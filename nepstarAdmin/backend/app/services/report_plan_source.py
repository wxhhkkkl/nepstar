"""只读方案查询；独立于会在导入时反射旧库的报告源模型。"""

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from .. import database as app_database
from ..database import NEPSTAR_SCHEMA


DEFAULT_PLAN_TRIGGER_SCORE_BELOW = 80


async def fetch_product_details(db: AsyncSession, product_ids: list[int]) -> list[dict]:
    """Read only already-authorized product IDs; preserve the effective plan's order."""
    from sqlalchemy.exc import SQLAlchemyError
    if not product_ids:
        return []
    ids = tuple(dict.fromkeys(product_ids))
    try:
        rows = (await db.execute(text(
            f"SELECT id, product_name, description, detail_html, cover_url FROM {_t('sa_product')} "
            "WHERE status = 1 AND id IN :ids"
        ).bindparams(bindparam('ids', expanding=True, value=ids)))).all()
        images = (await db.execute(text(
            f"SELECT product_id, image_url FROM {_t('sa_product_image')} WHERE product_id IN :ids "
            "ORDER BY product_id, sort_order, id"
        ).bindparams(bindparam('ids', expanding=True, value=ids)))).all()
    except SQLAlchemyError as exc:
        from .report_source import ReportSourceUnavailableError
        raise ReportSourceUnavailableError('Product source unavailable') from exc
    by_id = {}
    for product_id, name, description, html, cover in rows:
        by_id[int(product_id)] = dict(product_id=int(product_id), name=name, description=description,
                                      detail_html=html, images=[{'url': cover, 'alt': name}] if cover else [])
    for product_id, url in images:
        item = by_id.get(int(product_id))
        if item and url and url not in [image['url'] for image in item['images']]:
            item['images'].append({'url': url, 'alt': item['name']})
    return [by_id[i] for i in ids if i in by_id]


def _t(table: str) -> str:
    return f"{NEPSTAR_SCHEMA}.{table}" if NEPSTAR_SCHEMA else table


async def fetch_plans_for_indicators(
    db: AsyncSession, indicator_ids: list[int]
) -> dict[int, list[dict]]:
    """读取已启用、已关联的方案及已启用商品，保持后台排序。"""
    if not indicator_ids:
        return {}
    plan_rows = (
        await db.execute(
            text(
                f"SELECT pi.indicator_id, p.id, p.plan_name, p.description, "
                f"p.trigger_score_below, p.sort_order "
                f"FROM {_t('sa_plan_indicator')} pi "
                f"JOIN {_t('sa_plan')} p ON p.id = pi.plan_id "
                f"WHERE p.status = 1 AND pi.indicator_id IN :ids "
                f"ORDER BY pi.indicator_id, p.sort_order, p.id"
            ).bindparams(ids=tuple(indicator_ids))
        )
    ).all()
    plans: dict[int, list[dict]] = {}
    for indicator_id, plan_id, plan_name, description, trigger_score_below, sort_order in plan_rows:
        plans.setdefault(int(indicator_id), []).append(
            {
                "plan_id": int(plan_id),
                "plan_name": plan_name,
                "description": description,
                "sort_order": int(sort_order or 0),
                "trigger_score_below": (
                    int(trigger_score_below)
                    if trigger_score_below is not None
                    else DEFAULT_PLAN_TRIGGER_SCORE_BELOW
                ),
                # tags / actionLabel / actionHint 在 sa_plan 里没有对应列。
                "tags": [],
                "action_label": None,
                "action_hint": None,
                "products": [],
            }
        )

    plan_ids = sorted({p["plan_id"] for group in plans.values() for p in group})
    product_rows = []
    if plan_ids:
        product_rows = (
            await db.execute(
                text(
                    f"SELECT pp.plan_id, pr.id, pr.product_name, pr.cover_url "
                    f"FROM {_t('sa_plan_product')} pp "
                    f"JOIN {_t('sa_product')} pr ON pr.id = pp.product_id "
                    f"WHERE pr.status = 1 AND pp.plan_id IN :ids "
                    f"ORDER BY pp.plan_id, pp.sort_order, pr.id"
                ).bindparams(ids=tuple(plan_ids))
            )
        ).all()

    by_plan: dict[int, list[dict]] = {}
    for group in plans.values():
        for plan in group:
            by_plan.setdefault(plan["plan_id"], []).append(plan)
    for plan_id, product_id, product_name, cover_url in product_rows:
        for plan in by_plan.get(int(plan_id), []):
            plan["products"].append(
                {
                    "product_id": int(product_id),
                    "name": product_name,
                    "image_url": cover_url,
                    "image_alt": product_name,
                }
            )
    # The local isolated runtime writes plan snapshots to its own nepstar DB,
    # while the regular report registry connection remains read-only. Merge
    # only explicitly marked local snapshots into this response.
    local_sessionmaker = getattr(app_database, "local_plan_overlay_sessionmaker", None)
    if local_sessionmaker is not None:
        remote_plan_ids = sorted({plan["plan_id"] for group in plans.values() for plan in group})
        predicates = ["pi.indicator_id IN :indicator_ids"]
        params = {"indicator_ids": tuple(indicator_ids)}
        bindings = [bindparam("indicator_ids", expanding=True)]
        if remote_plan_ids:
            predicates.append("p.id IN :remote_plan_ids")
            params["remote_plan_ids"] = tuple(remote_plan_ids)
            bindings.append(bindparam("remote_plan_ids", expanding=True))
        local_query = text(
            f"SELECT p.id, p.plan_name, p.description, p.trigger_score_below, "
            f"p.status, p.sort_order, pi.indicator_id "
            f"FROM {_t('sa_plan')} p "
            f"LEFT JOIN {_t('sa_plan_indicator')} pi ON pi.plan_id = p.id "
            f"WHERE p.updated_at IS NOT NULL AND ({' OR '.join(predicates)})"
        ).bindparams(*bindings)
        async with local_sessionmaker() as local_db:
            overlay_rows = (await local_db.execute(local_query, params)).all()
            overlays: dict[int, dict] = {}
            for plan_id, name, description, threshold, status, sort_order, indicator_id in overlay_rows:
                item = overlays.setdefault(
                    int(plan_id),
                    {
                        "plan_id": int(plan_id),
                        "plan_name": name,
                        "description": description,
                        "sort_order": int(sort_order or 0),
                        "trigger_score_below": (
                            int(threshold) if threshold is not None
                            else DEFAULT_PLAN_TRIGGER_SCORE_BELOW
                        ),
                        "tags": [],
                        "action_label": None,
                        "action_hint": None,
                        "products": [],
                        "status": int(status),
                        "indicator_ids": set(),
                    },
                )
                if indicator_id is not None:
                    item["indicator_ids"].add(int(indicator_id))

            # A local disabled snapshot also suppresses its enabled source copy.
            overlay_ids = set(overlays)
            for indicator_id in list(plans):
                plans[indicator_id] = [
                    plan for plan in plans[indicator_id] if plan["plan_id"] not in overlay_ids
                ]
                if not plans[indicator_id]:
                    del plans[indicator_id]

            report_indicator_ids = set(indicator_ids)
            active_overlay_ids = sorted(
                plan_id for plan_id, item in overlays.items()
                if item["status"] == 1 and item["indicator_ids"] & report_indicator_ids
            )
            if active_overlay_ids:
                local_products_query = text(
                    f"SELECT plan_id, product_id FROM {_t('sa_plan_product')} "
                    f"WHERE plan_id IN :plan_ids ORDER BY plan_id, sort_order, id"
                ).bindparams(bindparam("plan_ids", expanding=True))
                local_product_rows = (await local_db.execute(
                    local_products_query, {"plan_ids": tuple(active_overlay_ids)}
                )).all()
                product_ids = sorted({int(row.product_id) for row in local_product_rows})
                product_by_id = {}
                if product_ids:
                    product_query = text(
                        f"SELECT id, product_name, cover_url FROM {_t('sa_product')} "
                        f"WHERE status = 1 AND id IN :product_ids"
                    ).bindparams(bindparam("product_ids", expanding=True))
                    source_products = (await db.execute(
                        product_query, {"product_ids": tuple(product_ids)}
                    )).all()
                    product_by_id = {
                        int(product_id): (name, cover_url)
                        for product_id, name, cover_url in source_products
                    }
                for plan_id, product_id in local_product_rows:
                    product = product_by_id.get(int(product_id))
                    if product is not None:
                        name, cover_url = product
                        overlays[int(plan_id)]["products"].append(
                            {
                                "product_id": int(product_id),
                                "name": name,
                                "image_url": cover_url,
                                "image_alt": name,
                            }
                        )
                for indicator_id in report_indicator_ids:
                    matching = [
                        item for item in overlays.values()
                        if item["status"] == 1 and indicator_id in item["indicator_ids"]
                    ]
                    if matching:
                        plans.setdefault(indicator_id, []).extend(matching)

    for group in plans.values():
        group.sort(key=lambda plan: (plan.get("sort_order", 0), plan["plan_id"]))
    for group in plans.values():
        for plan in group:
            plan.pop("sort_order", None)
    return plans
