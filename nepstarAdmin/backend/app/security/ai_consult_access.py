"""公开报告下的匿名聊天凭证；不把报告定位参数当作身份。"""

import hashlib
import hmac
import re
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.new.sa_ai_consult import SAAiConsultGuest


GUEST_TOKEN_DAYS = 30
TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_-]{43}\Z")


class GuestAccessConfigurationError(RuntimeError):
    """聊天凭证密钥尚未安全配置。"""


class GuestAccessDenied(Exception):
    """凭证无效、过期、撤销或不属于所请求的报告。"""


def _key_bytes(hmac_key: str | None) -> bytes:
    key = settings.AI_CONSULT_TOKEN_HMAC_KEY if hmac_key is None else hmac_key
    encoded = key.encode("utf-8")
    if len(encoded) < 32:
        raise GuestAccessConfigurationError("AI consult token key is not configured")
    return encoded


def _digest(token: str, key: bytes) -> str:
    return hmac.new(key, token.encode("ascii"), hashlib.sha256).hexdigest()


def build_guest_context(
    report_code: str,
    customer_id: int,
    *,
    now: datetime | None = None,
    hmac_key: str | None = None,
) -> tuple[str, SAAiConsultGuest]:
    """构造待写入 nepstar 的 guest；明文 token 只向创建者返回一次。"""
    key = _key_bytes(hmac_key)
    if not report_code or customer_id <= 0:
        raise ValueError("Valid report parameters are required")
    issued_at = now or datetime.now(UTC).replace(tzinfo=None)
    token = secrets.token_urlsafe(32)
    guest = SAAiConsultGuest(
        token_digest=_digest(token, key),
        report_code=report_code,
        customer_id=customer_id,
        created_at=issued_at,
        last_activity_at=issued_at,
        expires_at=issued_at + timedelta(days=GUEST_TOKEN_DAYS),
    )
    return token, guest


async def require_guest(
    db: AsyncSession,
    token: str,
    report_code: str,
    *,
    now: datetime | None = None,
    hmac_key: str | None = None,
) -> SAAiConsultGuest:
    """每次聊天读取与写入前验证凭证摘要及报告范围。"""
    if not token or not TOKEN_PATTERN.fullmatch(token):
        raise GuestAccessDenied()
    digest = _digest(token, _key_bytes(hmac_key))
    result = await db.execute(
        select(SAAiConsultGuest).where(SAAiConsultGuest.token_digest == digest)
    )
    guest = result.scalar_one_or_none()
    checked_at = now or datetime.now(UTC).replace(tzinfo=None)
    if (
        guest is None
        or not hmac.compare_digest(guest.token_digest, digest)
        or guest.report_code != report_code
        or guest.revoked_at is not None
        or checked_at >= guest.expires_at
    ):
        raise GuestAccessDenied()
    return guest
