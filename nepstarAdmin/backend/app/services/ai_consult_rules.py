"""Immutable AI answer-rule versions; callers use the dedicated nepstar session."""

import hashlib

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_ai_consult import SAAiConsultRuleVersion


class ConsultRuleUnavailable(RuntimeError):
    """A pinned or active rule is missing, unpublished, or fails integrity checks."""


def rule_content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def load_rule_content(
    db: AsyncSession,
    rule_version_id: int | None,
    *,
    allow_retired: bool = False,
) -> str | None:
    if rule_version_id is None:
        return None
    row = await db.scalar(
        select(SAAiConsultRuleVersion).where(
            SAAiConsultRuleVersion.id == rule_version_id
        )
    )
    allowed_statuses = {"published", "retired"} if allow_retired else {"published"}
    if (
        row is None
        or row.status not in allowed_statuses
        or not isinstance(row.content, str)
        or not row.content.strip()
        or len(row.content) > 2000
        or row.content_hash != rule_content_hash(row.content)
    ):
        raise ConsultRuleUnavailable("Consult rule is unavailable")
    return row.content
