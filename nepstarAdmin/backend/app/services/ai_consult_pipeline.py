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


_PRIVATE_INPUT = re.compile(
    r"\b(?:KH|KJ)[A-Z0-9]{12,}\b|"
    r"\b\d{8,}\b|"
    r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)|"
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}",
    re.IGNORECASE,
)
_PROVIDER_FAILURE = "AI 咨询暂时不可用，请稍后再试。"
_UNSAFE_DRAFT = "这段回答未通过事实或安全校验，暂时不能展示；请稍后再试。"


async def prepare_answer_candidate(
    read_db: Any,
    bound_scope: Any,
    question: str,
    *,
    provider: DraftProvider = default_provider,
    reader: Callable[..., Awaitable[dict[str, Any]]] = read_report_tool,
    requested_indicator_code: str | None = None,
    provider_timeout_seconds: float = 20.0,
) -> CandidateOutcome:
    """只返回未发布候选；调用方须在独立事务中验证并保存后才能发 completed。"""
    assessment = assess_input(question)
    if not assessment.may_call_model:
        return CandidateOutcome(assessment.route, assessment.message, [], assessment.source)
    if _PRIVATE_INPUT.search(question):
        return CandidateOutcome(
            "private_input", "请先去掉问题中的报告编号和联系方式，再重新提问。", [], "system"
        )
    if not 0 < provider_timeout_seconds <= 60:
        raise ValueError("Invalid provider timeout")

    try:
        bundle = await prepare_report_evidence(
            read_db,
            bound_scope,
            question,
            requested_indicator_code=requested_indicator_code,
            reader=reader,
        )
    except Exception:
        # 报告源失效、范围校验失败或读取异常均不可继续调用模型。
        return CandidateOutcome("report_unavailable", "当前报告依据无法核对，请稍后再试。", [], "system")

    # 缺少可核对报告事实时不向模型发送问题或维护文案。
    if not any(fact.get("kind") == "report" for fact in bundle.facts):
        try:
            uncertain = validate_answer_draft(bundle, None)
        except AnswerRejected:
            return CandidateOutcome("unsafe_answer", _UNSAFE_DRAFT, [], "system")
        return CandidateOutcome("insufficient_evidence", uncertain.candidate_text, [], "system")

    try:
        # 模型只拿最小化事实；引用路由、报告号和客户号仅在服务端保存。
        draft = await asyncio.wait_for(
            provider.draft(question=question.strip(), evidence=bundle.for_model()),
            timeout=provider_timeout_seconds,
        )
    except Exception:
        return CandidateOutcome("provider_unavailable", _PROVIDER_FAILURE, [], "system")

    try:
        validated = validate_answer_draft(bundle, draft)
    except AnswerRejected:
        return CandidateOutcome("unsafe_answer", _UNSAFE_DRAFT, [], "system")

    async def supply_validated():
        return validated

    guarded = await guarded_candidate(question, supply_validated)
    if not guarded.approved:
        return CandidateOutcome("unsafe_answer", _UNSAFE_DRAFT, [], "system")
    return CandidateOutcome(
        "reviewed_candidate", guarded.text, validated.evidence, guarded.source
    )
