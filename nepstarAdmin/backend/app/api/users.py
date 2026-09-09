"""User management API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.response import ApiResponse
from ..schemas.user import UserCreate, UserUpdate
from ..security.rbac import get_current_user
from ..services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def list_users(page: int = 1, page_size: int = 10, keyword: str = "",
                     db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    data = await user_service.list_users(db, page, page_size, keyword)
    return ApiResponse(data=data)


@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db),
                   user=Depends(get_current_user)):
    detail = await user_service.get_user_detail(db, user_id)
    return ApiResponse(data=detail)


@router.post("")
async def create_user_endpoint(req: UserCreate, db: AsyncSession = Depends(get_db),
                               user=Depends(get_current_user)):
    try:
        new_user = await user_service.create_user(db, req, user.id)
        return ApiResponse(data={"id": new_user.id})
    except ValueError as e:
        return ApiResponse(code=409, message=str(e))


@router.put("/{user_id}")
async def update_user_endpoint(user_id: int, req: UserUpdate,
                               db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await user_service.update_user(db, user_id, req)
    return ApiResponse()


@router.put("/{user_id}/unlock")
async def unlock_user_endpoint(user_id: int, db: AsyncSession = Depends(get_db),
                               user=Depends(get_current_user)):
    await user_service.unlock_user(db, user_id)
    return ApiResponse()


@router.delete("/{user_id}")
async def delete_user_endpoint(user_id: int, db: AsyncSession = Depends(get_db),
                               user=Depends(get_current_user)):
    """Delete a user. Rejects self-deletion and users who created other users."""
    try:
        await user_service.delete_user(db, user_id, user.id)
        return ApiResponse()
    except ValueError as e:
        return ApiResponse(code=400, message=str(e))
