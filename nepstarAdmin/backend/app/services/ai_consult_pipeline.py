"""报告证据、模型草稿和健康安全审核的候选编排；不会发布或持久化回答。"""

import asyncio
import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from .ai_consult_answer import AnswerRejected, validate_answer_draft
from .ai_consult_evidence import prepare_report_evidence
from .ai_consult_provider import DraftProvider, default_provider
from .ai_consult_safety import assess_input, guarded_candidate
from .ai_consult_sources import read_report_tool


@dataclass(frozen=True)
class CandidateOutcome:
    state: str
    text: str
    evidence: list[dict[str, Any]]
    source: str
    is_completed: bool = False
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


_PRIVATE_INPUT = re.compile(
    r"\b(?:KH|KJ)[A-Z0-9]{12,}\b|"
    r"\b\d{8,}\b|"
    r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)|"
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}",
    re.IGNORECASE,
)
_PROVIDER_FAILURE = "AI 咨询暂时不可用，请稍后再试。"
_UNSAFE_DRAFT = "这段回答未通过事实或安全校验，暂时不能展示；请稍后再试。"


def _with_action_sources(
    evidence: list[dict[str, Any]], actions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """附加独立的后台维护行动建议；不混入模型事实或模型回答正文。"""
    if not actions:
        return evidence
    return evidence + [
        {
            "id": f"action{index}",
            "kind": "maintained",
            "label": action["label"],
            "report_date": None,
            "route": action["route"],
            "source_type": "action",
            "text": action["text"],
        }
        for index, action in enumerate(actions, start=1)
    ]


def _with_follow_up_questions(
    evidence: list[dict[str, Any]], questions: list[str],
) -> list[dict[str, Any]]:
    """Persist suggestions with a verified report citation; no schema migration needed."""
    if not questions:
        return evidence
    result = [item.copy() for item in evidence]
    indicator_codes = set()
    for item in result:
        if item.get("kind") != "report" or not isinstance(item.get("route"), str):
            continue
        match = re.match(r"#/system/[^/?]+/indicator/([^/?]+)(?:\?|$)", item["route"])
        if match:
            indicator_codes.add(match.group(1))
    if len(indicator_codes) == 1:
        indicator_code = next(iter(indicator_codes))
        report_citation = next(
            (
                item for item in result
                if item.get("kind") == "report"
                and re.match(
                    rf"#/system/[^/?]+/indicator/{re.escape(indicator_code)}(?:\?|$)",
                    item.get("route", ""),
                )
            ),
            None,
        )
        if report_citation is not None:
            report_citation["follow_up_questions"] = list(questions)
    return result


async def prepare_answer_candidate(
    read_db: Any,
    bound_scope: Any,
    question: str,
    *,
    provider: DraftProvider = default_provider,
    reader: Callable[..., Awaitable[dict[str, Any]]] = read_report_tool,
    requested_indicator_code: str | None = None,
    context_indicator_code: str | None = None,
    prior_user_context: list[dict[str, Any]] | None = None,
    prior_follow_up_questions: list[dict[str, Any]] | None = None,
    requested_plan_id: int | None = None,
    rule_instructions: str | None = None,
    provider_timeout_seconds: float = 20.0,
) -> CandidateOutcome:
    """只返回未发布候选；调用方须在独立事务中验证并保存后才能发 completed。"""
    assessment = assess_input(question)
    if not assessment.may_call_model:
        return CandidateOutcome(
            assessment.route, assessment.message, [], assessment.source,
            prompt_tokens=0, completion_tokens=0,
        )
    if _PRIVATE_INPUT.search(question):
        return CandidateOutcome(
            "private_input", "请先去掉问题中的报告编号和联系方式，再重新提问。", [], "system",
            prompt_tokens=0, completion_tokens=0,
        )
    if not 0 < provider_timeout_seconds <= 60:
        raise ValueError("Invalid provider timeout")

    try:
        bundle = await prepare_report_evidence(
            read_db,
            bound_scope,
            question,
            requested_indicator_code=requested_indicator_code,
            context_indicator_code=context_indicator_code,
            prior_user_context=prior_user_context,
            prior_follow_up_questions=prior_follow_up_questions,
            requested_plan_id=requested_plan_id,
            reader=reader,
        )
    except Exception:
        # 报告源失效、范围校验失败或读取异常均不可继续调用模型。
        return CandidateOutcome(
            "report_unavailable", "当前报告依据无法核对，请稍后再试。", [], "system",
            prompt_tokens=0, completion_tokens=0,
        )

    # 缺少可核对报告事实时不向模型发送问题或维护文案。
    if not any(fact.get("kind") == "report" for fact in bundle.facts):
        try:
            uncertain = validate_answer_draft(bundle, None)
        except AnswerRejected:
            return CandidateOutcome(
                "unsafe_answer", _UNSAFE_DRAFT, [], "system",
                prompt_tokens=0, completion_tokens=0,
            )
        return CandidateOutcome(
            "insufficient_evidence", uncertain.candidate_text, [], "system",
            prompt_tokens=0, completion_tokens=0,
        )

    if "plan_stale" in bundle.warnings:
        report_fact = next(fact for fact in bundle.facts if fact.get("kind") == "report")
        try:
            validated = validate_answer_draft(bundle, {
                "summary": (
                    "当前报告未能核实该管理方案仍满足有效推荐条件，因此不能把它解释为当前有效方案。"
                    "以下仅说明这项指标在本次报告中的结果。"
                ),
                "evidence_ids": [report_fact["id"]],
                "follow_up_questions": [],
            })
        except AnswerRejected:
            return CandidateOutcome("unsafe_answer", _UNSAFE_DRAFT, [], "system")

        async def supply_stale_plan_answer():
            return validated

        guarded = await guarded_candidate(
            question,
            supply_stale_plan_answer,
            actions=[item["text"] for item in bundle.actions],
        )
        if not guarded.approved:
            return CandidateOutcome("unsafe_answer", _UNSAFE_DRAFT, [], "system")
        return CandidateOutcome(
            "reviewed_candidate", guarded.text,
            _with_action_sources(validated.evidence, bundle.actions), "system",
            prompt_tokens=0, completion_tokens=0,
        )

    try:
        # 模型只拿最小化事实；引用路由、报告号和客户号仅在服务端保存。
        model_evidence = bundle.for_model()
        if rule_instructions:
            model_evidence["operator_guidance"] = rule_instructions
        draft = await asyncio.wait_for(
            provider.draft(question=question.strip(), evidence=model_evidence),
            timeout=provider_timeout_seconds,
        )
    except Exception:
        return CandidateOutcome("provider_unavailable", _PROVIDER_FAILURE, [], "system")

    usage = draft.get("_usage") if isinstance(draft, dict) else None
    invalid_usage = usage is not None and (
        not isinstance(usage, dict)
        or set(usage) != {"prompt_tokens", "completion_tokens"}
        or type(usage.get("prompt_tokens")) is not int
        or type(usage.get("completion_tokens")) is not int
        or min(usage["prompt_tokens"], usage["completion_tokens"]) < 0
        or usage["prompt_tokens"] + usage["completion_tokens"]
        > getattr(provider, "token_budget", 0)
    )
    if invalid_usage or (getattr(provider, "requires_usage", False) and usage is None):
        return CandidateOutcome("provider_unavailable", _PROVIDER_FAILURE, [], "system")
    draft_content = {key: value for key, value in draft.items() if key != "_usage"} if usage else draft
    token_usage = {
        "prompt_tokens": usage["prompt_tokens"],
        "completion_tokens": usage["completion_tokens"],
    } if usage else {}

    try:
        validated = validate_answer_draft(bundle, draft_content)
    except AnswerRejected:
        return CandidateOutcome("unsafe_answer", _UNSAFE_DRAFT, [], "system", **token_usage)

    async def supply_validated():
        return validated

    guarded = await guarded_candidate(
        question,
        supply_validated,
        actions=[item["text"] for item in bundle.actions],
    )
    if not guarded.approved:
        return CandidateOutcome("unsafe_answer", _UNSAFE_DRAFT, [], "system", **token_usage)
    return CandidateOutcome(
        "reviewed_candidate", guarded.text,
        _with_action_sources(
            _with_follow_up_questions(validated.evidence, validated.follow_up_questions),
            bundle.actions,
        ), guarded.source,
        **token_usage,
    )
