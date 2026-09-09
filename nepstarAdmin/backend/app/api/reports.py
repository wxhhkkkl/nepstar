"""检测报告 API 路由 — 列表查询、详情查看（只读）。"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.response import ApiResponse
from ..security.rbac import check_permission, get_current_user
from ..services import report_service

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
