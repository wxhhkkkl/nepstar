"""Menu service — tree CRUD operations."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_menu import SAMenu


async def get_menu_tree(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(SAMenu).order_by(SAMenu.sort_order))
    menus = result.scalars().all()
    return _build_tree(menus)


async def create_menu(db: AsyncSession, data) -> SAMenu:
    menu = SAMenu(**data.model_dump())
    db.add(menu)
    await db.commit()
    return menu


async def update_menu(db: AsyncSession, menu_id: int, data) -> SAMenu:
    menu = (await db.execute(select(SAMenu).where(SAMenu.id == menu_id))).scalar_one()
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(menu, key, val)
    await db.commit()
    return menu


async def toggle_menu(db: AsyncSession, menu_id: int):
    menu = (await db.execute(select(SAMenu).where(SAMenu.id == menu_id))).scalar_one()
    menu.status = 0 if menu.status == 1 else 1
    # Recursively toggle children
    await _toggle_children(db, menu_id, menu.status)
    await db.commit()


async def _toggle_children(db: AsyncSession, parent_id: int, status: int):
    children = (await db.execute(select(SAMenu).where(SAMenu.parent_id == parent_id))).scalars().all()
    for child in children:
        child.status = status
        await _toggle_children(db, child.id, status)


async def delete_menu(db: AsyncSession, menu_id: int):
    menu = (await db.execute(select(SAMenu).where(SAMenu.id == menu_id))).scalar_one()
    await db.delete(menu)
    await db.commit()


def _build_tree(menus: list[SAMenu], parent_id: int | None = None) -> list[dict]:
    tree = []
    for m in menus:
        if m.parent_id == parent_id:
            node = {"id": m.id, "parent_id": m.parent_id, "name_zh": m.name_zh,
                    "name_en": m.name_en, "name_es": m.name_es, "icon": m.icon,
                    "route_path": m.route_path, "sort_order": m.sort_order, "status": m.status}
            children = _build_tree(menus, m.id)
            if children:
                node["children"] = children
            tree.append(node)
    return tree
