"""AI 咨询的报告取数白名单；外部 MySQL/MongoDB 只能走既有读取路径。"""

import re
from datetime import date, datetime
from typing import Any

from sqlalchemy import Select, select, text
from sqlalchemy.sql import visitors
from sqlalchemy.sql.elements import TextClause
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_indicator import SAIndicator


class ReadBoundaryViolation(ValueError):
    """未授权工具、报告范围或非白名单读取语句。"""


# 只接受 report_source 当前固定的参数化 SELECT 模板。模型问题和工具参数
# 从不拼接到 SQL；模板发生变动时需先审查并更新此处与边界测试。
_TEXT_SELECTS = tuple(
    re.compile(pattern)
    for pattern in (
        r"SELECT target_id, inspect_name, inspect_level, parent_id, proportion FROM inspect_target WHERE target_id IN :ids",
        r"SELECT report_code, inspect_date FROM inspect_base WHERE customer_id = :cid AND status = 1 AND report_code <> :current_code ORDER BY inspect_date DESC, report_code DESC LIMIT :n",
        r"SELECT report_code FROM inspect_base WHERE customer_id = :cid AND status = 1 AND \(:ex IS NULL OR report_code <> :ex\) ORDER BY inspect_date DESC LIMIT :n",
        r"SELECT pi.indicator_id, p.id, p.plan_name, p.description, p.trigger_score_below, p.sort_order FROM nepstar.sa_plan_indicator pi JOIN nepstar.sa_plan p ON p.id = pi.plan_id WHERE p.status = 1 AND pi.indicator_id IN :ids ORDER BY pi.indicator_id, p.sort_order, p.id",
        r"SELECT pp.plan_id, pr.id, pr.product_name, pr.cover_url FROM nepstar.sa_plan_product pp JOIN nepstar.sa_product pr ON pr.id = pp.product_id WHERE pr.status = 1 AND pp.plan_id IN :ids ORDER BY pp.plan_id, pp.sort_order, pr.id",
        r"SELECT id, product_name, cover_url FROM nepstar.sa_product WHERE status = 1 AND id IN :product_ids",
        r"SELECT report_code, inspect_date, report_date, customer_id FROM inspect_base WHERE customer_id = :cid AND status = 1 AND inspect_date <= :cutoff AND report_date <= :report_time AND report_code <> :current_code ORDER BY inspect_date DESC, report_code DESC LIMIT :n",
    )
)


def _permitted_select(statement: Any) -> bool:
    if isinstance(statement, TextClause):
        normalized = " ".join(statement.text.split())
        return any(pattern.fullmatch(normalized) for pattern in _TEXT_SELECTS)
    if not isinstance(statement, Select) or statement._for_update_arg is not None:
        return False
    if statement._prefixes or statement._suffixes:
        return False
    if any(isinstance(part, TextClause) for part in visitors.iterate(statement)):
        return False
    froms = statement.get_final_froms()
    if len(froms) != 1:
        return False
    table = froms[0]
    table_identity = (getattr(table, "name", None), getattr(table, "schema", None))
    if table_identity == ("sa_indicator", "nepstar"):
        return str(statement) in {
            str(select(SAIndicator)),
            str(select(SAIndicator).order_by(SAIndicator.sort_order, SAIndicator.id)),
        }
    if table_identity != ("inspect_base", None):
        return False
    try:
        expected = select(
            table.c.status,
            table.c.report_date,
            table.c.ranking,
            table.c.customer_id,
            table.c.inspect_date,
        ).where(table.c.report_code == "bound-report-code")
    except AttributeError:
        return False
    return str(statement) == str(expected)


class ReadOnlyReportSession:
    """给既有报告服务的窄会话视图；不暴露任何写入或任意 SQL 能力。"""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def execute(self, statement, params=None):
        if not _permitted_select(statement):
            raise ReadBoundaryViolation("AI consult report source requires an approved SELECT")
        if params is None:
            return await self._db.execute(statement)
        return await self._db.execute(statement, params)

    def add(self, _row):
        raise ReadBoundaryViolation("AI consult report source is read-only")

    async def flush(self):
        raise ReadBoundaryViolation("AI consult report source is read-only")

    async def commit(self):
        raise ReadBoundaryViolation("AI consult report source is read-only")

    async def delete(self, _row):
        raise ReadBoundaryViolation("AI consult report source is read-only")


def _report_view_service():
    # 延迟导入：旧库 inspect_base 在现有代码中会在导入时反射；隔离测试
    # 不得因此连接真实旧库。运行时仍复用现有公开报告归属检查。
    from . import report_view_service

    return report_view_service


def _report_source():
    # 目标节点遍历沿用已验证的报告分支规则，避免把另一系统的同名指标混入历史。
    from . import report_source

    return report_source


_REPORT_CODE = re.compile(r"[A-Za-z0-9-]{1,64}\Z")
_INDICATOR_CODE = re.compile(r"[A-Z][A-Z0-9_]{1,63}\Z")


def _score(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(value) if 0 <= value <= 100 and int(value) == value else None


def _recommendation_context(value: Any) -> dict[str, Any] | None:
    """Expose only fields needed to re-check a current plan; no ad copy/products."""
    if not isinstance(value, dict):
        return None
    plan_id = value.get("plan_id")
    plan_name = value.get("plan_name")
    code = value.get("trigger_indicator_code")
    if (
        isinstance(plan_id, bool)
        or not isinstance(plan_id, int)
        or plan_id <= 0
        or not isinstance(plan_name, str)
        or not plan_name.strip()
        or len(plan_name) > 100
        or not isinstance(code, str)
        or _INDICATOR_CODE.fullmatch(code) is None
    ):
        return None
    return {
        "plan_id": plan_id,
        "plan_name": plan_name.strip(),
        "trigger_indicator_code": code,
        "indicator_score": _score(value.get("indicator_score")),
        "trigger_score_below": _score(value.get("trigger_score_below")),
        "description": (
            value.get("description")
            if isinstance(value.get("description"), str) and len(value["description"]) <= 1200
            else None
        ),
    }


def _scope(scope: Any) -> tuple[str, int]:
    report_code = getattr(scope, "report_code", None)
    customer_id = getattr(scope, "customer_id", None)
    if (
        not isinstance(report_code, str)
        or _REPORT_CODE.fullmatch(report_code) is None
        or isinstance(customer_id, bool)
        or not isinstance(customer_id, int)
        or customer_id <= 0
    ):
        raise ReadBoundaryViolation("Invalid bound report scope")
    return report_code, customer_id


async def read_report_tool(
    read_db: AsyncSession,
    bound_scope: Any,
    tool_name: str,
    *,
    indicator_code: str | None = None,
    plan_id: int | None = None,
) -> dict[str, Any]:
    """Only home, indicator and verified plan context; no product bodies or arbitrary SQL."""
    report_code, customer_id = _scope(bound_scope)
    if tool_name not in {"home", "indicator", "plan_context"}:
        raise ReadBoundaryViolation("Unknown report tool")
    if tool_name != 'plan_context' and plan_id is not None:
        raise ReadBoundaryViolation('Unexpected plan argument')
    if tool_name == "home" and indicator_code is not None:
        raise ReadBoundaryViolation("Unexpected indicator argument")
    if tool_name in {"indicator", "plan_context"} and (
        not isinstance(indicator_code, str) or _INDICATOR_CODE.fullmatch(indicator_code) is None
    ):
        raise ReadBoundaryViolation("Invalid indicator code")

    service = _report_view_service()
    guarded_db = ReadOnlyReportSession(read_db)
    if tool_name == 'plan_context':
        if type(plan_id) is not int or plan_id <= 0:
            raise ReadBoundaryViolation('Invalid plan ID')
        try:
            data = await service.build_plan_context(guarded_db, report_code, plan_id, customer_id, indicator_code)
        except Exception as exc:
            if getattr(exc, 'key', None) == 'report.plan_not_found':
                return {}
            raise
        plan = data.get('plan') or {}
        primary = data.get('primary_indicator') or {}
        if data.get('report_code') != report_code or plan.get('plan_id') != plan_id or primary.get('indicator_code') != indicator_code:
            raise ReadBoundaryViolation('Plan scope mismatch')
        return {'report_code': report_code, 'plan_id': plan_id, 'plan_name': plan.get('name'),
                'description': plan.get('description'), **{
                    key: primary.get(key) for key in ('system_code', 'system_name', 'indicator_code', 'indicator_name', 'indicator_score', 'trigger_score_below')
                }}
    if tool_name == "home":
        data = await service.build_home(guarded_db, report_code, customer_id)
        report = data.get("report") or {}
        if report.get("report_code") != report_code:
            raise ReadBoundaryViolation("Report scope mismatch")
        systems = []
        for item in data.get("systems") or []:
            if not isinstance(item, dict):
                continue
            system_code = item.get("system_code")
            if not isinstance(system_code, str) or _INDICATOR_CODE.fullmatch(system_code) is None:
                continue
            if not isinstance(item.get("name"), str) or not item["name"]:
                continue
            indicators = []
            for child in item.get("indicators") or []:
                if not isinstance(child, dict):
                    continue
                indicator_code = child.get("indicator_code")
                if (
                    not isinstance(indicator_code, str)
                    or _INDICATOR_CODE.fullmatch(indicator_code) is None
                    or not isinstance(child.get("name"), str)
                    or not child["name"]
                ):
                    continue
                indicators.append(
                    {
                        "indicator_code": indicator_code,
                        "name": child["name"],
                        "score": _score(child.get("score")),
                    }
                )
            systems.append(
                {
                    "system_code": system_code,
                    "name": item["name"],
                    "score": _score(item.get("score")),
                    "indicators": indicators,
                    "recommendation": _recommendation_context(item.get("recommendation")),
                }
            )
        return {
            "report_code": report_code,
            "report_date": report.get("report_date"),
            "total_score": _score(report.get("total_score")),
            "systems": systems,
        }

    data = await service.build_indicator_detail(guarded_db, report_code, indicator_code, customer_id)
    item = data.get("indicator") or {}
    if data.get("report_code") != report_code or item.get("indicator_code") != indicator_code:
        raise ReadBoundaryViolation("Indicator scope mismatch")
    system = data.get("system") or {}
    # 旧展示页趋势含当前报告之后的记录；AI 仅能使用独立的时间上界查询。
    return {
        "report_code": report_code,
        "system": {"system_code": system.get("system_code"), "name": system.get("name")},
        "indicator": {
            "indicator_code": indicator_code,
            "name": item.get("name"),
            "score": _score(item.get("score")),
            "description": item.get("description"),
            "interpretation": item.get("interpretation"),
            "status_text": item.get("status_text"),
            "actions": item.get("actions") if isinstance(item.get("actions"), list) else [],
        },
    }


async def fetch_bounded_indicator_history(
    read_db: AsyncSession,
    bound_scope: Any,
    *,
    system_target_id: int,
    indicator_target_id: int,
    current_inspect_date: datetime,
    current_report_timestamp: datetime,
    current_score: int | None,
    collection=None,
) -> list[dict[str, Any]]:
    """旧报告专用历史：仅在可信来源提供精确报告时间后调用，最多六个点。"""
    report_code, customer_id = _scope(bound_scope)
    report_date = getattr(bound_scope, "report_date", None)
    if (
        not isinstance(report_date, date)
        or not isinstance(current_inspect_date, datetime)
        or not isinstance(current_report_timestamp, datetime)
        or current_report_timestamp.date() != report_date
        or current_inspect_date > current_report_timestamp
        or isinstance(system_target_id, bool)
        or isinstance(indicator_target_id, bool)
        or not isinstance(system_target_id, int)
        or not isinstance(indicator_target_id, int)
        or system_target_id <= 0
        or indicator_target_id <= 0
    ):
        raise ReadBoundaryViolation("Invalid verified report history scope")

    statement = text(
        "SELECT report_code, inspect_date, report_date, customer_id FROM inspect_base "
        "WHERE customer_id = :cid AND status = 1 AND inspect_date <= :cutoff "
        "AND report_date <= :report_time AND report_code <> :current_code "
        "ORDER BY inspect_date DESC, report_code DESC LIMIT :n"
    )
    rows = (
        await ReadOnlyReportSession(read_db).execute(
            statement,
            {
                "cid": customer_id,
                "cutoff": current_inspect_date,
                "report_time": current_report_timestamp,
                "current_code": report_code,
                "n": 60,
            },
        )
    ).all()
    candidates = []
    for code, inspected_at, generated_at, row_customer_id in rows:
        if (
            row_customer_id != customer_id
            or not isinstance(code, str)
            or _REPORT_CODE.fullmatch(code) is None
            or code == report_code
            or not isinstance(inspected_at, datetime)
            or not isinstance(generated_at, datetime)
            or inspected_at > current_inspect_date
            or generated_at > current_report_timestamp
        ):
            continue
        candidates.append((code, inspected_at))

    points = []
    if candidates:
        if collection is None:
            from .. import mongo

            collection = mongo.get_report_collection()
        codes = [code for code, _ in candidates]
        documents = await collection.find(
            {"_id": {"$in": codes}}, {"ddsReportInfo.firstTarget": 1}
        ).to_list(length=len(codes))
        by_code = {doc.get("_id"): doc for doc in documents if isinstance(doc, dict)}
        source = _report_source()
        for code, inspected_at in candidates:
            document = by_code.get(code)
            if document is None:
                continue
            first_targets = (document.get("ddsReportInfo") or {}).get("firstTarget")
            node = source.find_target_under_system(
                first_targets, system_target_id, indicator_target_id
            )
            score = _score(node.get("score")) if node else None
            if score is not None:
                points.append(
                    {"report_code": code, "date": inspected_at.date().isoformat(), "score": score}
                )

    score = _score(current_score)
    if score is not None:
        points.append(
            {"report_code": report_code, "date": current_inspect_date.date().isoformat(), "score": score}
        )
    points.sort(key=lambda point: (point["date"], point["report_code"]))
    return points[-6:]
