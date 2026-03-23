from __future__ import annotations

from pydantic import BaseModel, Field


class LlmAnswerRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        description="The user question to answer from the provided context.",
        examples=["What is the total AWS cost for dev?"],
    )
    context: str = Field(
        ...,
        min_length=1,
        description="The retrieved document or API context that the model must use.",
        examples=["The total AWS cost for dev is 120.50 USD."],
    )


class LlmAnswerResponse(BaseModel):
    answer: str = Field(
        ...,
        description="The concise model answer derived from the supplied context.",
    )
    prompt: str = Field(
        ...,
        description="The final prompt sent to the downstream LLM service.",
    )
    engine: str = Field(
        ...,
        description="The configured downstream model engine.",
    )
    provider_request_id: str | None = Field(
        default=None,
        description="Optional provider request identifier when returned by the downstream API.",
    )


class LlmHealthCheckResponse(BaseModel):
    status: str = Field(
        ...,
        description="Overall LLM health-check status.",
        examples=["ok"],
    )
    message: str = Field(
        ...,
        description="Short summary of the health-check result.",
    )
    access_token: str = Field(
        ...,
        description="The access token returned by TOKEN_URL for verification.",
    )
    token_type: str | None = Field(
        default=None,
        description="Token type returned by the OAuth provider, if available.",
    )
    expires_at: str | None = Field(
        default=None,
        description="Resolved token expiry time in UTC when provided by the token endpoint.",
    )
    token_provider_status_code: int = Field(
        ...,
        description="HTTP status code returned by the token endpoint.",
    )
    llm_provider_status_code: int = Field(
        ...,
        description="HTTP status code returned by the LLM gateway.",
    )
    engine: str = Field(
        ...,
        description="The configured downstream model engine used for the health-check call.",
    )
    llm_answer: str = Field(
        ...,
        description="The answer returned by the downstream LLM health-check prompt.",
    )
    prompt: str = Field(
        ...,
        description="The exact health-check prompt sent to the LLM gateway.",
    )
    provider_request_id: str | None = Field(
        default=None,
        description="Optional downstream request identifier when returned by the LLM gateway.",
    )
