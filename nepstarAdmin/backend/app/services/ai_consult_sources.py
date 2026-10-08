"""AI 咨询的报告取数白名单；外部 MySQL/MongoDB 只能走既有读取路径。"""

import re
from typing import Any

from sqlalchemy import Select, select
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


_REPORT_CODE = re.compile(r"[A-Za-z0-9-]{1,64}\Z")
_INDICATOR_CODE = re.compile(r"[A-Z][A-Z0-9_]{1,63}\Z")


def _score(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(value) if 0 <= value <= 100 and int(value) == value else None


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
) -> dict[str, Any]:
    """只开放首页事实和单指标事实；历史上界另经专门适配器实现。"""
    report_code, customer_id = _scope(bound_scope)
    if tool_name not in {"home", "indicator"}:
        raise ReadBoundaryViolation("Unknown report tool")
    if tool_name == "home" and indicator_code is not None:
        raise ReadBoundaryViolation("Unexpected indicator argument")
    if tool_name == "indicator" and (
        not isinstance(indicator_code, str) or _INDICATOR_CODE.fullmatch(indicator_code) is None
    ):
        raise ReadBoundaryViolation("Invalid indicator code")

    service = _report_view_service()
    guarded_db = ReadOnlyReportSession(read_db)
    if tool_name == "home":
        data = await service.build_home(guarded_db, report_code, customer_id)
        report = data.get("report") or {}
        if report.get("report_code") != report_code:
            raise ReadBoundaryViolation("Report scope mismatch")
        systems = []
        for item in data.get("systems") or []:
            if not isinstance(item, dict):
                continue
            score = _score(item.get("score"))
            if score is not None and item.get("system_code") and item.get("name"):
                systems.append({"system_code": item["system_code"], "name": item["name"], "score": score})
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
    # 旧展示页趋势含当前报告之后的记录，AI 的历史上界尚未实现，故此处不复制 trend。
    return {
        "report_code": report_code,
        "system": {"system_code": system.get("system_code"), "name": system.get("name")},
        "indicator": {
            "indicator_code": indicator_code,
            "name": item.get("name"),
            "score": _score(item.get("score")),
            "description": item.get("description"),
        },
    }
