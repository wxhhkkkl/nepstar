"""Operator dashboard and permanent conversations, using nepstar tables only.

Known provider usage and conservative reservations are deliberately separate.
Business dates are Asia/Shanghai; stored timestamps remain naive UTC. Private
content is read only by the independently authorized conversation endpoint.
"""

import calendar
import json
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import String, case, func, select
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from ..models.new.sa_ai_consult import (
    SAAiConsultAdminAudit, SAAiConsultGeneration as Generation,
    SAAiConsultSession as Session, SAAiConsultTurn as Turn,
)
from .ai_consult_recovery import STALE_AFTER
from .ai_consult_sessions import SESSION_IDLE_TIMEOUT

BUSINESS_ZONE = ZoneInfo("Asia/Shanghai")


class LocalBucket(FunctionElement):
    """Fixed UTC+8 buckets without requiring MySQL timezone tables."""
    type = String()
    inherit_cache = False

    def __init__(self, column, *, hourly):
        self.hourly = hourly
        super().__init__(column)


@compiles(LocalBucket)
def _mysql_bucket(element, compiler, **kw):
    column = compiler.process(list(element.clauses)[0], **kw)
    pattern = "%H" if element.hourly else "%d"
    # No user-provided SQL, format or offset enters this expression.
    literal = compiler.render_literal_value(pattern, String())
    return f"DATE_FORMAT(TIMESTAMPADD(HOUR, 8, {column}), {literal})"


@compiles(LocalBucket, "sqlite")
def _sqlite_bucket(element, compiler, **kw):
    column = compiler.process(list(element.clauses)[0], **kw)
    return f"strftime('{('%H' if element.hourly else '%d')}', {column}, '+8 hours')"


def utc_now(now=None):
    value = now or datetime.now(UTC)
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def utc_bounds(start: date, end: date):
    return tuple(datetime.combine(value, datetime.min.time(), BUSINESS_ZONE)
                 .astimezone(UTC).replace(tzinfo=None) for value in (start, end))


def stamp(value):
    return value.replace(tzinfo=UTC).isoformat(timespec="seconds").replace("+00:00", "Z") if value else None


def usage_columns():
    known = Generation.prompt_tokens.is_not(None) & Generation.completion_tokens.is_not(None)
    return (
        func.coalesce(func.sum(case((known, Generation.prompt_tokens), else_=0)), 0).label("input_tokens"),
        func.coalesce(func.sum(case((known, Generation.completion_tokens), else_=0)), 0).label("output_tokens"),
        func.coalesce(func.sum(case((~known, Generation.budget_tokens), else_=0)), 0).label("reserved_tokens"),
        func.count(case((~known, 1))).label("unreported_attempts"),
    )


def usage_value(row):
    input_tokens, output_tokens = int(row["input_tokens"] or 0), int(row["output_tokens"] or 0)
    return {"input_tokens": input_tokens, "output_tokens": output_tokens,
            "actual_tokens": input_tokens + output_tokens,
            "reserved_tokens": int(row["reserved_tokens"] or 0),
            "unreported_attempts": int(row["unreported_attempts"] or 0)}


def usage_total(points):
    return {key: sum(point[key] or 0 for point in points)
            for key in ("input_tokens", "output_tokens", "actual_tokens", "reserved_tokens", "unreported_attempts")}


async def load_dashboard(db, *, day=None, month=None, now=None):
    current = utc_now(now)
    local = current.astimezone(BUSINESS_ZONE)
    selected_day = day or local.date()
    selected_month = date.fromisoformat(f"{month}-01") if month else local.date().replace(day=1)
    if selected_day > local.date() or selected_month > local.date().replace(day=1):
        raise ValueError("Future dashboard period rejected")
    month_days = calendar.monthrange(selected_month.year, selected_month.month)[1]
    month_end = selected_month + timedelta(days=month_days)
    periods = ((selected_day, selected_day + timedelta(days=1), True),
               (selected_month, month_end, False))
    groups = []
    day_counts = {"completed": 0, "failed": 0}
    for start, end, hourly in periods:
        lower, upper = utc_bounds(start, end)
        bucket = LocalBucket(Generation.started_at, hourly=hourly)
        rows = (await db.execute(select(
            bucket.label("bucket"), *usage_columns(),
            func.count(case((Generation.status == "completed", 1))).label("completed"),
            func.count(case((Generation.status == "failed", 1))).label("failed"),
        ).where(Generation.started_at >= lower, Generation.started_at < upper,
                Generation.started_at <= current.replace(tzinfo=None)).group_by(bucket))).mappings().all()
        lookup = {int(row["bucket"]): row for row in rows}
        points = []
        for index in range(24) if hourly else range(1, month_days + 1):
            future = (start == local.date() and index > local.hour) if hourly else (
                start.replace(day=index) > local.date())
            usage = usage_value(lookup[index]) if index in lookup else usage_value({
                "input_tokens": 0, "output_tokens": 0, "reserved_tokens": 0, "unreported_attempts": 0})
            points.append({"label": f"{index:02}:00" if hourly else f"{index:02}",
                           **{key: None if future else value for key, value in usage.items()},
                           "future": future})
        groups.append(points)
        if hourly:
            day_counts = {key: sum(int(row[key] or 0) for row in rows) for key in day_counts}
    day_lower, day_upper = utc_bounds(selected_day, selected_day + timedelta(days=1))
    sessions = await db.scalar(select(func.count(Session.id)).where(
        Session.created_at >= day_lower, Session.created_at < day_upper,
        Session.created_at <= current.replace(tzinfo=None)))
    running, stale = (await db.execute(select(
        func.count(case((Generation.status == "running", 1))),
        func.count(case(((Generation.status == "running")
                         & (Generation.started_at <= current.replace(tzinfo=None) - STALE_AFTER), 1))),
    ))).one()
    ended = day_counts["completed"] + day_counts["failed"]
    return {"timezone": "Asia/Shanghai", "day": selected_day.isoformat(),
            "month": selected_month.strftime("%Y-%m"), "generated_at": stamp(current),
            "day_sessions": int(sessions or 0), "day_completed": day_counts["completed"],
            "day_failed": day_counts["failed"],
            "completion_rate_percent": round(100 * day_counts["completed"] / ended, 1) if ended else None,
            "running": int(running or 0), "stale_running": int(stale or 0),
            "day_usage": usage_total(groups[0]), "month_usage": usage_total(groups[1]),
            "hourly_trend": groups[0], "daily_trend": groups[1]}


def session_query(*, now=None):
    turns = select(Turn.session_id, func.count(Turn.id).label("turn_count"))\
        .group_by(Turn.session_id).subquery()
    usage = select(Turn.session_id, *usage_columns())\
        .join(Generation, Generation.turn_id == Turn.id).group_by(Turn.session_id).subquery()
    state = case((func.coalesce(turns.c.turn_count, 0) == 0, "empty"),
                 ((Session.status != "active") | Session.deleted_at.is_not(None)
                  | (Session.last_activity_at <= utc_now(now).replace(tzinfo=None) - SESSION_IDLE_TIMEOUT),
                  "ended"), else_="active").label("state")
    statement = select(Session.id, Session.report_code, Session.customer_id, Session.report_date,
                       Session.source, Session.source_indicator_code, Session.source_plan_id,
                       Session.created_at, Session.last_activity_at,
                       func.coalesce(turns.c.turn_count, 0).label("turn_count"), state,
                       *[func.coalesce(usage.c[key], 0).label(key) for key in (
                           "input_tokens", "output_tokens", "reserved_tokens", "unreported_attempts")])\
        .outerjoin(turns, turns.c.session_id == Session.id)\
        .outerjoin(usage, usage.c.session_id == Session.id)
    return statement, state


def session_value(row):
    return {key: row[key] for key in ("id", "report_code", "customer_id", "source", "state",
                                     "source_indicator_code", "source_plan_id", "turn_count")} | {
        "report_date": row["report_date"].isoformat(),
        "created_at": stamp(row["created_at"]), "last_activity_at": stamp(row["last_activity_at"]),
        "usage": usage_value(row),
    }


async def list_sessions(db, *, report_code=None, customer_id=None, start_date=None, end_date=None,
                        state=None, page=1, page_size=20, now=None):
    if start_date and end_date and start_date > end_date:
        raise ValueError("Reversed session date range")
    statement, state_column = session_query(now=now)
    if report_code:
        # Exact report search; no arbitrary SQL or wildcard matching.
        statement = statement.where(Session.report_code == report_code.strip())
    if customer_id:
        statement = statement.where(Session.customer_id == customer_id)
    if start_date:
        statement = statement.where(Session.created_at >= utc_bounds(start_date, start_date + timedelta(days=1))[0])
    if end_date:
        statement = statement.where(Session.created_at < utc_bounds(end_date, end_date + timedelta(days=1))[1])
    if state:
        statement = statement.where(state_column == state)
    total = await db.scalar(select(func.count()).select_from(statement.subquery()))
    rows = (await db.execute(statement.order_by(Session.last_activity_at.desc(), Session.id.desc())
                            .offset((page - 1) * page_size).limit(page_size))).mappings().all()
    return {"records": [session_value(row) for row in rows], "total": int(total or 0),
            "page": page, "page_size": page_size}


def evidence_labels(raw):
    """Plain labels only; never return arbitrary stored JSON or credential URLs."""
    try:
        items = json.loads(raw) if isinstance(raw, str) and len(raw) <= 65536 else []
    except ValueError:
        return []
    if not isinstance(items, list):
        return []
    return [{"label": item["label"][:160], "kind": item.get("kind") if item.get("kind") in (
        "report", "knowledge", "plan", "trend") else "other"}
        for item in items[:20] if isinstance(item, dict) and isinstance(item.get("label"), str)]


async def load_session_detail(db, session_id, *, actor_admin_id, limit=30, offset=0):
    """Read every retained session regardless of guest token lifetime; audit read."""
    statement, _state = session_query()
    row = (await db.execute(statement.where(Session.id == session_id))).mappings().one_or_none()
    if row is None:
        return None
    turns = (await db.execute(select(Turn).where(Turn.session_id == session_id)
                             .order_by(Turn.sequence, Turn.id).limit(limit).offset(offset))).scalars().all()
    attempts = (await db.execute(select(Generation).where(Generation.turn_id.in_([turn.id for turn in turns]))
                                .order_by(Generation.turn_id, Generation.attempt_number))).scalars().all() if turns else []
    by_turn = {}
    safe_errors = {"worker_timeout", "timeout", "provider_unavailable", "report_unavailable",
                   "unsafe_answer", "insufficient_evidence", "private_input", "emergency",
                   "clinical_boundary", "longevity_boundary", "session_ended", "user_stopped"}
    for item in attempts:
        known = item.prompt_tokens is not None and item.completion_tokens is not None
        by_turn.setdefault(item.turn_id, []).append({
            "attempt_number": item.attempt_number, "status": item.status,
            "model_code": item.model_code, "input_tokens": item.prompt_tokens,
            "output_tokens": item.completion_tokens,
            "actual_tokens": item.prompt_tokens + item.completion_tokens if known else None,
            "reserved_tokens": 0 if known else int(item.budget_tokens or 0),
            "error_category": item.error_category if item.error_category in safe_errors else (
                "unknown" if item.error_category else None),
            "started_at": stamp(item.started_at), "finished_at": stamp(item.finished_at),
        })
    result = {"session": session_value(row), "turns": [{
        "id": turn.id, "sequence": turn.sequence, "question": turn.question_text,
        "answer": turn.answer_text, "status": turn.status,
        "created_at": stamp(turn.created_at), "completed_at": stamp(turn.completed_at),
        "feedback": turn.feedback_value, "evidence": evidence_labels(turn.evidence_refs_json),
        "attempts": by_turn.get(turn.id, []),
    } for turn in turns], "limit": limit, "offset": offset,
              "has_more": offset + len(turns) < int(row["turn_count"])}
    # Access auditing never copies report/user identifiers, questions or answers.
    db.add(SAAiConsultAdminAudit(actor_admin_id=actor_admin_id, action="session.read",
                              target_id=session_id, change_summary_json=json.dumps({"offset": offset, "limit": limit}),
                              occurred_at=utc_now().replace(tzinfo=None)))
    await db.commit()
    return result
