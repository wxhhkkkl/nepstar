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


def sleep_detail(score=90, description="呼吸睡眠是睡眠期间的呼吸质量。", actions=None):
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
            "actions": actions or [],
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


@pytest.mark.asyncio
async def test_admin_actions_are_only_collected_for_advice_questions_and_never_sent_to_model():
    from app.services.ai_consult_evidence import prepare_report_evidence

    actions = [
        "规律作息",
        "请联系 13800001111 咨询",
        "适量活动",
        "减少久坐",
        "均衡饮食",
        "保证充足睡眠",
    ]
    reader = FakeReader(home(), {"SYS_LUNG_SLEEP": sleep_detail(actions=actions)})

    bundle = await prepare_report_evidence(
        None, scope(), "呼吸睡眠我可以做哪些日常调整？", reader=reader,
    )

    assert [item["text"] for item in bundle.actions] == ["规律作息", "适量活动", "减少久坐"]
    assert all(item["route"].startswith("#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP?")
               for item in bundle.actions)
    model_payload = str(bundle.for_model())
    assert "规律作息" not in model_payload
    assert "适量活动" not in model_payload
    assert "13800001111" not in model_payload

    ordinary = await prepare_report_evidence(
        None, scope(), "呼吸睡眠这项指标是什么意思？", reader=reader,
    )
    assert ordinary.actions == []


@pytest.mark.asyncio
async def test_prior_user_context_is_clipped_to_two_safe_messages_for_the_same_indicator():
    from app.services.ai_consult_evidence import prepare_report_evidence

    reader = FakeReader(home(), {"SYS_LUNG_SLEEP": sleep_detail()})
    prior = [
        {"indicator_code": "SYS_LUNG_SLEEP", "text": "我最近每天睡得比较晚"},
        {"indicator_code": "SYS_LUNG_SLEEP", "text": "白天偶尔会觉得疲惫"},
        {"indicator_code": "SYS_LUNG_SLEEP", "text": "第三条较早的补充"},
        {"indicator_code": "SYS_LUNG_VC", "text": "另一个指标的上下文不能混入"},
        {"indicator_code": "SYS_LUNG_SLEEP", "text": "联系电话13800001111"},
        {"indicator_code": "SYS_LUNG_SLEEP", "text": "这个情况怎么改善？"},
    ]

    bundle = await prepare_report_evidence(
        None,
        scope(),
        "这个情况怎么改善？",
        context_indicator_code="SYS_LUNG_SLEEP",
        prior_user_context=prior,
        reader=reader,
    )

    assert bundle.user_context == [
        {"source_type": "user_supplement", "text": "我最近每天睡得比较晚"},
        {"source_type": "user_supplement", "text": "白天偶尔会觉得疲惫"},
    ]
    assert bundle.for_model()["user_context"] == bundle.user_context
    assert "第三条较早的补充" not in str(bundle.for_model())
    assert "13800001111" not in str(bundle.for_model())
    assert all("text" not in item for item in bundle.for_client()["citations"])


@pytest.mark.asyncio
async def test_global_or_explicit_system_questions_do_not_inherit_a_single_indicator_anchor():
    from app.services.ai_consult_evidence import prepare_report_evidence

    source = home()
    source["systems"][0]["indicators"].append(
        {"indicator_code": "SYS_LUNG_EXTRA", "name": "第三项", "score": 70}
    )
    reader = FakeReader(source)

    priority = await prepare_report_evidence(
        None, scope(), "哪些指标值得优先关注？", context_indicator_code="SYS_LUNG_SLEEP", reader=reader,
    )
    assert [fact["metric"] for fact in priority.facts] == ["肺活量", "第三项", "呼吸睡眠"]
    assert all(call[0] == "home" for call in reader.calls)

    reader = FakeReader(home())
    system = await prepare_report_evidence(
        None, scope(), "肺功能整体怎么样？", context_indicator_code="SYS_LUNG_SLEEP", reader=reader,
    )
    assert [fact["metric"] for fact in system.facts] == ["肺功能", "肺活量", "呼吸睡眠"]
    assert reader.calls == [("home", None, "R1", 1001)]


@pytest.mark.asyncio
async def test_system_question_keeps_components_in_the_same_report_and_system():
    from app.services.ai_consult_evidence import prepare_report_evidence

    source = home()
    source["systems"].append({
        "system_code": "SYS_BONE", "name": "骨骼", "score": 40,
        "indicators": [{"indicator_code": "SYS_BONE_A", "name": "骨质", "score": 20}],
    })
    reader = FakeReader(source)
    bundle = await prepare_report_evidence(
        None, scope(), "肺功能应该优先关注哪些指标？", reader=reader,
    )
    assert [(fact["metric"], fact["score"]) for fact in bundle.facts] == [
        ("肺功能", 84), ("肺活量", 60), ("呼吸睡眠", 90),
    ]
    assert all(item["route"].startswith("#/system/SYS_LUNG") for item in bundle.citations)
    assert "骨质" not in str(bundle.for_model())
    assert "私人姓名" not in str(bundle.for_model())
    assert "DEVICE-SECRET" not in str(bundle.for_model())
    assert reader.calls == [("home", None, "R1", 1001)]


@pytest.mark.asyncio
async def test_system_components_are_bounded_and_skip_unusable_scores():
    from app.services.ai_consult_evidence import prepare_report_evidence

    source = home()
    source["systems"][0]["indicators"].extend([
        {"indicator_code": "SYS_LUNG_X", "name": "子项甲", "score": 80},
        {"indicator_code": "SYS_LUNG_Y", "name": "子项乙", "score": 70},
        {"indicator_code": "SYS_LUNG_BAD", "name": "错误项", "score": True},
    ])
    bundle = await prepare_report_evidence(None, scope(), "肺功能整体怎么样？", reader=FakeReader(source))
    assert [(fact["metric"], fact["score"]) for fact in bundle.facts] == [
        ("肺功能", 84), ("肺活量", 60), ("子项乙", 70), ("子项甲", 80),
    ]
    assert set(bundle.warnings) == {"system_indicator_score_missing", "system_indicators_partial"}


@pytest.mark.asyncio
async def test_system_without_valid_components_does_not_invent_them():
    from app.services.ai_consult_evidence import prepare_report_evidence

    source = home()
    source["systems"][0]["indicators"] = []
    bundle = await prepare_report_evidence(None, scope(), "肺功能整体怎么样？", reader=FakeReader(source))
    assert [(fact["metric"], fact["score"]) for fact in bundle.facts] == [("肺功能", 84)]
