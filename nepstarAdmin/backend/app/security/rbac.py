"""RBAC dependency for FastAPI — JWT extraction + permission checking."""

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.new.sa_junctions import SARoleMenu, SAUserRole
from ..models.new.sa_user import SAUser
from .jwt import decode_token
from .org_filter import is_admin

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> SAUser:
    """Extract and validate JWT, return current user. Raises 401 if invalid."""
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")

    result = await db.execute(select(SAUser).where(SAUser.id == user_id, SAUser.status == 1))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Check lockout
    if user.locked_until and user.locked_until > __import__("datetime").datetime.utcnow():
        raise HTTPException(status_code=423, detail="Account locked")

    return user


async def check_permission(
    request: Request,
    user: SAUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SAUser:
    """Check user has permission for the current request path + method."""
    # Map HTTP method to action
    method_map = {"GET": "view", "POST": "add", "PUT": "edit", "DELETE": "delete"}
    action = method_map.get(request.method, "view")

    # Admin role bypasses all permission checks
    if await is_admin(user.id, db):
        return user

    # Get user's menu permissions through roles
    role_result = await db.execute(
        select(SAUserRole.role_id).where(SAUserRole.user_id == user.id)
    )
    role_ids = [r[0] for r in role_result.all()]
    if not role_ids:
        raise HTTPException(status_code=403, detail="No permission")

    # Check if any role has the required action for this path
    perm_result = await db.execute(
        select(SARoleMenu).where(
            SARoleMenu.role_id.in_(role_ids),
            SARoleMenu.actions.contains(action),
        )
    )
    if not perm_result.scalars().first():
        raise HTTPException(status_code=403, detail="No permission")

    return user
