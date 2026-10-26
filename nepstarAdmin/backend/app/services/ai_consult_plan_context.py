"""Resolve plan and indicator entry context against the current public report."""

import re
from typing import Any


_CODE = re.compile(r"[A-Z][A-Z0-9_]{1,63}\Z")
_PHONE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
_REPORT_ID = re.compile(r"\b(?:KH|KJ)[A-Z0-9]{12,}\b")


def _score(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not 0 <= value <= 100 or int(value) != value:
        return None
    return int(value)


def _safe_label(value: Any) -> bool:
    return (
        isinstance(value, str)
        and bool(value.strip())
        and len(value) <= 100
        and _PHONE.search(value) is None
        and _EMAIL.search(value) is None
        and _REPORT_ID.search(value) is None
    )


def resolve_entry_context(
    home: dict[str, Any], *, plan_id: int | None, indicator_code: str | None
) -> dict[str, Any] | None:
    """Return only a report-bound context; stale plan URLs degrade to the indicator."""
    if not isinstance(home, dict) or not isinstance(indicator_code, str) or not _CODE.fullmatch(indicator_code):
        return None

    matches: list[tuple[dict, dict]] = []
    for system in home.get("systems") or []:
        if not isinstance(system, dict) or not _CODE.fullmatch(str(system.get("system_code") or "")):
            continue
        if not _safe_label(system.get("name")):
            continue
        for indicator in system.get("indicators") or []:
            if (
                isinstance(indicator, dict)
                and indicator.get("indicator_code") == indicator_code
                and _safe_label(indicator.get("name"))
            ):
                matches.append((system, indicator))
    if len(matches) != 1:
        return None

    system, indicator = matches[0]
    score = _score(indicator.get("score"))
    common = {
        "system_code": system["system_code"],
        "system_name": system["name"],
        "indicator_code": indicator_code,
        "indicator_name": indicator["name"],
        "indicator_score": score,
    }

    if type(plan_id) is int and plan_id > 0:
        recommendations = []
        for candidate_system in home.get("systems") or []:
            if not isinstance(candidate_system, dict):
                continue
            recommendation = candidate_system.get("recommendation")
            if isinstance(recommendation, dict):
                recommendations.append((candidate_system, recommendation))
        exact = [
            (candidate_system, recommendation)
            for candidate_system, recommendation in recommendations
            if type(recommendation.get("plan_id")) is int
            and recommendation.get("plan_id") == plan_id
            and recommendation.get("trigger_indicator_code") == indicator_code
        ]
        if len(exact) == 1:
            candidate_system, recommendation = exact[0]
            rec_score = _score(recommendation.get("indicator_score"))
            threshold = _score(recommendation.get("trigger_score_below", 80))
            if (
                candidate_system.get("system_code") == system["system_code"]
                and _safe_label(recommendation.get("plan_name"))
                and score is not None
                and rec_score == score
                and threshold is not None
                and score < threshold
            ):
                return {
                    "type": "plan",
                    "plan_id": plan_id,
                    "plan_name": recommendation["plan_name"].strip(),
                    "trigger_score_below": threshold,
                    **common,
                }

    return {"type": "indicator", "stale_plan": plan_id is not None, **common}


async def resolve_current_entry_context(read_db, scope, home, *, plan_id, indicator_code, reader=None):
    """Revalidate the complete effective plan set through the explicit read boundary."""
    from .ai_consult_sources import read_report_tool
    fallback = resolve_entry_context(home, plan_id=None, indicator_code=indicator_code)
    if fallback is None or plan_id is None:
        return fallback
    stale = {**fallback, 'stale_plan': True}
    if type(plan_id) is not int or plan_id <= 0:
        return stale
    data = await (reader or read_report_tool)(read_db, scope, 'plan_context', plan_id=plan_id, indicator_code=indicator_code)
    if not isinstance(data, dict) or data.get('report_code') != scope.report_code or data.get('plan_id') != plan_id:
        return stale
    if not _safe_label(data.get('plan_name')) or any(data.get(key) != fallback.get(key) for key in ('system_code', 'system_name', 'indicator_code', 'indicator_name')):
        return stale
    score, threshold = _score(data.get('indicator_score')), _score(data.get('trigger_score_below'))
    if score is None or score != fallback['indicator_score'] or threshold is None or score >= threshold:
        return stale
    return {**fallback, 'type': 'plan', 'stale_plan': False, 'plan_id': plan_id,
            'plan_name': data['plan_name'], 'trigger_score_below': threshold,
            'description': data.get('description')}
