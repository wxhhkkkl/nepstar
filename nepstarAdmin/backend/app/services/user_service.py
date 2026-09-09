"""User service — CRUD with org and role assignment."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_junctions import SAUserOrg, SAUserRole
from ..models.new.sa_user import SAUser
from ..security.password import hash_password


def _user_to_dict(u: SAUser) -> dict:
    return {
        "id": u.id, "username": u.username, "real_name": u.real_name,
        "lang_pref": u.lang_pref, "must_change_pwd": u.must_change_pwd,
        "login_fail_count": u.login_fail_count, "locked_until": u.locked_until,
        "status": u.status, "created_by": u.created_by,
        "created_at": u.created_at, "updated_at": u.updated_at,
    }


async def list_users(db: AsyncSession, page=1, page_size=10, keyword="", org_id: int = None):
    base = select(SAUser)
    if keyword:
        base = base.where(SAUser.username.contains(keyword) | SAUser.real_name.contains(keyword))
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    result = await db.execute(base.offset((page - 1) * page_size).limit(page_size))
    records = [_user_to_dict(u) for u in result.scalars().all()]
    return {"records": records, "total": total, "page": page, "page_size": page_size}


async def create_user(db: AsyncSession, data, created_by: int):
    existing = (await db.execute(select(SAUser).where(SAUser.username == data.username))).scalar_one_or_none()
    if existing:
        raise ValueError("user.exists")
    user = SAUser(
        username=data.username, password=hash_password(data.password),
        real_name=data.real_name, lang_pref=data.lang_pref, created_by=created_by,
    )
    db.add(user)
    await db.flush()
    for org_id in data.org_ids:
        db.add(SAUserOrg(user_id=user.id, org_id=org_id))
    for role_id in data.role_ids:
        db.add(SAUserRole(user_id=user.id, role_id=role_id))
    await db.commit()
    return user


async def get_user_detail(db: AsyncSession, user_id: int) -> dict:
    user = (await db.execute(select(SAUser).where(SAUser.id == user_id))).scalar_one()
    roles = (await db.execute(
        select(SAUserRole).where(SAUserRole.user_id == user_id)
    )).scalars().all()
    orgs = (await db.execute(
        select(SAUserOrg).where(SAUserOrg.user_id == user_id)
    )).scalars().all()
    return {
        **_user_to_dict(user),
        "role_ids": [r.role_id for r in roles],
        "org_ids": [o.org_id for o in orgs],
    }


async def update_user(db: AsyncSession, user_id: int, data):
    user = (await db.execute(select(SAUser).where(SAUser.id == user_id))).scalar_one()
    if data.real_name is not None:
        user.real_name = data.real_name
    if data.password is not None:
        user.password = hash_password(data.password)
    if data.status is not None:
        user.status = data.status
    if data.org_ids is not None:
        old_ids = set((await db.execute(select(SAUserOrg.org_id).where(SAUserOrg.user_id == user_id))).scalars().all())
        new_ids = set(data.org_ids)
        for org_id in old_ids - new_ids:
            link = (await db.execute(select(SAUserOrg).where(SAUserOrg.user_id == user_id, SAUserOrg.org_id == org_id))).scalar_one()
            await db.delete(link)
        for org_id in new_ids - old_ids:
            db.add(SAUserOrg(user_id=user.id, org_id=org_id))
    if data.role_ids is not None:
        old_ids = set((await db.execute(select(SAUserRole.role_id).where(SAUserRole.user_id == user_id))).scalars().all())
        new_ids = set(data.role_ids)
        for role_id in old_ids - new_ids:
            link = (await db.execute(select(SAUserRole).where(SAUserRole.user_id == user_id, SAUserRole.role_id == role_id))).scalar_one()
            await db.delete(link)
        for role_id in new_ids - old_ids:
            db.add(SAUserRole(user_id=user.id, role_id=role_id))
    await db.commit()
    return user


async def delete_user(db: AsyncSession, user_id: int, current_user_id: int):
    """Delete a user with guards: no self-deletion, no deletion of users who created others."""
    if user_id == current_user_id:
        raise ValueError("Cannot delete yourself")
    user = (await db.execute(select(SAUser).where(SAUser.id == user_id))).scalar_one()
    # Guard: cannot delete the built-in admin user
    if user.username == "admin":
        raise ValueError("Cannot delete the built-in admin user")
    # Guard: prevent deletion of users who have created other users
    created_count = (await db.execute(
        select(func.count()).select_from(SAUser).where(SAUser.created_by == user_id)
    )).scalar() or 0
    if created_count > 0:
        raise ValueError("Cannot delete user who has created other users")
    # Cascade delete junction records
    role_links = (await db.execute(
        select(SAUserRole).where(SAUserRole.user_id == user_id)
    )).scalars().all()
    for rl in role_links:
        await db.delete(rl)
    org_links = (await db.execute(
        select(SAUserOrg).where(SAUserOrg.user_id == user_id)
    )).scalars().all()
    for ol in org_links:
        await db.delete(ol)
    await db.delete(user)
    await db.commit()


async def unlock_user(db: AsyncSession, user_id: int):
    user = (await db.execute(select(SAUser).where(SAUser.id == user_id))).scalar_one()
    user.login_fail_count = 0
    user.locked_until = None
    await db.commit()
