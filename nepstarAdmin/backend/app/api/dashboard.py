"""数据看板 API — 聚合统计 + 趋势数据。"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.response import ApiResponse
from ..security.rbac import get_current_user
from ..services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(
    start_date: str | None = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: str | None = Query(None, description="结束日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """获取数据看板统计（需要登录）。

    返回：stats（设备数/报告数/客户数）+ trend（趋势数据点）。
    所有统计受用户角色数据范围限制。
    """
    stats = await dashboard_service.get_dashboard_stats(db, user.id)
    trend = await dashboard_service.get_dashboard_trend(
        db, user.id, start_date=start_date, end_date=end_date
    )
    return ApiResponse(data={"stats": stats, "trend": trend})
