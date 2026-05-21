from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Protocol

from app.chat.tool_catalog import AwsToolDefinition
from app.core.config import settings

try:  # Optional at runtime; FAISS is used when installed.
    import faiss  # type: ignore
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover - depends on local binary availability
    faiss = None
    np = None


TOKEN_PATTERN = re.compile(r"[a-z0-9][a-z0-9._:-]*")
SEMANTIC_VECTOR_DIM = 256


class QueryContextLike(Protocol):
    account_keys: list[str] | None
    budget_name: str | None
    resource_id: str | None
    instance_ids: list[str]
    cluster_names: list[str]
    service_filter: str | None


@dataclass(frozen=True)
class ToolRouteScore:
    tool: AwsToolDefinition
    final_score: float
    semantic_score: float
    deterministic_score: float
    entity_score: float

    def reason(self) -> str:
        return (
            "semantic router selected tool "
            f"(final={self.final_score:.3f}, semantic={self.semantic_score:.3f}, "
            f"trigger={self.deterministic_score:.3f}, entity={self.entity_score:.3f})"
        )


class ToolRoutingService:
    def __init__(
        self,
        *,
        tool_catalog: tuple[AwsToolDefinition, ...],
        index_path: str | Path | None = None,
    ) -> None:
        self.tool_catalog = tool_catalog
        self.index_path = settings.resolve_path(index_path or settings.tool_catalog_index_file)
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._entries = self._build_entries()
        self._vectors = [self._embed(entry["routing_text"]) for entry in self._entries]
        self._faiss_index = self._build_faiss_index(self._vectors)
        self._write_jsonl_index()

    def score_tools(self, query_text: str, query_context: QueryContextLike) -> list[ToolRouteScore]:
        lowered_query = query_text.lower()
        semantic_scores = self._semantic_scores(query_text)
        deterministic_scores = [
            self._deterministic_trigger_score(tool=tool, lowered_query=lowered_query)
            for tool in self.tool_catalog
        ]
        entity_scores = [
            self._entity_score(tool=tool, lowered_query=lowered_query, query_context=query_context)
            for tool in self.tool_catalog
        ]

        scores = [
            ToolRouteScore(
                tool=tool,
                final_score=(0.55 * semantic_scores[index]) + (0.25 * deterministic_scores[index]) + (0.20 * entity_scores[index]),
                semantic_score=semantic_scores[index],
                deterministic_score=deterministic_scores[index],
                entity_score=entity_scores[index],
            )
            for index, tool in enumerate(self.tool_catalog)
        ]
        return sorted(scores, key=lambda item: item.final_score, reverse=True)

    def select_tool(
        self,
        *,
        query_text: str,
        query_context: QueryContextLike,
        min_score: float = 0.18,
    ) -> ToolRouteScore | None:
        scores = self.score_tools(query_text, query_context)
        if not scores or scores[0].final_score < min_score:
            return None
        return scores[0]

    def _build_entries(self) -> list[dict[str, Any]]:
        entries = []
        for tool in self.tool_catalog:
            routing_text = " ".join(
                [
                    tool.tool_name.replace("_", " "),
                    tool.summary,
                    tool.use_when,
                    tool.response_shape,
                    " ".join(tool.required_inputs),
                    " ".join(tool.optional_inputs),
                    " ".join(tool.trigger_phrases),
                ]
            )
            entries.append(
                {
                    "schema_version": "2026-05-12",
                    "tool_name": tool.tool_name,
                    "endpoint": tool.endpoint,
                    "required_inputs": list(tool.required_inputs),
                    "optional_inputs": list(tool.optional_inputs),
                    "trigger_phrases": list(tool.trigger_phrases),
                    "routing_text": routing_text,
                }
            )
        return entries

    def _write_jsonl_index(self) -> None:
        with self._lock:
            temp_path = self.index_path.with_suffix(f"{self.index_path.suffix}.tmp")
            with temp_path.open("w", encoding="utf-8", newline="\n") as index_file:
                for entry, vector in zip(self._entries, self._vectors, strict=True):
                    record = dict(entry)
                    record["embedding"] = [round(value, 8) for value in vector]
                    index_file.write(json.dumps(record, ensure_ascii=True, separators=(",", ":"), sort_keys=True))
                    index_file.write("\n")
            Path(temp_path).replace(self.index_path)

    def _semantic_scores(self, query_text: str) -> list[float]:
        query_vector = self._embed(query_text)
        if self._faiss_index is not None and np is not None:
            query_array = np.array([query_vector], dtype="float32")
            distances, indexes = self._faiss_index.search(query_array, len(self._entries))
            scores = [0.0 for _ in self._entries]
            for distance, index in zip(distances[0], indexes[0], strict=False):
                if 0 <= int(index) < len(scores):
                    scores[int(index)] = max(0.0, min(1.0, float(distance)))
            return scores
        return [max(0.0, min(1.0, self._dot(query_vector, vector))) for vector in self._vectors]

    def _build_faiss_index(self, vectors: list[list[float]]) -> Any | None:
        if faiss is None or np is None or not vectors:
            return None
        vector_array = np.array(vectors, dtype="float32")
        index = faiss.IndexFlatIP(SEMANTIC_VECTOR_DIM)
        index.add(vector_array)
        return index

    def _embed(self, text: str) -> list[float]:
        vector = [0.0 for _ in range(SEMANTIC_VECTOR_DIM)]
        tokens = TOKEN_PATTERN.findall(text.lower())
        for token in tokens:
            self._add_token(vector, token, 1.0)
            parts = [part for part in re.split(r"[._:-]+", token) if part]
            for part in parts:
                self._add_token(vector, part, 0.65)
            for index in range(max(0, len(token) - 2)):
                self._add_token(vector, token[index : index + 3], 0.25)
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [value / norm for value in vector]

    def _add_token(self, vector: list[float], token: str, weight: float) -> None:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "big") % SEMANTIC_VECTOR_DIM
        vector[index] += weight

    def _deterministic_trigger_score(self, *, tool: AwsToolDefinition, lowered_query: str) -> float:
        raw_score = sum(1.0 for phrase in tool.trigger_phrases if phrase in lowered_query)
        if tool.tool_name == "resource_cost" and re.search(r"\b(?:i|vol|eni|subnet|sg)-[a-z0-9]+\b", lowered_query):
            raw_score += 2.0
        if tool.tool_name == "ec2_idle_check" and re.search(r"\bi-[a-z0-9]+\b", lowered_query):
            raw_score += 2.0
        if tool.tool_name == "analytics_hub_snapshot" and any(
            term in lowered_query
            for term in ("analytics hub", "cockpit", "priority queue", "current findings", "dashboard")
        ):
            raw_score += 2.0
        if tool.tool_name == "analytics_hub_storage_status" and any(
            term in lowered_query
            for term in ("sqlite", "storage status", "db connected", "database connected", "jsonl fallback")
        ):
            raw_score += 2.0
        if tool.tool_name == "idle_resources" and any(term in lowered_query for term in ("idle", "unused", "underused", "waste")):
            raw_score += 1.0
        if tool.tool_name == "certificate_expiry" and any(term in lowered_query for term in ("certificate", "acm", "tls", "ssl")):
            raw_score += 1.0
        if tool.tool_name == "ecs_insights" and re.search(r"\b[a-z0-9._-]+-ecs-cluster\b", lowered_query):
            raw_score += 2.0
        return min(1.0, raw_score / 3.0)

    def _entity_score(
        self,
        *,
        tool: AwsToolDefinition,
        lowered_query: str,
        query_context: QueryContextLike,
    ) -> float:
        score = 0.0
        if query_context.account_keys:
            score += 0.15
        if re.search(r"(?:last|past)\s+\d+\s+(?:day|week|month)", lowered_query):
            score += 0.20

        if tool.tool_name == "accounts":
            if "account" in lowered_query or "environment" in lowered_query:
                score += 0.80
        elif tool.tool_name == "analytics_hub_snapshot":
            if any(term in lowered_query for term in ("analytics hub", "cockpit", "priority queue", "current findings", "dashboard")):
                score += 0.90
            if any(term in lowered_query for term in ("utilization insights", "certificate watch", "resource doctor")):
                score += 0.45
        elif tool.tool_name == "analytics_hub_storage_status":
            if any(term in lowered_query for term in ("sqlite", "database", "db", "storage", "jsonl", "fallback", "data folder")):
                score += 0.90
        elif tool.tool_name == "cost_breakdown":
            if re.search(r"\btop\s+\d+", lowered_query):
                score += 0.45
            if any(term in lowered_query for term in ("breakdown", "driver", "highest", "top", "service")):
                score += 0.35
        elif tool.tool_name == "total_cost":
            if any(term in lowered_query for term in ("total", "overall", "spent", "spend", "cost")):
                score += 0.45
        elif tool.tool_name == "service_costs":
            if any(term in lowered_query for term in ("all services", "each service", "service wise", "service-wise", "full list")):
                score += 0.65
        elif tool.tool_name == "trends_forecast":
            if any(term in lowered_query for term in ("trend", "forecast", "anomaly", "month over month", "mom")):
                score += 0.70
        elif tool.tool_name == "budget":
            if query_context.budget_name:
                score += 0.90
            elif "budget" in lowered_query:
                score += 0.55
        elif tool.tool_name == "resource_cost":
            if query_context.resource_id:
                score += 0.95
        elif tool.tool_name == "idle_resources":
            if any(term in lowered_query for term in ("idle resources", "unused resources", "underused resources", "waste", "rightsizing")):
                score += 0.90
            elif any(term in lowered_query for term in ("idle", "unused", "underused")) and not query_context.instance_ids:
                score += 0.65
        elif tool.tool_name == "ec2_idle_check":
            if query_context.instance_ids:
                score += 0.90
            if any(term in lowered_query for term in ("idle", "unused", "underused")):
                score += 0.25
        elif tool.tool_name == "certificate_expiry":
            if any(term in lowered_query for term in ("certificate", "acm", "tls", "ssl", "renewal")):
                score += 0.85
        elif tool.tool_name == "ecs_insights":
            if query_context.cluster_names:
                score += 0.70
            if query_context.service_filter:
                score += 0.35
            if any(term in lowered_query for term in ("ecs", "task", "service", "cluster", "deployment")):
                score += 0.45
        return min(1.0, score)

    @staticmethod
    def _dot(left: list[float], right: list[float]) -> float:
        return sum(left_item * right_item for left_item, right_item in zip(left, right, strict=True))
