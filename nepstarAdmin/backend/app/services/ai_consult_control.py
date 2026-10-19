"""Database service switch and deployment vetoes; all reads are nepstar-only."""

from sqlalchemy import select

from ..config import settings
from ..models.new.sa_ai_consult import SAAiConsultAdminAudit


DEPLOYMENT_GATES = {
    "guest": "AI_CONSULT_GUEST_ENABLED",
    "sessions": "AI_CONSULT_SESSIONS_ENABLED",
    "answers": "AI_CONSULT_ANSWERS_ENABLED",
    "operations": "AI_CONSULT_OPERATIONS_READY",
}


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
