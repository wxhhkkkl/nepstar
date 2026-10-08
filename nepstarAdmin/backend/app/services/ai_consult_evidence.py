"""把当前公开报告的已核对事实压缩成可引用、去身份化的问答证据。"""

import re
from copy import deepcopy
from dataclasses import dataclass
from datetime import date
from typing import Any, Awaitable, Callable
from urllib.parse import quote

from .ai_consult_sources import read_report_tool


class EvidenceUnavailable(ValueError):
    """当前报告、日期或指定指标不能安全关联。"""


@dataclass(frozen=True)
class EvidenceBundle:
    facts: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    warnings: list[str]

    def for_model(self) -> dict[str, Any]:
        """模型只接收事实与不确定性，不接收路由、报告号或客户标识。"""
        return {"facts": deepcopy(self.facts), "warnings": list(self.warnings)}

    def for_client(self) -> dict[str, Any]:
        """页面引用单独返回，不能把本结构直接当模型上下文。"""
        return {"citations": deepcopy(self.citations), "warnings": list(self.warnings)}


_CODE = re.compile(r"[A-Z][A-Z0-9_]{1,63}\Z")
_REPORT_CODE = re.compile(r"[A-Za-z0-9-]{1,64}\Z")
_PHONE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
_REPORT_ID = re.compile(r"\b(?:KH|KJ)[A-Z0-9]{12,}\b")
_PRIORITY_WORDS = ("哪些指标", "优先关注", "需要关注什么", "低分指标", "异常指标")


def _score(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(value) if 0 <= value <= 100 and int(value) == value else None


def _valid_code(value: Any) -> bool:
    return isinstance(value, str) and _CODE.fullmatch(value) is not None


def _safe_label(value: Any) -> bool:
    return (
        isinstance(value, str)
        and bool(value.strip())
        and len(value) <= 100
        and _PHONE.search(value) is None
        and _EMAIL.search(value) is None
        and _REPORT_ID.search(value) is None
    )


def _route(scope: Any, system_code: str | None = None, indicator_code: str | None = None) -> str:
    path = "#/"
    if system_code:
        path = f"#/system/{quote(system_code, safe='')}"
    if indicator_code:
        path += f"/indicator/{quote(indicator_code, safe='')}"
    report_code = quote(scope.report_code, safe="")
    return f"{path}?reportId={report_code}&customerId={scope.customer_id}"


def _safe_maintained_text(indicator: dict[str, Any], report_code: str) -> str | None:
    pieces = []
    for key in ("description", "interpretation"):
        value = indicator.get(key)
        if isinstance(value, str) and value.strip():
            pieces.append(value.strip())
    if not pieces:
        return None
    combined = "\n".join(pieces)
    if (
        len(combined) > 1000
        or report_code in combined
        or _PHONE.search(combined)
        or _EMAIL.search(combined)
        or _REPORT_ID.search(combined)
    ):
        return None
    return combined


def _add_fact(
    facts: list[dict[str, Any]],
    citations: list[dict[str, Any]],
    scope: Any,
    *,
    kind: str,
    metric: str,
    report_date: str,
    system_code: str | None = None,
    indicator_code: str | None = None,
    score: int | None = None,
    text: str | None = None,
) -> None:
    evidence_id = f"ev{len(facts) + 1}"
    fact: dict[str, Any] = {"id": evidence_id, "kind": kind, "metric": metric}
    if kind == "report":
        fact.update({"score": score, "date": report_date, "date_kind": "report_date"})
    else:
        fact["text"] = text
    facts.append(fact)
    citations.append(
        {
            "id": evidence_id,
            "kind": kind,
            "label": metric,
            "report_date": report_date if kind == "report" else None,
            "route": _route(scope, system_code, indicator_code),
        }
    )


async def prepare_report_evidence(
    read_db: Any,
    bound_scope: Any,
    question: str,
    *,
    requested_indicator_code: str | None = None,
    reader: Callable[..., Awaitable[dict[str, Any]]] = read_report_tool,
) -> EvidenceBundle:
    """按问题只取一项匹配指标详情，或最多三项低分事实；不调用模型。"""
    report_code = getattr(bound_scope, "report_code", None)
    customer_id = getattr(bound_scope, "customer_id", None)
    scope_date = getattr(bound_scope, "report_date", None)
    if (
        not isinstance(report_code, str)
        or _REPORT_CODE.fullmatch(report_code) is None
        or isinstance(customer_id, bool)
        or not isinstance(customer_id, int)
        or customer_id <= 0
        or not isinstance(scope_date, date)
        or not isinstance(question, str)
        or not question.strip()
        or len(question) > 500
    ):
        raise EvidenceUnavailable("Invalid evidence scope or question")

    home = await reader(read_db, bound_scope, "home")
    try:
        report_date = date.fromisoformat(home.get("report_date"))
    except (TypeError, ValueError) as exc:
        raise EvidenceUnavailable("Report date unavailable") from exc
    if home.get("report_code") != report_code or report_date != scope_date:
        raise EvidenceUnavailable("Report scope mismatch")
    date_text = report_date.isoformat()

    catalog = []
    systems = []
    for system in home.get("systems") or []:
        if not isinstance(system, dict) or not _valid_code(system.get("system_code")):
            continue
        if not _safe_label(system.get("name")):
            continue
        systems.append(system)
        for indicator in system.get("indicators") or []:
            if not isinstance(indicator, dict) or not _valid_code(indicator.get("indicator_code")):
                continue
            if not _safe_label(indicator.get("name")):
                continue
            catalog.append((system, indicator))

    if requested_indicator_code is not None:
        matches = [
            pair for pair in catalog if pair[1]["indicator_code"] == requested_indicator_code
        ]
        if len(matches) != 1:
            raise EvidenceUnavailable("Indicator not registered in this report")
    else:
        matches = [
            pair for pair in catalog
            if pair[1]["name"] in question or pair[1]["indicator_code"] in question
        ]
        matches.sort(key=lambda pair: (-len(pair[1]["name"]), pair[1]["indicator_code"]))

    facts: list[dict[str, Any]] = []
    citations: list[dict[str, Any]] = []
    warnings: list[str] = []
    if matches:
        system, indicator = matches[0]
        code = indicator["indicator_code"]
        detail = await reader(read_db, bound_scope, "indicator", indicator_code=code)
        detail_system = detail.get("system") or {}
        item = detail.get("indicator") or {}
        if (
            detail.get("report_code") != report_code
            or detail_system.get("system_code") != system["system_code"]
            or item.get("indicator_code") != code
            or item.get("name") != indicator["name"]
        ):
            raise EvidenceUnavailable("Indicator scope mismatch")
        catalog_score = _score(indicator.get("score"))
        detail_score = _score(item.get("score"))
        if catalog_score is None or detail_score is None:
            warnings.append("score_missing")
        elif catalog_score != detail_score:
            warnings.append("score_conflict")
        else:
            _add_fact(
                facts, citations, bound_scope, kind="report", metric=indicator["name"],
                report_date=date_text, system_code=system["system_code"],
                indicator_code=code, score=detail_score,
            )
            maintained_text = _safe_maintained_text(item, report_code)
            if maintained_text:
                _add_fact(
                    facts, citations, bound_scope, kind="maintained", metric=indicator["name"],
                    report_date=date_text, system_code=system["system_code"],
                    indicator_code=code, text=maintained_text,
                )
        return EvidenceBundle(facts, citations, warnings)

    if any(word in question for word in _PRIORITY_WORDS):
        scored = [
            (system, indicator, _score(indicator.get("score")))
            for system, indicator in catalog
        ]
        scored = [item for item in scored if item[2] is not None]
        scored.sort(key=lambda item: (item[2], item[1]["indicator_code"]))
        for system, indicator, score in scored[:3]:
            _add_fact(
                facts, citations, bound_scope, kind="report", metric=indicator["name"],
                report_date=date_text, system_code=system["system_code"],
                indicator_code=indicator["indicator_code"], score=score,
            )
        if not scored:
            warnings.append("score_missing")
        return EvidenceBundle(facts, citations, warnings)

    matched_system = next((s for s in systems if s["name"] in question), None)
    if matched_system:
        system_score = _score(matched_system.get("score"))
        if system_score is not None:
            _add_fact(
                facts, citations, bound_scope, kind="report", metric=matched_system["name"],
                report_date=date_text, system_code=matched_system["system_code"],
                score=system_score,
            )
        else:
            warnings.append("score_missing")
    else:
        total_score = _score(home.get("total_score"))
        if total_score is not None:
            _add_fact(
                facts, citations, bound_scope, kind="report", metric="报告总分",
                report_date=date_text, score=total_score,
            )
        else:
            warnings.append("score_missing")
    return EvidenceBundle(facts, citations, warnings)
