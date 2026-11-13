"""幂等登记“推送记录”菜单。

优先挂在既有 `/report/list` 同级；目标环境没有该菜单时创建顶层菜单，
避免全新库静默跳过。管理员权限由随后执行的 `seed_admin_role` 自动补齐。
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_menu import SAMenu

ROUTE = "/report/push-records"
REPORT_ROUTE = "/report/list"


async def seed_report_push_menu(db: AsyncSession) -> None:
    existing = (
        await db.execute(select(SAMenu).where(SAMenu.route_path == ROUTE))
    ).scalar_one_or_none()
    if existing is not None:
        return

    report_menu = (
        await db.execute(select(SAMenu).where(SAMenu.route_path == REPORT_ROUTE))
    ).scalar_one_or_none()
    parent_id = report_menu.parent_id if report_menu is not None else None
    sort_order = (report_menu.sort_order + 1) if report_menu is not None else 0

    db.add(
        SAMenu(
            parent_id=parent_id,
            name_zh="推送记录",
            name_en="Push Records",
            name_es="Registros de Envío",
            icon="tickets",
            route_path=ROUTE,
            sort_order=sort_order,
            status=1,
        )
    )
    await db.commit()
