from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class AwsAccountConfig:
    key: str
    account_id: str
    access_key_id: str
    secret_access_key: str
    session_token: str | None
    region: str


class Settings:
    api_v1_prefix: str = "/api/v1"
    app_name: str = "AWS Insights API"
    aws_ce_region: str = "us-east-1"
    default_cost_days: int = 180
    default_forecast_months: int = 3
    max_parallel_accounts: int = 10

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

            if not access_key_id or not secret_access_key or not account_id:
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


settings = Settings()

