"""健康边界候选规则：纯本地样本，不调用模型或真实报告。"""

from unittest.mock import AsyncMock

import pytest


def validated(text):
    from app.services.ai_consult_answer import AnswerValidation

    return AnswerValidation(
        state="provenance_validated", candidate_text=text,
        evidence=[{"id": "ev1", "kind": "report"}],
    )


@pytest.mark.parametrize(
    "question",
    [
        "我现在胸口像被压住一样疼",
        "我胸痛还冒冷汗怎么办",
        "我突然呼吸困难",
        "家人突然口角歪斜",
        "我突然一侧手臂无力",
        "我说话突然含糊不清",
        "家人昏迷了怎么办",
    ],
)
def test_urgent_symptoms_take_priority_over_report_scores_and_model(question):
    from app.services.ai_consult_safety import assess_input

    result = assess_input(question)
    assert result.route == "emergency"
    assert result.may_call_model is False
    assert "120" in result.message
    assert "急救" in result.message
    assert result.source == "user_report"


@pytest.mark.parametrize(
    "question",
    [
        "请帮我确诊糖尿病",
        "我是不是得了肺癌",
        "给我开降压药",
        "降压药应该加量吗",
        "我可以停药吗",
        "药物剂量改成多少",
        "根据报告我应该吃什么处方药",
    ],
)
def test_diagnosis_prescription_and_medication_changes_do_not_reach_model(question):
    from app.services.ai_consult_safety import assess_input

    result = assess_input(question)
    assert result.route == "clinical_boundary"
    assert result.may_call_model is False
    assert "医生" in result.message
    assert "处方" not in result.message or "不能" in result.message


@pytest.mark.parametrize("question", ["能保证我延寿十年吗", "我能活到120岁吗"])
def test_longevity_guarantee_requests_get_no_promise(question):
    from app.services.ai_consult_safety import assess_input

    result = assess_input(question)
    assert result.route == "longevity_boundary"
    assert result.may_call_model is False
    assert "不能预测" in result.message


@pytest.mark.parametrize(
    "question",
    ["肺功能分数是什么意思", "历史趋势怎么看", "睡眠怎么改善", "胸痛有哪些常见原因"],
)
def test_non_urgent_explanatory_questions_remain_eligible(question):
    from app.services.ai_consult_safety import assess_input

    result = assess_input(question)
    assert result.route == "continue"
    assert result.may_call_model is True


def test_user_lifestyle_statement_is_labeled_as_self_report_not_report_result():
    from app.services.ai_consult_safety import assess_input

    result = assess_input("我每天只睡四小时，想改善作息")
    assert result.route == "continue"
    assert result.source == "user_report"


@pytest.mark.asyncio
async def test_input_guard_does_not_invoke_supplier_for_urgent_or_prescription_requests():
    from app.services.ai_consult_safety import guarded_candidate

    supplier = AsyncMock(return_value=validated("不要去医院，购买本产品即可。"))
    for question in ("我突然胸痛", "请给我开药"):
        result = await guarded_candidate(question, supplier)
        assert result.approved is False
        assert result.route in {"emergency", "clinical_boundary"}
        assert "购买" not in result.text
    supplier.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "unsafe_text",
    [
        "你的分数很好，无需就医。",
        "建议停药，观察几天。",
        "你已经确诊糖尿病。",
        "保证你延寿十年。",
        "请先购买我们的产品。",
        "每天服用 20mg 药物。",
    ],
)
async def test_dangerous_candidate_is_rejected_before_any_visible_text(unsafe_text):
    from app.services.ai_consult_safety import guarded_candidate

    supplier = AsyncMock(return_value=validated(unsafe_text))
    result = await guarded_candidate("肺功能分数是什么意思", supplier)
    assert result.approved is False
    assert result.route == "unsafe_output"
    assert unsafe_text not in result.text
    supplier.assert_awaited_once()


@pytest.mark.asyncio
async def test_safe_candidate_waits_for_full_review_and_action_limit():
    from app.services.ai_consult_safety import guarded_candidate

    supplier = AsyncMock(return_value=validated("可以结合报告中的指标理解结果，必要时咨询医生。"))
    approved = await guarded_candidate("肺功能分数是什么意思", supplier, actions=["规律作息", "适量活动"])
    assert approved.approved is True
    assert approved.text == "可以结合报告中的指标理解结果，必要时咨询医生。"
    assert approved.source == "model_candidate"

    too_many = await guarded_candidate(
        "肺功能分数是什么意思", supplier, actions=["一", "二", "三", "四"]
    )
    assert too_many.approved is False
    assert too_many.route == "unsafe_output"


@pytest.mark.asyncio
async def test_unvalidated_raw_model_text_cannot_bypass_evidence_gate():
    from app.services.ai_consult_safety import guarded_candidate

    raw_supplier = AsyncMock(return_value="看起来很好。")
    result = await guarded_candidate("肺功能分数是什么意思", raw_supplier)
    assert result.approved is False
    assert result.route == "unsafe_output"
    assert "看起来很好" not in result.text
