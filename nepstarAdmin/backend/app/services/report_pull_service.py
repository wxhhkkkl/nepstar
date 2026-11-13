"""客户主动拉取报告的只读查询。

与后台 `report_service` 的差异：
- 不套用后台用户 RBAC，只按全局 DEPT_ID 与有效状态过滤；
- 返回完整姓名/手机号（合作伙伴用于会员匹配），由调用方保证 HTTPS 与日志脱敏。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from datetime import time as dt_time

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.old.inspect_base import inspect_base_table
from ..models.old.ne import ne_table
from .report_service import _build_report_url, _status_text

CHINA_TZ = timezone(timedelta(hours=8), "GMT+8")  # 不依赖系统 tzdata


class PullParamError(ValueError):
    """拉取参数非法（日期、区间、分页）。"""


class PullUnavailableError(RuntimeError):
    """报告数据源不可用。"""


def resolve_secret(app_key: str) -> str | None:
    """按 appKey 查找 secret；主凭据优先，支持新旧凭据并存。"""
    merged = dict(settings.HAIXIN_APP_KEYS or {})
    if settings.HAIXIN_APP_KEY and settings.HAIXIN_APP_SECRET:
        merged[settings.HAIXIN_APP_KEY] = settings.HAIXIN_APP_SECRET
    return merged.get(app_key) or None


def _parse_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError) as exc:
        raise PullParamError("invalid date") from exc


def parse_range(start_date: str | None, end_date: str | None) -> tuple[datetime, datetime]:
    """返回 [start, end_exclusive) 的本地时间区间（旧库时间为 GMT+8 本地时间）。"""
    today = datetime.now(CHINA_TZ).date()
    end = _parse_date(end_date) if end_date else today
    if start_date:
        start = _parse_date(start_date)
    else:
        days = max(settings.HAIXIN_PULL_DEFAULT_DAYS, 1)
        start = end - timedelta(days=days - 1)
    if start > end:
        raise PullParamError("startDate after endDate")
    if (end - start).days + 1 > settings.HAIXIN_PULL_MAX_DAYS:
        raise PullParamError("range exceeds max days")
    return (
        datetime.combine(start, dt_time.min),
        datetime.combine(end + timedelta(days=1), dt_time.min),
    )


def resolve_page(page: int | None, page_size: int | None) -> tuple[int, int]:
    current = max(page or 1, 1)
    size = page_size or settings.HAIXIN_PULL_DEFAULT_PAGE_SIZE
    size = max(1, min(size, settings.HAIXIN_PULL_MAX_PAGE_SIZE))
    return current, size


def _serialize(row) -> dict:
    m = row._mapping
    report_code = m.get("report_code")
    customer_id = m.get("customer_id")
    inspect_date = m.get("inspect_date")
    return {
        "report_id": m.get("inspect_base_id"),
        "report_code": report_code,
        "customer_id": customer_id,
        "device_sn": m.get("sn_num"),
        "device_name": m.get("device_name"),
        "inspect_date": (
            inspect_date.isoformat() if isinstance(inspect_date, datetime) else inspect_date
        ),
        "total_score": m.get("total_score"),
        "status": m.get("status"),
        "status_text": _status_text(m.get("status")),
        "name": m.get("name"),
        "mobile": m.get("mobile"),
        "report_url": _build_report_url(report_code, customer_id),
    }


async def list_reports_for_partner(
    db: AsyncSession,
    start: datetime,
    end_exclusive: datetime,
    page: int,
    page_size: int,
) -> dict:
    if inspect_base_table is None:
        raise PullUnavailableError()

    base = (
        select(inspect_base_table, ne_table.c.device_name)
        .select_from(inspect_base_table)
        .join(ne_table, inspect_base_table.c.device_id == ne_table.c.ne_id, isouter=True)
        .where(
            inspect_base_table.c.dept_id == int(settings.DEPT_ID),
            inspect_base_table.c.status == 1,
            inspect_base_table.c.inspect_date >= start,
            inspect_base_table.c.inspect_date < end_exclusive,
        )
    )
    try:
        total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
        rows = (
            await db.execute(
                base.order_by(inspect_base_table.c.inspect_date.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    except SQLAlchemyError as exc:
        raise PullUnavailableError() from exc

    return {
        "records": [_serialize(row) for row in rows],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "startDate": start.date().isoformat(),
        "endDate": (end_exclusive - timedelta(days=1)).date().isoformat(),
    }
