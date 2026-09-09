"""客户管理 API 路由 — 客户列表查询（只读）。"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.response import ApiResponse
from ..security.rbac import check_permission
from ..services import customer_service

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("")
async def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    org_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(check_permission),
):
    """获取客户列表（需要"客户管理"菜单权限）。

    客户按 customer_id 去重，附带最近检测日期和报告总数。
    支持组织树级联筛选和时间范围过滤。
    手机号和姓名已在服务层脱敏后返回。
    """
    try:
        data = await customer_service.list_customers(
            db,
            user_id=user.id,
            page=page,
            page_size=page_size,
            org_id=org_id,
            start_date=start_date,
            end_date=end_date,
        )
        return ApiResponse(data=data)
    except ValueError as e:
        return ApiResponse(code=503, message=str(e))
