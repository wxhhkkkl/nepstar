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


def draft(summary="可以结合报告中的呼吸睡眠指标理解本次结果。", ids=None):
    return {"summary": summary, "evidence_ids": ["ev1"] if ids is None else ids}


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
