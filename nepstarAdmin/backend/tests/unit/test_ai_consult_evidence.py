"""证据组装只使用内存报告，不连接真实 MySQL、MongoDB 或模型。"""

from datetime import date
from types import SimpleNamespace

import pytest


class FakeReader:
    def __init__(self, home, details=None):
        self.home = home
        self.details = details or {}
        self.calls = []

    async def __call__(self, db, scope, tool_name, *, indicator_code=None):
        self.calls.append((tool_name, indicator_code, scope.report_code, scope.customer_id))
        if tool_name == "home":
            return self.home
        return self.details[indicator_code]


def scope():
    return SimpleNamespace(report_code="R1", customer_id=1001, report_date=date(2026, 10, 8))


def home():
    return {
        "report_code": "R1",
        "report_date": "2026-10-08",
        "total_score": 82,
        "customer_name": "私人姓名不得进入证据",
        "device_sn": "DEVICE-SECRET",
        "systems": [{
            "system_code": "SYS_LUNG",
            "name": "肺功能",
            "score": 84,
            "indicators": [
                {"indicator_code": "SYS_LUNG_SLEEP", "name": "呼吸睡眠", "score": 90},
                {"indicator_code": "SYS_LUNG_VC", "name": "肺活量", "score": 60},
            ],
        }],
    }


def sleep_detail(score=90, description="呼吸睡眠是睡眠期间的呼吸质量。"):
    return {
        "report_code": "R1",
        "system": {"system_code": "SYS_LUNG", "name": "肺功能"},
        "indicator": {
            "indicator_code": "SYS_LUNG_SLEEP",
            "name": "呼吸睡眠",
            "score": score,
            "description": description,
            "interpretation": "关注睡眠期间的呼吸节律。",
            "status_text": "保持关注",
            "phone": "13800001111",
        },
    }


@pytest.mark.asyncio
async def test_specific_question_gets_only_matching_indicator_and_separate_client_citation():
    from app.services.ai_consult_evidence import prepare_report_evidence

    reader = FakeReader(home(), {"SYS_LUNG_SLEEP": sleep_detail()})
    bundle = await prepare_report_evidence(None, scope(), "呼吸睡眠得分是什么意思？", reader=reader)
    assert reader.calls == [
        ("home", None, "R1", 1001),
        ("indicator", "SYS_LUNG_SLEEP", "R1", 1001),
    ]
    model = bundle.for_model()
    assert model["facts"][0]["metric"] == "呼吸睡眠"
    assert model["facts"][0]["score"] == 90
    assert model["facts"][0]["date"] == "2026-10-08"
    assert model["facts"][0]["date_kind"] == "report_date"
    assert any(fact["kind"] == "maintained" for fact in model["facts"])
    assert "R1" not in str(model)
    assert "1001" not in str(model)
    assert "DEVICE-SECRET" not in str(model)
    assert "13800001111" not in str(model)
    assert bundle.for_client()["citations"][0]["route"].startswith(
        "#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP?reportId=R1&customerId=1001"
    )


@pytest.mark.asyncio
async def test_conflicting_or_missing_scores_are_not_picked_as_authoritative():
    from app.services.ai_consult_evidence import prepare_report_evidence

    reader = FakeReader(home(), {"SYS_LUNG_SLEEP": sleep_detail(score=98)})
    bundle = await prepare_report_evidence(None, scope(), "呼吸睡眠如何？", reader=reader)
    model = bundle.for_model()
    assert model["facts"] == []
    assert "score_conflict" in model["warnings"]
    assert "90" not in str(model)
    assert "98" not in str(model)

    missing = home()
    missing["systems"][0]["indicators"][0]["score"] = None
    reader = FakeReader(missing, {"SYS_LUNG_SLEEP": sleep_detail(score=None)})
    model = (await prepare_report_evidence(None, scope(), "呼吸睡眠如何？", reader=reader)).for_model()
    assert model["facts"] == []
    assert "score_missing" in model["warnings"]


@pytest.mark.asyncio
async def test_generic_priority_question_selects_only_lowest_valid_indicators_without_detail_calls():
    from app.services.ai_consult_evidence import prepare_report_evidence

    source = home()
    source["systems"][0]["indicators"].extend([
        {"indicator_code": "SYS_LUNG_X", "name": "第三项", "score": 70},
        {"indicator_code": "SYS_LUNG_Y", "name": "第四项", "score": 71},
        {"indicator_code": "SYS_LUNG_BAD", "name": "错误项", "score": 130},
    ])
    reader = FakeReader(source)
    bundle = await prepare_report_evidence(None, scope(), "哪些指标值得优先关注？", reader=reader)
    model = bundle.for_model()
    assert reader.calls == [("home", None, "R1", 1001)]
    assert [fact["metric"] for fact in model["facts"]] == ["肺活量", "第三项", "第四项"]
    assert [fact["score"] for fact in model["facts"]] == [60, 70, 71]


@pytest.mark.asyncio
async def test_unregistered_indicator_or_wrong_report_never_fetches_detail():
    from app.services.ai_consult_evidence import EvidenceUnavailable, prepare_report_evidence

    reader = FakeReader(home())
    with pytest.raises(EvidenceUnavailable):
        await prepare_report_evidence(
            None, scope(), "看看这个指标", requested_indicator_code="SYS_OTHER_UNKNOWN", reader=reader
        )
    assert reader.calls == [("home", None, "R1", 1001)]

    wrong = home()
    wrong["report_code"] = "R2"
    reader = FakeReader(wrong)
    with pytest.raises(EvidenceUnavailable):
        await prepare_report_evidence(None, scope(), "呼吸睡眠", reader=reader)
    assert reader.calls == [("home", None, "R1", 1001)]


@pytest.mark.asyncio
async def test_maintained_text_with_contact_information_is_not_sent_to_model():
    from app.services.ai_consult_evidence import prepare_report_evidence

    reader = FakeReader(home(), {
        "SYS_LUNG_SLEEP": sleep_detail(description="请联系 13800001111 咨询")
    })
    model = (await prepare_report_evidence(None, scope(), "呼吸睡眠如何？", reader=reader)).for_model()
    assert all(fact["kind"] != "maintained" for fact in model["facts"])
    assert "13800001111" not in str(model)


@pytest.mark.asyncio
async def test_metric_name_containing_contact_information_is_never_sent_or_fetched():
    from app.services.ai_consult_evidence import prepare_report_evidence

    source = home()
    source["systems"][0]["indicators"][0]["name"] = "呼吸睡眠 13800001111"
    reader = FakeReader(source)
    bundle = await prepare_report_evidence(None, scope(), "哪些指标值得优先关注？", reader=reader)
    assert "13800001111" not in str(bundle.for_model())
    assert reader.calls == [("home", None, "R1", 1001)]
