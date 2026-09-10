"""Health plan business logic (关联商品有序；指标严格精确关联)."""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_indicator import SAIndicator
from ..models.new.sa_plan import SAPlan, SAPlanIndicator, SAPlanProduct
from ..models.new.sa_product import SAProduct
from ..schemas.plan import PlanCreate, PlanUpdate


def dedup_ids(ids: list[int]) -> list[int]:
    """Ordered de-duplication, preserving first-seen order (FR-304)."""
    seen: set[int] = set()
    out: list[int] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def _list_row(row: SAPlan) -> dict:
    return {
        "id": row.id,
        "name": row.plan_name,
        "description": row.description,
        "status": row.status,
        "sort_order": row.sort_order,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


async def _counts(db: AsyncSession, plan_ids: list[int]) -> tuple[dict, dict]:
    if not plan_ids:
        return {}, {}
    pc = dict(
        (
            await db.execute(
                select(SAPlanProduct.plan_id, func.count())
                .where(SAPlanProduct.plan_id.in_(plan_ids))
                .group_by(SAPlanProduct.plan_id)
            )
        ).all()
    )
    ic = dict(
        (
            await db.execute(
                select(SAPlanIndicator.plan_id, func.count())
                .where(SAPlanIndicator.plan_id.in_(plan_ids))
                .group_by(SAPlanIndicator.plan_id)
            )
        ).all()
    )
    return pc, ic


async def list_plans(
    db: AsyncSession, page: int = 1, page_size: int = 10, keyword: str = ""
) -> dict:
    stmt = select(SAPlan)
    count_stmt = select(func.count()).select_from(SAPlan)
    if keyword:
        cond = or_(SAPlan.plan_name.contains(keyword), SAPlan.description.contains(keyword))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = (await db.execute(count_stmt)).scalar() or 0
    rows = (
        (
            await db.execute(
                stmt.order_by(SAPlan.sort_order, SAPlan.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    pc, ic = await _counts(db, [r.id for r in rows])
    records = []
    for r in rows:
        item = _list_row(r)
        item["product_count"] = pc.get(r.id, 0)
        item["indicator_count"] = ic.get(r.id, 0)
        records.append(item)
    return {"records": records, "total": total, "page": page, "page_size": page_size}


async def get_plan_detail(db: AsyncSession, plan_id: int) -> dict:
    row = (await db.execute(select(SAPlan).where(SAPlan.id == plan_id))).scalar_one_or_none()
    if row is None:
        raise ValueError("plan.not_found")
    detail = _list_row(row)

    product_rows = (
        await db.execute(
            select(SAPlanProduct, SAProduct)
            .join(SAProduct, SAProduct.id == SAPlanProduct.product_id)
            .where(SAPlanProduct.plan_id == plan_id)
            .order_by(SAPlanProduct.sort_order, SAPlanProduct.id)
        )
    ).all()
    detail["products"] = [
        {
            "product_id": p.product_id,
            "name": prod.product_name,
            "cover_url": prod.cover_url,
            "sort_order": p.sort_order,
        }
        for p, prod in product_rows
    ]

    ind_rows = (
        await db.execute(
            select(SAPlanIndicator, SAIndicator)
            .join(SAIndicator, SAIndicator.id == SAPlanIndicator.indicator_id)
            .where(SAPlanIndicator.plan_id == plan_id)
        )
    ).all()
    parent_ids = [ind.parent_id for _, ind in ind_rows if ind.parent_id is not None]
    parent_names: dict[int, str] = {}
    if parent_ids:
        for prow in (
            await db.execute(
                select(SAIndicator.id, SAIndicator.ind_name).where(SAIndicator.id.in_(parent_ids))
            )
        ).all():
            parent_names[prow[0]] = prow[1]
    detail["indicators"] = [
        {
            "indicator_id": ind.id,
            "level": 1 if ind.parent_id is None else 2,
            "code": ind.ind_code,
            "name": ind.ind_name,
            "parent_id": ind.parent_id,
            "parent_name": parent_names.get(ind.parent_id) if ind.parent_id else None,
            "status": ind.status,
        }
        for _, ind in ind_rows
    ]
    return detail


async def _replace_products(db: AsyncSession, plan_id: int, ids: list[int]) -> None:
    ordered = dedup_ids(ids)
    if ordered:
        found = set(
            (await db.execute(select(SAProduct.id).where(SAProduct.id.in_(ordered))))
            .scalars()
            .all()
        )
        for pid in ordered:
            if pid not in found:
                raise ValueError("plan.product_not_found")
    for row in (
        (await db.execute(select(SAPlanProduct).where(SAPlanProduct.plan_id == plan_id)))
        .scalars()
        .all()
    ):
        await db.delete(row)
    await db.flush()
    for idx, pid in enumerate(ordered):
        db.add(SAPlanProduct(plan_id=plan_id, product_id=pid, sort_order=idx))


async def _replace_indicators(db: AsyncSession, plan_id: int, ids: list[int]) -> None:
    ordered = dedup_ids(ids)
    if ordered:
        found = set(
            (await db.execute(select(SAIndicator.id).where(SAIndicator.id.in_(ordered))))
            .scalars()
            .all()
        )
        for iid in ordered:
            if iid not in found:
                raise ValueError("plan.indicator_not_found")
    for row in (
        (await db.execute(select(SAPlanIndicator).where(SAPlanIndicator.plan_id == plan_id)))
        .scalars()
        .all()
    ):
        await db.delete(row)
    await db.flush()
    for iid in ordered:
        db.add(SAPlanIndicator(plan_id=plan_id, indicator_id=iid))


async def create_plan(db: AsyncSession, data: PlanCreate) -> dict:
    row = SAPlan(
        plan_name=data.name,
        description=data.description,
        status=data.status,
        sort_order=data.sort_order,
    )
    db.add(row)
    await db.flush()
    await _replace_products(db, row.id, data.product_ids)
    await _replace_indicators(db, row.id, data.indicator_ids)
    await db.commit()
    return await get_plan_detail(db, row.id)


async def update_plan(db: AsyncSession, plan_id: int, data: PlanUpdate) -> dict:
    row = (await db.execute(select(SAPlan).where(SAPlan.id == plan_id))).scalar_one_or_none()
    if row is None:
        raise ValueError("plan.not_found")
    if data.name is not None:
        row.plan_name = data.name
    if data.description is not None:
        row.description = data.description
    if data.status is not None:
        row.status = data.status
    if data.sort_order is not None:
        row.sort_order = data.sort_order
    if data.product_ids is not None:
        await _replace_products(db, plan_id, data.product_ids)
    if data.indicator_ids is not None:
        await _replace_indicators(db, plan_id, data.indicator_ids)
    await db.commit()
    return await get_plan_detail(db, plan_id)


async def delete_plan(db: AsyncSession, plan_id: int) -> None:
    row = (await db.execute(select(SAPlan).where(SAPlan.id == plan_id))).scalar_one_or_none()
    if row is None:
        raise ValueError("plan.not_found")
    for jrow in (
        (await db.execute(select(SAPlanProduct).where(SAPlanProduct.plan_id == plan_id)))
        .scalars()
        .all()
    ):
        await db.delete(jrow)
    for jrow in (
        (await db.execute(select(SAPlanIndicator).where(SAPlanIndicator.plan_id == plan_id)))
        .scalars()
        .all()
    ):
        await db.delete(jrow)
    await db.delete(row)
    await db.commit()
