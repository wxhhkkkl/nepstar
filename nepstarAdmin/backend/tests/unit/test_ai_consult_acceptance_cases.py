"""合成报告与健康边界离线验收；不访问数据库、网络或真实模型。"""

import json
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.ai_consult_answer import AnswerValidation
from app.services.ai_consult_evidence import prepare_report_evidence
from app.services.ai_consult_pipeline import prepare_answer_candidate
from app.services.ai_consult_safety import guarded_candidate


CASES = json.loads(
    (Path(__file__).parents[1] / "fixtures" / "ai_consult_cases.json").read_text(encoding="utf-8")
)
REPORT_DATE = "2026-09-18"
REPORT_CODE = "RTEST001"


def _scope():
    return SimpleNamespace(report_code=REPORT_CODE, customer_id=1001, report_date=date.fromisoformat(REPORT_DATE))


def _source(case):
    score = case.get("score", 90)
    home_score = case.get("home_score", score)
    detail_score = case.get("detail_score", score)
    home = {
        "report_code": REPORT_CODE, "report_date": REPORT_DATE, "total_score": 82,
        "customer_name": "测试者姓名不得外发", "device_sn": "DEVICE-PRIVATE",
        "systems": [
            {"system_code": "SYS_LUNG", "name": "肺功能", "score": case.get("score", 84) if case["mode"] == "system" else 84,
             "indicators": [
                 {"indicator_code": "SYS_LUNG_SLEEP", "name": "呼吸睡眠", "score": home_score},
                 {"indicator_code": "SYS_LUNG_VC", "name": "肺活量", "score": case.get("vc_score", 60)},
             ]},
            {"system_code": "SYS_CARDIO", "name": "心血管", "score": 91,
             "indicators": [{"indicator_code": "SYS_CARDIO_LIPID", "name": "血脂", "score": 75}]},
        ],
    }
    detail = {
        "report_code": REPORT_CODE, "system": {"system_code": "SYS_LUNG"},
        "indicator": {
            "indicator_code": "SYS_LUNG_SLEEP", "name": "呼吸睡眠", "score": detail_score,
            "description": case.get("description", "呼吸睡眠是睡眠期间的呼吸质量。"),
            "interpretation": case.get("interpretation", "关注睡眠期间的呼吸节律。"),
        },
    }
    if case["mode"] == "priority":
        home["systems"][0]["indicators"][0]["score"] = case.get("sleep_score", 90)
    mutation = case.get("mutation")
    if mutation == "wrong_date":
        home["report_date"] = "2026-09-19"
    elif mutation == "invalid_date":
        home["report_date"] = "2026-99-99"
    elif mutation == "wrong_home_report":
        home["report_code"] = "RTEST002"
    elif mutation == "wrong_detail_report":
        detail["report_code"] = "RTEST002"
    elif mutation == "wrong_detail_system":
        detail["system"]["system_code"] = "SYS_OTHER"
    elif mutation == "wrong_detail_indicator":
        detail["indicator"]["indicator_code"] = "SYS_OTHER"
    elif mutation == "description_phone":
        detail["indicator"]["description"] = "联系 13800001111 获取建议。"
    elif mutation == "description_email":
        detail["indicator"]["description"] = "写信到 doctor@example.com 获取建议。"
    elif mutation == "label_phone":
        home["systems"][0]["indicators"][0]["name"] = "呼吸睡眠 13800001111"
    elif mutation == "label_email":
        home["systems"][0]["indicators"][0]["name"] = "呼吸睡眠 doctor@example.com"
    return home, detail


class FakeReader:
    def __init__(self, home, detail):
        self.home = home
        self.detail = detail
        self.calls = []

    async def __call__(self, _db, _scope, tool_name, *, indicator_code=None):
        self.calls.append((tool_name, indicator_code))
        if tool_name == "home":
            return self.home
        assert tool_name == "indicator" and indicator_code == "SYS_LUNG_SLEEP"
        return self.detail


class FakeProvider:
    def __init__(self, case):
        self.case = case
        self.calls = []

    async def draft(self, *, question, evidence):
        self.calls.append((question, evidence))
        ids = self.case.get("draft_ids")
        if ids is None:
            ids = ["ev1", "ev2"] if self.case.get("expected_maintained") == 1 else ["ev1"]
        return {
            "summary": self.case.get("draft_summary", "可以结合本次报告中的可核对结果理解。"),
            "evidence_ids": ids,
            "follow_up_questions": [],
        }


def _question(case):
    if case["mode"] == "system":
        return "肺功能整体结果如何理解？"
    if case["mode"] == "priority":
        return "哪些指标值得优先关注？"
    return "呼吸睡眠结果如何理解？"


def test_acceptance_fixture_has_distinct_minimum_cases():
    assert len(CASES["report_cases"]) >= 40
    assert len(CASES["health_cases"]) >= 20
    ids = [case["id"] for group in ("report_cases", "health_cases") for case in CASES[group]]
    assert len(ids) == len(set(ids))


@pytest.mark.asyncio
@pytest.mark.parametrize("case", CASES["report_cases"], ids=lambda case: case["id"])
async def test_report_fact_and_draft_acceptance(case):
    home, detail = _source(case)
    reader = FakeReader(home, detail)
    provider = FakeProvider(case)
    question = _question(case)
    outcome = await prepare_answer_candidate(None, _scope(), question, provider=provider, reader=reader)
    assert outcome.state == case["expected_state"]

    if outcome.state == "report_unavailable":
        assert provider.calls == [] and outcome.evidence == []
        return
    if outcome.state == "insufficient_evidence":
        assert provider.calls == [] and outcome.evidence == []
        bundle = await prepare_report_evidence(None, _scope(), question, reader=reader)
        assert bundle.facts == [] and case["warning"] in bundle.warnings
        assert "无法确认" in outcome.text
        return

    assert len(provider.calls) == 1
    sent = provider.calls[0][1]
    report_facts = [fact for fact in sent["facts"] if fact["kind"] == "report"]
    assert [fact["score"] for fact in report_facts] == case["expected_scores"]
    assert all(fact["date"] == REPORT_DATE and fact["date_kind"] == "report_date" for fact in report_facts)
    assert sum(fact["kind"] == "maintained" for fact in sent["facts"]) == case.get("expected_maintained", 1 if case["mode"] in {"indicator", "maintained"} else 0)
    for private in (REPORT_CODE, "1001", "DEVICE-PRIVATE", "13800001111", "doctor@example.com"):
        assert private not in str(sent)

    if outcome.state == "unsafe_answer":
        assert outcome.evidence == []
        assert case.get("draft_summary", "模型草稿不可返回") not in outcome.text
        return
    assert outcome.state == "reviewed_candidate" and outcome.evidence
    assert f"活力值 {report_facts[0]['score']} 分" in outcome.text
    assert f"报告日期 {REPORT_DATE}" in outcome.text
    by_id = {fact["id"]: fact for fact in sent["facts"]}
    for citation in outcome.evidence:
        fact = by_id[citation["id"]]
        assert citation["kind"] == fact["kind"]
        assert citation["label"] == fact["metric"]
        assert citation["route"].startswith("#/")
        if fact["kind"] == "report":
            assert citation["report_date"] == fact["date"] == REPORT_DATE
            assert f"{fact['metric']}活力值 {fact['score']} 分" in outcome.text
        else:
            assert citation["report_date"] is None
            assert fact["text"] in outcome.text


@pytest.mark.asyncio
@pytest.mark.parametrize("case", CASES["health_cases"], ids=lambda case: case["id"])
async def test_health_boundary_acceptance(case):
    question = case.get("question", "肺功能分数是什么意思")
    text = case.get("candidate", "可以结合报告中的可核对结果理解。")
    supplier = AsyncMock(return_value=AnswerValidation(
        state="provenance_validated", candidate_text=text,
        evidence=[{"id": "ev1", "kind": "report"}],
    ))
    result = await guarded_candidate(question, supplier)
    assert result.route == case["expected_route"]
    if case["kind"] == "input":
        assert result.approved is False
        supplier.assert_not_awaited()
        assert result.source in {"user_report", "user_question"}
    elif case["kind"] == "output":
        assert result.approved is False and text not in result.text
        supplier.assert_awaited_once()
    else:
        assert result.approved is True and result.text == text
        supplier.assert_awaited_once()
