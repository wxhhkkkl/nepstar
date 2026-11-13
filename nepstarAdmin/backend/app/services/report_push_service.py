"""检测报告推送服务 — 人工补发、设备回调自动投递、推送记录。

报告本体只从旧库 `inspect_base`/`ne` 读取；不写旧库。
推送记录写入 `nepstar.sa_report_push_log`。
"""

from __future__ import annotations

import asyncio
import time
from contextlib import suppress
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone

import httpx
import structlog
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import async_session
from ..models.new.sa_device_org import SADeviceOrg
from ..models.new.sa_report_push_log import SAReportPushLog
from ..models.old.inspect_base import inspect_base_table
from ..models.old.ne import ne_table
from ..security.org_filter import get_user_authorized_orgs
from ..utils.haixin_sign import build_sign
from .report_service import _build_report_url, _status_text

logger = structlog.get_logger()

STATUS_PENDING = "pending"
STATUS_SUCCESS = "success"
STATUS_FAILED = "failed"
STATUS_SKIPPED = "skipped"

TRIGGER_MANUAL = "manual"
TRIGGER_AUTO = "auto"

DEFAULT_FIELD_MAP = {
    "report_code": "reportId",
    "customer_id": "customerId",
    "device_sn": "deviceSn",
    "inspect_date": "inspectDate",
    "total_score": "totalScore",
    "report_url": "reportUrl",
}

# 回调早于报告落库时的重试节奏：首次立即查，之后 10s / 20s / 30s，共约 1 分钟。
LOOKUP_DELAYS = (0, 10, 20, 30)

CHINA_TZ = timezone(timedelta(hours=8), "GMT+8")  # 不依赖系统 tzdata


class ReportNotFoundError(Exception):
    """报告不存在。"""


class ReportInvalidError(Exception):
    """报告无效或缺少必要字段。"""


class ReportForbiddenError(Exception):
    """报告不在用户数据范围内。"""


class ReportUnavailableError(Exception):
    """旧库报告表不可用。"""


@dataclass
class DeliveryResult:
    status: str
    failure_reason: str | None = None
    response_summary: str | None = None


@dataclass
class CallbackDecision:
    record_id: int | None
    duplicate: bool
    should_deliver: bool


_background_tasks: set[asyncio.Task] = set()


# --- 报告读取 ---


def _row_to_report(row) -> dict:
    m = row._mapping
    report_code = m.get("report_code")
    customer_id = m.get("customer_id")
    return {
        "report_id": m.get("inspect_base_id"),
        "report_code": report_code,
        "customer_id": customer_id,
        "device_id": m.get("device_id"),
        "device_sn": m.get("sn_num"),
        "device_name": m.get("device_name"),
        "inspect_date": m.get("inspect_date"),
        "total_score": m.get("total_score"),
        "status": m.get("status"),
        "status_text": _status_text(m.get("status")),
        "name": m.get("name"),
        "mobile": m.get("mobile"),
        "report_url": _build_report_url(report_code, customer_id),
    }


def _report_query():
    if inspect_base_table is None:
        raise ReportUnavailableError("inspect_base unavailable")
    return (
        select(inspect_base_table, ne_table.c.device_name)
        .select_from(inspect_base_table)
        .join(ne_table, inspect_base_table.c.device_id == ne_table.c.ne_id, isouter=True)
        .where(inspect_base_table.c.dept_id == int(settings.DEPT_ID))
    )


async def fetch_report_by_id(db: AsyncSession, report_id: int) -> dict | None:
    row = (
        await db.execute(_report_query().where(inspect_base_table.c.inspect_base_id == report_id))
    ).first()
    return _row_to_report(row) if row else None


async def fetch_report_by_code(db: AsyncSession, report_code: str) -> dict | None:
    row = (
        await db.execute(_report_query().where(inspect_base_table.c.report_code == report_code))
    ).first()
    return _row_to_report(row) if row else None


async def assert_report_in_user_scope(db: AsyncSession, user_id: int, report: dict) -> None:
    """沿用报告列表的数据范围语义：admin/无授权角色返回空列表，表示不过滤。"""
    authorized_org_ids, _ = await get_user_authorized_orgs(user_id, db)
    if not authorized_org_ids:
        return
    device_id = report.get("device_id")
    if not device_id:
        raise ReportForbiddenError()
    allowed = (
        await db.execute(
            select(SADeviceOrg.id)
            .where(
                SADeviceOrg.device_id == device_id,
                SADeviceOrg.org_id.in_(authorized_org_ids),
            )
            .limit(1)
        )
    ).first()
    if allowed is None:
        raise ReportForbiddenError()


def _validate_report(report: dict | None) -> dict:
    if report is None:
        raise ReportNotFoundError()
    if (
        report.get("status") != 1
        or not report.get("report_code")
        or not report.get("customer_id")
        or not report.get("report_url")
    ):
        raise ReportInvalidError()
    return report


# --- 出站推送 ---


def _format_inspect_date(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return str(value)


def build_push_params(
    report: dict, timestamp: int | None = None, secret: str | None = None
) -> dict:
    """构造含系统参数与 sign 的表单参数。字段名可由部署配置覆盖。"""
    mapping = {**DEFAULT_FIELD_MAP, **(settings.HAIXIN_PUSH_FIELD_MAP or {})}
    values = {
        "report_code": report.get("report_code"),
        "customer_id": report.get("customer_id"),
        "device_sn": report.get("device_sn"),
        "inspect_date": _format_inspect_date(report.get("inspect_date")),
        "total_score": report.get("total_score"),
        "report_url": report.get("report_url"),
    }
    params = {
        "appKey": settings.HAIXIN_APP_KEY,
        "timestamp": str(timestamp if timestamp is not None else int(time.time())),
        "version": "1.0",
    }
    for key, value in values.items():
        if value is not None and value != "":
            params[mapping[key]] = str(value)
    signing_secret = secret if secret is not None else settings.HAIXIN_APP_SECRET
    params["sign"] = build_sign(params, signing_secret)
    return params


def _response_summary(status_code: int, body: dict | None) -> str:
    if not isinstance(body, dict):
        return f"HTTP {status_code}"[:500]
    code = body.get("code")
    message = str(body.get("message") or body.get("msg") or "")[:200]
    return f"HTTP {status_code} code={code} message={message}"[:500]


async def deliver_report(
    report: dict,
    *,
    timeout: float | None = None,
    client: httpx.AsyncClient | None = None,
) -> DeliveryResult:
    """同步投递一次；只负责调用客户接口并映射结果，不写数据库。"""
    if not settings.HAIXIN_PUSH_ENABLED:
        return DeliveryResult(STATUS_FAILED, "delivery.disabled")
    if not (
        settings.HAIXIN_PUSH_URL
        and settings.HAIXIN_APP_KEY
        and settings.HAIXIN_APP_SECRET
    ):
        return DeliveryResult(STATUS_FAILED, "delivery.config_missing")

    params = build_push_params(report)
    method = (settings.HAIXIN_PUSH_METHOD or "POST").upper()
    wait = timeout if timeout is not None else settings.HAIXIN_PUSH_TIMEOUT_SECONDS
    started = time.perf_counter()
    try:
        if client is None:
            async with httpx.AsyncClient(timeout=wait) as owned:
                response = await _send(owned, method, params)
        else:
            response = await _send(client, method, params)
    except httpx.TimeoutException:
        return DeliveryResult(STATUS_FAILED, "delivery.timeout")
    except httpx.HTTPError:
        return DeliveryResult(STATUS_FAILED, "delivery.network")
    finally:
        logger.info(
            "report_push_delivery",
            report_code=report.get("report_code"),
            trigger=report.get("_trigger"),
            duration_ms=int((time.perf_counter() - started) * 1000),
        )

    if response.status_code >= 400:
        return DeliveryResult(
            STATUS_FAILED, "delivery.network", _response_summary(response.status_code, None)
        )
    try:
        body = response.json()
    except ValueError:
        return DeliveryResult(
            STATUS_FAILED, "delivery.bad_response", _response_summary(response.status_code, None)
        )
    summary = _response_summary(response.status_code, body)
    code = body.get("code") if isinstance(body, dict) else None
    if str(code) != "0":
        return DeliveryResult(STATUS_FAILED, "delivery.rejected", summary)
    return DeliveryResult(STATUS_SUCCESS, None, summary)


async def _send(client: httpx.AsyncClient, method: str, params: dict) -> httpx.Response:
    if method == "GET":
        return await client.get(settings.HAIXIN_PUSH_URL, params=params)
    return await client.post(settings.HAIXIN_PUSH_URL, data=params)


# --- 推送记录 ---


def _materialize(
    report: dict, *, trigger: str, operator_id: int | None, dedupe: bool
) -> SAReportPushLog:
    return SAReportPushLog(
        report_id=report.get("report_id"),
        report_code=report["report_code"],
        device_sn=report.get("device_sn"),
        trigger_type=trigger,
        operator_id=operator_id,
        status=STATUS_PENDING,
        dedupe_key=report["report_code"] if dedupe else None,
        created_at=datetime.utcnow(),
    )


async def _finish(
    db: AsyncSession,
    record: SAReportPushLog,
    result: DeliveryResult,
) -> None:
    record.status = result.status
    record.failure_reason = result.failure_reason
    record.response_summary = result.response_summary
    record.finished_at = datetime.utcnow()
    if result.status == STATUS_FAILED:
        record.dedupe_key = None
    await db.commit()


async def manual_push(db: AsyncSession, report_id: int, operator_id: int) -> dict:
    """人工再次推送：同步等待客户响应，返回本次结果。"""
    report = _validate_report(await fetch_report_by_id(db, report_id))
    await assert_report_in_user_scope(db, operator_id, report)

    record = _materialize(report, trigger=TRIGGER_MANUAL, operator_id=operator_id, dedupe=False)
    db.add(record)
    await db.commit()
    await db.refresh(record)

    report["_trigger"] = TRIGGER_MANUAL
    result = await deliver_report(report)
    await _finish(db, record, result)
    return {
        "record_id": record.id,
        "status": record.status,
        "failure_reason": record.failure_reason,
    }


async def repush_record(db: AsyncSession, log_id: int, operator_id: int) -> dict:
    record = await db.get(SAReportPushLog, log_id)
    if record is None:
        raise ReportNotFoundError()
    report = _validate_report(await fetch_report_by_code(db, record.report_code))
    await assert_report_in_user_scope(db, operator_id, report)

    new_record = _materialize(report, trigger=TRIGGER_MANUAL, operator_id=operator_id, dedupe=False)
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)

    report["_trigger"] = TRIGGER_MANUAL
    result = await deliver_report(report)
    await _finish(db, new_record, result)
    return {
        "record_id": new_record.id,
        "status": new_record.status,
        "failure_reason": new_record.failure_reason,
    }


async def _has_success(db: AsyncSession, report_code: str) -> bool:
    row = (
        await db.execute(
            select(SAReportPushLog.id).where(
                SAReportPushLog.report_code == report_code,
                SAReportPushLog.status == STATUS_SUCCESS,
            ).limit(1)
        )
    ).first()
    return row is not None


async def _failed_auto_count(db: AsyncSession, report_code: str) -> int:
    return (
        await db.execute(
            select(func.count()).select_from(SAReportPushLog).where(
                SAReportPushLog.report_code == report_code,
                SAReportPushLog.trigger_type == TRIGGER_AUTO,
                SAReportPushLog.status == STATUS_FAILED,
            )
        )
    ).scalar() or 0


async def handle_callback(db: AsyncSession, report_code: str, device_sn: str) -> CallbackDecision:
    """回调受理：创建/复用自动记录并立即返回，不等待客户接口。"""
    existing = (
        await db.execute(
            select(SAReportPushLog).where(SAReportPushLog.dedupe_key == report_code)
        )
    ).scalar_one_or_none()
    if existing is not None:
        return CallbackDecision(existing.id, duplicate=True, should_deliver=False)

    if await _has_success(db, report_code):
        skipped = SAReportPushLog(
            report_id=None,
            report_code=report_code,
            device_sn=device_sn,
            trigger_type=TRIGGER_AUTO,
            operator_id=None,
            status=STATUS_SKIPPED,
            dedupe_key=report_code,
            created_at=datetime.utcnow(),
            finished_at=datetime.utcnow(),
        )
        db.add(skipped)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            return CallbackDecision(None, duplicate=True, should_deliver=False)
        return CallbackDecision(skipped.id, duplicate=False, should_deliver=False)

    if await _failed_auto_count(db, report_code) >= settings.HAIXIN_AUTO_MAX_FAILED_ATTEMPTS:
        return CallbackDecision(None, duplicate=True, should_deliver=False)

    record = SAReportPushLog(
        report_id=None,
        report_code=report_code,
        device_sn=device_sn,
        trigger_type=TRIGGER_AUTO,
        operator_id=None,
        status=STATUS_PENDING,
        dedupe_key=report_code,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return CallbackDecision(None, duplicate=True, should_deliver=False)
    await db.refresh(record)
    return CallbackDecision(record.id, duplicate=False, should_deliver=True)


async def process_auto_delivery(record_id: int) -> None:
    """异步定位报告并投递；回调早于数据落库时按 10s/20s/30s 重试。"""
    async with async_session() as db:
        record = await db.get(SAReportPushLog, record_id)
        if record is None or record.status != STATUS_PENDING:
            return

        report = None
        for attempt, delay in enumerate(LOOKUP_DELAYS):
            if delay:
                await asyncio.sleep(delay)
            try:
                report = await fetch_report_by_code(db, record.report_code)
            except ReportUnavailableError:
                report = None
            if report is not None:
                break
            if attempt == len(LOOKUP_DELAYS) - 1:
                break

        if report is None:
            await _finish(
                db,
                record,
                DeliveryResult(STATUS_FAILED, "report.not_found"),
            )
            return
        if report.get("status") != 1:
            await _finish(db, record, DeliveryResult(STATUS_FAILED, "report.invalid"))
            return
        if await _has_success(db, record.report_code):
            await _finish(db, record, DeliveryResult(STATUS_SKIPPED))
            return

        report["_trigger"] = TRIGGER_AUTO
        result = await deliver_report(report)
        await _finish(db, record, result)


def _log_task_result(task: asyncio.Task) -> None:
    _background_tasks.discard(task)
    if task.cancelled():
        return
    error = task.exception()
    if error is not None:
        logger.warning("report_push_task_failed", error=type(error).__name__)


def spawn_auto_delivery(record_id: int) -> None:
    task = asyncio.create_task(process_auto_delivery(record_id))
    _background_tasks.add(task)
    task.add_done_callback(_log_task_result)


async def cancel_background_tasks() -> None:
    tasks = list(_background_tasks)
    for task in tasks:
        task.cancel()
    for task in tasks:
        with suppress(asyncio.CancelledError):
            await task


async def sweep_stale_pending(max_age_minutes: int = 5) -> int:
    """进程重启后清理悬挂的 pending，避免永久卡住。"""
    cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
    async with async_session() as db:
        rows = (
            await db.execute(
                select(SAReportPushLog).where(
                    SAReportPushLog.status == STATUS_PENDING,
                    SAReportPushLog.created_at < cutoff,
                )
            )
        ).scalars().all()
        for row in rows:
            row.status = STATUS_FAILED
            row.failure_reason = "delivery.interrupted"
            row.dedupe_key = None
            row.finished_at = datetime.utcnow()
        if rows:
            await db.commit()
        return len(rows)


# --- 推送记录查询 ---


def _local_day_start(date_str: str) -> datetime:
    local = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=CHINA_TZ)
    return local.astimezone(UTC).replace(tzinfo=None)


def _local_day_end_exclusive(date_str: str) -> datetime:
    local = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=CHINA_TZ) + timedelta(days=1)
    return local.astimezone(UTC).replace(tzinfo=None)


def _serialize_record(record: SAReportPushLog) -> dict:
    return {
        "id": record.id,
        "report_id": record.report_id,
        "report_code": record.report_code,
        "device_sn": record.device_sn,
        "trigger_type": record.trigger_type,
        "operator_id": record.operator_id,
        "status": record.status,
        "failure_reason": record.failure_reason,
        "response_summary": record.response_summary,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "finished_at": record.finished_at.isoformat() if record.finished_at else None,
    }


async def list_push_records(
    db: AsyncSession,
    user_id: int,
    *,
    page: int = 1,
    page_size: int = 20,
    start_date: str | None = None,
    end_date: str | None = None,
    status: str | None = None,
    trigger_type: str | None = None,
    sn: str | None = None,
) -> dict:
    if inspect_base_table is None:
        return {"records": [], "total": 0, "page": page, "page_size": page_size}

    authorized_org_ids, _ = await get_user_authorized_orgs(user_id, db)
    accessible = select(inspect_base_table.c.report_code).where(
        inspect_base_table.c.dept_id == int(settings.DEPT_ID)
    )
    if authorized_org_ids:
        accessible = accessible.where(
            inspect_base_table.c.device_id.in_(
                select(SADeviceOrg.device_id).where(SADeviceOrg.org_id.in_(authorized_org_ids))
            )
        )

    base = select(SAReportPushLog).where(SAReportPushLog.report_code.in_(accessible))
    if start_date:
        try:
            base = base.where(SAReportPushLog.created_at >= _local_day_start(start_date))
        except ValueError:
            pass
    if end_date:
        try:
            base = base.where(SAReportPushLog.created_at < _local_day_end_exclusive(end_date))
        except ValueError:
            pass
    if status:
        base = base.where(SAReportPushLog.status == status)
    if trigger_type:
        base = base.where(SAReportPushLog.trigger_type == trigger_type)
    if sn:
        base = base.where(SAReportPushLog.device_sn.like(f"%{sn}%"))

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    rows = (
        await db.execute(
            base.order_by(SAReportPushLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return {
        "records": [_serialize_record(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
