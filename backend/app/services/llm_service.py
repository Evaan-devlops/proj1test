from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.schemas.llm import (
    LlmAnswerRequest,
    LlmAnswerResponse,
    LlmHealthCheckResponse,
)


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TokenPayload:
    access_token: str
    expires_at: datetime | None
    token_type: str | None = None
    provider_status_code: int | None = None


class LlmService:
    def __init__(self) -> None:
        self._token_payload: TokenPayload | None = None
        self._token_lock = asyncio.Lock()

    async def answer_question(self, payload: LlmAnswerRequest) -> LlmAnswerResponse:
        self._validate_settings()

        prompt = self._build_prompt(query=payload.query, context=payload.context)
        answer, provider_request_id = await self.generate_text(prompt)

        return LlmAnswerResponse(
            answer=answer,
            prompt=prompt,
            engine=settings.vessel_openai_engine,
            provider_request_id=provider_request_id,
        )

    async def generate_text(self, prompt: str) -> tuple[str, str | None]:
        self._validate_settings()
        token_payload = await self._get_token_payload()
        provider_response = await self._call_llm(
            prompt=prompt,
            token=token_payload.access_token,
        )
        answer = self._extract_answer(provider_response["body"])

        if not answer:
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "llm_call",
                    "message": (
                        "LLM call succeeded but the response did not contain a readable answer "
                        "in the expected OpenAI-compatible format."
                    ),
                    "provider_status_code": provider_response["status_code"],
                },
            )

        return answer, provider_response["request_id"]

    async def health_check(self) -> LlmHealthCheckResponse:
        self._validate_settings()

        token_payload = await self._get_token_payload()

        prompt = "Reply with HEALTHCHECK_OK only."
        provider_response = await self._call_llm(
            prompt=prompt,
            token=token_payload.access_token,
        )
        answer = self._extract_answer(provider_response["body"])

        if not answer:
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "llm_call",
                    "message": (
                        "LLM health-check succeeded at the HTTP layer but the response did not "
                        "contain a readable answer in the expected OpenAI-compatible format."
                    ),
                    "provider_status_code": provider_response["status_code"],
                },
            )

        return LlmHealthCheckResponse(
            status="ok",
            message="Token generation and downstream LLM call both succeeded.",
            access_token=token_payload.access_token,
            token_type=token_payload.token_type,
            expires_at=(
                token_payload.expires_at.isoformat()
                if token_payload.expires_at is not None
                else None
            ),
            token_provider_status_code=token_payload.provider_status_code or 200,
            llm_provider_status_code=provider_response["status_code"],
            engine=settings.vessel_openai_engine,
            llm_answer=answer,
            prompt=prompt,
            provider_request_id=provider_response["request_id"],
        )

    def _validate_settings(self) -> None:
        try:
            settings.validate_llm_settings()
        except RuntimeError as exc:
            raise HTTPException(
                status_code=500,
                detail={
                    "source": "configuration",
                    "message": str(exc),
                },
            ) from exc

    def _build_prompt(self, *, query: str, context: str) -> str:
        return (
            "Answer the question using the context below.\n\n"
            "Context:\n"
            f"{context}\n\n"
            "Question:\n"
            f"{query}\n\n"
            "Provide a concise answer.\n"
            "If you don't find the info in the context, do not guess.\n"
            "Say that the info is not found in the document."
        )

    async def _get_token_payload(self) -> TokenPayload:
        cached_token = self._token_payload
        if cached_token and self._is_token_valid(cached_token):
            return cached_token

        async with self._token_lock:
            cached_token = self._token_payload
            if cached_token and self._is_token_valid(cached_token):
                return cached_token

            response_body, status_code = await self._request_access_token()
            self._token_payload = self._build_token_payload(
                response_body=response_body,
                status_code=status_code,
            )
            return self._token_payload

    async def _request_access_token(self) -> tuple[dict[str, Any], int]:
        try:
            async with httpx.AsyncClient(
                timeout=settings.token_request_timeout_seconds
            ) as client:
                response = await client.post(
                    settings.token_url,
                    auth=(settings.vox_user, settings.vox_password),
                    headers={"Accept": "application/json"},
                    data=self._token_request_data(),
                )
                response.raise_for_status()
                return response.json(), response.status_code
        except httpx.TimeoutException as exc:
            logger.exception("Token generation timed out")
            raise HTTPException(
                status_code=504,
                detail={
                    "source": "token_generation",
                    "message": (
                        "Timed out while requesting the VOX access token. "
                        "Check TOKEN_URL connectivity and VOX credentials."
                    ),
                },
            ) from exc
        except httpx.HTTPStatusError as exc:
            logger.exception("Token generation failed with status %s", exc.response.status_code)
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "token_generation",
                    "message": (
                        "Token generation failed at the VOX OAuth endpoint. "
                        "Verify VOX_USER, VOX_PASSWORD, and TOKEN_URL."
                    ),
                    "provider_status_code": exc.response.status_code,
                    "provider_response": self._safe_error_body(exc.response),
                },
            ) from exc
        except ValueError as exc:
            logger.exception("Token endpoint returned invalid JSON")
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "token_generation",
                    "message": "Token endpoint returned a non-JSON response.",
                },
            ) from exc
        except httpx.HTTPError as exc:
            logger.exception("Token generation request failed")
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "token_generation",
                    "message": (
                        "Token generation request failed before a response was received. "
                        "Check TOKEN_URL connectivity."
                    ),
                },
            ) from exc

    async def _call_llm(self, *, prompt: str, token: str) -> dict[str, Any]:
        payload = self._build_llm_payload(prompt)
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(
                timeout=settings.llm_request_timeout_seconds
            ) as client:
                response = await client.post(
                    settings.vessel_openai_api,
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                return {
                    "body": response.json(),
                    "status_code": response.status_code,
                    "request_id": response.headers.get("x-request-id")
                    or response.headers.get("request-id")
                    or response.headers.get("x-correlation-id"),
                }
        except httpx.TimeoutException as exc:
            logger.exception("LLM request timed out")
            raise HTTPException(
                status_code=504,
                detail={
                    "source": "llm_call",
                    "message": (
                        "Timed out while calling the Vessel OpenAI API. "
                        "Check VESSEL_OPENAI_API availability."
                    ),
                },
            ) from exc
        except httpx.HTTPStatusError as exc:
            logger.exception("LLM request failed with status %s", exc.response.status_code)
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "llm_call",
                    "message": (
                        "The LLM gateway rejected the request. "
                        "Verify the OAuth token, engine, gateway URL, and payload mode "
                        "(chatCompletion vs completions)."
                    ),
                    "provider_status_code": exc.response.status_code,
                    "provider_response": self._safe_error_body(exc.response),
                },
            ) from exc
        except ValueError as exc:
            logger.exception("LLM endpoint returned invalid JSON")
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "llm_call",
                    "message": "The Vessel OpenAI API returned a non-JSON response.",
                },
            ) from exc
        except httpx.HTTPError as exc:
            logger.exception("LLM request failed before a response was received")
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "llm_call",
                    "message": (
                        "The Vessel OpenAI API request failed before a response was received. "
                        "Check VESSEL_OPENAI_API connectivity."
                    ),
                },
            ) from exc

    def _token_request_data(self) -> dict[str, str] | None:
        query = parse_qs(urlparse(settings.token_url).query)
        if query.get("grant_type"):
            return None
        return {"grant_type": "client_credentials"}

    def _build_token_payload(
        self,
        *,
        response_body: dict[str, Any],
        status_code: int,
    ) -> TokenPayload:
        access_token = response_body.get("access_token")
        if not isinstance(access_token, str) or not access_token.strip():
            raise HTTPException(
                status_code=502,
                detail={
                    "source": "token_generation",
                    "message": "Token endpoint response did not include a valid access_token.",
                    "provider_status_code": status_code,
                },
            )

        token_type = response_body.get("token_type")
        return TokenPayload(
            access_token=access_token.strip(),
            expires_at=self._resolve_expiry(response_body.get("expires_in")),
            token_type=token_type.strip() if isinstance(token_type, str) else None,
            provider_status_code=status_code,
        )

    def _resolve_expiry(self, expires_in: Any) -> datetime | None:
        if isinstance(expires_in, str):
            try:
                expires_in = float(expires_in)
            except ValueError:
                expires_in = None

        if isinstance(expires_in, int | float) and float(expires_in) > 0:
            return datetime.now(UTC) + timedelta(seconds=float(expires_in))

        return datetime.now(UTC) + timedelta(minutes=settings.token_cache_minutes)

    def _is_token_valid(self, token_payload: TokenPayload) -> bool:
        if token_payload.expires_at is None:
            return True
        return token_payload.expires_at > (datetime.now(UTC) + timedelta(seconds=60))

    def _extract_answer(self, response_body: dict[str, Any]) -> str:
        choices = response_body.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""

        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            return ""

        text = first_choice.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()

        message = first_choice.get("message")
        if not isinstance(message, dict):
            return ""

        content = message.get("content")
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            text_chunks = [
                item.get("text", "")
                for item in content
                if isinstance(item, dict) and isinstance(item.get("text"), str)
            ]
            return "\n".join(chunk.strip() for chunk in text_chunks if chunk.strip())

        return ""

    def _build_llm_payload(self, prompt: str) -> dict[str, Any]:
        payload = {
            "engine": settings.vessel_openai_engine,
            "temperature": settings.vessel_openai_temperature,
            "max_tokens": settings.vessel_openai_max_tokens,
        }

        if self._uses_chat_completions():
            payload["messages"] = [{"role": "user", "content": prompt}]
            return payload

        payload["prompt"] = prompt
        return payload

    def _uses_chat_completions(self) -> bool:
        llm_url = settings.vessel_openai_api.lower()
        return "chatcompletion" in llm_url or "chat/completions" in llm_url

    def _safe_error_body(self, response: httpx.Response) -> str:
        try:
            return response.text[:1000]
        except Exception:
            return "Unable to read provider response body."


@lru_cache(maxsize=1)
def get_llm_service() -> LlmService:
    return LlmService()
