"""单指标详情聚合：全部替身数据，不连接真实 MySQL/MongoDB。"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.exc import OperationalError

from app.models.new.sa_indicator import SAIndicator
from app.services import report_source, report_view_service as svc


def _indicator(id_, code, target_id, parent_id=None, status=1, **extra):
    return SAIndicator(
        id=id_, parent_id=parent_id, ind_code=code,
        ind_name="免疫力" if parent_id is None else "淋巴结",
        target_id=target_id, status=status, sort_order=1, **extra,
    )


def _db(rows):
    result = MagicMock()
    result.scalars.return_value.all.return_value = rows
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    return db


def _doc(score=92):
    return {
        "_id": "R1",
        "ddsReportInfo": {"firstTarget": [
            {"targetId": 3135, "score": 88, "secondTarget": [
                {"targetId": 3136, "score": 90, "threeTarget": [
                    {"targetId": 3137, "score": score, "lastScore": 90, "abLevel": 1}
                ]}
            ]},
        ]},
    }


ROOT = _indicator(1, "SYS_IMMUNE", 3135)
CHILD = _indicator(
    2, "SYS_IMMUNE_LYMPH", 3137, parent_id=1,
    description="淋巴结参与免疫应答。", report_status_text="正常",
    report_interpretation="本次结果表现稳定。",
    report_actions='["保持规律作息", "适量运动"]',
)
META = {"status": 1, "customer_id": 1001, "report_date": "2026-09-01", "inspect_date": "2026-09-01"}


@pytest.mark.asyncio
async def test_single_indicator_uses_real_nested_node_and_nepstar_copy():
    db = _db([ROOT, CHILD])
    trend = [{"report_code": "R1", "date": "2026-09-01", "score": 92}]
    with patch.object(report_source, "fetch_report_document", AsyncMock(return_value=_doc())), \
         patch.object(report_source, "fetch_report_meta", AsyncMock(return_value=META)), \
         patch.object(report_source, "fetch_recent_indicator_trend", AsyncMock(return_value=trend)) as fetch_trend:
        data = await svc.build_indicator_detail(db, "R1", "SYS_IMMUNE_LYMPH", 1001)

    assert data["system"] == {"system_code": "SYS_IMMUNE", "name": "免疫力"}
    assert data["indicator"] == {
        "indicator_code": "SYS_IMMUNE_LYMPH", "name": "淋巴结", "score": 92,
        "last_score": 90, "score_change": 2, "abnormal_level": 1,
        "status_text": "正常", "description": "淋巴结参与免疫应答。",
        "interpretation": "本次结果表现稳定。",
        "actions": ["保持规律作息", "适量运动"], "trend": trend,
    }
    assert fetch_trend.await_args.args[:4] == (db, 1001, 3135, 3137)
    db.commit.assert_not_awaited()
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_male_prostate_indicator_uses_registered_sibling_branch():
    male = SAIndicator(
        id=10, parent_id=None, ind_code="SYS_MALE", ind_name="男性功能",
        target_id=3144, status=1, sort_order=1,
    )
    prostate = SAIndicator(
        id=11, parent_id=10, ind_code="SYS_MALE_PROSTATE_HYPERPLASIA",
        ind_name="前列腺增生", target_id=3149, status=1, sort_order=1,
    )
    doc = {"ddsReportInfo": {"firstTarget": [
        {"targetId": 3143, "secondTarget": [
            {"targetId": 3144, "score": 89, "threeTarget": []},
            {"targetId": 3148, "threeTarget": [
                {"targetId": 3149, "score": 79, "lastScore": 82, "abLevel": 2}
            ]},
        ]},
    ]}}
    trend = [{"report_code": "R1", "date": "2026-09-01", "score": 79}]
    db = _db([male, prostate])
    with patch.object(report_source, "fetch_report_document", AsyncMock(return_value=doc)), \
         patch.object(report_source, "fetch_report_meta", AsyncMock(return_value=META)), \
         patch.object(report_source, "fetch_recent_indicator_trend", AsyncMock(return_value=trend)) as fetch_trend:
        data = await svc.build_indicator_detail(
            db, "R1", "SYS_MALE_PROSTATE_HYPERPLASIA", 1001
        )

    assert data["system"] == {"system_code": "SYS_MALE", "name": "男性功能"}
    assert data["indicator"]["score"] == 79
    assert data["indicator"]["score_change"] == -3
    assert data["indicator"]["trend"] == trend
    assert fetch_trend.await_args.args[:4] == (db, 1001, 3144, 3149)


@pytest.mark.asyncio
async def test_wrong_customer_is_indistinguishable_from_missing_report():
    db = _db([ROOT, CHILD])
    with patch.object(report_source, "fetch_report_document", AsyncMock(return_value=_doc())), \
         patch.object(report_source, "fetch_report_meta", AsyncMock(return_value=META)):
        with pytest.raises(svc.ReportNotFoundError):
            await svc.build_indicator_detail(db, "R1", "SYS_IMMUNE_LYMPH", 9999)
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("rows", [[ROOT], [ROOT, _indicator(2, "SYS_IMMUNE_LYMPH", 3137, 1, status=0)]])
async def test_unregistered_or_disabled_indicator_is_not_found(rows):
    db = _db(rows)
    with patch.object(report_source, "fetch_report_document", AsyncMock(return_value=_doc())), \
         patch.object(report_source, "fetch_report_meta", AsyncMock(return_value=META)):
        with pytest.raises(svc.ReportIndicatorNotFoundError):
            await svc.build_indicator_detail(db, "R1", "SYS_IMMUNE_LYMPH", 1001)


@pytest.mark.asyncio
async def test_target_in_another_system_is_not_accepted():
    db = _db([ROOT, CHILD])
    doc = {"ddsReportInfo": {"firstTarget": [
        {"targetId": 3135, "secondTarget": []},
        {"targetId": 4000, "secondTarget": [{"targetId": 3137, "score": 92}]},
    ]}}
    with patch.object(report_source, "fetch_report_document", AsyncMock(return_value=doc)), \
         patch.object(report_source, "fetch_report_meta", AsyncMock(return_value=META)):
        with pytest.raises(svc.ReportIndicatorNotFoundError):
            await svc.build_indicator_detail(db, "R1", "SYS_IMMUNE_LYMPH", 1001)


@pytest.mark.asyncio
async def test_nepstar_configuration_read_failure_is_reported_as_unavailable():
    db = _db([])
    db.execute.side_effect = OperationalError("SELECT", {}, Exception("offline"))
    with patch.object(report_source, "fetch_report_document", AsyncMock(return_value=_doc())), \
         patch.object(report_source, "fetch_report_meta", AsyncMock(return_value=META)):
        with pytest.raises(report_source.ReportSourceUnavailableError):
            await svc.build_indicator_detail(db, "R1", "SYS_IMMUNE_LYMPH", 1001)
    db.commit.assert_not_awaited()
