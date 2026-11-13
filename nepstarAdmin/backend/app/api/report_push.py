"""对外集成路由：设备检测完成回调 + 客户主动拉取报告。

两组路由都不挂 JWT：
- 回调按业务决定不做签名，部署层需限制来源 IP；
- 拉取使用海王 appKey/secret 签名校验。
"""

from __future__ import annotations

import json
import time

import structlog
from fastapi import APIRouter, Depends, Request
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..schemas.report_push import DeviceCallbackPayload
from ..schemas.response import ApiResponse
from ..services import report_pull_service, report_push_service
from ..utils.haixin_sign import timestamp_is_fresh, verify_sign

router = APIRouter(tags=["report-push"])
logger = structlog.get_logger()


@router.post("/report-callback/device")
async def device_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """设备检测完成回调：校验定位字段后立即应答，客户推送异步执行。"""
    try:
        body = await request.json()
        payload = DeviceCallbackPayload.model_validate(body)
    except (ValueError, ValidationError):
        return ApiResponse(code=400, message="callback.invalid")

    decision = await report_push_service.handle_callback(
        db, payload.reportId, payload.deviceId
    )
    if decision.should_deliver and decision.record_id is not None:
        report_push_service.spawn_auto_delivery(decision.record_id)
    return ApiResponse(data={"accepted": True, "duplicate": decision.duplicate})


def _pull_error(code: str, reason: str, app_key: str, started: float):
    logger.info(
        "report_pull",
        app_key=app_key[:32],
        result="failed",
        code=code,
        failure_reason=reason,
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
    # 对外统一错误文案，避免通过错误差异枚举 appKey/签名。
    message = "invalid params" if code == "400" else "unauthorized"
    if code == "503":
        message = "report data unavailable"
    return {"code": code, "message": message, "data": None}


@router.get("/open/reports")
async def pull_reports(request: Request, db: AsyncSession = Depends(get_db)):
    """客户按时间范围拉取报告；响应遵循海王字符串 code 与 JSON 字符串 data。"""
    started = time.perf_counter()
    params = dict(request.query_params)
    app_key = params.get("appKey", "")
    version = params.get("version", "")

    secret = report_pull_service.resolve_secret(app_key)
    if secret is None or version != "1.0":
        return _pull_error("401", "credential", app_key, started)
    if not timestamp_is_fresh(params.get("timestamp"), settings.HAIXIN_SIGN_TOLERANCE_SECONDS):
        return _pull_error("401", "timestamp", app_key, started)
    if not verify_sign(params, secret):
        return _pull_error("401", "signature", app_key, started)

    try:
        page, page_size = report_pull_service.resolve_page(
            int(params.get("page") or 0), int(params.get("pageSize") or 0)
        )
        start, end_exclusive = report_pull_service.parse_range(
            params.get("startDate"), params.get("endDate")
        )
    except (ValueError, report_pull_service.PullParamError):
        return _pull_error("400", "params", app_key, started)

    try:
        data = await report_pull_service.list_reports_for_partner(
            db, start, end_exclusive, page, page_size
        )
    except report_pull_service.PullUnavailableError:
        return _pull_error("503", "unavailable", app_key, started)

    logger.info(
        "report_pull",
        app_key=app_key[:32],
        result="success",
        total=data["total"],
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
    return {"code": "0", "message": "success", "data": json.dumps(data, ensure_ascii=False)}
