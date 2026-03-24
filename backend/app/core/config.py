from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True)
class AwsAccountConfig:
    key: str
    account_id: str | None
    access_key_id: str
    secret_access_key: str
    session_token: str | None
    region: str


class Settings:
    base_dir: Path = BASE_DIR
    api_v1_prefix: str = "/api/v1"
    app_name: str = "AWS Insights API"
    aws_ce_region: str = "us-east-1"
    default_cost_days: int = 180
    default_forecast_months: int = 3
    max_parallel_accounts: int = 10
    chat_context_file: str = os.getenv("CHAT_CONTEXT_FILE", "data/chat_context.jsonl")
    chat_recent_limit: int = int(os.getenv("CHAT_RECENT_LIMIT", "10"))
    chat_context_message_limit: int = int(os.getenv("CHAT_CONTEXT_MESSAGE_LIMIT", "6"))
    chat_context_prompt_char_limit: int = int(os.getenv("CHAT_CONTEXT_PROMPT_CHAR_LIMIT", "2500"))
    vox_user: str = os.getenv("VOX_USER", "")
    vox_password: str = os.getenv("VOX_PASSWORD", "")
    token_url: str = os.getenv(
        "TOKEN_URL",
        "https://devfederate.pfizer.com/as/token.oauth2?grant_type=client_credentials",
    )
    vessel_openai_api: str = os.getenv(
        "VESSEL_OPENAI_API",
        "https://mule4api-comm-amer-dev.pfizer.com/vessel-openai-api-v1/chatCompletion",
    )
    vessel_openai_payload_mode: str = os.getenv(
        "VESSEL_OPENAI_PAYLOAD_MODE",
        "model_messages",
    ).strip().lower()
    vessel_openai_engine: str = os.getenv("VESSEL_OPENAI_ENGINE", "gpt-4o-mini")
    vessel_openai_temperature: float = float(os.getenv("VESSEL_OPENAI_TEMPERATURE", "0.1"))
    vessel_openai_max_tokens: int = int(os.getenv("VESSEL_OPENAI_MAX_TOKENS", "10000"))
    token_cache_minutes: int = int(os.getenv("TOKEN_CACHE_MINUTES", "20"))
    token_request_timeout_seconds: float = float(
        os.getenv("TOKEN_REQUEST_TIMEOUT_SECONDS", "30")
    )
    llm_request_timeout_seconds: float = float(
        os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", "60")
    )

    def get_aws_accounts(self) -> dict[str, AwsAccountConfig]:
        accounts: dict[str, AwsAccountConfig] = {}
        account_keys = [
            item.strip()
            for item in os.getenv("AWS_ACCOUNT_KEYS", "").split(",")
            if item.strip()
        ]

        for key in account_keys:
            prefix = f"AWS_ACCOUNT__{key.upper()}__"
            access_key_id = os.getenv(f"{prefix}ACCESS_KEY_ID")
            secret_access_key = os.getenv(f"{prefix}SECRET_ACCESS_KEY")
            account_id = os.getenv(f"{prefix}ACCOUNT_ID")
            session_token = os.getenv(f"{prefix}SESSION_TOKEN")
            region = os.getenv(f"{prefix}REGION", "us-east-1")

            if not access_key_id or not secret_access_key:
                continue

            accounts[key] = AwsAccountConfig(
                key=key,
                account_id=account_id,
                access_key_id=access_key_id,
                secret_access_key=secret_access_key,
                session_token=session_token,
                region=region,
            )

        return accounts

    def validate_llm_settings(self) -> None:
        missing = [
            name
            for name, value in (
                ("VOX_USER", self.vox_user),
                ("VOX_PASSWORD", self.vox_password),
                ("TOKEN_URL", self.token_url),
                ("VESSEL_OPENAI_API", self.vessel_openai_api),
                ("VESSEL_OPENAI_ENGINE", self.vessel_openai_engine),
            )
            if not value
        ]
        if missing:
            missing_env = ", ".join(missing)
            raise RuntimeError(
                f"Missing required LLM environment settings: {missing_env}. "
                "Update your .env file before using the LLM endpoint."
            )

    def resolve_path(self, value: str | Path) -> Path:
        path = Path(value)
        if path.is_absolute():
            return path
        return self.base_dir / path


settings = Settings()
