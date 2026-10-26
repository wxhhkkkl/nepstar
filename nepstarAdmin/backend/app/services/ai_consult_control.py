"""Database service switch and deployment vetoes; all reads are nepstar-only."""

import asyncio

from sqlalchemy import select

from ..config import settings
from ..models.new.sa_ai_consult import SAAiConsultAdminAudit


DEPLOYMENT_GATES = {
    "guest": "AI_CONSULT_GUEST_ENABLED",
    "sessions": "AI_CONSULT_SESSIONS_ENABLED",
    "answers": "AI_CONSULT_ANSWERS_ENABLED",
    "operations": "AI_CONSULT_OPERATIONS_READY",
}

_ENTRY_READ_TIMEOUT_SECONDS = 1.0


def deployment_allows(*gates: str) -> bool:
    # Unset delegates to the database master switch (new settings default True).
    # Explicit False remains a deployment veto; True never overrides a saved pause.
    return all(getattr(settings, DEPLOYMENT_GATES[gate]) is not False for gate in gates)


async def last_pause_revision(db) -> int:
    """Caller holds settings lock. Current read also sees pauses after RR snapshots.

    The existing append-only audit ID is a pause fence: pause/resume cannot
    resurrect an answer admitted before the pause. No table/migration required.
    Lock order is settings -> audit; never acquire session locks from this helper.
    """
    result = await db.execute(
        select(SAAiConsultAdminAudit.id)
        .where(SAAiConsultAdminAudit.action == "service.pause", SAAiConsultAdminAudit.target_id == "1")
        .order_by(SAAiConsultAdminAudit.id.desc()).limit(1).with_for_update()
    )
    return int(result.scalar_one_or_none() or 0)


class ServicePaused(Exception):
    """An admitted generation must not publish after the service was paused."""


async def public_entry_status(db=None, *, provider_ready=None) -> dict:
    """Read global entry availability without creating guest, consent, session or turns."""
    from ..database import get_ai_consult_sessionmaker
    from ..models.new.sa_ai_consult import SAAiConsultSettings
    from .ai_consult_entry_guard import public_maintenance_text
    from .ai_consult_provider import default_provider, provider_matches_configuration
    unavailable = {'status': 'unavailable', 'message': '咨询服务暂不可用，请稍后再试。'}
    if not deployment_allows('guest', 'sessions', 'answers', 'operations'):
        return unavailable
    try:
        if db is None:
            async with get_ai_consult_sessionmaker()() as session:
                return await public_entry_status(session, provider_ready=provider_ready)
        result = await asyncio.wait_for(
            db.execute(select(SAAiConsultSettings).where(SAAiConsultSettings.id == 1)),
            timeout=_ENTRY_READ_TIMEOUT_SECONDS,
        )
        config = result.scalar_one_or_none()
        maintenance = public_maintenance_text(config)
        if maintenance:
            return {'status': 'maintenance', 'message': maintenance}
        ready = provider_ready if provider_ready is not None else bool(config and provider_matches_configuration(default_provider, config.provider_code, config.model_code))
        return {'status': 'available', 'message': None} if config and config.enabled and ready else unavailable
    except Exception:
        # This optional, read-only dependency must never hide the plan body or leak configuration.
        return unavailable
