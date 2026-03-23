from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatSchemaBase(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )


class ChatSummary(ChatSchemaBase):
    id: str
    title: str
    created_at_ms: int = Field(alias="createdAtMs")
    updated_at_ms: int = Field(alias="updatedAtMs")


class ChatMessageDto(ChatSchemaBase):
    id: str
    chat_id: str = Field(alias="chatId")
    role: Literal["user", "assistant"]
    text: str
    created_at_ms: int = Field(alias="createdAtMs")
    status: Literal["final", "streaming", "error"] = "final"


class HealthResponse(ChatSchemaBase):
    ok: Literal[True] = True
    version: str
    server_time_ms: int = Field(alias="serverTimeMs")


class CreateChatRequest(ChatSchemaBase):
    title: str | None = None


class CreateChatResponse(ChatSchemaBase):
    chat: ChatSummary


class ListChatsResponse(ChatSchemaBase):
    items: list[ChatSummary]
    next_cursor: str | None = Field(default=None, alias="nextCursor")


class RenameChatRequest(ChatSchemaBase):
    title: str = Field(..., min_length=1)


class RenameChatResponse(ChatSchemaBase):
    ok: Literal[True] = True
    chat: ChatSummary


class DeleteChatResponse(ChatSchemaBase):
    ok: Literal[True] = True


class ListMessagesResponse(ChatSchemaBase):
    items: list[ChatMessageDto]
    next_cursor: str | None = Field(default=None, alias="nextCursor")


class ChatStreamRequest(ChatSchemaBase):
    user_text: str = Field(..., alias="userText", min_length=1)
    client_message_id: str | None = Field(default=None, alias="clientMessageId")
    selected_account_keys: list[str] | None = Field(default=None, alias="selectedAccountKeys")


class RerunStreamRequest(ChatSchemaBase):
    new_user_text: str = Field(..., alias="newUserText", min_length=1)
    selected_account_keys: list[str] | None = Field(default=None, alias="selectedAccountKeys")


class StreamStartEvent(ChatSchemaBase):
    type: Literal["start"] = "start"
    user_message: ChatMessageDto = Field(alias="userMessage")
    assistant_message: ChatMessageDto = Field(alias="assistantMessage")


class StreamDeltaEvent(ChatSchemaBase):
    type: Literal["delta"] = "delta"
    message_id: str = Field(alias="messageId")
    text: str


class StreamFinalEvent(ChatSchemaBase):
    type: Literal["final"] = "final"
    message_id: str = Field(alias="messageId")
    full_text: str | None = Field(default=None, alias="fullText")


class StreamErrorEvent(ChatSchemaBase):
    type: Literal["error"] = "error"
    message: str
