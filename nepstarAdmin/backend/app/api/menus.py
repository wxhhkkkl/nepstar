"""Menu management API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.response import ApiResponse
from ..security.rbac import get_current_user
from ..services import menu_service

router = APIRouter(prefix="/menus", tags=["menus"])


@router.get("")
async def get_menus(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    tree = await menu_service.get_menu_tree(db)
    return ApiResponse(data=tree)

# POST/PUT/DELETE endpoints intentionally removed per FR-025:
# Menu CRUD is performed directly in the database, not via API.
