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
        }
        self.calls = []

    async def draft(self, *, question, evidence):
        self.calls.append((question, evidence))
        return self.result


def report_reader(*, score=90, detail_score=90):
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
        {"summary": "分数是 98 分。", "evidence_ids": ["ev1"]},
        {"summary": "可以放心，不用就医。", "evidence_ids": ["ev1"]},
        {"summary": "这项情况良好。", "evidence_ids": ["ev404"]},
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
            return {"summary": "不应展示", "evidence_ids": ["ev1"]}

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
