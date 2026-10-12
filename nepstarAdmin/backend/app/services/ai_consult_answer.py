"""模型草稿的事实来源校验；通过后仍须健康安全审核，不能直接发布。"""

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from .ai_consult_evidence import EvidenceBundle
from .ai_consult_followups import validate_follow_up_questions


class AnswerRejected(ValueError):
    """模型草稿或服务端证据不可信；调用方须标记失败，不得发送 completed。"""


@dataclass(frozen=True)
class AnswerValidation:
    state: str
    candidate_text: str
    evidence: list[dict[str, Any]]
    follow_up_questions: list[str] = field(default_factory=list)
    is_completed: bool = False


_EVIDENCE_ID = re.compile(r"ev[1-9][0-9]*\Z")
_DIGIT = re.compile(r"[0-9０-９]")
_CHINESE_NUMBER_CLAIM = re.compile(r"[零〇一二两三四五六七八九十百]+\s*[分岁年月日%％]")
_URL = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)
_REPORT_ID = re.compile(r"\b(?:KH|KJ)[A-Z0-9]{12,}\b")
_PHONE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
_QUESTION_MARK = re.compile(r"[?？]")
_NO_EVIDENCE = (
    "目前没有可核对且一致的本次报告事实，无法确认这项结果。"
    "请查看报告原文，必要时咨询专业人员。"
)


def _evidence_index(bundle: EvidenceBundle) -> tuple[dict[str, dict], dict[str, dict]]:
    if not isinstance(bundle, EvidenceBundle):
        raise AnswerRejected("Invalid evidence bundle")
    facts: dict[str, dict] = {}
    citations: dict[str, dict] = {}
    for fact in bundle.facts:
        if not isinstance(fact, dict):
            raise AnswerRejected("Invalid evidence fact")
        evidence_id = fact.get("id")
        if not isinstance(evidence_id, str) or _EVIDENCE_ID.fullmatch(evidence_id) is None:
            raise AnswerRejected("Invalid evidence ID")
        if evidence_id in facts:
            raise AnswerRejected("Duplicate evidence ID")
        if fact.get("kind") not in {"report", "maintained", "plan"}:
            raise AnswerRejected("Unknown evidence kind")
        if not isinstance(fact.get("metric"), str) or not fact["metric"].strip():
            raise AnswerRejected("Missing evidence metric")
        if fact["kind"] == "report":
            score = fact.get("score")
            if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 100:
                raise AnswerRejected("Invalid report score")
            try:
                parsed_date = date.fromisoformat(fact.get("date"))
            except (TypeError, ValueError) as exc:
                raise AnswerRejected("Invalid report date") from exc
            if parsed_date.isoformat() != fact["date"] or fact.get("date_kind") != "report_date":
                raise AnswerRejected("Unverified report date kind")
        elif fact["kind"] == "maintained" and (
            not isinstance(fact.get("text"), str) or not fact["text"].strip()
        ):
            raise AnswerRejected("Invalid maintained content")
        elif fact["kind"] == "plan":
            score = fact.get("score")
            threshold = fact.get("threshold")
            if (
                not isinstance(fact.get("indicator_name"), str)
                or not fact["indicator_name"].strip()
                or isinstance(score, bool)
                or not isinstance(score, int)
                or not 0 <= score <= 100
                or isinstance(threshold, bool)
                or not isinstance(threshold, int)
                or not 0 <= threshold <= 100
                or score >= threshold
                or (
                    "text" in fact
                    and (
                        not isinstance(fact["text"], str)
                        or not fact["text"].strip()
                        or len(fact["text"]) > 1200
                        or _PHONE.search(fact["text"])
                        or _EMAIL.search(fact["text"])
                        or _REPORT_ID.search(fact["text"])
                    )
                )
            ):
                raise AnswerRejected("Invalid plan trigger evidence")
        facts[evidence_id] = fact

    for citation in bundle.citations:
        if not isinstance(citation, dict):
            raise AnswerRejected("Invalid citation")
        evidence_id = citation.get("id")
        if evidence_id in citations or evidence_id not in facts:
            raise AnswerRejected("Citation ID mismatch")
        if citation.get("kind") != facts[evidence_id]["kind"]:
            raise AnswerRejected("Citation kind mismatch")
        if citation.get("label") != facts[evidence_id]["metric"]:
            raise AnswerRejected("Citation label mismatch")
        expected_date = facts[evidence_id]["date"] if facts[evidence_id]["kind"] == "report" else None
        if citation.get("report_date") != expected_date:
            raise AnswerRejected("Citation date mismatch")
        route = citation.get("route")
        if not isinstance(route, str) or not route.startswith("#/"):
            raise AnswerRejected("Invalid citation route")
        citations[evidence_id] = citation
    if set(facts) != set(citations):
        raise AnswerRejected("Missing citation")
    return facts, citations


def validate_answer_draft(bundle: EvidenceBundle, draft: Any) -> AnswerValidation:
    """只校验来源与数值/日期；返回候选文案，绝不标记为已完成。"""
    facts, citations = _evidence_index(bundle)
    if not any(fact["kind"] == "report" for fact in facts.values()):
        return AnswerValidation(
            state="insufficient_evidence", candidate_text=_NO_EVIDENCE, evidence=[]
        )

    if not isinstance(draft, dict) or set(draft) != {
        "summary", "evidence_ids", "follow_up_questions"
    }:
        raise AnswerRejected("Invalid model draft shape")
    summary = draft["summary"]
    selected_ids = draft["evidence_ids"]
    if (
        not isinstance(summary, str)
        or not 1 <= len(summary.strip()) <= 600
        or _DIGIT.search(summary)
        or _CHINESE_NUMBER_CLAIM.search(summary)
        or _URL.search(summary)
        or _REPORT_ID.search(summary)
        or _QUESTION_MARK.search(summary)
    ):
        raise AnswerRejected("Model text may not assert unrendered numbers or sources")
    try:
        follow_up_questions = validate_follow_up_questions(draft["follow_up_questions"])
    except ValueError as exc:
        raise AnswerRejected("Invalid follow-up questions") from exc
    previous = {
        re.sub(r"[\s？?。.!！,，、;；:：]+", "", item).casefold()
        for item in bundle.prior_follow_up_questions
    }
    follow_up_questions = [
        item for item in follow_up_questions
        if re.sub(r"[\s？?。.!！,，、;；:：]+", "", item).casefold() not in previous
    ]
    if (
        not isinstance(selected_ids, list)
        or not 1 <= len(selected_ids) <= 5
        or any(not isinstance(item, str) or item not in facts for item in selected_ids)
        or len(set(selected_ids)) != len(selected_ids)
        or not any(facts[item]["kind"] == "report" for item in selected_ids)
        or (
            any(fact["kind"] == "plan" for fact in facts.values())
            and not any(facts[item]["kind"] == "plan" for item in selected_ids)
        )
    ):
        raise AnswerRejected("Model cited unknown or insufficient evidence")

    lines = [summary.strip()]
    for evidence_id in selected_ids:
        fact = facts[evidence_id]
        if fact["kind"] == "report":
            lines.append(
                f"报告日期 {fact['date']}：{fact['metric']}活力值 {fact['score']} 分。"
            )
        elif fact["kind"] == "maintained":
            lines.append(f"报告维护说明：{fact['text']}")
        else:
            lines.append(
                f"当前报告中，管理方案「{fact['metric']}」对应指标「{fact['indicator_name']}」："
                f"本次得分 {fact['score']} 分，触发条件为低于 {fact['threshold']} 分。"
            )
            if fact.get("text"):
                lines.append(f"方案说明（后台维护）：{fact['text']}")
    return AnswerValidation(
        state="provenance_validated",
        candidate_text="\n".join(lines),
        evidence=[citations[item].copy() for item in selected_ids],
        follow_up_questions=follow_up_questions,
    )
