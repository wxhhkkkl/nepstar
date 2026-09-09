"""数据看板服务 — 角色范围内的聚合统计与趋势查询。

所有统计受 dept_id=225671 全局过滤 + 用户 sa_role_org 数据范围限制。
各 KPI 独立聚合，单个数据源故障不影响其他卡片。
"""

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.old.inspect_base import inspect_base_table
from ..models.old.ne import ne_table
from ..models.new.sa_device_org import SADeviceOrg
from ..security.org_filter import get_user_authorized_orgs


async def _build_device_filter(db, user_id):
    """构建 dept_id + RBAC 的设备过滤子查询。

    看板统计全局依赖 dept_id=225671 做多租户隔离。
    RBAC 通过 sa_device_org 限制非 admin 用户可见的设备范围。
    """
    authorized_org_ids, _ = await get_user_authorized_orgs(user_id, db)

    # dept_id 全局过滤
    conditions = [inspect_base_table.c.dept_id == int(settings.DEPT_ID)]

    # 非 admin 用户通过 sa_device_org 限制
    if authorized_org_ids:
        device_subq = (
            select(SADeviceOrg.device_id)
            .where(SADeviceOrg.org_id.in_(authorized_org_ids))
        )
        conditions.append(inspect_base_table.c.device_id.in_(device_subq))

    return conditions


async def get_dashboard_stats(db: AsyncSession, user_id: int) -> dict:
    """获取三个 KPI 统计数据：设备数、报告数、客户数。

    各指标独立查询，单个失败不影响其他。
    """
    authorized_org_ids, _ = await get_user_authorized_orgs(user_id, db)

    # 设备数：从 ne 表统计（company_id 过滤），sa_device_org 可能未覆盖全部设备
    try:
        if ne_table is not None:
            device_q = select(func.count()).select_from(ne_table).where(
                ne_table.c.company_id == settings.COMPANY_ID
            )
            if authorized_org_ids:
                device_subq = select(SADeviceOrg.device_id).where(
                    SADeviceOrg.org_id.in_(authorized_org_ids)
                )
                device_q = device_q.where(ne_table.c.ne_id.in_(device_subq))
            device_count = (await db.execute(device_q)).scalar() or 0
        else:
            device_count = 0
    except Exception:
        device_count = 0

    # 报告数 + 客户数：从 inspect_base 统计
    if inspect_base_table is not None:
        conditions = await _build_device_filter(db, user_id)
        try:
            report_q = select(func.count()).select_from(inspect_base_table)
            for c in conditions:
                report_q = report_q.where(c)
            report_count = (await db.execute(report_q)).scalar() or 0
        except Exception:
            report_count = 0

        try:
            cust_q = (
                select(func.count(func.distinct(inspect_base_table.c.customer_id)))
                .select_from(inspect_base_table)
                .where(inspect_base_table.c.customer_id.isnot(None))
            )
            for c in conditions:
                cust_q = cust_q.where(c)
            customer_count = (await db.execute(cust_q)).scalar() or 0
        except Exception:
            customer_count = 0
    else:
        report_count = 0
        customer_count = 0

    return {
        "device_count": device_count,
        "report_count": report_count,
        "customer_count": customer_count,
    }


async def get_dashboard_trend(
    db: AsyncSession,
    user_id: int,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """获取报告数和客户数的趋势数据。

    粒度自动选择：≤30天 → 按日，≤365天 → 按周，>365天 → 按月。
    返回 [{label, report_count, customer_count}] 列表。
    """
    if inspect_base_table is None:
        return {"granularity": "daily", "points": []}

    # 默认最近 30 天
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

    # 统一按日聚合，90天以内的图表日粒度足够清晰
    try:
        days = (datetime.strptime(end_date, "%Y-%m-%d") - datetime.strptime(start_date, "%Y-%m-%d")).days
    except ValueError:
        days = 30
    granularity = "daily"
    date_expr = func.date(inspect_base_table.c.inspect_date)

    conditions = await _build_device_filter(db, user_id)
    conditions.append(inspect_base_table.c.inspect_date >= start_date)
    conditions.append(inspect_base_table.c.inspect_date <= end_date)

    base = (
        select(
            date_expr.label("label"),
            func.count().label("report_count"),
            func.count(func.distinct(inspect_base_table.c.customer_id)).label("customer_count"),
        )
        .select_from(inspect_base_table)
    )
    for c in conditions:
        base = base.where(c)
    base = base.group_by(date_expr).order_by("label")

    try:
        rows = (await db.execute(base)).all()
    except Exception:
        return {"granularity": granularity, "points": []}

    points = [
        {
            "label": str(r.label),
            "report_count": r.report_count or 0,
            "customer_count": r.customer_count or 0,
        }
        for r in rows
    ]
    return {"granularity": granularity, "points": points}
