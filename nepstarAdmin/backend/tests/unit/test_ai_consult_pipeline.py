"""候选问答链只使用假报告和假模型；不打开数据库或网络连接。"""

import asyncio
from datetime import date
from types import SimpleNamespace

import pytest

from app.services.ai_consult_pipeline import prepare_answer_candidate


SCOPE = SimpleNamespace(
    report_code="KH503LS0014998K260729093902424",
    customer_id=15439954,
    report_date=date(2026, 7, 29),
)


class FakeProvider:
    def __init__(self, draft=None):
        self.result = draft or {
            "summary": "可以结合这项报告结果理解本次情况。",
            "evidence_ids": ["ev1"],
            "follow_up_questions": [],
        }
        self.calls = []

    async def draft(self, *, question, evidence):
        self.calls.append((question, evidence))
        return self.result


def report_reader(*, score=90, detail_score=90, actions=None):
    async def read(_db, _scope, tool_name, *, indicator_code=None):
        if tool_name == "home":
            return {
                "report_code": SCOPE.report_code,
                "report_date": "2026-07-29",
                "total_score": 82,
                "systems": [
                    {
                        "system_code": "SYS_LUNG",
                        "name": "肺功能",
                        "score": 84,
                        "indicators": [
                            {
                                "indicator_code": "SYS_LUNG_SLEEP_BREATHING",
                                "name": "呼吸睡眠",
                                "score": score,
                            }
                        ],
                    }
                ],
            }
        assert tool_name == "indicator"
        assert indicator_code == "SYS_LUNG_SLEEP_BREATHING"
        return {
            "report_code": SCOPE.report_code,
            "system": {"system_code": "SYS_LUNG"},
            "indicator": {
                "indicator_code": indicator_code,
                "name": "呼吸睡眠",
                "score": detail_score,
                "description": "关注睡眠期间的呼吸质量。",
                "actions": actions or [],
            },
        }

    return read


@pytest.mark.asyncio
async def test_reviewed_candidate_uses_only_minimal_facts_and_server_citations():
    provider = FakeProvider()
    result = await prepare_answer_candidate(
        object(), SCOPE, "呼吸睡眠怎么样？", provider=provider, reader=report_reader()
    )

    assert result.state == "reviewed_candidate"
    assert result.is_completed is False
    assert "呼吸睡眠活力值 90 分" in result.text
    assert "2026-07-29" in result.text
    assert result.evidence[0]["route"].startswith("#/system/SYS_LUNG/indicator/")
    question, model_evidence = provider.calls[0]
    assert question == "呼吸睡眠怎么样？"
    assert model_evidence["facts"][0]["score"] == 90
    assert "route" not in str(model_evidence)
    assert SCOPE.report_code not in str(model_evidence)
    assert str(SCOPE.customer_id) not in str(model_evidence)


@pytest.mark.asyncio
async def test_urgent_or_private_input_never_reaches_reader_or_provider():
    provider = FakeProvider()

    async def forbidden_reader(*_args, **_kwargs):
        raise AssertionError("report must not be read")

    urgent = await prepare_answer_candidate(
        object(), SCOPE, "我现在胸痛，怎么办？", provider=provider, reader=forbidden_reader
    )
    private = await prepare_answer_candidate(
        object(), SCOPE, f"报告 {SCOPE.report_code} 怎么样？", provider=provider,
        reader=forbidden_reader,
    )
    assert urgent.state == "emergency"
    assert private.state == "private_input"
    assert (urgent.prompt_tokens, urgent.completion_tokens) == (0, 0)
    assert (private.prompt_tokens, private.completion_tokens) == (0, 0)
    assert provider.calls == []


@pytest.mark.asyncio
async def test_conflicting_scores_produce_uncertainty_without_model_call():
    provider = FakeProvider()
    result = await prepare_answer_candidate(
        object(), SCOPE, "呼吸睡眠怎么样？", provider=provider,
        reader=report_reader(score=90, detail_score=98),
    )
    assert result.state == "insufficient_evidence"
    assert "无法确认" in result.text
    assert result.evidence == []
    assert provider.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "draft",
    [
        {"summary": "分数是 98 分。", "evidence_ids": ["ev1"], "follow_up_questions": []},
        {"summary": "可以放心，不用就医。", "evidence_ids": ["ev1"], "follow_up_questions": []},
        {"summary": "这项情况良好。", "evidence_ids": ["ev404"], "follow_up_questions": []},
    ],
)
async def test_unverified_or_unsafe_model_text_is_never_exposed(draft):
    result = await prepare_answer_candidate(
        object(), SCOPE, "呼吸睡眠怎么样？", provider=FakeProvider(draft),
        reader=report_reader(),
    )
    assert result.state == "unsafe_answer"
    assert result.evidence == []
    assert "98 分" not in result.text
    assert "不用就医" not in result.text
    assert result.is_completed is False


@pytest.mark.asyncio
async def test_default_provider_is_disabled_even_when_evidence_exists():
    result = await prepare_answer_candidate(
        object(), SCOPE, "呼吸睡眠怎么样？", reader=report_reader()
    )
    assert result.state == "provider_unavailable"
    assert result.evidence == []
    assert result.is_completed is False


@pytest.mark.asyncio
async def test_provider_timeout_does_not_publish_partial_text():
    class SlowProvider:
        async def draft(self, *, question, evidence):
            await asyncio.sleep(0.1)
            return {"summary": "不应展示", "evidence_ids": ["ev1"], "follow_up_questions": []}

    result = await prepare_answer_candidate(
        object(), SCOPE, "呼吸睡眠怎么样？", provider=SlowProvider(),
        reader=report_reader(), provider_timeout_seconds=0.001,
    )
    assert result.state == "provider_unavailable"
    assert result.evidence == []
    assert "不应展示" not in result.text


@pytest.mark.asyncio
async def test_report_read_failure_never_calls_provider():
    provider = FakeProvider()

    async def broken_reader(*_args, **_kwargs):
        raise RuntimeError("private report source error")

    result = await prepare_answer_candidate(
        object(), SCOPE, "呼吸睡眠怎么样？", provider=provider, reader=broken_reader
    )
    assert result.state == "report_unavailable"
    assert "private report source error" not in result.text
    assert provider.calls == []


@pytest.mark.asyncio
async def test_safe_admin_actions_are_saved_as_separate_sources_not_model_facts():
    provider = FakeProvider()
    result = await prepare_answer_candidate(
        object(), SCOPE, "呼吸睡眠有什么建议？", provider=provider,
        reader=report_reader(actions=["保持规律作息", "适量活动"]),
    )

    assert result.state == "reviewed_candidate"
    assert [item["text"] for item in result.evidence if item.get("source_type") == "action"] == [
        "保持规律作息", "适量活动",
    ]
    assert all(item["kind"] == "maintained" for item in result.evidence if item.get("source_type") == "action")
    _, model_evidence = provider.calls[0]
    assert "保持规律作息" not in str(model_evidence)
    assert "适量活动" not in str(model_evidence)


@pytest.mark.asyncio
async def test_unsafe_admin_action_prevents_answer_and_action_from_being_published():
    result = await prepare_answer_candidate(
        object(), SCOPE, "呼吸睡眠有什么建议？", provider=FakeProvider(),
        reader=report_reader(actions=["建议购买我们的产品"]),
    )

    assert result.state == "unsafe_answer"
    assert result.evidence == []
    assert result.is_completed is False


@pytest.mark.asyncio
async def test_pipeline_sends_only_bounded_labeled_same_indicator_user_context():
    provider = FakeProvider()
    result = await prepare_answer_candidate(
        object(),
        SCOPE,
        "这个情况可以怎么改善？",
        provider=provider,
        reader=report_reader(),
        context_indicator_code="SYS_LUNG_SLEEP_BREATHING",
        prior_user_context=[
            {"indicator_code": "SYS_LUNG_SLEEP_BREATHING", "text": "我最近每天睡得比较晚"},
            {"indicator_code": "SYS_CARDIO_LIPID", "text": "不相关的另一个指标"},
        ],
        prior_follow_up_questions=[
            {"indicator_code": "SYS_LUNG_SLEEP_BREATHING", "text": "你每晚是否容易醒来？"},
            {"indicator_code": "SYS_CARDIO_LIPID", "text": "你平时关注血脂吗？"},
        ],
    )

    assert result.state == "reviewed_candidate"
    _, model_evidence = provider.calls[0]
    assert model_evidence["user_context"] == [
        {"source_type": "user_supplement", "text": "我最近每天睡得比较晚"},
    ]
    assert "previous_follow_up_questions" not in model_evidence
    assert "不相关的另一个指标" not in str(model_evidence)
    assert "你平时关注血脂吗？" not in str(model_evidence)
    assert "我最近每天睡得比较晚" not in str(result.evidence)


@pytest.mark.asyncio
async def test_pipeline_persists_only_validated_followups_with_report_citation():
    provider = FakeProvider({
        "summary": "可以结合这项报告结果理解本次情况。",
        "evidence_ids": ["ev1"],
        "follow_up_questions": ["你每晚是否容易醒来？"],
    })
    result = await prepare_answer_candidate(
        object(), SCOPE, "呼吸睡眠怎么样？", provider=provider, reader=report_reader()
    )
    assert result.state == "reviewed_candidate"
    assert result.evidence[0]["kind"] == "report"
    assert result.evidence[0]["follow_up_questions"] == ["你每晚是否容易醒来？"]
    assert all("follow_up_questions" not in item for item in result.evidence[1:])
