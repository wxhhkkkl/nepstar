"""Health-module menu seeding (健康管理: 指标/商品/方案)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_menu import SAMenu

HEALTH_MENUS = [
    {
        "parent_route": None,
        "name_zh": "健康管理",
        "name_en": "Health Management",
        "name_es": "Gestión de Salud",
        "icon": "data-analysis",
        "route_path": "/health",
        "sort_order": 5,
    },
    {
        "parent_route": "/health",
        "name_zh": "指标管理",
        "name_en": "Indicator Management",
        "name_es": "Gestión de Indicadores",
        "icon": "list",
        "route_path": "/health/indicators",
        "sort_order": 1,
    },
    {
        "parent_route": "/health",
        "name_zh": "商品管理",
        "name_en": "Product Management",
        "name_es": "Gestión de Productos",
        "icon": "goods",
        "route_path": "/health/products",
        "sort_order": 2,
    },
    {
        "parent_route": "/health",
        "name_zh": "方案管理",
        "name_en": "Plan Management",
        "name_es": "Gestión de Planes",
        "icon": "document",
        "route_path": "/health/plans",
        "sort_order": 3,
    },
]


async def seed_health_menus(db: AsyncSession) -> None:
    """Idempotently insert the health-module menus (guard by route_path).

    Called at startup BEFORE seed_admin_role so the admin auto re-grant
    (which iterates all current menus) includes the new rows.
    """
    route_paths = [m["route_path"] for m in HEALTH_MENUS]
    existing = {
        row.route_path: row
        for row in (
            await db.execute(select(SAMenu).where(SAMenu.route_path.in_(route_paths)))
        ).scalars().all()
    }
    if existing.get("/health") and all(p in existing for p in route_paths):
        return

    top = next(m for m in HEALTH_MENUS if m["parent_route"] is None)
    top_menu = existing.get(top["route_path"])
    if not top_menu:
        top_menu = SAMenu(
            parent_id=None,
            name_zh=top["name_zh"],
            name_en=top["name_en"],
            name_es=top["name_es"],
            icon=top["icon"],
            route_path=top["route_path"],
            sort_order=top["sort_order"],
            status=1,
        )
        db.add(top_menu)
        await db.flush()

    for m in HEALTH_MENUS:
        if m["parent_route"] is None or m["route_path"] in existing:
            continue
        db.add(
            SAMenu(
                parent_id=top_menu.id,
                name_zh=m["name_zh"],
                name_en=m["name_en"],
                name_es=m["name_es"],
                icon=m["icon"],
                route_path=m["route_path"],
                sort_order=m["sort_order"],
                status=1,
            )
        )
    await db.commit()
