"""检测报告 API 路由 — 列表查询、详情查看（只读）与推送到客户。"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.response import ApiResponse
from ..security.rbac import check_permission
from ..services import report_push_service, report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
async def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    org_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sn: str | None = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(check_permission),
):
    """获取检测报告列表（需要"检测报告"菜单权限）。

    支持的组织树、时间范围、设备SN筛选。所有用户受全局 dept_id 过滤和数据范围限制。
    手机号和姓名已在服务层脱敏后返回。
    """
    data = await report_service.list_reports(
        db,
        user_id=user.id,
        page=page,
        page_size=page_size,
        org_id=org_id,
        start_date=start_date,
        end_date=end_date,
        sn=sn,
    )
    return ApiResponse(data=data)


@router.post("/{report_id}/push")
async def push_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(check_permission),
):
    """人工再次推送：同步等待客户接口（≤5 秒）并返回本次结果。"""
    try:
        data = await report_push_service.manual_push(db, report_id, user.id)
        return ApiResponse(data=data)
    except report_push_service.ReportNotFoundError:
        return ApiResponse(code=404, message="report.not_found")
    except report_push_service.ReportForbiddenError:
        return ApiResponse(code=403, message="report.forbidden")
    except report_push_service.ReportInvalidError:
        return ApiResponse(code=409, message="report.invalid")
    except report_push_service.ReportUnavailableError:
        return ApiResponse(code=503, message="report.unavailable")


@router.get("/push-records")
async def list_push_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: str | None = None,
    end_date: str | None = None,
    status: str | None = None,
    trigger_type: str | None = None,
    sn: str | None = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(check_permission),
):
    """推送记录列表，遵守与检测报告一致的组织数据范围。"""
    data = await report_push_service.list_push_records(
        db,
        user.id,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        status=status,
        trigger_type=trigger_type,
        sn=sn,
    )
    return ApiResponse(data=data)


@router.post("/push-records/{log_id}/repush")
async def repush_record(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(check_permission),
):
    """按推送记录重发；新增一条 manual 记录，原记录保留。"""
    try:
        data = await report_push_service.repush_record(db, log_id, user.id)
        return ApiResponse(data=data)
    except report_push_service.ReportNotFoundError:
        return ApiResponse(code=404, message="report.not_found")
    except report_push_service.ReportForbiddenError:
        return ApiResponse(code=403, message="report.forbidden")
    except report_push_service.ReportInvalidError:
        return ApiResponse(code=409, message="report.invalid")
    except report_push_service.ReportUnavailableError:
        return ApiResponse(code=503, message="report.unavailable")


@router.get("/{report_id}")
async def get_report_detail(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(check_permission),
):
    """获取单条报告详情（需要"检测报告"菜单权限，含 PII 脱敏）。"""
    try:
        data = await report_service.get_report_detail(db, report_id)
        return ApiResponse(data=data)
    except ValueError as e:
        return ApiResponse(code=404, message=str(e))
