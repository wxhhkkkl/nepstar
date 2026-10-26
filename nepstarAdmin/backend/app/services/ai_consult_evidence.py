"""把当前公开报告的已核对事实压缩成可引用、去身份化的问答证据。"""

import re
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Awaitable, Callable
from urllib.parse import quote

from .ai_consult_sources import read_report_tool
from .ai_consult_plan_context import resolve_current_entry_context


class EvidenceUnavailable(ValueError):
    """当前报告、日期或指定指标不能安全关联。"""


@dataclass(frozen=True)
class EvidenceBundle:
    facts: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    warnings: list[str]
    actions: list[dict[str, Any]] = field(default_factory=list)
    user_context: list[dict[str, str]] = field(default_factory=list)
    prior_follow_up_questions: list[str] = field(default_factory=list)

    def for_model(self) -> dict[str, Any]:
        """模型只接收事实、有限用户补充与不确定性，不接收路由或报告身份。"""
        facts = deepcopy(self.facts)
        for fact in facts:
            if fact.get("kind") == "plan":
                # Exact plan title and admin-authored description are rendered server-side;
                # do not expose either as prompt text.
                fact["metric"] = "当前管理方案"
                fact.pop("text", None)
        payload = {"facts": facts, "warnings": list(self.warnings)}
        if self.user_context:
            payload["user_context"] = deepcopy(self.user_context)
        return payload

    def for_client(self) -> dict[str, Any]:
        """页面引用单独返回，不能把本结构直接当模型上下文。"""
        return {"citations": deepcopy(self.citations), "warnings": list(self.warnings)}


_CODE = re.compile(r"[A-Z][A-Z0-9_]{1,63}\Z")
_REPORT_CODE = re.compile(r"[A-Za-z0-9-]{1,64}\Z")
_PHONE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
_REPORT_ID = re.compile(r"\b(?:KH|KJ)[A-Z0-9]{12,}\b")
_PRIVATE_CONTEXT = re.compile(r"\b\d{8,}\b|(?:https?://|www\.)", re.IGNORECASE)
_PRIORITY_WORDS = ("哪些指标", "优先关注", "需要关注什么", "低分指标", "异常指标")
_ACTION_REQUEST = re.compile(
    r"行动建议|建议|怎么(?:做|改善|调整|调理|提高|管理|安排)|"
    r"如何(?:改善|调整|调理|提高|管理|安排)|可以做(?:什么|哪些)|下一步|"
    r"日常(?:怎么|如何|需要|调整|改善)|需要注意什么|注意事项|有什么办法"
)


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


def _safe_plan_description(value: Any, report_code: str) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if (
        len(text) > 1200
        or report_code in text
        or _PHONE.search(text)
        or _EMAIL.search(text)
        or _REPORT_ID.search(text)
    ):
        return None
    return text


def _safe_actions(value: Any, report_code: str) -> list[str]:
    """只保留短小、无身份信息的后台行动建议；模型不会收到这些文案。"""
    if not isinstance(value, list):
        return []
    actions: list[str] = []
    for raw in value:
        if not isinstance(raw, str):
            continue
        text = raw.strip()
        if (
            not 1 <= len(text) <= 120
            or any(ord(char) < 32 and char not in "\n\t" for char in text)
            or report_code in text
            or _PHONE.search(text)
            or _EMAIL.search(text)
            or _REPORT_ID.search(text)
        ):
            continue
        actions.append(text)
        if len(actions) == 3:
            break
    return actions


def _safe_prior_user_context(
    value: Any, indicator_code: str, current_question: str,
) -> list[dict[str, str]]:
    """仅取同一指标下最多两条短用户输入；不复制 AI 回答或引用正文。"""
    if not isinstance(value, list):
        return []
    context: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, dict) or item.get("indicator_code") != indicator_code:
            continue
        raw = item.get("text")
        if not isinstance(raw, str) or any(ord(char) < 32 and char not in "\n\t" for char in raw):
            continue
        text = re.sub(r"\s+", " ", raw).strip()
        if (
            not 1 <= len(text) <= 160
            or text == current_question.strip()
            or text in seen
            or _PHONE.search(text)
            or _EMAIL.search(text)
            or _REPORT_ID.search(text)
            or _PRIVATE_CONTEXT.search(text)
        ):
            continue
        context.append({"source_type": "user_supplement", "text": text})
        seen.add(text)
        if len(context) == 2:
            break
    return context


def _safe_prior_follow_up_questions(
    value: Any, indicator_code: str, current_question: str,
) -> list[str]:
    """Only reuse a few previously offered, report-bound prompts for this indicator."""
    from .ai_consult_followups import normalize_follow_up_question

    if not isinstance(value, list):
        return []
    current_key = re.sub(r"[\s？?。.!！,，、;；:：]+", "", current_question).casefold()
    seen = set()
    result = []
    for item in value:
        if not isinstance(item, dict) or item.get("indicator_code") != indicator_code:
            continue
        question = normalize_follow_up_question(item.get("text"))
        if question is None:
            continue
        key = re.sub(r"[\s？?。.!！,，、;；:：]+", "", question).casefold()
        if key == current_key or key in seen:
            continue
        result.append(question)
        seen.add(key)
        if len(result) == 4:
            break
    return result


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


def _add_plan_fact(
    facts: list[dict[str, Any]],
    citations: list[dict[str, Any]],
    scope: Any,
    context: dict[str, Any],
    description: str | None,
) -> None:
    evidence_id = f"ev{len(facts) + 1}"
    plan_name = context["plan_name"]
    fact = {
        "id": evidence_id,
        "kind": "plan",
        "metric": plan_name,
        "indicator_name": context["indicator_name"],
        "score": context["indicator_score"],
        "threshold": context["trigger_score_below"],
    }
    if description:
        fact["text"] = description
    facts.append(fact)
    citations.append({
        "id": evidence_id,
        "kind": "plan",
        "label": plan_name,
        "report_date": None,
        "route": _route(scope, context["system_code"], context["indicator_code"]),
    })


async def prepare_report_evidence(
    read_db: Any,
    bound_scope: Any,
    question: str,
    *,
    requested_indicator_code: str | None = None,
    context_indicator_code: str | None = None,
    prior_user_context: list[dict[str, Any]] | None = None,
    prior_follow_up_questions: list[dict[str, Any]] | None = None,
    requested_plan_id: int | None = None,
    reader: Callable[..., Awaitable[dict[str, Any]]] = read_report_tool,
) -> EvidenceBundle:
    """取匹配指标详情、系统及最多三项子指标，或报告优先项；不调用模型。"""
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
        if not _valid_code(requested_indicator_code):
            raise EvidenceUnavailable("Invalid requested indicator")
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
        explicit_system_match = any(system["name"] in question for system in systems)
        global_question = any(
            phrase in question
            for phrase in (
                *_PRIORITY_WORDS,
                "总分", "整体", "总体", "所有指标", "各系统", "全部",
                "其他指标", "别的指标", "另一个指标", "换个指标", "其他方面", "别的方面",
            )
        )
        if (
            not matches
            and context_indicator_code is not None
            and not explicit_system_match
            and not global_question
        ):
            if not _valid_code(context_indicator_code):
                raise EvidenceUnavailable("Invalid conversation indicator context")
            matches = [
                pair for pair in catalog
                if pair[1]["indicator_code"] == context_indicator_code
            ]
            if len(matches) != 1:
                matches = []

    facts: list[dict[str, Any]] = []
    citations: list[dict[str, Any]] = []
    warnings: list[str] = []
    actions: list[dict[str, Any]] = []
    user_context: list[dict[str, str]] = []
    previous_questions: list[str] = []
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
            if _ACTION_REQUEST.search(question):
                actions = [
                    {
                        "label": f"{item['name']} · 行动建议",
                        "text": action,
                        "route": _route(bound_scope, system["system_code"], code),
                    }
                    for action in _safe_actions(item.get("actions"), report_code)
                ]
            user_context = _safe_prior_user_context(prior_user_context, code, question)
            previous_questions = _safe_prior_follow_up_questions(
                prior_follow_up_questions, code, question
            )
        if requested_plan_id is not None:
            plan_context = await resolve_current_entry_context(
                read_db, bound_scope, home, plan_id=requested_plan_id, indicator_code=code, reader=reader,
            )
            if (plan_context and plan_context.get('type') == 'plan'
                    and catalog_score is not None
                    and detail_score == catalog_score == plan_context.get('indicator_score')):
                description = _safe_plan_description(plan_context.get('description'), report_code)
                _add_plan_fact(facts, citations, bound_scope, plan_context, description)
            else:
                warnings.append('plan_stale')
        return EvidenceBundle(
            facts, citations, warnings, actions, user_context, previous_questions
        )

    matched_system = next((s for s in systems if s["name"] in question), None)
    if any(word in question for word in _PRIORITY_WORDS) and matched_system is None:
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
        # A system question needs its components, not just one aggregate score.
        # Reuse the already scope-checked home facts; no extra database reads.
        children = [
            (indicator, _score(indicator.get("score")))
            for system, indicator in catalog
            if system["system_code"] == matched_system["system_code"]
        ]
        valid_children = [item for item in children if item[1] is not None]
        valid_children.sort(key=lambda item: (item[1], item[0]["indicator_code"]))
        if len(valid_children) != len(children):
            warnings.append("system_indicator_score_missing")
        if len(valid_children) > 3:
            warnings.append("system_indicators_partial")
        for indicator, score in valid_children[:3]:
            _add_fact(
                facts, citations, bound_scope, kind="report", metric=indicator["name"],
                report_date=date_text, system_code=matched_system["system_code"],
                indicator_code=indicator["indicator_code"], score=score,
            )
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
