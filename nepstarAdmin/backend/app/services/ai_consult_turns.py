"""匿名问答轮次及生成状态；写入对象全部位于 nepstar。"""

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_ai_consult import (
    SAAiConsultGeneration,
    SAAiConsultSession,
    SAAiConsultTurn,
)
from .ai_consult_pipeline import CandidateOutcome


class TurnConflict(Exception):
    """同一幂等键用于不同问题，或旧生成结果晚到。"""


class TurnInProgress(Exception):
    """当前会话已有未结束的生成，先等待或停止它。"""


@dataclass(frozen=True)
class TurnStart:
    turn_id: int
    generation_id: int
    generation_epoch: int
    replay: bool
    status: str
    answer: str | None = None
    evidence: list[dict] | None = None
    error_category: str | None = None


def valid_request_id(value: str | None) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = UUID(value)
    except (ValueError, AttributeError):
        return False
    return str(parsed) == value and len(value) == 36


async def start_turn(
    db: AsyncSession,
    session: SAAiConsultSession,
    request_id: str,
    question: str,
) -> TurnStart:
    """调用方先锁定且验证 session；该行锁串行化同会话的序号和幂等键。"""
    if not valid_request_id(request_id) or not question.strip() or len(question) > 500:
        raise ValueError("Invalid consult question or request ID")
    clean_question = question.strip()
    existing_result = await db.execute(
        select(SAAiConsultTurn).where(
            SAAiConsultTurn.session_id == session.id,
            SAAiConsultTurn.client_request_id == request_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        if existing.question_text != clean_question:
            raise TurnConflict("Idempotency key belongs to another question")
        generation_result = await db.execute(
            select(SAAiConsultGeneration)
            .where(SAAiConsultGeneration.turn_id == existing.id)
            .order_by(SAAiConsultGeneration.attempt_number.desc())
            .limit(1)
        )
        generation = generation_result.scalar_one_or_none()
        if generation is None:
            raise TurnConflict("Turn has no generation")
        return TurnStart(
            existing.id,
            generation.id,
            generation.generation_epoch,
            True,
            existing.status,
            existing.answer_text,
            json.loads(existing.evidence_refs_json) if existing.evidence_refs_json else [],
            generation.error_category,
        )

    running_result = await db.execute(
        select(SAAiConsultTurn.id)
        .where(
            SAAiConsultTurn.session_id == session.id,
            SAAiConsultTurn.status == "running",
        )
        .limit(1)
    )
    if running_result.scalar_one_or_none() is not None:
        raise TurnInProgress()

    max_sequence = await db.scalar(
        select(func.coalesce(func.max(SAAiConsultTurn.sequence), 0)).where(
            SAAiConsultTurn.session_id == session.id
        )
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    session.generation_epoch += 1
    session.last_activity_at = now
    turn = SAAiConsultTurn(
        session_id=session.id,
        sequence=int(max_sequence or 0) + 1,
        client_request_id=request_id,
        question_text=clean_question,
        status="running",
        created_at=now,
    )
    db.add(turn)
    await db.flush()
    generation = SAAiConsultGeneration(
        turn_id=turn.id,
        attempt_number=1,
        generation_epoch=session.generation_epoch,
        status="running",
        started_at=now,
    )
    db.add(generation)
    await db.flush()
    return TurnStart(turn.id, generation.id, generation.generation_epoch, False, "running")


async def finalize_turn(
    db: AsyncSession,
    session: SAAiConsultSession,
    start: TurnStart,
    outcome: CandidateOutcome,
) -> bool:
    """仅当前 epoch 的、仍在运行的生成可以落库；返回能否发布完成事件。"""
    if start.replay or session.generation_epoch != start.generation_epoch:
        raise TurnConflict("Generation is no longer current")
    turn_result = await db.execute(
        select(SAAiConsultTurn).where(
            SAAiConsultTurn.id == start.turn_id,
            SAAiConsultTurn.session_id == session.id,
        ).with_for_update()
    )
    turn = turn_result.scalar_one_or_none()
    generation_result = await db.execute(
        select(SAAiConsultGeneration).where(
            SAAiConsultGeneration.id == start.generation_id,
            SAAiConsultGeneration.turn_id == start.turn_id,
            SAAiConsultGeneration.generation_epoch == start.generation_epoch,
        ).with_for_update()
    )
    generation = generation_result.scalar_one_or_none()
    if turn is None or generation is None or turn.status != "running" or generation.status != "running":
        raise TurnConflict("Generation state changed")

    now = datetime.now(UTC).replace(tzinfo=None)
    completed = outcome.state == "reviewed_candidate" and bool(outcome.evidence) and not outcome.is_completed
    if completed:
        turn.answer_text = outcome.text
        turn.evidence_refs_json = json.dumps(outcome.evidence, ensure_ascii=False)
        turn.completed_at = now
        turn.status = "completed"
        generation.status = "completed"
        generation.first_valid_chunk_at = now
    else:
        turn.status = "failed"
        generation.status = "failed"
        generation.error_category = outcome.state
    generation.finished_at = now
    session.last_activity_at = now
    return completed
