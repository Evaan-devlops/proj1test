from __future__ import annotations

import boto3

from app.core.config import AwsAccountConfig, settings


class AwsClientFactory:
    def __init__(self, account: AwsAccountConfig) -> None:
        self.account = account
        self._session = boto3.Session(
            aws_access_key_id=account.access_key_id,
            aws_secret_access_key=account.secret_access_key,
            aws_session_token=account.session_token,
            region_name=account.region,
        )

    def ce(self):
        return self._session.client("ce", region_name=settings.aws_ce_region)

    def budgets(self):
        return self._session.client("budgets", region_name=settings.aws_ce_region)

    def cloudwatch(self):
        return self._session.client("cloudwatch", region_name=self.account.region)

    def sts(self):
        return self._session.client("sts", region_name=self.account.region)
