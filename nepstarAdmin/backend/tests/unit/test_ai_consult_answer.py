"""回答校验只用服务端证据和假模型草稿，不调用外部模型或数据库。"""

import pytest

from app.services.ai_consult_evidence import EvidenceBundle


def report_bundle():
    return EvidenceBundle(
        facts=[
            {"id": "ev1", "kind": "report", "metric": "呼吸睡眠", "score": 90,
             "date": "2026-10-08", "date_kind": "report_date"},
            {"id": "ev2", "kind": "maintained", "metric": "呼吸睡眠",
             "text": "关注睡眠期间的呼吸节律。"},
        ],
        citations=[
            {"id": "ev1", "kind": "report", "label": "呼吸睡眠",
             "report_date": "2026-10-08", "route": "#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP"},
            {"id": "ev2", "kind": "maintained", "label": "呼吸睡眠",
             "report_date": None, "route": "#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP"},
        ],
        warnings=[],
    )


def draft(summary="可以结合报告中的呼吸睡眠指标理解本次结果。", ids=None, follow_ups=None):
    return {
        "summary": summary,
        "evidence_ids": ["ev1"] if ids is None else ids,
        "follow_up_questions": [] if follow_ups is None else follow_ups,
    }


def test_validated_answer_renders_score_date_and_citation_from_server_evidence_only():
    from app.services.ai_consult_answer import validate_answer_draft

    bundle = report_bundle()
    result = validate_answer_draft(bundle, draft())
    assert result.state == "provenance_validated"
    assert result.is_completed is False  # 健康安全校验和持久化尚未完成
    assert "呼吸睡眠" in result.candidate_text
    assert "90 分" in result.candidate_text
    assert "2026-10-08" in result.candidate_text
    assert result.evidence == [bundle.citations[0]]
    assert "报告日期" in result.candidate_text  # 不把报告生成日期冒称检测日期
    assert "customerId" not in result.candidate_text


@pytest.mark.parametrize("already_in_summary", [False, True])
def test_health_reminder_is_part_of_answer_after_all_report_facts(already_in_summary):
    from app.services.ai_consult_answer import HEALTH_REMINDER, validate_answer_draft

    summary = "可以结合报告中的呼吸睡眠指标理解本次结果。"
    if already_in_summary:
        summary += "\n\n" + HEALTH_REMINDER
    result = validate_answer_draft(report_bundle(), draft(summary=summary, ids=["ev1", "ev2"]))

    assert result.candidate_text.startswith("可以结合报告中的呼吸睡眠指标理解本次结果。")
    assert result.candidate_text.endswith("\n\n" + HEALTH_REMINDER)
    assert result.candidate_text.count(HEALTH_REMINDER) == 1
    assert result.candidate_text.index("报告维护说明") < result.candidate_text.index(HEALTH_REMINDER)


def test_answer_returns_two_structured_follow_up_questions():
    from app.services.ai_consult_answer import validate_answer_draft

    result = validate_answer_draft(
        report_bundle(),
        draft(
            summary="这项指标可以结合你补充的情况理解。",
            follow_ups=["你每晚是否容易醒来？", "白天会感到疲惫吗？"],
        ),
    )
    assert result.state == "provenance_validated"
    assert result.candidate_text.count("？") == 0
    assert result.follow_up_questions == ["你每晚是否容易醒来？", "白天会感到疲惫吗？"]


def test_answer_drops_follow_up_already_offered_for_same_indicator():
    from app.services.ai_consult_answer import validate_answer_draft

    bundle = report_bundle()
    bundle.prior_follow_up_questions.append("你每晚是否容易醒来？")
    result = validate_answer_draft(
        bundle, draft(follow_ups=["你每晚是否容易醒来？", "白天会感到疲惫吗？"])
    )
    assert result.follow_up_questions == ["白天会感到疲惫吗？"]


@pytest.mark.parametrize("follow_ups", [
    ["你有确诊吗？"],
    ["这个指标怎么样？" * 20],
    ["你每晚是否容易醒来？", "你每晚是否容易醒来？"],
    ["报告 KH503LS0014998K260729093902424 怎么样？"],
    ["要不要停药？"],
    ["第一项？第二项？第三项？"],
])
def test_unsafe_duplicate_or_oversized_followups_are_rejected(follow_ups):
    from app.services.ai_consult_answer import AnswerRejected, validate_answer_draft

    with pytest.raises(AnswerRejected):
        validate_answer_draft(report_bundle(), draft(follow_ups=follow_ups))


@pytest.mark.parametrize(
    "bad_draft",
    [
        draft(ids=["ev404"]),
        draft(ids=[]),
        draft(summary="呼吸睡眠得分是 98 分。"),
        draft(summary="检测日期是 2026-09-01。"),
        draft(summary="本次得分为 90 分。"),  # 正确数值也必须由服务端渲染
        draft(summary="根据 https://unknown.example/ 的研究。"),
        draft(summary="报告 KH503LS0014998K260729093902424 已确认。"),
        draft(summary="问题一？问题二？问题三？"),
        {"summary": "可以结合报告理解。", "evidence_ids": ["ev1"],
         "answer": "模型夹带的原文不可返回"},
    ],
)
def test_unknown_evidence_wrong_score_date_and_untrusted_fields_are_rejected(bad_draft):
    from app.services.ai_consult_answer import AnswerRejected, validate_answer_draft

    with pytest.raises(AnswerRejected):
        validate_answer_draft(report_bundle(), bad_draft)


def test_no_reliable_report_fact_produces_uncertainty_not_a_completed_model_answer():
    from app.services.ai_consult_answer import validate_answer_draft

    bundle = EvidenceBundle(facts=[], citations=[], warnings=["score_conflict"])
    result = validate_answer_draft(bundle, draft(summary="这项分数正常，不用担心。"))
    assert result.state == "insufficient_evidence"
    assert result.is_completed is False
    assert "无法确认" in result.candidate_text
    assert "正常" not in result.candidate_text
    assert result.evidence == []


def test_mismatched_duplicate_or_malformed_server_evidence_is_rejected():
    from app.services.ai_consult_answer import AnswerRejected, validate_answer_draft

    bundle = report_bundle()
    bundle.citations[0]["id"] = "ev404"
    with pytest.raises(AnswerRejected):
        validate_answer_draft(bundle, draft())

    bundle = report_bundle()
    bundle.facts[0]["score"] = 190
    with pytest.raises(AnswerRejected):
        validate_answer_draft(bundle, draft())

    bundle = report_bundle()
    bundle.facts.append(dict(bundle.facts[0]))
    with pytest.raises(AnswerRejected):
        validate_answer_draft(bundle, draft())

    bundle = report_bundle()
    bundle.citations[0]["report_date"] = "2026-09-01"
    with pytest.raises(AnswerRejected):
        validate_answer_draft(bundle, draft())

    bundle = report_bundle()
    bundle.citations[0]["label"] = "另一个指标"
    with pytest.raises(AnswerRejected):
        validate_answer_draft(bundle, draft())
