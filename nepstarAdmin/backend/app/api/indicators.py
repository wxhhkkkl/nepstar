"""Health indicator management API routes (两级指标)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.indicator import IndicatorCreate, IndicatorUpdate
from ..schemas.response import ApiResponse
from ..security.rbac import get_current_user
from ..services import indicator_service

router = APIRouter(prefix="/indicators", tags=["indicators"])


@router.get("/tree")
async def get_indicator_tree(keyword: str = "", status: int | None = None,
                             db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    data = await indicator_service.get_tree(db, keyword=keyword, status=status)
    return ApiResponse(data=data)


@router.post("")
async def create_indicator(req: IndicatorCreate, db: AsyncSession = Depends(get_db),
                           user=Depends(get_current_user)):
    try:
        row = await indicator_service.create_indicator(db, req)
    except ValueError as e:
        return ApiResponse(code=400, message=str(e))
    return ApiResponse(data=row)


@router.put("/{indicator_id}")
async def update_indicator(indicator_id: int, req: IndicatorUpdate,
                           db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    try:
        row = await indicator_service.update_indicator(db, indicator_id, req)
    except ValueError as e:
        return ApiResponse(code=400, message=str(e))
    return ApiResponse(data=row)


@router.delete("/{indicator_id}")
async def delete_indicator(indicator_id: int, db: AsyncSession = Depends(get_db),
                           user=Depends(get_current_user)):
    try:
        await indicator_service.delete_indicator(db, indicator_id)
    except ValueError as e:
        return ApiResponse(code=409, message=str(e))
    return ApiResponse()
