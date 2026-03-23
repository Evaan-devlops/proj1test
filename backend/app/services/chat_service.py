from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, AsyncGenerator

from fastapi import HTTPException
from pydantic import BaseModel

from app.chat.tool_catalog import AwsToolDefinition, build_tool_catalog_prompt, get_aws_tool_catalog
from app.core.config import settings
from app.schemas.aws import (
    AwsAccountsRequest,
    BudgetRequest,
    CostBreakdownRequest,
    Ec2IdleRequest,
    ResourceCostRequest,
)
from app.schemas.chat import (
    ChatMessageDto,
    ChatStreamRequest,
    RerunStreamRequest,
    StreamDeltaEvent,
    StreamErrorEvent,
    StreamFinalEvent,
    StreamStartEvent,
)
from app.services.archive_service import ApiResponseArchiveService
from app.services.aws_service import AwsInsightsService
from app.services.chat_store_service import ChatLastToolContext, ChatStoreService
from app.services.llm_service import LlmService


DEFAULT_COST_DAYS = 180
DEFAULT_TOP_N = 5
DEFAULT_IDLE_DAYS = 14
DAY_RANGE_PATTERN = re.compile(r"(?:last|past)\s+(\d+)\s+day")
WEEK_RANGE_PATTERN = re.compile(r"(?:last|past)\s+(\d+)\s+week")
MONTH_RANGE_PATTERN = re.compile(r"(?:last|past)\s+(\d+)\s+month")
TOP_N_PATTERN = re.compile(r"top\s+(\d+)")
QUOTED_TEXT_PATTERN = re.compile(r'"([^"]+)"')
BUDGET_NAME_PATTERN = re.compile(r"budget\s+(?:named|name)\s+([A-Za-z0-9._-]+)", re.IGNORECASE)
RESOURCE_ID_PATTERN = re.compile(r"\b(?:i|vol|eni|subnet|sg)-[A-Za-z0-9]+\b")
INSTANCE_ID_PATTERN = re.compile(r"\bi-[A-Za-z0-9]+\b")
IDLE_DAYS_PATTERN = re.compile(r"idle\s+for\s+(\d+)\s+day")


@dataclass(frozen=True)
class RouteDecision:
    tool: AwsToolDefinition | None
    reason: str
    needs_follow_up: bool = False
    follow_up_message: str | None = None


@dataclass(frozen=True)
class QueryContext:
    account_keys: list[str] | None
    days: int
    top_n: int
    budget_name: str | None
    resource_id: str | None
    instance_ids: list[str]
    idle_days: int


@dataclass(frozen=True)
class SessionReuseDecision:
    reuse_existing_result: bool
    tool: AwsToolDefinition | None = None
    live_result: dict[str, Any] | None = None
    recorded_at_utc: str | None = None
    reason: str | None = None


class ChatService:
    def __init__(
        self,
        *,
        chat_store: ChatStoreService,
        aws_service: AwsInsightsService,
        llm_service: LlmService,
        archive_service: ApiResponseArchiveService | None = None,
    ) -> None:
        self.chat_store = chat_store
        self.aws_service = aws_service
        self.llm_service = llm_service
        self.archive_service = archive_service or ApiResponseArchiveService()
        self.tool_catalog = get_aws_tool_catalog()
        self._tool_by_name_map = {tool.tool_name: tool for tool in self.tool_catalog}
        self.available_account_keys = tuple(settings.get_aws_accounts().keys())
        self._tool_executor_map = {
            "accounts": self._execute_accounts_tool,
            "cost_breakdown": self._execute_cost_breakdown_tool,
            "total_cost": self._execute_total_cost_tool,
            "service_costs": self._execute_service_costs_tool,
            "trends_forecast": self._execute_trends_forecast_tool,
            "budget": self._execute_budget_tool,
            "resource_cost": self._execute_resource_cost_tool,
            "ec2_idle_check": self._execute_ec2_idle_check_tool,
        }

    def stream_new_message(
        self,
        *,
        chat_id: str,
        payload: ChatStreamRequest,
    ) -> AsyncGenerator[str, None]:
        user_message, assistant_message = self.chat_store.add_turn(
            chat_id=chat_id,
            user_text=payload.user_text.strip(),
            chat_title_hint=self._chat_title_from_text(payload.user_text),
        )
        return self._stream_answer(
            chat_id=chat_id,
            user_message=user_message,
            assistant_message=assistant_message,
            query_text=payload.user_text.strip(),
            selected_account_keys=payload.selected_account_keys,
        )

    def stream_rerun_message(
        self,
        *,
        chat_id: str,
        user_message_id: str,
        payload: RerunStreamRequest,
    ) -> AsyncGenerator[str, None]:
        user_message, assistant_message = self.chat_store.rerun_turn(
            chat_id=chat_id,
            user_message_id=user_message_id,
            new_user_text=payload.new_user_text.strip(),
        )
        return self._stream_answer(
            chat_id=chat_id,
            user_message=user_message,
            assistant_message=assistant_message,
            query_text=payload.new_user_text.strip(),
            selected_account_keys=payload.selected_account_keys,
        )

    async def _stream_answer(
        self,
        *,
        chat_id: str,
        user_message: ChatMessageDto,
        assistant_message: ChatMessageDto,
        query_text: str,
        selected_account_keys: list[str] | None,
    ) -> AsyncGenerator[str, None]:
        try:
            yield self._sse_event(
                StreamStartEvent(
                    userMessage=user_message,
                    assistantMessage=assistant_message,
                )
            )

            yield self._sse_event(
                StreamDeltaEvent(
                    messageId=assistant_message.id,
                    text="Checking recent AWS data and selecting the best backend tool...\n\n",
                )
            )

            query_context = self._extract_query_context(
                query_text=query_text,
                selected_account_keys=selected_account_keys,
            )
            conversation_context = self.chat_store.get_conversation_context(
                chat_id=chat_id,
                upto_message_id=user_message.id,
            ).render_for_prompt(char_limit=settings.chat_context_prompt_char_limit)
            last_tool_context = self.chat_store.get_last_tool_context(chat_id=chat_id)
            session_reuse = self._decide_session_reuse(
                query_text=query_text,
                query_context=query_context,
                last_tool_context=last_tool_context,
            )

            if session_reuse.reuse_existing_result and session_reuse.tool is not None and session_reuse.live_result is not None:
                yield self._sse_event(
                    StreamDeltaEvent(
                        messageId=assistant_message.id,
                        text="Answering from the latest session dataset. No new AWS refresh is needed for this follow-up.\n\n",
                    )
                )
                final_text = await self._compose_reused_answer(
                    query_text=query_text,
                    tool=session_reuse.tool,
                    conversation_context=conversation_context,
                    recorded_at_utc=session_reuse.recorded_at_utc,
                    live_result=session_reuse.live_result,
                )
                self.chat_store.update_assistant_message(
                    chat_id=chat_id,
                    assistant_message_id=assistant_message.id,
                    text=final_text,
                    status="final",
                )
                yield self._sse_event(
                    StreamFinalEvent(
                        messageId=assistant_message.id,
                        fullText=final_text,
                    )
                )
                return

            route_decision = await self._decide_route(
                query_text,
                query_context,
                conversation_context,
                last_tool_context=last_tool_context,
            )

            if route_decision.needs_follow_up:
                final_text = route_decision.follow_up_message or "Please clarify your request."
                self.chat_store.update_assistant_message(
                    chat_id=chat_id,
                    assistant_message_id=assistant_message.id,
                    text=final_text,
                    status="final",
                )
                yield self._sse_event(
                    StreamFinalEvent(
                        messageId=assistant_message.id,
                        fullText=final_text,
                    )
                )
                return

            if route_decision.tool is None:
                final_text = (
                    "I could not determine which AWS backend API to use for that request. "
                    "Try asking about total cost, top costly services, trends, budget, resource cost, or idle EC2 instances."
                )
                self.chat_store.update_assistant_message(
                    chat_id=chat_id,
                    assistant_message_id=assistant_message.id,
                    text=final_text,
                    status="final",
                )
                yield self._sse_event(
                    StreamFinalEvent(
                        messageId=assistant_message.id,
                        fullText=final_text,
                    )
                )
                return

            cached_record = self._find_recent_cached_record(
                endpoint=route_decision.tool.endpoint,
                query_context=query_context,
            )
            if cached_record is not None:
                yield self._sse_event(
                    StreamDeltaEvent(
                        messageId=assistant_message.id,
                        text=self._build_cached_preview(
                            tool=route_decision.tool,
                            query_text=query_text,
                            cached_record=cached_record,
                        )
                        + "\n\nRefreshing with live AWS data...\n\n",
                    )
                )
            else:
                yield self._sse_event(
                    StreamDeltaEvent(
                        messageId=assistant_message.id,
                        text="No recent cached record matched this request. Fetching live AWS data...\n\n",
                    )
                )

            try:
                live_result = await self._execute_tool(
                    tool=route_decision.tool,
                    query_context=query_context,
                )
            except Exception as exc:
                if cached_record is None:
                    raise
                final_text = self._build_cached_fallback_after_live_failure(
                    tool=route_decision.tool,
                    query_text=query_text,
                    cached_record=cached_record,
                    exc=exc,
                )
                self.chat_store.update_assistant_message(
                    chat_id=chat_id,
                    assistant_message_id=assistant_message.id,
                    text=final_text,
                    status="final",
                )
                yield self._sse_event(
                    StreamFinalEvent(
                        messageId=assistant_message.id,
                        fullText=final_text,
                    )
                )
                return

            normalized_live_result = self._normalize_json_payload(live_result)
            request_payload = self._build_request_payload(tool=route_decision.tool, query_context=query_context)
            archive_record = self._archive_live_result(
                tool=route_decision.tool,
                request_payload=request_payload,
                live_result=normalized_live_result,
            )
            final_text = await self._compose_final_answer(
                query_text=query_text,
                tool=route_decision.tool,
                query_context=query_context,
                conversation_context=conversation_context,
                cached_record=cached_record,
                live_result=normalized_live_result,
            )
            self.chat_store.finalize_assistant_response(
                chat_id=chat_id,
                assistant_message_id=assistant_message.id,
                text=final_text,
                status="final",
                tool_name=route_decision.tool.tool_name,
                endpoint=route_decision.tool.endpoint,
                request_payload=request_payload,
                live_result=normalized_live_result,
                recorded_at_utc=archive_record.get("recorded_at_utc") if isinstance(archive_record, dict) else None,
            )
            yield self._sse_event(
                StreamFinalEvent(
                    messageId=assistant_message.id,
                    fullText=final_text,
                )
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            error_message = self._user_safe_error_message(exc)
            self.chat_store.mark_assistant_error(
                chat_id=chat_id,
                assistant_message_id=assistant_message.id,
                error_text=error_message,
            )
            yield self._sse_event(StreamErrorEvent(message=error_message))

    async def _decide_route(
        self,
        query_text: str,
        query_context: QueryContext,
        conversation_context: str,
        last_tool_context: ChatLastToolContext | None = None,
    ) -> RouteDecision:
        lowered_query = query_text.lower()

        if "account" in lowered_query and any(
            phrase in lowered_query
            for phrase in ("which account", "available account", "list account", "configured account")
        ):
            return RouteDecision(tool=self._tool_by_name("accounts"), reason="matched account listing rule")

        route_from_rules = self._route_from_rules(lowered_query)
        if route_from_rules is not None:
            follow_up = self._follow_up_if_missing(route_from_rules, query_context)
            if follow_up:
                return RouteDecision(
                    tool=route_from_rules,
                    reason="matched deterministic routing rule",
                    needs_follow_up=True,
                    follow_up_message=follow_up,
                )
            return RouteDecision(tool=route_from_rules, reason="matched deterministic routing rule")

        if last_tool_context is not None and self._looks_like_follow_up(query_text):
            fallback_tool = self._tool_by_name(last_tool_context.tool_name)
            if fallback_tool is not None:
                follow_up = self._follow_up_if_missing(fallback_tool, query_context)
                if follow_up:
                    return RouteDecision(
                        tool=fallback_tool,
                        reason="used previous tool for follow-up but more input is required",
                        needs_follow_up=True,
                        follow_up_message=follow_up,
                    )
                return RouteDecision(tool=fallback_tool, reason="reused previous tool for follow-up routing")

        try:
            planner_answer, _ = await self.llm_service.generate_text(
                self._planner_prompt(
                    query_text=query_text,
                    conversation_context=conversation_context,
                )
            )
            tool = self._tool_by_name(planner_answer.strip().splitlines()[0].strip().lower())
            if tool is None:
                return RouteDecision(tool=None, reason="LLM planner returned unknown tool")
            follow_up = self._follow_up_if_missing(tool, query_context)
            if follow_up:
                return RouteDecision(
                    tool=tool,
                    reason="LLM planner selected tool but more input is required",
                    needs_follow_up=True,
                    follow_up_message=follow_up,
                )
            return RouteDecision(tool=tool, reason="LLM planner selected tool")
        except Exception:
            return RouteDecision(tool=None, reason="routing fallback failed")

    def _route_from_rules(self, lowered_query: str) -> AwsToolDefinition | None:
        scored_tools: list[tuple[int, AwsToolDefinition]] = []
        for tool in self.tool_catalog:
            score = sum(1 for phrase in tool.trigger_phrases if phrase in lowered_query)
            if tool.tool_name == "resource_cost" and self._extract_resource_id(lowered_query):
                score += 2
            if tool.tool_name == "ec2_idle_check" and self._extract_instance_ids(lowered_query):
                score += 2
            if score > 0:
                scored_tools.append((score, tool))

        if not scored_tools:
            return None
        scored_tools.sort(key=lambda item: item[0], reverse=True)
        return scored_tools[0][1]

    async def _execute_tool(
        self,
        *,
        tool: AwsToolDefinition,
        query_context: QueryContext,
    ) -> dict[str, Any]:
        executor = self._tool_executor_map.get(tool.tool_name)
        if executor is None:
            raise HTTPException(status_code=400, detail=f"Unsupported tool: {tool.tool_name}")
        return await executor(query_context)

    async def _execute_accounts_tool(self, query_context: QueryContext) -> dict[str, Any]:
        del query_context
        accounts = self.aws_service.list_accounts()
        return {"accounts": [account.model_dump() for account in accounts]}

    async def _execute_cost_breakdown_tool(self, query_context: QueryContext) -> dict[str, Any]:
        return await self.aws_service.get_cost_breakdown(
            CostBreakdownRequest(
                account_keys=query_context.account_keys,
                days=query_context.days,
                top_n=query_context.top_n,
            )
        )

    async def _execute_total_cost_tool(self, query_context: QueryContext) -> dict[str, Any]:
        return await self.aws_service.get_total_cost(
            AwsAccountsRequest(
                account_keys=query_context.account_keys,
                days=query_context.days,
            )
        )

    async def _execute_service_costs_tool(self, query_context: QueryContext) -> dict[str, Any]:
        return await self.aws_service.get_service_costs(
            AwsAccountsRequest(
                account_keys=query_context.account_keys,
                days=query_context.days,
            )
        )

    async def _execute_trends_forecast_tool(self, query_context: QueryContext) -> dict[str, Any]:
        return await self.aws_service.get_trends_and_forecast(
            AwsAccountsRequest(
                account_keys=query_context.account_keys,
                days=query_context.days,
            )
        )

    async def _execute_budget_tool(self, query_context: QueryContext) -> dict[str, Any]:
        return await self.aws_service.get_budget(
            BudgetRequest(
                account_keys=query_context.account_keys,
                days=query_context.days,
                budget_name=query_context.budget_name or "",
            )
        )

    async def _execute_resource_cost_tool(self, query_context: QueryContext) -> dict[str, Any]:
        return await self.aws_service.get_resource_cost(
            ResourceCostRequest(
                account_keys=query_context.account_keys,
                days=query_context.days,
                resource_id=query_context.resource_id or "",
            )
        )

    async def _execute_ec2_idle_check_tool(self, query_context: QueryContext) -> dict[str, Any]:
        return await self.aws_service.get_ec2_idle_status(
            Ec2IdleRequest(
                account_keys=query_context.account_keys,
                days=query_context.days,
                instance_ids=query_context.instance_ids,
                idle_days=query_context.idle_days,
            )
        )

    async def _compose_final_answer(
        self,
        *,
        query_text: str,
        tool: AwsToolDefinition,
        query_context: QueryContext,
        conversation_context: str,
        cached_record: dict[str, Any] | None,
        live_result: dict[str, Any],
    ) -> str:
        prompt = (
            "You are answering questions about AWS analytics.\n"
            "Use the live result as the source of truth. If cached data is present, mention it briefly only when useful.\n"
            "Be concise, practical, and clear.\n\n"
            f"Conversation context:\n{conversation_context or 'No earlier conversation context.'}\n\n"
            f"User question:\n{query_text}\n\n"
            f"Context:\n{self._build_answer_context(tool=tool, query_context=query_context, cached_record=cached_record, live_result=live_result)}\n"
        )
        try:
            answer, _ = await self.llm_service.generate_text(prompt)
            return answer
        except Exception:
            return self._deterministic_answer(tool=tool, live_result=live_result)

    async def _compose_reused_answer(
        self,
        *,
        query_text: str,
        tool: AwsToolDefinition,
        conversation_context: str,
        recorded_at_utc: str | None,
        live_result: dict[str, Any],
    ) -> str:
        prompt = (
            "You are answering a follow-up question about AWS analytics.\n"
            "Do not request fresh AWS data. Use only the latest session dataset below.\n"
            "Be concise, practical, and clear.\n\n"
            f"Conversation context:\n{conversation_context or 'No earlier conversation context.'}\n\n"
            f"Latest session dataset recorded at: {recorded_at_utc or 'unknown time'}\n"
            f"Tool used for that dataset: {tool.tool_name}\n"
            f"User question:\n{query_text}\n\n"
            f"Session dataset JSON:\n{json.dumps(live_result, ensure_ascii=True)}\n"
        )
        try:
            answer, _ = await self.llm_service.generate_text(prompt)
            return answer
        except Exception:
            return (
                f"Using the latest session dataset from {recorded_at_utc or 'the most recent refresh'}, "
                f"{self._deterministic_answer(tool=tool, live_result=live_result)}"
            )

    def _deterministic_answer(self, *, tool: AwsToolDefinition, live_result: dict[str, Any]) -> str:
        if tool.tool_name == "accounts":
            accounts = live_result.get("accounts", [])
            if not accounts:
                return "No configured AWS accounts were found."
            formatted = ", ".join(
                f"{item.get('account_key')} ({item.get('account_id')})"
                for item in accounts
            )
            return f"Configured AWS accounts: {formatted}."

        succeeded_accounts = live_result.get("succeeded_accounts", [])
        failed_accounts = live_result.get("failed_accounts", [])
        if not succeeded_accounts and failed_accounts:
            first_failure = failed_accounts[0]
            return (
                f"The request failed for {first_failure.get('account_key')}: "
                f"{first_failure.get('error')}."
            )
        if not succeeded_accounts:
            return "No successful data was returned from AWS."

        first_account = succeeded_accounts[0]
        account_key = first_account.get("account_key")
        data = first_account.get("data", {})

        if tool.tool_name == "cost_breakdown":
            breakdown = data.get("breakdown", [])
            top_services = ", ".join(
                f"{item.get('service')} ({item.get('cost')})"
                for item in breakdown[:3]
            )
            return (
                f"For account {account_key}, total cost is {data.get('total_cost')}. "
                f"Top services: {top_services or 'none'}."
            )

        if tool.tool_name == "total_cost":
            return f"For account {account_key}, total cost is {data.get('total_cost')}."

        if tool.tool_name == "service_costs":
            service_costs = data.get("service_costs", {})
            top_services = sorted(service_costs.items(), key=lambda item: item[1], reverse=True)[:3]
            formatted = ", ".join(f"{name} ({cost})" for name, cost in top_services)
            return f"For account {account_key}, the largest services are {formatted or 'none'}."

        if tool.tool_name == "trends_forecast":
            actual = data.get("actual", [])
            latest_actual = actual[-1] if actual else {}
            return (
                f"For account {account_key}, the latest actual month is {latest_actual.get('month')} "
                f"with cost {latest_actual.get('cost')}."
            )

        if tool.tool_name == "budget":
            return (
                f"For account {account_key}, budget {data.get('budget_name')} is at "
                f"{data.get('utilization_pct')}% utilization."
            )

        if tool.tool_name == "resource_cost":
            return (
                f"For account {account_key}, resource {data.get('resource_id')} "
                f"cost is {data.get('total_cost')}."
            )

        if tool.tool_name == "ec2_idle_check":
            instances = data.get("instances", [])
            idle_instances = [item.get("instance_id") for item in instances if item.get("idle")]
            return (
                f"For account {account_key}, idle EC2 instances: "
                f"{', '.join(idle_instances) if idle_instances else 'none'}."
            )

        return json.dumps(live_result, ensure_ascii=True)

    def _build_answer_context(
        self,
        *,
        tool: AwsToolDefinition,
        query_context: QueryContext,
        cached_record: dict[str, Any] | None,
        live_result: dict[str, Any],
    ) -> str:
        parts = [
            f"Tool used: {tool.tool_name}",
            f"Requested account keys: {query_context.account_keys or 'all configured accounts'}",
            f"Live result JSON: {json.dumps(live_result, ensure_ascii=True)}",
        ]
        if cached_record is not None:
            parts.append(f"Cached record JSON: {json.dumps(cached_record, ensure_ascii=True)}")
        return "\n".join(parts)

    def _find_recent_cached_record(
        self,
        *,
        endpoint: str,
        query_context: QueryContext,
    ) -> dict[str, Any] | None:
        records = self.archive_service.list_recent_records(endpoint=endpoint, limit=2)
        requested_account_keys = set(query_context.account_keys or [])
        for record in reversed(records):
            if requested_account_keys:
                record_accounts = set(record.get("requested_accounts", []))
                if record_accounts and record_accounts != requested_account_keys:
                    continue
            request_payload = record.get("request_payload", {})
            if "days" in request_payload and request_payload.get("days") != query_context.days:
                continue
            if "top_n" in request_payload and request_payload.get("top_n") != query_context.top_n:
                continue
            if "budget_name" in request_payload and request_payload.get("budget_name") != query_context.budget_name:
                continue
            if "resource_id" in request_payload and request_payload.get("resource_id") != query_context.resource_id:
                continue
            if "idle_days" in request_payload and request_payload.get("idle_days") != query_context.idle_days:
                continue
            if "instance_ids" in request_payload:
                record_instance_ids = request_payload.get("instance_ids") or []
                if record_instance_ids != query_context.instance_ids:
                    continue
            return record
        return None

    def _build_cached_preview(
        self,
        *,
        tool: AwsToolDefinition,
        query_text: str,
        cached_record: dict[str, Any],
    ) -> str:
        recorded_at = cached_record.get("recorded_at_utc", "unknown time")
        preview = self._cached_record_summary_text(cached_record)
        return (
            f"Using recent archived data for `{tool.endpoint}` from {recorded_at} while live AWS data is refreshing.\n"
            f"Question: {query_text}\n"
            f"Archived answer: {preview}"
        )

    def _build_cached_fallback_after_live_failure(
        self,
        *,
        tool: AwsToolDefinition,
        query_text: str,
        cached_record: dict[str, Any],
        exc: Exception,
    ) -> str:
        recorded_at = cached_record.get("recorded_at_utc", "unknown time")
        archived_answer = self._cached_record_summary_text(cached_record)
        return (
            f"{archived_answer}\n\n"
            f"Live refresh for `{tool.endpoint}` failed, so this response is based on archived data from {recorded_at}.\n"
            f"Original question: {query_text}\n"
            f"Live refresh error: {self._user_safe_error_message(exc)}"
        )

    def _cached_record_summary_text(self, cached_record: dict[str, Any]) -> str:
        account_results = cached_record.get("account_results", [])
        summaries = [
            item.get("summary_text")
            for item in account_results
            if isinstance(item, dict) and isinstance(item.get("summary_text"), str)
        ]
        if summaries:
            return " ".join(summaries[:3])
        return "No archived summary available."

    def _decide_session_reuse(
        self,
        *,
        query_text: str,
        query_context: QueryContext,
        last_tool_context: ChatLastToolContext | None,
    ) -> SessionReuseDecision:
        if last_tool_context is None:
            return SessionReuseDecision(reuse_existing_result=False, reason="no previous tool context")

        previous_tool = self._tool_by_name(last_tool_context.tool_name)
        if previous_tool is None:
            return SessionReuseDecision(reuse_existing_result=False, reason="previous tool no longer exists")

        if self._explicit_refresh_requested(query_text):
            return SessionReuseDecision(reuse_existing_result=False, reason="user requested refresh")

        explicit_route = self._route_from_rules(query_text.lower())
        if explicit_route is not None and explicit_route.tool_name != previous_tool.tool_name:
            return SessionReuseDecision(reuse_existing_result=False, reason="query asks for a different tool")

        if self._requires_scope_refresh(
            query_text=query_text,
            query_context=query_context,
            last_tool_context=last_tool_context,
        ):
            return SessionReuseDecision(reuse_existing_result=False, reason="query changes data scope")

        if not self._looks_like_follow_up(query_text):
            return SessionReuseDecision(reuse_existing_result=False, reason="not a follow-up style question")

        return SessionReuseDecision(
            reuse_existing_result=True,
            tool=previous_tool,
            live_result=self._normalize_json_payload(last_tool_context.live_result),
            recorded_at_utc=last_tool_context.recorded_at_utc,
            reason="answer from latest session dataset",
        )

    def _requires_scope_refresh(
        self,
        *,
        query_text: str,
        query_context: QueryContext,
        last_tool_context: ChatLastToolContext,
    ) -> bool:
        request_payload = last_tool_context.request_payload
        if self._query_mentions_time_range(query_text) and request_payload.get("days") != query_context.days:
            return True
        if self._query_mentions_top_n(query_text) and request_payload.get("top_n") != query_context.top_n:
            return True
        if self._query_mentions_budget_name(query_text) and request_payload.get("budget_name") != query_context.budget_name:
            return True
        if self._query_mentions_resource_id(query_text) and request_payload.get("resource_id") != query_context.resource_id:
            return True
        if self._query_mentions_instance_ids(query_text) and request_payload.get("instance_ids") != query_context.instance_ids:
            return True
        if self._query_mentions_idle_days(query_text) and request_payload.get("idle_days") != query_context.idle_days:
            return True

        current_accounts = query_context.account_keys or []
        last_accounts_raw = request_payload.get("account_keys")
        last_accounts = [
            item
            for item in last_accounts_raw
            if isinstance(item, str)
        ] if isinstance(last_accounts_raw, list) else []
        if current_accounts and last_accounts and not set(current_accounts).issubset(set(last_accounts)):
            return True
        return False

    def _query_mentions_time_range(self, query_text: str) -> bool:
        lowered = query_text.lower()
        return bool(
            DAY_RANGE_PATTERN.search(lowered)
            or WEEK_RANGE_PATTERN.search(lowered)
            or MONTH_RANGE_PATTERN.search(lowered)
            or "today" in lowered
        )

    def _query_mentions_top_n(self, query_text: str) -> bool:
        return bool(TOP_N_PATTERN.search(query_text.lower()))

    def _query_mentions_budget_name(self, query_text: str) -> bool:
        return self._extract_budget_name(query_text) is not None

    def _query_mentions_resource_id(self, query_text: str) -> bool:
        return self._extract_resource_id(query_text) is not None

    def _query_mentions_instance_ids(self, query_text: str) -> bool:
        return bool(self._extract_instance_ids(query_text))

    def _query_mentions_idle_days(self, query_text: str) -> bool:
        return bool(IDLE_DAYS_PATTERN.search(query_text.lower()))

    def _explicit_refresh_requested(self, query_text: str) -> bool:
        lowered = query_text.lower()
        return any(
            phrase in lowered
            for phrase in ("refresh", "recheck", "latest now", "current now", "run again", "fetch again")
        )

    def _looks_like_follow_up(self, query_text: str) -> bool:
        lowered = query_text.lower().strip()
        if len(lowered.split()) <= 12:
            return True
        return any(
            phrase in lowered
            for phrase in (
                "what about",
                "how about",
                "and for",
                "compare",
                "summarize",
                "explain",
                "why",
                "which",
                "show only",
                "from that",
                "from this",
            )
        )

    def _normalize_json_payload(self, value: Any) -> Any:
        if isinstance(value, BaseModel):
            return value.model_dump()
        if isinstance(value, dict):
            return {
                str(key): self._normalize_json_payload(item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [self._normalize_json_payload(item) for item in value]
        if isinstance(value, tuple):
            return [self._normalize_json_payload(item) for item in value]
        return value

    def _archive_live_result(
        self,
        *,
        tool: AwsToolDefinition,
        request_payload: dict[str, Any],
        live_result: dict[str, Any],
    ) -> dict[str, Any]:
        return self.archive_service.append_record(
            endpoint=tool.endpoint,
            request_payload=request_payload,
            response_payload=live_result,
        )

    def _build_request_payload(
        self,
        *,
        tool: AwsToolDefinition,
        query_context: QueryContext,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if query_context.account_keys is not None:
            payload["account_keys"] = query_context.account_keys
        if "days" in tool.required_inputs or "days" in tool.optional_inputs:
            payload["days"] = query_context.days
        if "top_n" in tool.optional_inputs:
            payload["top_n"] = query_context.top_n
        if "budget_name" in tool.required_inputs or "budget_name" in tool.optional_inputs:
            payload["budget_name"] = query_context.budget_name
        if "resource_id" in tool.required_inputs or "resource_id" in tool.optional_inputs:
            payload["resource_id"] = query_context.resource_id
        if "instance_ids" in tool.required_inputs or "instance_ids" in tool.optional_inputs:
            payload["instance_ids"] = query_context.instance_ids
        if "idle_days" in tool.optional_inputs:
            payload["idle_days"] = query_context.idle_days
        return payload

    def _extract_query_context(
        self,
        *,
        query_text: str,
        selected_account_keys: list[str] | None,
    ) -> QueryContext:
        lowered_query = query_text.lower()
        return QueryContext(
            account_keys=self._resolve_account_keys(lowered_query, selected_account_keys),
            days=self._extract_days(lowered_query),
            top_n=self._extract_top_n(lowered_query),
            budget_name=self._extract_budget_name(query_text),
            resource_id=self._extract_resource_id(query_text),
            instance_ids=self._extract_instance_ids(query_text),
            idle_days=self._extract_idle_days(lowered_query),
        )

    def _resolve_account_keys(
        self,
        lowered_query: str,
        selected_account_keys: list[str] | None,
    ) -> list[str] | None:
        matched_accounts = [
            account_key
            for account_key in self.available_account_keys
            if account_key.lower() in lowered_query
        ]
        if matched_accounts:
            return matched_accounts
        if selected_account_keys:
            return selected_account_keys
        return None

    def _extract_days(self, lowered_query: str) -> int:
        day_match = DAY_RANGE_PATTERN.search(lowered_query)
        if day_match:
            return max(1, int(day_match.group(1)))
        week_match = WEEK_RANGE_PATTERN.search(lowered_query)
        if week_match:
            return max(1, int(week_match.group(1)) * 7)
        month_match = MONTH_RANGE_PATTERN.search(lowered_query)
        if month_match:
            return max(1, int(month_match.group(1)) * 30)
        if "today" in lowered_query:
            return 1
        return DEFAULT_COST_DAYS

    def _extract_top_n(self, lowered_query: str) -> int:
        match = TOP_N_PATTERN.search(lowered_query)
        if not match:
            return DEFAULT_TOP_N
        return max(1, min(50, int(match.group(1))))

    def _extract_budget_name(self, query_text: str) -> str | None:
        quoted_match = QUOTED_TEXT_PATTERN.search(query_text)
        if quoted_match:
            return quoted_match.group(1).strip()
        named_match = BUDGET_NAME_PATTERN.search(query_text)
        if named_match:
            return named_match.group(1).strip()
        return None

    def _extract_resource_id(self, query_text: str) -> str | None:
        resource_match = RESOURCE_ID_PATTERN.search(query_text)
        if resource_match:
            return resource_match.group(0)
        return None

    def _extract_instance_ids(self, query_text: str) -> list[str]:
        return INSTANCE_ID_PATTERN.findall(query_text)

    def _extract_idle_days(self, lowered_query: str) -> int:
        idle_match = IDLE_DAYS_PATTERN.search(lowered_query)
        if idle_match:
            return max(1, int(idle_match.group(1)))
        return DEFAULT_IDLE_DAYS

    def _follow_up_if_missing(
        self,
        tool: AwsToolDefinition,
        query_context: QueryContext,
    ) -> str | None:
        if tool.tool_name == "budget" and not query_context.budget_name:
            return "Please provide the AWS budget name you want me to check."
        if tool.tool_name == "resource_cost" and not query_context.resource_id:
            return "Please provide the AWS resource id you want me to inspect."
        if tool.tool_name == "ec2_idle_check" and not query_context.instance_ids:
            return "Please provide one or more EC2 instance ids for the idle check."
        return None

    def _planner_prompt(self, *, query_text: str, conversation_context: str) -> str:
        return (
            "Choose exactly one AWS tool name for the user request.\n"
            "Return only the tool_name and nothing else.\n\n"
            f"{build_tool_catalog_prompt()}\n\n"
            f"Conversation context:\n{conversation_context or 'No earlier conversation context.'}\n\n"
            f"User request:\n{query_text}\n"
        )

    def _tool_by_name(self, tool_name: str) -> AwsToolDefinition | None:
        return self._tool_by_name_map.get(tool_name.strip().lower())

    def _chat_title_from_text(self, text: str) -> str:
        return " ".join(text.strip().split()[:4]) or "New chat"

    def _sse_event(self, event: Any) -> str:
        return f"data: {json.dumps(event.model_dump(by_alias=True), ensure_ascii=True)}\n\n"

    def _user_safe_error_message(self, exc: Exception) -> str:
        if isinstance(exc, HTTPException):
            detail = exc.detail
            if isinstance(detail, dict):
                return str(detail.get("message") or detail.get("detail") or "Request failed.")
            if isinstance(detail, str):
                return detail
        return f"Unable to process the chat request: {exc}"
