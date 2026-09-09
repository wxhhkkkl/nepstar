"""Role service — CRUD operations and permission assignment."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_junctions import SARoleMenu, SARoleOrg, SAUserRole
from ..models.new.sa_menu import SAMenu
from ..models.new.sa_organization import SAOrganization
from ..models.new.sa_role import SARole
from ..models.new.sa_user import SAUser

ADMIN_ROLE_CODE = "admin"


def _role_to_dict(r: SARole) -> dict:
    return {
        "id": r.id, "role_name": r.role_name, "role_code": r.role_code,
        "data_scope": r.data_scope,
        "status": r.status, "created_at": r.created_at, "updated_at": r.updated_at,
    }


async def seed_admin_role(db: AsyncSession) -> None:
    """Ensure admin role exists with all permissions (idempotent, runs on startup)."""
    existing = (await db.execute(
        select(SARole).where(SARole.role_code == ADMIN_ROLE_CODE)
    )).scalar_one_or_none()
    if not existing:
        role = SARole(role_name="系统管理员", role_code=ADMIN_ROLE_CODE, data_scope="all")
        db.add(role)
        await db.flush()
    else:
        role = existing

    # Grant all menu permissions to admin role
    menus = (await db.execute(select(SAMenu))).scalars().all()
    for menu in menus:
        existing_perm = (await db.execute(
            select(SARoleMenu).where(SARoleMenu.role_id == role.id, SARoleMenu.menu_id == menu.id)
        )).scalar_one_or_none()
        if not existing_perm:
            db.add(SARoleMenu(
                role_id=role.id, menu_id=menu.id,
                actions="view,add,edit,delete,export,import",
            ))

    # Grant all organizations to admin role
    orgs = (await db.execute(select(SAOrganization))).scalars().all()
    for org in orgs:
        existing_org = (await db.execute(
            select(SARoleOrg).where(SARoleOrg.role_id == role.id, SARoleOrg.org_id == org.id)
        )).scalar_one_or_none()
        if not existing_org:
            db.add(SARoleOrg(role_id=role.id, org_id=org.id))

    # Assign admin user to admin role
    admin_user = (await db.execute(
        select(SAUser).where(SAUser.username == "admin")
    )).scalar_one_or_none()
    if admin_user:
        existing_ur = (await db.execute(
            select(SAUserRole).where(SAUserRole.user_id == admin_user.id, SAUserRole.role_id == role.id)
        )).scalar_one_or_none()
        if not existing_ur:
            db.add(SAUserRole(user_id=admin_user.id, role_id=role.id))

    await db.commit()


async def list_roles(db: AsyncSession, page: int = 1, page_size: int = 10, keyword: str = ""):
    base = select(SARole)
    if keyword:
        base = base.where(SARole.role_name.contains(keyword) | SARole.role_code.contains(keyword))
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    result = await db.execute(base.offset((page - 1) * page_size).limit(page_size))
    records = []
    for r in result.scalars().all():
        d = _role_to_dict(r)
        mc = (await db.execute(
            select(func.count()).select_from(SARoleMenu).where(SARoleMenu.role_id == r.id)
        )).scalar() or 0
        uc = (await db.execute(
            select(func.count()).select_from(SAUserRole).where(SAUserRole.role_id == r.id)
        )).scalar() or 0
        oc = (await db.execute(
            select(func.count()).select_from(SARoleOrg).where(SARoleOrg.role_id == r.id)
        )).scalar() or 0
        d["menu_count"] = mc
        d["user_count"] = uc
        d["org_count"] = oc
        records.append(d)
    return {"records": records, "total": total, "page": page, "page_size": page_size}


async def create_role(db: AsyncSession, data) -> SARole:
    role = SARole(role_name=data.role_name, role_code=data.role_code, data_scope=data.data_scope)
    db.add(role)
    await db.flush()
    for mp in data.menu_permissions:
        db.add(SARoleMenu(role_id=role.id, menu_id=mp.menu_id, actions=mp.actions))
    for org_id in data.org_ids:
        db.add(SARoleOrg(role_id=role.id, org_id=org_id))
    await db.commit()
    return role


async def update_role(db: AsyncSession, role_id: int, data):
    role = (await db.execute(select(SARole).where(SARole.id == role_id))).scalar_one()
    if data.role_name is not None:
        role.role_name = data.role_name
    if data.data_scope is not None:
        role.data_scope = data.data_scope
    if data.menu_permissions is not None:
        old = (await db.execute(select(SARoleMenu).where(SARoleMenu.role_id == role_id))).scalars().all()
        for o in old:
            await db.delete(o)
        await db.flush()  # flush deletes before inserts to avoid duplicate key
        for mp in data.menu_permissions:
            db.add(SARoleMenu(role_id=role_id, menu_id=mp.menu_id, actions=mp.actions))
    if data.org_ids is not None:
        old = (await db.execute(select(SARoleOrg).where(SARoleOrg.role_id == role_id))).scalars().all()
        for o in old:
            await db.delete(o)
        await db.flush()  # flush deletes before inserts to avoid duplicate key
        for org_id in data.org_ids:
            db.add(SARoleOrg(role_id=role_id, org_id=org_id))
    await db.commit()
    return role


async def get_role_detail(db: AsyncSession, role_id: int) -> dict:
    role = (await db.execute(select(SARole).where(SARole.id == role_id))).scalar_one()
    perms = (await db.execute(
        select(SARoleMenu).where(SARoleMenu.role_id == role_id)
    )).scalars().all()
    orgs = (await db.execute(
        select(SARoleOrg).where(SARoleOrg.role_id == role_id)
    )).scalars().all()
    return {
        "id": role.id,
        "role_name": role.role_name,
        "role_code": role.role_code,
        "data_scope": role.data_scope,
        "status": role.status,
        "menu_permissions": [{"menu_id": p.menu_id, "actions": p.actions} for p in perms],
        "org_ids": [o.org_id for o in orgs],
        "created_at": role.created_at,
    }


async def delete_role(db: AsyncSession, role_id: int):
    """Delete a role. Rejects admin role and roles with users assigned."""
    role = (await db.execute(select(SARole).where(SARole.id == role_id))).scalar_one()
    # Guard: cannot delete the built-in admin role
    if role.role_code == ADMIN_ROLE_CODE:
        raise ValueError("role.cannot_delete_admin")
    # Guard: role must not have users assigned
    count = (await db.execute(
        select(func.count()).select_from(SAUserRole).where(SAUserRole.role_id == role_id)
    )).scalar() or 0
    if count > 0:
        raise ValueError("role.has_users")
    # Cascade delete menu permissions and org assignments
    for model in (SARoleMenu, SARoleOrg):
        links = (await db.execute(
            select(model).where(model.role_id == role_id)  # type: ignore[arg-type]
        )).scalars().all()
        for link in links:
            await db.delete(link)
    await db.delete(role)
    await db.commit()
