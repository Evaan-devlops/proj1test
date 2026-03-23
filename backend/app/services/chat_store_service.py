from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from threading import Lock
from time import time
from uuid import uuid4

from fastapi import HTTPException

from app.core.config import settings
from app.schemas.chat import ChatMessageDto, ChatSummary


SUMMARY_MESSAGE_ID_PREFIX = "msg_summary"


def _now_ms() -> int:
    return int(time() * 1000)


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


@dataclass
class StoredMessage:
    id: str
    chat_id: str
    role: str
    text: str
    created_at_ms: int
    status: str = "final"


@dataclass
class StoredChat:
    id: str
    title: str
    created_at_ms: int
    updated_at_ms: int
    messages: list[StoredMessage] = field(default_factory=list)
    summary_text: str | None = None
    compacted_at_ms: int | None = None
    last_tool_name: str | None = None
    last_tool_endpoint: str | None = None
    last_request_payload: dict[str, object] | None = None
    last_live_result: dict[str, object] | None = None
    last_recorded_at_utc: str | None = None


@dataclass(frozen=True)
class ChatLastToolContext:
    tool_name: str
    endpoint: str
    request_payload: dict[str, object]
    live_result: dict[str, object]
    recorded_at_utc: str | None


@dataclass(frozen=True)
class ChatConversationContext:
    chat_id: str
    title: str
    archived_summary: str | None
    recent_messages: list[ChatMessageDto]

    def render_for_prompt(self, *, char_limit: int | None = None) -> str:
        parts: list[str] = []
        if self.archived_summary:
            parts.append(f"Archived conversation summary:\n{self.archived_summary}")
        if self.recent_messages:
            recent_lines = "\n".join(
                f"{message.role}: {message.text}"
                for message in self.recent_messages
                if message.text.strip()
            )
            if recent_lines:
                parts.append(f"Recent chat messages:\n{recent_lines}")
        rendered = "\n\n".join(parts)
        if char_limit is not None and len(rendered) > char_limit:
            return rendered[: max(0, char_limit - 25)].rstrip() + "\n...[truncated for prompt]"
        return rendered


class ChatStoreService:
    def __init__(
        self,
        *,
        storage_path: str | Path | None = None,
        recent_chat_limit: int | None = None,
        context_message_limit: int | None = None,
    ) -> None:
        self._lock = Lock()
        self._storage_path = settings.resolve_path(storage_path or settings.chat_context_file)
        self._recent_chat_limit = max(1, recent_chat_limit or settings.chat_recent_limit)
        self._context_message_limit = max(
            1,
            context_message_limit or settings.chat_context_message_limit,
        )
        self._chats: dict[str, StoredChat] = {}
        self._load_from_disk()

    def create_chat(self, title: str | None = None) -> ChatSummary:
        with self._lock:
            now_ms = _now_ms()
            chat = StoredChat(
                id=_new_id("chat"),
                title=(title or "New chat").strip() or "New chat",
                created_at_ms=now_ms,
                updated_at_ms=now_ms,
            )
            self._chats[chat.id] = chat
            self._persist_locked()
            return self._chat_summary(chat)

    def list_chats(self) -> list[ChatSummary]:
        with self._lock:
            chats = sorted(
                self._chats.values(),
                key=lambda chat: chat.updated_at_ms,
                reverse=True,
            )
            return [self._chat_summary(chat) for chat in chats]

    def rename_chat(self, chat_id: str, title: str) -> ChatSummary:
        with self._lock:
            chat = self._get_chat(chat_id)
            chat.title = title.strip() or chat.title
            chat.updated_at_ms = _now_ms()
            self._persist_locked()
            return self._chat_summary(chat)

    def delete_chat(self, chat_id: str) -> None:
        with self._lock:
            self._get_chat(chat_id)
            del self._chats[chat_id]
            self._persist_locked()

    def list_messages(self, chat_id: str) -> list[ChatMessageDto]:
        with self._lock:
            chat = self._get_chat(chat_id)
            return [self._message_dto(message) for message in self._messages_for_client(chat)]

    def get_conversation_context(
        self,
        *,
        chat_id: str,
        upto_message_id: str | None = None,
    ) -> ChatConversationContext:
        with self._lock:
            chat = self._get_chat(chat_id)
            messages = list(chat.messages)
            if upto_message_id is not None:
                cutoff_index = next(
                    (index for index, message in enumerate(messages) if message.id == upto_message_id),
                    -1,
                )
                if cutoff_index != -1:
                    messages = messages[: cutoff_index + 1]

            recent_messages = [
                self._message_dto(message)
                for message in messages[-self._context_message_limit :]
                if message.role in {"user", "assistant"} and message.text.strip()
            ]
            return ChatConversationContext(
                chat_id=chat.id,
                title=chat.title,
                archived_summary=chat.summary_text,
                recent_messages=recent_messages,
            )

    def get_last_tool_context(self, *, chat_id: str) -> ChatLastToolContext | None:
        with self._lock:
            chat = self._get_chat(chat_id)
            if not all(
                (
                    isinstance(chat.last_tool_name, str),
                    isinstance(chat.last_tool_endpoint, str),
                    isinstance(chat.last_request_payload, dict),
                    isinstance(chat.last_live_result, dict),
                )
            ):
                return None
            return ChatLastToolContext(
                tool_name=chat.last_tool_name,
                endpoint=chat.last_tool_endpoint,
                request_payload=dict(chat.last_request_payload),
                live_result=dict(chat.last_live_result),
                recorded_at_utc=chat.last_recorded_at_utc,
            )

    def add_turn(
        self,
        *,
        chat_id: str,
        user_text: str,
        chat_title_hint: str | None = None,
    ) -> tuple[ChatMessageDto, ChatMessageDto]:
        with self._lock:
            chat = self._get_chat(chat_id)
            now_ms = _now_ms()
            if chat.title == "New chat" and chat_title_hint:
                chat.title = chat_title_hint
            user_message = StoredMessage(
                id=_new_id("msg_user"),
                chat_id=chat_id,
                role="user",
                text=user_text,
                created_at_ms=now_ms,
                status="final",
            )
            assistant_message = StoredMessage(
                id=_new_id("msg_asst"),
                chat_id=chat_id,
                role="assistant",
                text="",
                created_at_ms=now_ms + 1,
                status="streaming",
            )
            chat.messages.extend([user_message, assistant_message])
            chat.updated_at_ms = now_ms
            self._persist_locked()
            return self._message_dto(user_message), self._message_dto(assistant_message)

    def rerun_turn(
        self,
        *,
        chat_id: str,
        user_message_id: str,
        new_user_text: str,
    ) -> tuple[ChatMessageDto, ChatMessageDto]:
        with self._lock:
            chat = self._get_chat(chat_id)
            user_index = next(
                (index for index, message in enumerate(chat.messages) if message.id == user_message_id),
                -1,
            )
            if user_index == -1:
                raise HTTPException(status_code=404, detail="User message not found.")

            user_message = chat.messages[user_index]
            if user_message.role != "user":
                raise HTTPException(status_code=400, detail="The selected message is not a user message.")

            now_ms = _now_ms()
            user_message.text = new_user_text
            user_message.created_at_ms = now_ms
            user_message.status = "final"

            if user_index + 1 < len(chat.messages) and chat.messages[user_index + 1].role == "assistant":
                chat.messages.pop(user_index + 1)

            assistant_message = StoredMessage(
                id=_new_id("msg_asst"),
                chat_id=chat_id,
                role="assistant",
                text="",
                created_at_ms=now_ms + 1,
                status="streaming",
            )
            chat.messages.insert(user_index + 1, assistant_message)
            chat.updated_at_ms = now_ms
            self._persist_locked()
            return self._message_dto(user_message), self._message_dto(assistant_message)

    def update_assistant_message(
        self,
        *,
        chat_id: str,
        assistant_message_id: str,
        text: str,
        status: str,
    ) -> ChatMessageDto:
        with self._lock:
            chat = self._get_chat(chat_id)
            assistant_message = next(
                (message for message in chat.messages if message.id == assistant_message_id),
                None,
            )
            if assistant_message is None:
                raise HTTPException(status_code=404, detail="Assistant message not found.")
            assistant_message.text = text
            assistant_message.status = status
            chat.updated_at_ms = _now_ms()
            self._persist_locked()
            return self._message_dto(assistant_message)

    def mark_assistant_error(
        self,
        *,
        chat_id: str,
        assistant_message_id: str,
        error_text: str,
    ) -> ChatMessageDto:
        return self.update_assistant_message(
            chat_id=chat_id,
            assistant_message_id=assistant_message_id,
            text=error_text,
            status="error",
        )

    def finalize_assistant_response(
        self,
        *,
        chat_id: str,
        assistant_message_id: str,
        text: str,
        status: str,
        tool_name: str | None = None,
        endpoint: str | None = None,
        request_payload: dict[str, object] | None = None,
        live_result: dict[str, object] | None = None,
        recorded_at_utc: str | None = None,
    ) -> ChatMessageDto:
        with self._lock:
            chat = self._get_chat(chat_id)
            assistant_message = next(
                (message for message in chat.messages if message.id == assistant_message_id),
                None,
            )
            if assistant_message is None:
                raise HTTPException(status_code=404, detail="Assistant message not found.")

            assistant_message.text = text
            assistant_message.status = status

            if all(
                (
                    isinstance(tool_name, str),
                    isinstance(endpoint, str),
                    isinstance(request_payload, dict),
                    isinstance(live_result, dict),
                )
            ):
                chat.last_tool_name = tool_name
                chat.last_tool_endpoint = endpoint
                chat.last_request_payload = dict(request_payload)
                chat.last_live_result = dict(live_result)
                chat.last_recorded_at_utc = recorded_at_utc

            chat.updated_at_ms = _now_ms()
            self._persist_locked()
            return self._message_dto(assistant_message)

    def _chat_summary(self, chat: StoredChat) -> ChatSummary:
        return ChatSummary(
            id=chat.id,
            title=chat.title,
            createdAtMs=chat.created_at_ms,
            updatedAtMs=chat.updated_at_ms,
        )

    def _message_dto(self, message: StoredMessage) -> ChatMessageDto:
        return ChatMessageDto(
            id=message.id,
            chatId=message.chat_id,
            role=message.role,
            text=message.text,
            createdAtMs=message.created_at_ms,
            status=message.status,
        )

    def _messages_for_client(self, chat: StoredChat) -> list[StoredMessage]:
        messages = list(chat.messages)
        if not chat.summary_text:
            return messages
        summary_message = StoredMessage(
            id=f"{SUMMARY_MESSAGE_ID_PREFIX}_{chat.id}",
            chat_id=chat.id,
            role="assistant",
            text=f"Summary of earlier conversation:\n{chat.summary_text}",
            created_at_ms=chat.compacted_at_ms or chat.updated_at_ms,
            status="final",
        )
        return [summary_message, *messages]

    def _persist_locked(self) -> None:
        self._apply_compaction_locked()
        self._write_to_disk_locked()

    def _apply_compaction_locked(self) -> None:
        ordered_chats = sorted(
            self._chats.values(),
            key=lambda chat: chat.updated_at_ms,
            reverse=True,
        )
        for chat in ordered_chats[self._recent_chat_limit :]:
            if not chat.messages:
                continue
            summary_text = self._summarize_chat_messages(chat=chat, messages=chat.messages)
            chat.summary_text = self._merge_summaries(chat.summary_text, summary_text)
            chat.messages = []
            chat.compacted_at_ms = _now_ms()

    def _summarize_chat_messages(
        self,
        *,
        chat: StoredChat,
        messages: list[StoredMessage],
    ) -> str:
        non_empty_messages = [message for message in messages if message.text.strip()]
        user_messages = [message.text.strip() for message in non_empty_messages if message.role == "user"]
        assistant_messages = [
            message.text.strip()
            for message in non_empty_messages
            if message.role == "assistant"
        ]
        key_user_points = "; ".join(user_messages[-3:]) or "No user questions recorded."
        latest_answer = assistant_messages[-1] if assistant_messages else "No assistant answer recorded."
        return (
            f"Chat title: {chat.title}\n"
            f"Messages summarized: {len(non_empty_messages)}\n"
            f"Recent user asks: {key_user_points[:800]}\n"
            f"Latest assistant answer: {latest_answer[:1200]}"
        )

    def _merge_summaries(self, existing_summary: str | None, new_summary: str) -> str:
        if not existing_summary:
            return new_summary
        return (
            f"{existing_summary}\n\n"
            "Additional compacted conversation:\n"
            f"{new_summary}"
        )

    def _load_from_disk(self) -> None:
        if not self._storage_path.exists():
            return

        chats: dict[str, StoredChat] = {}
        for raw_line in self._storage_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            chat = self._deserialize_chat(record)
            if chat is not None:
                chats[chat.id] = chat
        self._chats = chats

    def _write_to_disk_locked(self) -> None:
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._storage_path.with_suffix(f"{self._storage_path.suffix}.tmp")
        ordered_chats = sorted(
            self._chats.values(),
            key=lambda chat: chat.updated_at_ms,
            reverse=True,
        )
        with temp_path.open("w", encoding="utf-8", newline="\n") as handle:
            for chat in ordered_chats:
                handle.write(json.dumps(self._serialize_chat(chat), ensure_ascii=True))
                handle.write("\n")
        temp_path.replace(self._storage_path)

    def _serialize_chat(self, chat: StoredChat) -> dict[str, object]:
        return {
            "record_type": "chat_context",
            "chat_id": chat.id,
            "title": chat.title,
            "created_at_ms": chat.created_at_ms,
            "updated_at_ms": chat.updated_at_ms,
            "summary_text": chat.summary_text,
            "compacted_at_ms": chat.compacted_at_ms,
            "last_tool_name": chat.last_tool_name,
            "last_tool_endpoint": chat.last_tool_endpoint,
            "last_request_payload": chat.last_request_payload,
            "last_live_result": chat.last_live_result,
            "last_recorded_at_utc": chat.last_recorded_at_utc,
            "messages": [
                {
                    "id": message.id,
                    "chat_id": message.chat_id,
                    "role": message.role,
                    "text": message.text,
                    "created_at_ms": message.created_at_ms,
                    "status": message.status,
                }
                for message in chat.messages
            ],
        }

    def _deserialize_chat(self, record: dict[str, object]) -> StoredChat | None:
        chat_id = record.get("chat_id")
        title = record.get("title")
        created_at_ms = record.get("created_at_ms")
        updated_at_ms = record.get("updated_at_ms")
        if not all(
            (
                isinstance(chat_id, str),
                isinstance(title, str),
                isinstance(created_at_ms, int),
                isinstance(updated_at_ms, int),
            )
        ):
            return None

        raw_messages = record.get("messages", [])
        messages: list[StoredMessage] = []
        if isinstance(raw_messages, list):
            for raw_message in raw_messages:
                if not isinstance(raw_message, dict):
                    continue
                message = self._deserialize_message(raw_message)
                if message is not None:
                    messages.append(message)

        compacted_at_ms = record.get("compacted_at_ms")
        return StoredChat(
            id=chat_id,
            title=title,
            created_at_ms=created_at_ms,
            updated_at_ms=updated_at_ms,
            messages=messages,
            summary_text=record.get("summary_text") if isinstance(record.get("summary_text"), str) else None,
            compacted_at_ms=compacted_at_ms if isinstance(compacted_at_ms, int) else None,
            last_tool_name=record.get("last_tool_name") if isinstance(record.get("last_tool_name"), str) else None,
            last_tool_endpoint=record.get("last_tool_endpoint") if isinstance(record.get("last_tool_endpoint"), str) else None,
            last_request_payload=record.get("last_request_payload") if isinstance(record.get("last_request_payload"), dict) else None,
            last_live_result=record.get("last_live_result") if isinstance(record.get("last_live_result"), dict) else None,
            last_recorded_at_utc=record.get("last_recorded_at_utc") if isinstance(record.get("last_recorded_at_utc"), str) else None,
        )

    def _deserialize_message(self, record: dict[str, object]) -> StoredMessage | None:
        message_id = record.get("id")
        chat_id = record.get("chat_id")
        role = record.get("role")
        text = record.get("text")
        created_at_ms = record.get("created_at_ms")
        status = record.get("status")
        if not all(
            (
                isinstance(message_id, str),
                isinstance(chat_id, str),
                isinstance(role, str),
                isinstance(text, str),
                isinstance(created_at_ms, int),
                isinstance(status, str),
            )
        ):
            return None
        return StoredMessage(
            id=message_id,
            chat_id=chat_id,
            role=role,
            text=text,
            created_at_ms=created_at_ms,
            status=status,
        )

    def _get_chat(self, chat_id: str) -> StoredChat:
        chat = self._chats.get(chat_id)
        if chat is None:
            raise HTTPException(status_code=404, detail="Chat not found.")
        return chat


@lru_cache(maxsize=1)
def get_chat_store_service() -> ChatStoreService:
    return ChatStoreService()
