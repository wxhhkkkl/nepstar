"""Health plan management API routes (方案 + 商品/指标关联)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.plan import PlanCreate, PlanUpdate
from ..schemas.response import ApiResponse
from ..security.rbac import get_current_user
from ..services import plan_service

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("")
async def list_plans(
    page: int = 1,
    page_size: int = 10,
    keyword: str = "",
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    data = await plan_service.list_plans(db, page, page_size, keyword)
    return ApiResponse(data=data)


@router.get("/{plan_id}")
async def get_plan(
    plan_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    try:
        data = await plan_service.get_plan_detail(db, plan_id)
    except ValueError as e:
        return ApiResponse(code=404, message=str(e))
    return ApiResponse(data=data)


@router.post("")
async def create_plan(
    req: PlanCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    try:
        data = await plan_service.create_plan(db, req)
    except ValueError as e:
        return ApiResponse(code=400, message=str(e))
    return ApiResponse(data=data)


@router.put("/{plan_id}")
async def update_plan(
    plan_id: int,
    req: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        data = await plan_service.update_plan(db, plan_id, req)
    except ValueError as e:
        return ApiResponse(code=400, message=str(e))
    return ApiResponse(data=data)


@router.delete("/{plan_id}")
async def delete_plan(
    plan_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    try:
        await plan_service.delete_plan(db, plan_id)
    except ValueError as e:
        return ApiResponse(code=409, message=str(e))
    return ApiResponse()
