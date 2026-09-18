"""报告展示数据接口（面向报告查看者）。

访问控制与后台管理接口**相互独立**：本路由不挂 `get_current_user`，
也不挂 `check_permission`；以报告编号 + 客户标识鉴权并校验归属（FR-021、FR-029）。
"""

import time

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.response import ApiResponse
from ..services import report_source, report_view_service
from ..utils.report_log import log_report_request

router = APIRouter(prefix="/report-view", tags=["report-view"])


@router.get("/{report_code}/home")
async def get_report_home(
    report_code: str,
    customer_id: int,
    db: AsyncSession = Depends(get_db),
):
    """报告首页聚合数据。一次返回首页所需的全部内容（FR-001）。"""
    started = time.perf_counter()
    try:
        data = await report_view_service.build_home(db, report_code, customer_id)
    except report_view_service.ReportViewError as exc:
        _log_failure(report_code, exc.reason, started)
        return ApiResponse(code=exc.code, message=exc.key)
    except report_source.ReportSourceUnavailableError as exc:
        _log_failure(report_code, "unavailable", started)
        return ApiResponse(code=503, message="report.unavailable", data={"detail": str(exc)})
    return ApiResponse(data=data)


@router.get("/{report_code}/systems/{system_code}")
async def get_report_system_detail(
    report_code: str,
    system_code: str,
    customer_id: int,
    db: AsyncSession = Depends(get_db),
):
    """系统二级详情。与首页同源，额外给出指标、直接采集值与文案（FR-007）。"""
    started = time.perf_counter()
    try:
        data = await report_view_service.build_system_detail(
            db, report_code, system_code, customer_id
        )
    except report_view_service.ReportViewError as exc:
        _log_failure(report_code, exc.reason, started)
        return ApiResponse(code=exc.code, message=exc.key)
    except report_source.ReportSourceUnavailableError as exc:
        _log_failure(report_code, "unavailable", started)
        return ApiResponse(code=503, message="report.unavailable", data={"detail": str(exc)})
    return ApiResponse(data=data)


def _log_failure(report_code: str, outcome: str, started: float) -> None:
    log_report_request(
        report_code=report_code,
        outcome=outcome,
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
