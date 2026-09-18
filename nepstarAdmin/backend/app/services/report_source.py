"""报告数据源读取层。

职责边界：
- 本模块只负责**读取**与**错误归并**，不做业务组装与排序（那是 report_view_service）。
- 两个数据源：报告文档（MongoDB，只读）与指标字典/报告主记录（旧库 MySQL，只读）。
- 任一数据源超时或不可达，统一抛 ReportSourceUnavailableError，由上层转成 report.unavailable。

字段来源约定见 spec 的 FR-046：实际年龄取受检年龄而非档案年龄；同龄人对比比例取旧库排名字段。
"""

from typing import Any

from pymongo.errors import PyMongoError
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .. import mongo
from ..database import NEPSTAR_SCHEMA
from ..models.old.inspect_base import inspect_base_table


def _t(table: str) -> str:
    """sa_* 表所在的库名限定（与 indicator_service 的做法一致）。"""
    return f"{NEPSTAR_SCHEMA}.{table}" if NEPSTAR_SCHEMA else table


class ReportSourceUnavailableError(RuntimeError):
    """报告数据源（MongoDB 或旧库）超时/不可达。上层转成 report.unavailable（FR-038）。"""


# --- 纯函数：文档解析（可单测，不碰 IO） ---


def walk_targets(first_targets: list[dict] | None) -> list[dict[str, Any]]:
    """把报告文档的三层指标树摊平成 [{target_id, level, score, ...}]。

    文档结构存在漂移，所有层级都按字段存在性容错读取；
    缺少 targetId 的条目跳过（无法与后台指标关联）。
    """
    out: list[dict[str, Any]] = []

    def visit(nodes: Any, level: int) -> None:
        if not isinstance(nodes, list):
            return
        for node in nodes:
            if not isinstance(node, dict):
                continue
            target_id = node.get("targetId")
            if target_id is not None:
                out.append(
                    {
                        "target_id": int(target_id),
                        "level": level,
                        "score": node.get("score"),
                        "ab_level": node.get("abLevel"),
                        "last_score": node.get("lastScore"),
                    }
                )
            visit(node.get("secondTarget") if level == 1 else node.get("threeTarget"), level + 1)

    visit(first_targets, 1)
    return out


def parse_summary(document: dict, meta: dict | None) -> dict[str, Any]:
    """从报告文档与旧库主记录中提取报告摘要字段。

    不含警示阈值与健康预期寿命——前者是后台固定值，后者按 FR-045 派生，
    两者都由 report_view_service 补充。
    """
    dds = document.get("ddsReportInfo") or {}
    user_info = document.get("userInfo") or {}
    meta = meta or {}

    return {
        "report_code": document.get("_id"),
        "gender": "male" if document.get("sex") == 1 else "female",
        "total_score": dds.get("totalScore"),
        # 实际年龄取受检年龄；档案年龄存在 0 值，不可用（FR-046）
        "actual_age": dds.get("inspectAge"),
        "biological_age": dds.get("totalAge"),
        "peer_percent": _to_int(meta.get("ranking")),
        "report_date": _iso_date(meta.get("report_date")),
        "profile_age": user_info.get("age"),  # 仅留作排查，不对外
    }


def is_ready(meta: dict | None) -> bool:
    """就绪判定：主记录状态有效且报告生成时间已落定。

    刻意不看明细结果是否已生成——合法的无明细报告不应被误判为未就绪（FR-019）。
    """
    if not meta:
        return False
    return meta.get("status") == 1 and bool(meta.get("report_date"))


def _to_int(value: Any) -> int | None:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _iso_date(value: Any) -> str | None:
    if value is None:
        return None
    return value.strftime("%Y-%m-%d") if hasattr(value, "strftime") else str(value)


# --- IO：MongoDB 报告文档 ---


async def fetch_report_document(report_code: str, *, collection=None) -> dict | None:
    """按报告编号读取报告文档。文档不存在返回 None。"""
    if collection is None:
        try:
            collection = mongo.get_report_collection()
        except mongo.MongoNotConfiguredError as exc:
            raise ReportSourceUnavailableError(str(exc)) from exc
    try:
        return await collection.find_one({"_id": report_code})
    except PyMongoError as exc:
        raise ReportSourceUnavailableError(f"报告数据源不可用: {type(exc).__name__}") from exc


# --- IO：旧库 MySQL（指标字典与报告主记录） ---


async def fetch_indicator_meta(db: AsyncSession, target_ids: list[int]) -> dict[int, dict]:
    """读取旧库指标字典：名称与权重（proportion）。

    权重一律以字典为准，后台不另行维护（FR-037）。
    """
    if not target_ids:
        return {}
    rows = (
        await db.execute(
            text(
                "SELECT target_id, inspect_name, inspect_level, parent_id, proportion "
                "FROM inspect_target WHERE target_id IN :ids"
            ).bindparams(ids=tuple(target_ids))
        )
    ).all()
    return {
        int(r[0]): {
            "name": r[1],
            "level": r[2],
            "parent_id": r[3],
            "weight": r[4],
        }
        for r in rows
    }


async def fetch_report_meta(db: AsyncSession, report_code: str) -> dict | None:
    """读取旧库报告主记录：状态、生成时间、排名字段（= 同龄人对比比例）。"""
    if inspect_base_table is None:
        raise ReportSourceUnavailableError("旧库 inspect_base 表不可用")
    try:
        row = (
            await db.execute(
                select(
                    inspect_base_table.c.status,
                    inspect_base_table.c.report_date,
                    inspect_base_table.c.ranking,
                    inspect_base_table.c.customer_id,
                ).where(inspect_base_table.c.report_code == report_code)
            )
        ).first()
    except SQLAlchemyError as exc:
        raise ReportSourceUnavailableError(f"报告主记录来源不可用: {type(exc).__name__}") from exc
    if row is None:
        return None
    return {
        "status": row[0],
        "report_date": row[1],
        "ranking": row[2],
        "customer_id": row[3],
    }


async def fetch_recent_system_scores(
    db: AsyncSession,
    customer_id: int,
    target_id: int,
    *,
    exclude_report_code: str | None = None,
    limit: int = 6,
    collection=None,
) -> list[int]:
    """按客户向前取最近 limit 份该系统的得分，时间升序返回（FR-034、FR-035）。

    实现要点：报告集合有 84 万文档，**只索引了 `_id` 与 robotSn，没有 uId**，
    直接按 uId 查会是全表扫描（实测超时）。因此先用旧库主记录按 customer_id
    取报告编号（该列有索引），再按 `_id` 回查文档（走主键索引）。

    某次没有该系统得分时跳过，不补零；次数固定为 6，不做后台可配置（FR-034）。
    """
    codes = await _recent_report_codes(db, customer_id, exclude_report_code, limit)
    if not codes:
        return []

    if collection is None:
        try:
            collection = mongo.get_report_collection()
        except mongo.MongoNotConfiguredError as exc:
            raise ReportSourceUnavailableError(str(exc)) from exc
    try:
        docs = await collection.find(
            {"_id": {"$in": codes}},
            {"ddsReportInfo.firstTarget": 1},
        ).to_list(length=len(codes))
    except PyMongoError as exc:
        raise ReportSourceUnavailableError(f"报告数据源不可用: {type(exc).__name__}") from exc

    by_id = {doc.get("_id"): doc for doc in docs}
    scores: list[int] = []
    for code in reversed(codes):  # codes 按时间倒序 → 反转成升序
        if exclude_report_code and code == exclude_report_code:
            continue  # SQL 已排除，这里兜一道，不依赖单一环节
        doc = by_id.get(code)
        if doc is None:
            continue
        score = _first_target_score(doc, target_id)
        if score is not None:
            scores.append(score)
    return scores


async def _recent_report_codes(
    db: AsyncSession, customer_id: int, exclude_report_code: str | None, limit: int
) -> list[str]:
    """该客户最近的报告编号，按检测时间倒序。走 inspect_base 的 customer_id 索引。"""
    if inspect_base_table is None:
        raise ReportSourceUnavailableError("旧库 inspect_base 表不可用")
    try:
        rows = (
            await db.execute(
                text(
                    "SELECT report_code FROM inspect_base "
                    "WHERE customer_id = :cid AND status = 1 "
                    "  AND (:ex IS NULL OR report_code <> :ex) "
                    "ORDER BY inspect_date DESC LIMIT :n"
                ),
                {"cid": customer_id, "ex": exclude_report_code, "n": limit},
            )
        ).all()
    except SQLAlchemyError as exc:
        raise ReportSourceUnavailableError(f"报告主记录来源不可用: {type(exc).__name__}") from exc
    return [r[0] for r in rows if r[0]]


def _first_target_score(document: dict, target_id: int) -> int | None:
    targets = (document.get("ddsReportInfo") or {}).get("firstTarget")
    if not isinstance(targets, list):
        return None
    for node in targets:
        if isinstance(node, dict) and node.get("targetId") == target_id:
            score = node.get("score")
            return int(score) if score is not None else None
    return None


async def fetch_plans_for_indicators(
    db: AsyncSession, indicator_ids: list[int]
) -> dict[int, list[dict]]:
    """按二级指标取命中的健康方案及其商品（FR-015、FR-017）。

    关联链：sa_plan_indicator → sa_plan → sa_plan_product → sa_product。
    只取启用状态的方案与商品；同一指标命中多个方案时按方案的排序取第一个。
    """
    if not indicator_ids:
        return {}
    plan_rows = (
        await db.execute(
            text(
                f"SELECT pi.indicator_id, p.id, p.plan_name, p.description, p.sort_order "
                f"FROM {_t('sa_plan_indicator')} pi "
                f"JOIN {_t('sa_plan')} p ON p.id = pi.plan_id "
                f"WHERE p.status = 1 AND pi.indicator_id IN :ids "
                f"ORDER BY pi.indicator_id, p.sort_order, p.id"
            ).bindparams(ids=tuple(indicator_ids))
        )
    ).all()
    if not plan_rows:
        return {}

    plans: dict[int, list[dict]] = {}
    for indicator_id, plan_id, plan_name, description, _sort in plan_rows:
        plans.setdefault(int(indicator_id), []).append(
            {
                "plan_id": int(plan_id),
                "plan_name": plan_name,
                "description": description,
                # tags / actionLabel / actionHint 在 sa_plan 里没有对应列，当前无来源
                "tags": [],
                "action_label": None,
                "action_hint": None,
                "products": [],
            }
        )

    plan_ids = [p["plan_id"] for group in plans.values() for p in group]
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

    by_plan = {p["plan_id"]: p for group in plans.values() for p in group}
    for plan_id, product_id, product_name, cover_url in product_rows:
        plan = by_plan.get(int(plan_id))
        if plan is None:
            continue
        plan["products"].append(
            {
                "product_id": int(product_id),
                "name": product_name,
                "image_url": cover_url,
                "image_alt": product_name,
            }
        )
    return plans
