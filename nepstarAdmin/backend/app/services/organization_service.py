"""Organization service — tree CRUD with validation and root org seeding."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_organization import SAOrganization
from ..security.org_filter import get_user_authorized_orgs, is_admin


async def seed_root_org(db: AsyncSession) -> None:
    """Ensure root organization 'NEPSTAR' exists (idempotent)."""
    existing = (await db.execute(
        select(SAOrganization).where(SAOrganization.org_code == "NEPSTAR")
    )).scalar_one_or_none()
    if not existing:
        root = SAOrganization(org_name="NEPSTAR", org_code="NEPSTAR", parent_id=None, sort_order=0)
        db.add(root)
        await db.commit()


async def get_org_tree(db: AsyncSession, user_id: int | None = None) -> list[dict]:
    """返回组织树。若指定 user_id，仅返回用户数据范围内的组织节点。"""
    result = await db.execute(select(SAOrganization).order_by(SAOrganization.sort_order))
    orgs = result.scalars().all()

    if user_id is not None and not await is_admin(user_id, db):  # admin 不过滤，显示全部组织
        authorized_ids, _ = await get_user_authorized_orgs(user_id, db)
        if authorized_ids:
            authorized_set = set(authorized_ids)
            # 补上所有祖先节点，确保树结构完整
            all_ids = set(authorized_set)
            org_map = {o.id: o for o in orgs}
            for oid in authorized_set:
                org = org_map.get(oid)
                while org and org.parent_id is not None:
                    all_ids.add(org.parent_id)
                    org = org_map.get(org.parent_id)
            orgs = [o for o in orgs if o.id in all_ids]
        else:
            orgs = []  # 非 admin 且无授权组织 → 空树

    return _build_tree(orgs)


async def create_org(db: AsyncSession, data) -> SAOrganization:
    existing = (await db.execute(select(SAOrganization).where(SAOrganization.org_code == data.org_code))).scalar_one_or_none()
    if existing:
        raise ValueError("org.code_exists")
    org = SAOrganization(**data.model_dump())
    db.add(org)
    await db.commit()
    return org


async def update_org(db: AsyncSession, org_id: int, data) -> SAOrganization:
    org = (await db.execute(select(SAOrganization).where(SAOrganization.id == org_id))).scalar_one()
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(org, key, val)
    await db.commit()
    return org


async def delete_org(db: AsyncSession, org_id: int):
    """Delete an organization. Rejects root org and orgs with children."""
    org = (await db.execute(select(SAOrganization).where(SAOrganization.id == org_id))).scalar_one()
    # Guard: cannot delete root organization
    if org.org_code == "NEPSTAR":
        raise ValueError("Cannot delete the root organization")
    # Guard: cannot delete if has children
    children = (await db.execute(
        select(func.count()).select_from(SAOrganization).where(SAOrganization.parent_id == org_id)
    )).scalar() or 0
    if children > 0:
        raise ValueError("org.has_children")
    await db.delete(org)
    await db.commit()


def _build_tree(orgs: list, parent_id=None) -> list[dict]:
    tree = []
    for o in orgs:
        if o.parent_id == parent_id:
            node = {"id": o.id, "org_name": o.org_name, "org_code": o.org_code,
                    "parent_id": o.parent_id, "sort_order": o.sort_order}
            children = _build_tree(orgs, o.id)
            if children:
                node["children"] = children
            tree.append(node)
    return tree
