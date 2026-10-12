"""Fail-closed, menu-scoped permission checks for AI consultation controls."""

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.new.sa_junctions import SARoleMenu, SAUserRole
from ..models.new.sa_menu import SAMenu
from ..models.new.sa_role import SARole
from ..security.org_filter import is_admin
from ..security.rbac import get_current_user

AI_CONSULT_SETTINGS_ROUTE = "/health/ai-consult-settings"
AI_CONSULT_OVERVIEW_ROUTE = "/health/ai-consult-overview"
AI_CONSULT_SETTINGS_API_ROUTE = "/api/v1/ai-consult/admin/settings"
AI_CONSULT_SERVICE_STATE_API_ROUTE = "/api/v1/ai-consult/admin/service-state"
AI_CONSULT_OPERATIONS_API_ROUTE = "/api/v1/ai-consult/admin/operations"
AI_CONSULT_DASHBOARD_API_ROUTE = "/api/v1/ai-consult/admin/dashboard"
AI_CONSULT_SESSIONS_API_ROUTE = "/api/v1/ai-consult/admin/sessions"
AI_CONSULT_SESSION_API_ROUTE = "/api/v1/ai-consult/admin/sessions/{session_id}"
AI_CONSULT_RULES_API_ROUTE = "/api/v1/ai-consult/admin/rules"
AI_CONSULT_AUDIT_API_ROUTE = "/api/v1/ai-consult/admin/audit"
AI_CONSULT_RULE_API_ROUTE = "/api/v1/ai-consult/admin/rules/{rule_id}"
AI_CONSULT_RULE_PUBLISH_API_ROUTE = "/api/v1/ai-consult/admin/rules/{rule_id}/publish"
AI_CONSULT_RULE_ACTIVATE_API_ROUTE = "/api/v1/ai-consult/admin/rules/{rule_id}/activate"
AI_CONSULT_ADMIN_ACTIONS = {
    ("GET", AI_CONSULT_SETTINGS_API_ROUTE): (AI_CONSULT_SETTINGS_ROUTE, "view"),
    ("PUT", AI_CONSULT_SETTINGS_API_ROUTE): (AI_CONSULT_SETTINGS_ROUTE, "edit"),
    ("PUT", AI_CONSULT_SERVICE_STATE_API_ROUTE): (AI_CONSULT_SETTINGS_ROUTE, "edit"),
    ("GET", AI_CONSULT_OPERATIONS_API_ROUTE): (AI_CONSULT_OVERVIEW_ROUTE, "view"),
    ("GET", AI_CONSULT_DASHBOARD_API_ROUTE): (AI_CONSULT_OVERVIEW_ROUTE, "view"),
    ("GET", AI_CONSULT_SESSIONS_API_ROUTE): (AI_CONSULT_OVERVIEW_ROUTE, "view"),
    ("GET", AI_CONSULT_SESSION_API_ROUTE): (AI_CONSULT_OVERVIEW_ROUTE, "conversation"),
    ("GET", AI_CONSULT_RULES_API_ROUTE): (AI_CONSULT_SETTINGS_ROUTE, "view"),
    ("GET", AI_CONSULT_AUDIT_API_ROUTE): (AI_CONSULT_SETTINGS_ROUTE, "view"),
    ("GET", AI_CONSULT_RULE_API_ROUTE): (AI_CONSULT_SETTINGS_ROUTE, "view"),
    ("POST", AI_CONSULT_RULES_API_ROUTE): (AI_CONSULT_SETTINGS_ROUTE, "edit"),
    ("POST", AI_CONSULT_RULE_PUBLISH_API_ROUTE): (AI_CONSULT_SETTINGS_ROUTE, "publish"),
    ("POST", AI_CONSULT_RULE_ACTIVATE_API_ROUTE): (AI_CONSULT_SETTINGS_ROUTE, "publish"),
}


async def require_ai_consult_system_admin(
    request: Request,
    user=Depends(get_current_user),
    auth_db: AsyncSession = Depends(get_db),
):
    """Allow system admins or roles granted the exact page action.

    Unknown methods/routes fail closed. This avoids inheriting the generic RBAC
    behavior that accepts an action from any unrelated menu item.
    """
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    # Newer FastAPI keeps the original APIRouter route in scope; older versions
    # expose the fully prefixed path. Normalize only this known router, never a
    # user-supplied URL or arbitrary route, so the allowlist remains fail-closed.
    if isinstance(route_path, str) and route_path.startswith("/ai-consult/admin/"):
        route_path = "/api/v1" + route_path
    permission = AI_CONSULT_ADMIN_ACTIONS.get(
        (request.method, route_path)
    )
    if permission is None:
        raise HTTPException(status_code=403, detail="consult.admin_forbidden")
    menu_path, action = permission
    if await is_admin(user.id, auth_db):
        return user

    menu = (
        await auth_db.execute(
            select(SAMenu).where(
                SAMenu.route_path == menu_path,
                SAMenu.status == 1,
            )
        )
    ).scalar_one_or_none()
    if menu is None:
        raise HTTPException(status_code=403, detail="consult.admin_forbidden")

    role_ids = list(
        (
            await auth_db.execute(
                select(SAUserRole.role_id)
                .join(SARole, SARole.id == SAUserRole.role_id)
                .where(SAUserRole.user_id == user.id, SARole.status == 1)
            )
        ).scalars().all()
    )
    if not role_ids:
        raise HTTPException(status_code=403, detail="consult.admin_forbidden")

    permissions = (
        await auth_db.execute(
            select(SARoleMenu.actions).where(
                SARoleMenu.role_id.in_(role_ids),
                SARoleMenu.menu_id == menu.id,
            )
        )
    ).scalars().all()
    if not any(action in {part.strip() for part in (value or "").split(",")} for value in permissions):
        raise HTTPException(status_code=403, detail="consult.admin_forbidden")
    return user
