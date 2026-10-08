"""匿名访问者的版本化告知与同意；此模块不会外发报告或调用模型。"""

import hashlib
import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_ai_consult import SAAiConsultConsent, SAAiConsultSettings


_HASH = re.compile(r"[a-fA-F0-9]{64}\Z")


class ConsentUnavailable(Exception):
    """当前告知或服务商配置不完整。"""


class ConsentMismatch(Exception):
    """客户端同意的并非当前公布的服务商/告知版本。"""


def _notice_ready(config: SAAiConsultSettings | None) -> bool:
    return bool(
        config
        and config.enabled
        and config.provider_code
        and config.notice_version
        and config.notice_text
        and config.notice_text.strip()
        and config.data_scope_text
        and config.data_scope_text.strip()
        and config.data_scope_hash
        and _HASH.fullmatch(config.data_scope_hash)
        and hashlib.sha256(config.data_scope_text.encode("utf-8")).hexdigest() == config.data_scope_hash.lower()
    )


def consent_is_current(consent: SAAiConsultConsent | None, config: SAAiConsultSettings | None, guest_id: int) -> bool:
    """调用方必须提供该 guest 的最新一条同意记录；旧授权不得越过撤回。"""
    return bool(
        _notice_ready(config)
        and consent
        and consent.guest_id == guest_id
        and consent.choice == "granted"
        and consent.withdrawn_at is None
        and consent.notice_version == config.notice_version
        and consent.notice_content_hash == hashlib.sha256(config.notice_text.encode("utf-8")).hexdigest()
        and consent.provider_code == config.provider_code
        and consent.data_scope_hash == config.data_scope_hash
    )


async def record_consent(
    db: AsyncSession,
    guest,
    *,
    notice_version: str,
    provider_code: str,
    accepted: bool,
    now: datetime | None = None,
) -> SAAiConsultConsent:
    """在 nepstar 写事务中记录决定；拒绝和撤回均产生最新的非授权记录。"""
    result = await db.execute(
        select(SAAiConsultSettings)
        .where(SAAiConsultSettings.id == 1)
        .with_for_update()
    )
    config = result.scalar_one_or_none()
    if not _notice_ready(config):
        raise ConsentUnavailable()
    if notice_version != config.notice_version or provider_code != config.provider_code:
        raise ConsentMismatch()
    decided_at = now or datetime.now(UTC).replace(tzinfo=None)
    consent = SAAiConsultConsent(
        guest_id=guest.id,
        notice_version=config.notice_version,
        notice_content_hash=hashlib.sha256(config.notice_text.encode("utf-8")).hexdigest(),
        provider_code=config.provider_code,
        data_scope_hash=config.data_scope_hash,
        choice="granted" if accepted else "withdrawn",
        decided_at=decided_at,
        withdrawn_at=None if accepted else decided_at,
    )
    db.add(consent)
    return consent


async def require_current_consent(db: AsyncSession, guest_id: int) -> SAAiConsultConsent | None:
    """只认该 guest 最新决定；服务商、处理范围或告知变更后必须重新同意。"""
    settings_result = await db.execute(select(SAAiConsultSettings).where(SAAiConsultSettings.id == 1))
    config = settings_result.scalar_one_or_none()
    if not _notice_ready(config):
        return None
    consent_result = await db.execute(
        select(SAAiConsultConsent)
        .where(SAAiConsultConsent.guest_id == guest_id)
        .order_by(SAAiConsultConsent.decided_at.desc(), SAAiConsultConsent.id.desc())
        .limit(1)
    )
    consent = consent_result.scalar_one_or_none()
    return consent if consent_is_current(consent, config, guest_id) else None
