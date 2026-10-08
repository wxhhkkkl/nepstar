"""健康咨询的保守候选关口；规则未经过临床审查，不得作为上线准入依据。"""

import re
from dataclasses import dataclass
from typing import Awaitable, Callable

from .ai_consult_answer import AnswerValidation


@dataclass(frozen=True)
class InputAssessment:
    route: str
    may_call_model: bool
    message: str
    source: str


@dataclass(frozen=True)
class GuardResult:
    approved: bool
    route: str
    text: str
    source: str
    is_completed: bool = False


_URGENT_SYMPTOM = re.compile(
    r"胸痛|胸闷|胸口.{0,8}(?:疼|痛|压|紧)|呼吸困难|喘不过气|"
    r"口角歪斜|嘴角歪|一侧.{0,8}(?:无力|麻木)|说话.{0,8}(?:含糊|不清)|昏迷"
)
_PERSONAL_CONTEXT = re.compile(
    r"我|本人|家人|父亲|母亲|孩子|老人|现在|突然|刚刚|正在|已经|出现|感觉|怎么办"
)
_CLINICAL_REQUEST = re.compile(
    r"确诊|诊断|是不是得了|开.{0,8}药|吃什么药|处方药|"
    r"停药|加量|减量|换药|药物剂量|用药剂量"
)
_LONGEVITY_PROMISE = re.compile(r"保证.{0,12}(?:延寿|长寿|寿命)|活到\s*\d+\s*岁")
_LIFESTYLE_SELF_REPORT = re.compile(
    r"(?:我|本人).{0,8}(?:每天|每晚|睡|运动|锻炼|吸烟|喝酒|饮酒|熬夜)"
)
_UNSAFE_OUTPUT = (
    re.compile(r"(?:无需|不用|不必).{0,6}(?:就医|看医生|去医院|急救)"),
    re.compile(r"(?:建议|可以|应该).{0,12}(?:停药|加量|减量|换药)"),
    re.compile(r"(?:你|您).{0,6}(?:确诊|患有|得了)"),
    re.compile(r"(?:保证|一定|肯定|必然).{0,12}(?:延寿|长寿|寿命|活到)"),
    re.compile(r"购买|下单|我们的产品|推荐.{0,8}产品"),
    re.compile(r"服用.{0,12}\d+\s*(?:mg|毫克|片|粒)", re.IGNORECASE),
    re.compile(r"(?:https?://|www\.)", re.IGNORECASE),
)
_EMERGENCY_MESSAGE = (
    "如果这些症状正在发生或刚发生，请立即联系当地急救服务；"
    "在中国可拨打 120。不要等待 AI 解读，请尽快由医护人员评估。"
)
_CLINICAL_MESSAGE = (
    "我不能根据这份报告为你确诊、开处方或决定停药和调整剂量。"
    "请联系医生或药师，按专业人员的意见处理。"
)
_LONGEVITY_MESSAGE = (
    "这份报告不能预测寿命，也不能保证延寿。"
    "可以讨论报告中的可核对结果和日常健康管理，但不作寿命承诺。"
)
_UNSAFE_MESSAGE = "这段回答未通过安全校验，暂时不能展示；请稍后重试或咨询专业人员。"


def assess_input(question: str) -> InputAssessment:
    """先处理可能需要及时帮助的问题；只做保守分流，不作医学诊断。"""
    if not isinstance(question, str) or not question.strip() or len(question) > 500:
        return InputAssessment("invalid", False, "问题不能为空或过长，请修改后重试。", "user_question")
    text = question.strip()
    if _URGENT_SYMPTOM.search(text) and _PERSONAL_CONTEXT.search(text):
        return InputAssessment("emergency", False, _EMERGENCY_MESSAGE, "user_report")
    if _CLINICAL_REQUEST.search(text):
        return InputAssessment("clinical_boundary", False, _CLINICAL_MESSAGE, "user_question")
    if _LONGEVITY_PROMISE.search(text):
        return InputAssessment("longevity_boundary", False, _LONGEVITY_MESSAGE, "user_question")
    source = "user_report" if _LIFESTYLE_SELF_REPORT.search(text) else "user_question"
    return InputAssessment("continue", True, "", source)


def _candidate_is_safe(candidate: AnswerValidation, actions: list[str] | None) -> bool:
    if (
        not isinstance(candidate, AnswerValidation)
        or candidate.state != "provenance_validated"
        or candidate.is_completed
        or not candidate.evidence
        or not isinstance(candidate.candidate_text, str)
        or not 1 <= len(candidate.candidate_text) <= 3000
    ):
        return False
    if any(pattern.search(candidate.candidate_text) for pattern in _UNSAFE_OUTPUT):
        return False
    if actions is not None:
        if (
            not isinstance(actions, list)
            or len(actions) > 3
            or any(not isinstance(item, str) or not 1 <= len(item.strip()) <= 120 for item in actions)
        ):
            return False
        if any(pattern.search(item) for item in actions for pattern in _UNSAFE_OUTPUT):
            return False
    return True


async def guarded_candidate(
    question: str,
    supplier: Callable[[], Awaitable[AnswerValidation]],
    *,
    actions: list[str] | None = None,
) -> GuardResult:
    """整段候选完成并审查前不输出任何模型片段；通过后仍非已完成答复。"""
    assessment = assess_input(question)
    if not assessment.may_call_model:
        return GuardResult(False, assessment.route, assessment.message, assessment.source)
    try:
        candidate = await supplier()
    except Exception:
        return GuardResult(False, "unsafe_output", _UNSAFE_MESSAGE, "system")
    if not _candidate_is_safe(candidate, actions):
        return GuardResult(False, "unsafe_output", _UNSAFE_MESSAGE, "system")
    return GuardResult(True, "reviewed_candidate", candidate.candidate_text, "model_candidate")
