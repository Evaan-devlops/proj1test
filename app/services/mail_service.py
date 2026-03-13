from __future__ import annotations

from email.mime.text import MIMEText


def build_plaintext_report(subject: str, body: str, to_email: str, from_email: str) -> MIMEText:
    message = MIMEText(body, "plain", "utf-8")
    message["Subject"] = subject
    message["To"] = to_email
    message["From"] = from_email
    return message

