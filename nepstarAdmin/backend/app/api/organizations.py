"""Organization management API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.organization import OrgCreate, OrgUpdate
from ..schemas.response import ApiResponse
from ..security.rbac import get_current_user
from ..services import organization_service

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("")
async def get_orgs(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tree = await organization_service.get_org_tree(db)
    return ApiResponse(data=tree)


@router.get("/tree")
async def get_org_tree(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """返回用户数据范围内的组织树，供设备页面左侧面板使用。

    普通用户仅看到授权组织，admin (user_id=1) 看到全部。
    """
    tree = await organization_service.get_org_tree(db, user_id=user.id)
    return ApiResponse(data=tree)


@router.post("")
async def create_org_endpoint(req: OrgCreate, db: AsyncSession = Depends(get_db),
                              user=Depends(get_current_user)):
    try:
        org = await organization_service.create_org(db, req)
        return ApiResponse(data={"id": org.id})
    except ValueError as e:
        return ApiResponse(code=409, message=str(e))


@router.put("/{org_id}")
async def update_org_endpoint(org_id: int, req: OrgUpdate,
                              db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await organization_service.update_org(db, org_id, req)
    return ApiResponse()


@router.delete("/{org_id}")
async def delete_org_endpoint(org_id: int, db: AsyncSession = Depends(get_db),
                              user=Depends(get_current_user)):
    try:
        await organization_service.delete_org(db, org_id)
        return ApiResponse()
    except ValueError as e:
        return ApiResponse(code=409, message=str(e))
