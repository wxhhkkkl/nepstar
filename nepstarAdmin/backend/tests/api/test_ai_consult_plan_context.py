"""方案咨询入口的离线验收；不连接数据库、网络或模型。"""

from copy import deepcopy
from datetime import date
from types import SimpleNamespace

import pytest

from app.services.ai_consult_plan_context import resolve_entry_context
from app.services.ai_consult_pipeline import prepare_answer_candidate


REPORT_CODE = "RTEST001"
INDICATOR_CODE = "SYS_LUNG_SLEEP"
PLAN_ID = 17


def _home(score=79, *, recommendation=True):
    system = {
        "system_code": "SYS_LUNG",
        "name": "肺功能",
        "indicators": [
            {"indicator_code": INDICATOR_CODE, "name": "呼吸睡眠", "score": score},
        ],
    }
    if recommendation:
        # 该字段只由报告聚合层对启用且关联的方案生成。
        system["recommendation"] = {
            "plan_id": PLAN_ID,
            "plan_name": "睡眠健康管理方案",
            "trigger_indicator_code": INDICATOR_CODE,
            "indicator_score": score,
            "trigger_score_below": 80,
            "description": "维持规律作息，关注睡眠质量。",
        }
    return {
        "report_code": REPORT_CODE,
        "report_date": "2026-09-18",
        "systems": [system],
    }


def _detail(score=79):
    return {
        "report_code": REPORT_CODE,
        "system": {"system_code": "SYS_LUNG"},
        "indicator": {
            "indicator_code": INDICATOR_CODE,
            "name": "呼吸睡眠",
            "score": score,
        },
    }


def _scope():
    return SimpleNamespace(report_code=REPORT_CODE, customer_id=1001, report_date=date(2026, 9, 18))


class Reader:
    def __init__(self, home, detail):
        self.home = home
        self.detail = detail

    async def __call__(self, _db, _scope, tool_name, *, indicator_code=None):
        if tool_name == "home":
            return self.home
        assert tool_name == "indicator" and indicator_code == INDICATOR_CODE
        return self.detail


class Provider:
    def __init__(self):
        self.calls = []

    async def draft(self, *, question, evidence):
        self.calls.append((question, evidence))
        return {
            "summary": "请结合本次报告理解。", "evidence_ids": ["ev1", "ev2"],
            "follow_up_questions": [],
        }


@pytest.mark.parametrize("score,expected_type", [(79, "plan"), (80, "indicator"), (81, "indicator")])
def test_strictly_below_default_threshold(score, expected_type):
    context = resolve_entry_context(_home(score), plan_id=PLAN_ID, indicator_code=INDICATOR_CODE)
    assert context["type"] == expected_type
    if expected_type == "plan":
        assert context["plan_id"] == PLAN_ID
        assert context["trigger_score_below"] == 80
    else:
        assert context["stale_plan"] is True
        assert "plan_name" not in context


@pytest.mark.parametrize("mutation", ["unpublished_or_unlinked", "wrong_plan", "wrong_indicator", "wrong_score", "wrong_system"])
def test_old_or_mismatched_plan_url_degrades_to_indicator(mutation):
    home = _home()
    if mutation == "unpublished_or_unlinked":
        # 聚合层过滤下架/取消关联的方案后，不再返回 recommendation。
        del home["systems"][0]["recommendation"]
    elif mutation == "wrong_plan":
        home["systems"][0]["recommendation"]["plan_id"] = 18
    elif mutation == "wrong_indicator":
        home["systems"][0]["recommendation"]["trigger_indicator_code"] = "SYS_LUNG_VC"
    elif mutation == "wrong_score":
        home["systems"][0]["recommendation"]["indicator_score"] = 78
    else:
        other = deepcopy(home["systems"][0])
        other["system_code"] = "SYS_CARDIO"
        other["name"] = "心血管"
        other["indicators"] = []
        home["systems"][0].pop("recommendation")
        home["systems"].append(other)
    context = resolve_entry_context(home, plan_id=PLAN_ID, indicator_code=INDICATOR_CODE)
    assert context["type"] == "indicator"
    assert context["stale_plan"] is True
    assert context["indicator_name"] == "呼吸睡眠"
    assert "plan_name" not in context


@pytest.mark.asyncio
async def test_valid_plan_uses_current_report_fact_and_does_not_send_marketing_copy_to_model():
    provider = Provider()
    result = await prepare_answer_candidate(
        None, _scope(), "为什么给我推荐这个方案？", provider=provider,
        reader=Reader(_home(), _detail()),
        requested_plan_id=PLAN_ID, requested_indicator_code=INDICATOR_CODE,
    )
    assert result.state == "reviewed_candidate"
    assert len(provider.calls) == 1
    facts = provider.calls[0][1]["facts"]
    assert [fact["kind"] for fact in facts] == ["report", "plan"]
    assert facts[0]["score"] == 79
    assert facts[1]["score"] == 79 and facts[1]["threshold"] == 80
    assert "睡眠健康管理方案" not in str(provider.calls)
    assert "维持规律作息" not in str(provider.calls)


@pytest.mark.asyncio
async def test_ordinary_question_does_not_inject_plan_fact():
    provider = Provider()
    provider.draft = _ordinary_draft
    result = await prepare_answer_candidate(
        None, _scope(), "呼吸睡眠结果如何理解？", provider=provider,
        reader=Reader(_home(), _detail()),
        requested_indicator_code=INDICATOR_CODE,
    )
    assert result.state == "reviewed_candidate"
    assert "方案" not in result.text
    assert all(item["kind"] != "plan" for item in result.evidence)


async def _ordinary_draft(*, question, evidence):
    assert [fact["kind"] for fact in evidence["facts"]] == ["report"]
    return {
        "summary": "可结合本次报告结果理解。", "evidence_ids": ["ev1"],
        "follow_up_questions": [],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("score,recommendation,detail_score", [
    (80, True, 80), (81, True, 81), (79, False, 79), (79, True, 78),
])
async def test_stale_plan_answer_is_indicator_only_without_model_call(score, recommendation, detail_score):
    provider = Provider()
    result = await prepare_answer_candidate(
        None, _scope(), "为什么给我推荐这个方案？", provider=provider,
        reader=Reader(_home(score, recommendation=recommendation), _detail(detail_score)),
        requested_plan_id=PLAN_ID, requested_indicator_code=INDICATOR_CODE,
    )
    assert provider.calls == []
    if detail_score != score:
        assert result.state == "insufficient_evidence"
        assert "无法确认" in result.text
    else:
        assert result.state == "reviewed_candidate"
        assert "不能把它解释为当前有效方案" in result.text
    assert all(item["kind"] != "plan" for item in result.evidence)
