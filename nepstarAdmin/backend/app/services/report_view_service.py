"""报告展示数据的组装层。

职责：把报告文档 + 后台指标配置组装成前端可直接渲染的结构。
读取与错误归并在 report_source；本模块只做组装、过滤、排序与错误区分。

口径要点（见 spec 与 data-model）：
- 只有**已在后台登记 target_id 的指标**才进入报告（FR-025、FR-044）。
- 旧报告的一级系统比 V2 展示的多，未登记的自然被排除（FR-027）。
- 性别专项不需要推断：文档里只会有对应性别那一支（FR-012）。
- 系统得分直接取文档中该 target_id 的得分，不由展示的指标重新加权（FR-044）。
"""

import json
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.new.sa_indicator import SAIndicator
from ..utils.report_log import log_report_request
from . import report_source

# 仅心血管返回趋势序列（FR-034）。以旧一级系统的 targetId 标识。
TREND_TARGET_ID = 3087

# 报告级单值到系统的固定归属（FR-009、research R7）。这些值不参与加权。
# 每项为 (展示名, (文档块, 字段), 单位)。
DIRECT_MEASUREMENT_SOURCES: dict[int, list[tuple[str, tuple[str, str], str | None]]] = {
    3087: [
        ("微循环", ("spo2hReportInfo", "microcirculation"), None),
        ("心率", ("spo2hReportInfo", "heartRate"), "bpm"),
        ("心电图", ("ecgReportInfo", "heartStatus"), None),
    ],
    3108: [("血氧饱和度", ("spo2hReportInfo", "bloodoxygenRate"), "%")],
}

# 心电状态在旧系统里是"正常/异常"标志：==1 为正常，其余按异常扣分，见
# oldbackend AzyReportDataServiceImpl: `if (ecg.getHeartStatus() != 1) demerit += 11`。
# 它没有节律类型文案——设计稿里的"窦性心律"在源数据里没有出处。
ECG_STATUS_TEXT = {1: "正常"}
ECG_STATUS_FALLBACK = "异常"


class ReportViewError(Exception):
    """报告展示接口的业务错误。key 是 i18n key，reason 是内部真实原因（FR-019）。"""

    key = "report.not_found"
    code = 404

    def __init__(self, reason: str = "not_found") -> None:
        super().__init__(self.key)
        self.reason = reason


class ReportNotFoundError(ReportViewError):
    """报告不存在 或 无权访问。两者对外共用同一标识，靠 reason 在日志里区分。"""


class ReportNotReadyError(ReportViewError):
    key = "report.not_ready"
    code = 409

    def __init__(self, reason: str = "not_ready") -> None:
        super().__init__(reason)


class ReportSystemNotFoundError(ReportViewError):
    key = "report.system_not_found"
    code = 404

    def __init__(self, reason: str = "system_not_found") -> None:
        super().__init__(reason)


# --- 纯函数 ---


def _derive_life_expectancy(actual_age: Any, biological_age: Any) -> float | None:
    """健康预期寿命 = 基准年寿 − (生理年龄 − 实际年龄)，保留一位小数（FR-045）。

    源数据里没有这个字段，基准值由后台配置。
    """
    if actual_age is None or biological_age is None:
        return None
    diff = float(biological_age) - float(actual_age)
    return round(settings.REPORT_LIFE_EXPECTANCY_BASE - diff, 1)


def _format_direct(key: str, raw: Any) -> str:
    if key == "heartStatus":
        return ECG_STATUS_TEXT.get(int(raw), ECG_STATUS_FALLBACK)
    return str(raw)


def _direct_measurements(document: dict, target_id: int) -> list[dict[str, Any]]:
    """按固定归属取出报告级单值。缺字段时跳过，不补占位值（FR-009）。"""
    out: list[dict[str, Any]] = []
    for name, (block, key), unit in DIRECT_MEASUREMENT_SOURCES.get(target_id, []):
        raw = (document.get(block) or {}).get(key)
        if raw is None:
            continue
        out.append({"name": name, "value": _format_direct(key, raw), "unit": unit})
    return out


def _parse_actions(raw: str | None) -> list[str]:
    """report_actions 存的是 JSON 字符串数组；非法或为空时按空数组处理。"""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return [str(x) for x in parsed] if isinstance(parsed, list) else []


def _index_indicators(
    rows: list[SAIndicator],
) -> tuple[list[SAIndicator], dict[int, list[SAIndicator]]]:
    """把注册指标拆成（一级系统，按父分组的二级）。只保留填了 target_id 的。"""
    usable = [r for r in rows if r.target_id is not None and r.status == 1]
    usable.sort(key=lambda r: (r.sort_order, r.id))
    systems = [r for r in usable if r.parent_id is None]
    children: dict[int, list[SAIndicator]] = {}
    for row in usable:
        if row.parent_id is not None:
            children.setdefault(row.parent_id, []).append(row)
    return systems, children


def _build_recommendation(child: SAIndicator, score: int, plan: dict) -> dict[str, Any]:
    """把一个命中的方案组装成推荐。触发指标必须来自该系统自己的指标（FR-015）。"""
    return {
        "trigger_indicator_code": child.ind_code,
        "issue": f"{child.ind_name} · 活力值 {score}",
        "plan_id": plan["plan_id"],
        "plan_name": plan["plan_name"],
        # 展示标题取方案名——sa_plan 没有独立的标题列
        "title": plan["plan_name"],
        "description": plan.get("description"),
        # 这三个字段在 sa_plan 里没有对应列，源端按空给出
        "tags": plan.get("tags") or [],
        "action_label": plan.get("action_label"),
        "action_hint": plan.get("action_hint"),
        "products": plan.get("products") or [],
    }


def _build_system(
    system: SAIndicator,
    children: list[SAIndicator],
    score_by_target: dict[int, int],
    weights: dict[int, dict],
    plans: dict[int, list[dict]] | None = None,
) -> dict[str, Any]:
    """组装单个系统。调用前已确认 system.target_id 在文档中存在。"""
    plans = plans or {}
    indicators = []
    categories: list[str] = []
    series: list[int] = []
    recommendation: dict[str, Any] | None = None
    for child in children:
        score = score_by_target.get(child.target_id)
        if score is None:
            continue
        # 同一指标命中多个方案时按后台排序取第一个（FR-017）
        candidates = plans.get(child.id) or []
        if recommendation is None and candidates:
            recommendation = _build_recommendation(child, score, candidates[0])
        indicators.append(
            {
                "indicator_code": child.ind_code,
                "name": child.ind_name,
                "score": score,
                "weight": (weights.get(child.target_id) or {}).get("weight"),
                "description": child.description,
            }
        )
        categories.append(child.ind_name)
        series.append(score)

    return {
        "system_code": system.ind_code,
        "name": system.ind_name,
        "score": score_by_target.get(system.target_id),
        "status_text": system.report_status_text,
        "summary": system.report_summary,
        "sort_order": system.sort_order,
        "applicable": True,  # 不适用当前性别的系统不会出现在文档里
        "visualization": {"categories": categories, "series": series},
        "trend": {"series": []},  # 仅心血管在 _assemble_system 里回填
        "indicators": indicators,
        "recommendation": recommendation,
    }


# --- IO 编排 ---


async def _load_document_and_meta(
    db: AsyncSession, report_code: str, customer_id: int
) -> tuple[dict, dict]:
    """读取报告文档与主记录，并完成归属校验与就绪判定。"""
    document = await report_source.fetch_report_document(report_code)
    if document is None:
        raise ReportNotFoundError("not_found")
    meta = await report_source.fetch_report_meta(db, report_code)
    if meta is None:
        raise ReportNotFoundError("not_found")
    if meta.get("customer_id") != customer_id:
        raise ReportNotFoundError("access_denied")
    if not report_source.is_ready(meta):
        raise ReportNotReadyError()
    return document, meta


async def _load_registry(
    db: AsyncSession, document: dict
) -> tuple[
    list[SAIndicator],
    dict[int, list[SAIndicator]],
    dict[int, int],
    dict[int, dict],
    dict[int, list],
]:
    """读取后台登记指标、报告指标树、旧库权重与命中的方案。"""
    nodes = report_source.walk_targets((document.get("ddsReportInfo") or {}).get("firstTarget"))
    score_by_target = {n["target_id"]: n["score"] for n in nodes if n.get("score") is not None}
    rows = list(
        (await db.execute(select(SAIndicator).order_by(SAIndicator.sort_order, SAIndicator.id)))
        .scalars()
        .all()
    )
    systems, children = _index_indicators(rows)
    weights = await report_source.fetch_indicator_meta(
        db, [r.target_id for r in rows if r.target_id is not None]
    )
    indicator_ids = [c.id for group in children.values() for c in group]
    plans = await report_source.fetch_plans_for_indicators(db, indicator_ids)
    return systems, children, score_by_target, weights, plans


async def _assemble_system(
    system: SAIndicator,
    children: list[SAIndicator],
    score_by_target: dict[int, int],
    weights: dict[int, dict],
    plans: dict[int, list[dict]],
    *,
    db: AsyncSession,
    customer_id: int,
    report_code: str,
) -> dict[str, Any]:
    """组装单个系统。首页与详情共用，保证两处结果一致（FR-011）。"""
    item = _build_system(system, children, score_by_target, weights, plans)
    if system.target_id == TREND_TARGET_ID:
        item["trend"] = {
            "series": await report_source.fetch_recent_system_scores(
                db, customer_id, system.target_id, exclude_report_code=report_code
            )
        }
    return item


async def build_home(db: AsyncSession, report_code: str, customer_id: int) -> dict[str, Any]:
    """组装报告首页数据。失败时抛 ReportViewError 的子类（由路由层记录日志）。"""
    started = time.perf_counter()
    document, meta = await _load_document_and_meta(db, report_code, customer_id)
    systems, children, score_by_target, weights, plans = await _load_registry(db, document)

    built: list[dict[str, Any]] = []
    for system in systems:
        if system.target_id not in score_by_target:
            continue  # 未登记到该份报告 / 性别不符
        built.append(
            await _assemble_system(
                system,
                children.get(system.id, []),
                score_by_target,
                weights,
                plans,
                db=db,
                customer_id=customer_id,
                report_code=report_code,
            )
        )

    # 低分且命中推荐方案的系统排在前面（FR-014）；同组内按后台排序
    built.sort(key=lambda s: (s["recommendation"] is None, s["sort_order"]))

    summary = report_source.parse_summary(document, meta)
    nodes = report_source.walk_targets((document.get("ddsReportInfo") or {}).get("firstTarget"))
    registered = {s.target_id for s in systems}
    registered |= {c.target_id for group in children.values() for c in group}
    missing = sorted({n["target_id"] for n in nodes} - registered)

    log_report_request(
        report_code=report_code,
        outcome="ok",
        duration_ms=int((time.perf_counter() - started) * 1000),
        missing_target_ids=missing or None,
    )

    return {
        "report": {
            "report_code": report_code,
            "serial_number": report_code.replace("-", "—"),
            "report_date": summary["report_date"],
            "gender": summary["gender"],
            "total_score": summary["total_score"],
            "warning_threshold": settings.REPORT_WARNING_THRESHOLD,
            "peer_percent": summary["peer_percent"],
            "actual_age": summary["actual_age"],
            "biological_age": summary["biological_age"],
            "healthy_life_expectancy": _derive_life_expectancy(
                summary["actual_age"], summary["biological_age"]
            ),
            "summary": None,  # 源数据无整份报告的总体结论文案，见 spec 的待确认项
        },
        "systems": built,
        "ai_consult": {
            "enabled": settings.REPORT_AI_CONSULT_ENABLED,
            "title": settings.REPORT_AI_CONSULT_TITLE,
            "entry_type": settings.REPORT_AI_CONSULT_ENTRY_TYPE,
            "entry_url": settings.REPORT_AI_CONSULT_ENTRY_URL,
        },
        "features": {"save_report_enabled": settings.REPORT_SAVE_ENABLED},
    }


async def build_system_detail(
    db: AsyncSession, report_code: str, system_code: str, customer_id: int
) -> dict[str, Any]:
    """组装单个系统的详情。失败时抛 ReportViewError 的子类。"""
    started = time.perf_counter()
    document, _meta = await _load_document_and_meta(db, report_code, customer_id)
    systems, children, score_by_target, weights, plans = await _load_registry(db, document)

    system = next((s for s in systems if s.ind_code == system_code), None)
    if system is None or system.target_id not in score_by_target:
        # 未登记，或该报告没有这一支（含性别不符）——不回退到第一个系统（FR-007）
        raise ReportSystemNotFoundError()

    item = await _assemble_system(
        system,
        children.get(system.id, []),
        score_by_target,
        weights,
        plans,
        db=db,
        customer_id=customer_id,
        report_code=report_code,
    )
    item["direct_measurements"] = _direct_measurements(document, system.target_id)
    item["interpretation"] = system.report_interpretation
    item["actions"] = _parse_actions(system.report_actions)

    log_report_request(
        report_code=report_code,
        outcome="ok",
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
    return {"report_code": report_code, "system": item}
