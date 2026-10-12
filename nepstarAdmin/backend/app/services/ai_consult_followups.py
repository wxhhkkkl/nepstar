"""Resolve short follow-up questions from previously verified report citations."""

import json
import re
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit


_CODE = re.compile(r"[A-Z][A-Z0-9_]{1,63}\Z")
_DIGIT = re.compile(r"[0-9０-９]")
_URL = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)
_REPORT_ID = re.compile(r"\b(?:KH|KJ)[A-Z0-9]{12,}\b")
_PHONE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
_QUESTION_MARK = re.compile(r"[?？]")
_UNSAFE_QUESTION = re.compile(
    r"确诊|诊断|患有|停药|换药|加量|减量|剂量|处方|急救|寿命|延寿|保证|"
    r"购买|下单|产品|广告|身份证|手机号|银行卡"
)


def normalize_follow_up_question(value: Any) -> str | None:
    """Return a short, display-safe question, or None for untrusted content."""
    if not isinstance(value, str) or any(ord(char) < 32 for char in value):
        return None
    question = re.sub(r"\s+", " ", value).strip()
    if (
        not 4 <= len(question) <= 80
        or question[-1] not in "？?"
        or len(_QUESTION_MARK.findall(question)) != 1
        or _DIGIT.search(question)
        or _URL.search(question)
        or _REPORT_ID.search(question)
        or _PHONE.search(question)
        or _EMAIL.search(question)
        or _UNSAFE_QUESTION.search(question)
    ):
        return None
    return question


def _question_key(value: str) -> str:
    return re.sub(r"[\s？?。.!！,，、;；:：]+", "", value).casefold()


def validate_follow_up_questions(values: Any, *, limit: int = 2) -> list[str]:
    """Validate a strict list of distinct safe prompts."""
    if not isinstance(values, list) or len(values) > limit:
        raise ValueError("Invalid follow-up question list")
    questions = []
    seen = set()
    for value in values:
        question = normalize_follow_up_question(value)
        if question is None:
            raise ValueError("Invalid follow-up question")
        key = _question_key(question)
        if key in seen:
            raise ValueError("Duplicate follow-up question")
        seen.add(key)
        questions.append(question)
    return questions


def _bound_indicator_from_item(item: Any, *, report_code: str, customer_id: int) -> str | None:
    if not isinstance(item, dict) or item.get("kind") not in {"report", "plan"}:
        return None
    route = item.get("route")
    if not isinstance(route, str) or not route.startswith("#/"):
        return None
    parsed = urlsplit(route[1:])
    parts = [unquote(part) for part in parsed.path.split("/") if part]
    if len(parts) != 4 or parts[0] != "system" or parts[2] != "indicator":
        return None
    system_code, indicator_code = parts[1], parts[3]
    if not _CODE.fullmatch(system_code) or not _CODE.fullmatch(indicator_code):
        return None
    query = parse_qs(parsed.query, keep_blank_values=True)
    if query.get("reportId") != [report_code] or len(query.get("customerId", [])) != 1:
        return None
    try:
        route_customer_id = int(query["customerId"][0])
    except (TypeError, ValueError):
        return None
    return indicator_code if route_customer_id == customer_id else None


def indicator_context_from_evidence(
    evidence_json: str | None, *, report_code: str, customer_id: int
) -> str | None:
    """Extract an indicator code only from a citation bound to this report/guest.

    The result is a local retrieval hint, never chat text for the model. The current
    report is still read again and must independently contain the requested code.
    """
    if (
        not isinstance(evidence_json, str)
        or not evidence_json
        or not isinstance(report_code, str)
        or not report_code
        or isinstance(customer_id, bool)
        or not isinstance(customer_id, int)
        or customer_id <= 0
    ):
        return None
    try:
        evidence: Any = json.loads(evidence_json)
    except (TypeError, ValueError):
        return None
    if not isinstance(evidence, list):
        return None

    indicator_codes = set()
    for item in evidence[:20]:
        indicator_code = _bound_indicator_from_item(
            item, report_code=report_code, customer_id=customer_id
        )
        if indicator_code:
            indicator_codes.add(indicator_code)
    return next(iter(indicator_codes)) if len(indicator_codes) == 1 else None


def follow_up_questions_from_evidence(
    evidence_json: str | None, *, report_code: str, customer_id: int,
    indicator_code: str, limit: int = 4,
) -> list[str]:
    """Read only previously offered questions from citations bound to one indicator."""
    if (
        not isinstance(evidence_json, str)
        or not evidence_json
        or not isinstance(report_code, str)
        or not report_code
        or isinstance(customer_id, bool)
        or not isinstance(customer_id, int)
        or customer_id <= 0
        or not isinstance(indicator_code, str)
        or not _CODE.fullmatch(indicator_code)
        or not 1 <= limit <= 8
    ):
        return []
    try:
        evidence: Any = json.loads(evidence_json)
    except (TypeError, ValueError):
        return []
    if not isinstance(evidence, list):
        return []
    questions: list[str] = []
    seen = set()
    for item in evidence[:20]:
        if _bound_indicator_from_item(
            item, report_code=report_code, customer_id=customer_id
        ) != indicator_code:
            continue
        raw_questions = item.get("follow_up_questions")
        if not isinstance(raw_questions, list):
            continue
        for raw_question in raw_questions[:2]:
            question = normalize_follow_up_question(raw_question)
            if question is None:
                continue
            key = _question_key(question)
            if key not in seen:
                questions.append(question)
                seen.add(key)
            if len(questions) >= limit:
                return questions
    return questions
