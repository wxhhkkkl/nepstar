"""Role management API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.response import ApiResponse
from ..schemas.role import RoleCreate, RoleUpdate
from ..security.rbac import get_current_user
from ..services import role_service

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("")
async def list_roles(page: int = 1, page_size: int = 10, keyword: str = "",
                     db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    data = await role_service.list_roles(db, page, page_size, keyword)
    return ApiResponse(data=data)


@router.get("/{role_id}")
async def get_role(role_id: int, db: AsyncSession = Depends(get_db),
                   user=Depends(get_current_user)):
    detail = await role_service.get_role_detail(db, role_id)
    return ApiResponse(data=detail)


@router.post("")
async def create_role_endpoint(req: RoleCreate, db: AsyncSession = Depends(get_db),
                               user=Depends(get_current_user)):
    role = await role_service.create_role(db, req)
    return ApiResponse(data={"id": role.id})


@router.put("/{role_id}")
async def update_role_endpoint(role_id: int, req: RoleUpdate,
                               db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await role_service.update_role(db, role_id, req)
    return ApiResponse()


@router.delete("/{role_id}")
async def delete_role_endpoint(role_id: int, db: AsyncSession = Depends(get_db),
                               user=Depends(get_current_user)):
    try:
        await role_service.delete_role(db, role_id)
        return ApiResponse()
    except ValueError as e:
        return ApiResponse(code=409, message=str(e))
