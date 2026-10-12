"""匿名咨询欢迎数据：只转换已验证的报告聚合结果，不生成示例报告。"""

import math
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_ai_consult import (
    SAAiConsultConsent, SAAiConsultGeneration, SAAiConsultGuest,
    SAAiConsultSession, SAAiConsultTurn,
)
from .ai_consult_plan_context import resolve_entry_context

SESSION_IDLE_TIMEOUT = timedelta(minutes=10)


def _score(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(value) or value < 0 or value > 100 or int(value) != value:
        return None
    return int(value)


def build_welcome_context(home: dict[str, Any]) -> dict[str, Any]:
    """从现有报告首页数据挑选可核对字段；缺项不推断或填充假分数。"""
    report = home.get("report") or {}
    systems = home.get("systems") or []
    date = report.get("report_date")
    total = _score(report.get("total_score"))
    visible = [item for item in systems if isinstance(item, dict)]
    scored = [
        (str(item["name"]), _score(item.get("score")))
        for item in visible
        if item.get("name") and _score(item.get("score")) is not None
    ]
    scored.sort(key=lambda item: item[1])

    if total is None:
        summary = f"本次报告展示 {len(visible)} 个身体系统；总分未提供。"
    else:
        summary = f"本次报告总分 {total} 分，展示 {len(visible)} 个身体系统。"

    questions = [
        f"我的{name}活力值{score}分，应该如何理解？"
        for name, score in scored[:2]
    ]
    if total is not None:
        questions.append(f"本次报告总分{total}分，我应该优先关注什么？")
    else:
        questions.append("这份报告的总体结果应该如何理解？")
    for fallback in (
        "这份报告有哪些指标值得关注？",
        "本次报告与历史检测有可核对的变化吗？",
    ):
        if len(questions) >= 3:
            break
        questions.append(fallback)

    management_plans = []
    for system in visible:
        recommendation = system.get("recommendation")
        if not isinstance(recommendation, dict):
            continue
        context = resolve_entry_context(
            home,
            plan_id=recommendation.get("plan_id"),
            indicator_code=recommendation.get("trigger_indicator_code"),
        )
        if not context or context["type"] != "plan":
            continue
        products = recommendation.get("products") or []
        product = next((item for item in products if isinstance(item, dict) and item.get("image_url")), {})
        management_plans.append({
            **context,
            "description": recommendation.get("description"),
            "image_url": product.get("image_url"),
            "image_alt": product.get("image_alt") or product.get("name") or context["plan_name"],
        })

    return {
        "report_date": date,
        "report_score": total,
        "report_summary": summary,
        "focus_systems": [{"name": name, "score": score} for name, score in scored[:2]],
        "management_plans": management_plans,
        "suggested_questions": questions[:3],
    }


class ConsultReportDateUnavailable(Exception):
    """已验证报告没有可安全固定到会话的检测日期。"""


def verified_report_date(home: dict[str, Any], expected_report_code: str) -> date:
    report = home.get("report") or {}
    if report.get("report_code") != expected_report_code:
        raise ConsultReportDateUnavailable()
    value = report.get("report_date")
    try:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str) and len(value) >= 10:
            return date.fromisoformat(value[:10])
    except ValueError as exc:
        raise ConsultReportDateUnavailable() from exc
    raise ConsultReportDateUnavailable()


def new_home_session(
    guest: SAAiConsultGuest,
    consent: SAAiConsultConsent | None,
    report_date: date,
    *,
    source: str = "home",
    plan_id: int | None = None,
    indicator_code: str | None = None,
    now: datetime | None = None,
) -> SAAiConsultSession:
    current = now or datetime.now(UTC).replace(tzinfo=None)
    if (consent is not None and consent.guest_id != guest.id) or guest.revoked_at is not None or current >= guest.expires_at:
        raise ValueError("Guest must be valid for this session")
    guest.last_activity_at = current
    return SAAiConsultSession(
        id=str(uuid.uuid4()),
        guest_id=guest.id,
        report_code=guest.report_code,
        customer_id=guest.customer_id,
        report_date=report_date,
        source=source,
        source_plan_id=plan_id,
        source_indicator_code=indicator_code,
        consent_id=consent.id if consent is not None else None,
        title=None,
        status="active",
        created_at=current,
        last_activity_at=current,
        expires_at=min(current + timedelta(days=30), guest.expires_at),
        generation_epoch=0,
    )


def public_session(item: SAAiConsultSession) -> dict[str, Any]:
    """不返回客户标识、guest、告知主键及未来聊天正文。"""
    return {
        "id": item.id,
        "report_code": item.report_code,
        "report_date": item.report_date.isoformat(),
        "source": item.source,
        "source_plan_id": item.source_plan_id,
        "source_indicator_code": item.source_indicator_code,
        "title": item.title,
        "status": item.status,
        "created_at": item.created_at.isoformat() + "Z",
        "last_activity_at": item.last_activity_at.isoformat() + "Z",
        "expires_at": item.expires_at.isoformat() + "Z",
    }


def revoke_guest_session(item: SAAiConsultSession, *, now: datetime | None = None) -> None:
    """撤销会话访问并使正在生成的结果失效；永久留存的问答正文不做清理。"""
    current = now or datetime.now(UTC).replace(tzinfo=None)
    item.status = "deleted"
    item.deleted_at = current
    item.last_activity_at = current
    item.generation_epoch += 1


async def get_guest_session(
    db: AsyncSession, guest: SAAiConsultGuest, report_code: str, session_id: str,
    *, lock: bool = False,
) -> SAAiConsultSession | None:
    current = datetime.now(UTC).replace(tzinfo=None)
    statement = select(SAAiConsultSession).where(
        SAAiConsultSession.id == session_id,
        SAAiConsultSession.guest_id == guest.id,
        SAAiConsultSession.report_code == report_code,
        SAAiConsultSession.status == "active",
        SAAiConsultSession.deleted_at.is_(None),
        SAAiConsultSession.expires_at > current,
        SAAiConsultSession.last_activity_at > current - SESSION_IDLE_TIMEOUT,
    )
    if lock:
        statement = statement.with_for_update()
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def is_latest_guest_session(
    db: AsyncSession, guest: SAAiConsultGuest, report_code: str, session_id: str,
) -> bool:
    """允许当前咨询断线恢复，但不允许通过旧会话 ID 读取之前的咨询。"""
    statement = (
        select(SAAiConsultSession.id)
        .where(
            SAAiConsultSession.guest_id == guest.id,
            SAAiConsultSession.report_code == report_code,
        )
        .order_by(SAAiConsultSession.created_at.desc(), SAAiConsultSession.id.desc())
        .limit(1)
    )
    # Do not acquire a second session lock after the settings lock: another
    # request could hold that session while waiting for settings (lock inversion).
    result = await db.execute(statement)
    return result.scalar_one_or_none() == session_id


async def end_guest_session(
    db: AsyncSession, guest: SAAiConsultGuest, report_code: str, session_id: str,
    *, now: datetime | None = None,
) -> SAAiConsultSession | None:
    """End an owned session idempotently; retain completed answers and usage."""
    item = (await db.execute(
        select(SAAiConsultSession).where(
            SAAiConsultSession.id == session_id,
            SAAiConsultSession.guest_id == guest.id,
            SAAiConsultSession.report_code == report_code,
            SAAiConsultSession.deleted_at.is_(None),
        ).with_for_update()
    )).scalar_one_or_none()
    if item is None or item.status not in {"active", "ended"}:
        return None
    if item.status == "ended":
        return item
    current = now or datetime.now(UTC).replace(tzinfo=None)
    item.status = "ended"
    item.generation_epoch += 1
    # last_activity_at remains the last user question/retry time.
    turns = (await db.execute(
        select(SAAiConsultTurn).where(
            SAAiConsultTurn.session_id == item.id,
            SAAiConsultTurn.status == "running",
        ).with_for_update()
    )).scalars().all()
    if turns:
        generations = (await db.execute(
            select(SAAiConsultGeneration).where(
                SAAiConsultGeneration.turn_id.in_([turn.id for turn in turns]),
                SAAiConsultGeneration.status == "running",
            ).with_for_update()
        )).scalars().all()
        for turn in turns:
            turn.status = "stopped"
        for generation in generations:
            generation.status = "stopped"
            generation.error_category = "session_ended"
            generation.finished_at = current
            generation.partial_text = None
    return item
