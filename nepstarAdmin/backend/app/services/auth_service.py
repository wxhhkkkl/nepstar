"""Authentication service — login, user info, password change."""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.new.sa_junctions import SARoleMenu, SAUserRole
from ..models.new.sa_menu import SAMenu
from ..models.new.sa_role import SARole
from ..models.new.sa_user import SAUser
from ..security.jwt import create_token
from ..security.org_filter import is_admin
from ..security.password import hash_password, validate_password_complexity, verify_password


class AuthError(Exception):
    pass


async def login(db: AsyncSession, username: str, password: str) -> dict:
    """Authenticate user and return JWT token with user info."""
    result = await db.execute(
        select(SAUser).where(SAUser.username == username, SAUser.status == 1)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise AuthError("auth.invalid_credentials")

    # Check lockout
    if user.locked_until and user.locked_until > datetime.utcnow():
        raise AuthError("auth.account_locked")

    if not verify_password(password, user.password):
        user.login_fail_count += 1
        if user.login_fail_count >= settings.LOGIN_MAX_FAILURES:
            user.locked_until = datetime.utcnow() + timedelta(minutes=settings.LOCKOUT_MINUTES)
        await db.commit()
        raise AuthError("auth.invalid_credentials")

    # Reset fail count on success
    user.login_fail_count = 0
    user.locked_until = None
    await db.commit()

    token = create_token(user.id, user.username)

    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "real_name": user.real_name,
            "lang_pref": user.lang_pref,
        },
        "must_change_pwd": bool(user.must_change_pwd),
    }


async def get_me(db: AsyncSession, user_id: int) -> dict:
    """Get current user's info, roles, menus, and permissions."""
    result = await db.execute(select(SAUser).where(SAUser.id == user_id))
    user = result.scalar_one()

    # Get roles
    role_result = await db.execute(
        select(SARole).join(SAUserRole, SAUserRole.role_id == SARole.id)
        .where(SAUserRole.user_id == user_id, SARole.status == 1)
    )
    roles = [{"role_code": r.role_code, "role_name": r.role_name} for r in role_result.scalars()]

    # Get menu tree
    menu_result = await db.execute(
        select(SAMenu).where(SAMenu.status == 1).order_by(SAMenu.sort_order)
    )
    all_menus = menu_result.scalars().all()

    # Get permissions
    role_ids_result = await db.execute(
        select(SAUserRole.role_id).where(SAUserRole.user_id == user_id)
    )
    role_ids = [r[0] for r in role_ids_result.all()]

    perm_result = await db.execute(
        select(SARoleMenu).where(SARoleMenu.role_id.in_(role_ids))
    )
    permissions: dict[str, list[str]] = {}
    for p in perm_result.scalars():
        if str(p.menu_id) not in permissions:
            permissions[str(p.menu_id)] = []
        permissions[str(p.menu_id)].extend(p.actions.split(","))

    # Build menu tree (admin sees all, others see permitted)
    if await is_admin(user_id, db):
        visible_menus = [m for m in all_menus]
    else:
        permitted_ids = {int(k) for k in permissions.keys()}
        visible_menus = [m for m in all_menus if m.id in permitted_ids or m.parent_id in permitted_ids]

    menus = build_menu_tree(visible_menus)

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "real_name": user.real_name,
            "lang_pref": user.lang_pref,
        },
        "roles": roles,
        "menus": menus,
        "permissions": permissions,
    }


async def change_password(db: AsyncSession, user_id: int, old_pwd: str, new_pwd: str) -> None:
    """Change user password with validation."""
    error = validate_password_complexity(new_pwd, settings.PASSWORD_MIN_LENGTH)
    if error:
        raise AuthError("auth.weak_password")

    result = await db.execute(select(SAUser).where(SAUser.id == user_id))
    user = result.scalar_one()

    if not verify_password(old_pwd, user.password):
        raise AuthError("auth.invalid_credentials")

    user.password = hash_password(new_pwd)
    user.must_change_pwd = 0
    await db.commit()


def build_menu_tree(menus: list[SAMenu], parent_id: int | None = None) -> list[dict]:
    """Build recursive menu tree from flat list."""
    tree = []
    for menu in sorted(menus, key=lambda m: m.sort_order):
        if menu.parent_id == parent_id:
            node = {
                "id": menu.id,
                "parent_id": menu.parent_id,
                "name": getattr(menu, "name_zh"),  # default; frontend picks by lang
                "name_zh": menu.name_zh,
                "name_en": menu.name_en,
                "name_es": menu.name_es,
                "icon": menu.icon,
                "route_path": menu.route_path,
                "sort_order": menu.sort_order,
            }
            children = build_menu_tree(menus, menu.id)
            if children:
                node["children"] = children
            tree.append(node)
    return tree
