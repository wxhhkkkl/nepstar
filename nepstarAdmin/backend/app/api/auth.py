"""Authentication API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.auth import ChangePasswordRequest, LoginRequest
from ..schemas.response import ApiResponse
from ..security.rbac import get_current_user
from ..services.auth_service import AuthError, change_password, get_me, login

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login_endpoint(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = await login(db, req.username, req.password)
        return ApiResponse(data=data)
    except AuthError as e:
        return ApiResponse(code=401, message=str(e))


@router.post("/logout")
async def logout_endpoint():
    return ApiResponse(message="Logged out")


@router.get("/me")
async def me_endpoint(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = await get_me(db, user.id)
    return ApiResponse(data=data)


@router.put("/change-password")
async def change_password_endpoint(
    req: ChangePasswordRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await change_password(db, user.id, req.old_password, req.new_password)
        return ApiResponse(message="Password changed successfully")
    except AuthError as e:
        return ApiResponse(code=400, message=str(e))
