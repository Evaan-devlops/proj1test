from __future__ import annotations

from time import time

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.schemas.chat import (
    ChatStreamRequest,
    CreateChatRequest,
    CreateChatResponse,
    DeleteChatResponse,
    HealthResponse,
    ListChatsResponse,
    ListMessagesResponse,
    RenameChatRequest,
    RenameChatResponse,
    RerunStreamRequest,
)
from app.services.archive_service import ApiResponseArchiveService
from app.services.aws_service import AwsInsightsService, get_aws_insights_service
from app.services.chat_service import ChatService
from app.services.chat_store_service import ChatStoreService, get_chat_store_service
from app.services.llm_service import LlmService, get_llm_service


router = APIRouter()


def get_chat_service(
    chat_store: ChatStoreService = Depends(get_chat_store_service),
    aws_service: AwsInsightsService = Depends(get_aws_insights_service),
    llm_service: LlmService = Depends(get_llm_service),
) -> ChatService:
    return ChatService(
        chat_store=chat_store,
        aws_service=aws_service,
        llm_service=llm_service,
        archive_service=ApiResponseArchiveService(),
    )


@router.get("/health", response_model=HealthResponse, summary="Backend health for frontend chat client")
async def api_health() -> HealthResponse:
    return HealthResponse(version="1.0.0", serverTimeMs=int(time() * 1000))


@router.post("/chats", response_model=CreateChatResponse, summary="Create a new chat")
async def create_chat(
    payload: CreateChatRequest | None = None,
    chat_store: ChatStoreService = Depends(get_chat_store_service),
) -> CreateChatResponse:
    chat = chat_store.create_chat(payload.title if payload else None)
    return CreateChatResponse(chat=chat)


@router.get("/chats", response_model=ListChatsResponse, summary="List chats")
async def list_chats(
    chat_store: ChatStoreService = Depends(get_chat_store_service),
) -> ListChatsResponse:
    return ListChatsResponse(items=chat_store.list_chats(), nextCursor=None)


@router.patch("/chats/{chat_id}", response_model=RenameChatResponse, summary="Rename a chat")
async def rename_chat(
    chat_id: str,
    payload: RenameChatRequest,
    chat_store: ChatStoreService = Depends(get_chat_store_service),
) -> RenameChatResponse:
    chat = chat_store.rename_chat(chat_id, payload.title)
    return RenameChatResponse(chat=chat)


@router.delete("/chats/{chat_id}", response_model=DeleteChatResponse, summary="Delete a chat")
async def delete_chat(
    chat_id: str,
    chat_store: ChatStoreService = Depends(get_chat_store_service),
) -> DeleteChatResponse:
    chat_store.delete_chat(chat_id)
    return DeleteChatResponse()


@router.get("/chats/{chat_id}/messages", response_model=ListMessagesResponse, summary="List messages in a chat")
async def list_messages(
    chat_id: str,
    chat_store: ChatStoreService = Depends(get_chat_store_service),
) -> ListMessagesResponse:
    return ListMessagesResponse(items=chat_store.list_messages(chat_id), nextCursor=None)


@router.post("/chats/{chat_id}/stream", summary="Stream a new assistant response")
async def stream_chat(
    chat_id: str,
    payload: ChatStreamRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> StreamingResponse:
    return StreamingResponse(
        chat_service.stream_new_message(chat_id=chat_id, payload=payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/chats/{chat_id}/messages/{user_message_id}/rerun/stream",
    summary="Stream a new assistant response after editing a user prompt",
)
async def rerun_stream_chat(
    chat_id: str,
    user_message_id: str,
    payload: RerunStreamRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> StreamingResponse:
    return StreamingResponse(
        chat_service.stream_rerun_message(
            chat_id=chat_id,
            user_message_id=user_message_id,
            payload=payload,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
