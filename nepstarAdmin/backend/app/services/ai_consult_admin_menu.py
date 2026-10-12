"""Seed the AI settings menu through the explicitly validated nepstar writer."""

from sqlalchemy import select

from ..database import NEPSTAR_SCHEMA, get_ai_consult_sessionmaker
from ..models.new.sa_junctions import SARoleMenu
from ..models.new.sa_menu import SAMenu
from ..models.new.sa_role import SARole


async def seed_ai_consult_admin_menu() -> None:
    """Idempotently add AI consultation menus and the system-admin rule action."""
    if NEPSTAR_SCHEMA != "nepstar":
        raise RuntimeError("AI consultation menu requires NEPSTAR_SCHEMA=nepstar")
    writer = get_ai_consult_sessionmaker()
    async with writer() as db:
        async with db.begin():
            parent = (
                await db.execute(select(SAMenu).where(SAMenu.route_path == "/health"))
            ).scalar_one_or_none()
            if parent is None:
                parent = SAMenu(
                    parent_id=None,
                    name_zh="健康管理",
                    name_en="Health Management",
                    name_es="Gestión de Salud",
                    icon="data-analysis",
                    route_path="/health",
                    sort_order=5,
                    status=1,
                )
                db.add(parent)
                await db.flush()

            admin = (
                await db.execute(select(SARole).where(SARole.role_code == "admin"))
            ).scalar_one_or_none()
            for route_path, name_zh, name_en, name_es, icon, order, actions in (
                ("/health/ai-consult-settings", "AI 咨询设置", "AI Consult Settings",
                 "Configuración de consulta IA", "setting", 4, "view,edit,publish"),
                ("/health/ai-consult-overview", "AI 咨询概览", "AI Consult Overview",
                 "Resumen de consulta IA", "data-analysis", 5, "view"),
            ):
                menu = (
                    await db.execute(
                        select(SAMenu).where(SAMenu.route_path == route_path)
                    )
                ).scalar_one_or_none()
                if menu is None:
                    menu = SAMenu(
                        parent_id=parent.id,
                        name_zh=name_zh,
                        name_en=name_en,
                        name_es=name_es,
                        icon=icon,
                        route_path=route_path,
                        sort_order=order,
                        status=1,
                    )
                    db.add(menu)
                    await db.flush()
                if admin is not None:
                    permission = (
                        await db.execute(
                            select(SARoleMenu).where(
                                SARoleMenu.role_id == admin.id,
                                SARoleMenu.menu_id == menu.id,
                            )
                        )
                    ).scalar_one_or_none()
                    if permission is None:
                        db.add(SARoleMenu(role_id=admin.id, menu_id=menu.id, actions=actions))
                    elif route_path == "/health/ai-consult-settings":
                        current_actions = {
                            part.strip()
                            for part in (permission.actions or "").split(",")
                            if part.strip()
                        }
                        current_actions.update({"view", "edit", "publish"})
                        permission.actions = ",".join(sorted(current_actions))
