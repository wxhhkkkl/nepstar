"""Report-bound plan matching, using only synthetic report data."""
from contextlib import ExitStack
from unittest.mock import AsyncMock, patch

import pytest

from app.services import report_view_service as svc
from tests.unit.test_report_view_service import female_doc, META, INDICATORS


async def context(score=48, threshold=99, requested=None, plans=None, doc=None):
    document = doc or female_doc()
    if doc is None:
        document['ddsReportInfo']['firstTarget'][1]['secondTarget'][0]['score'] = score
    system = INDICATORS[3]
    child = INDICATORS[4]
    plan = {'plan_id': 17, 'plan_name': '真实测试方案', 'description': '维护说明',
            'trigger_score_below': threshold, 'products': [{'product_id': 30}]}
    with ExitStack() as stack:
        stack.enter_context(patch.object(svc, '_load_document_and_meta', AsyncMock(return_value=(document, META))))
        stack.enter_context(patch.object(svc, '_load_registry', AsyncMock(return_value=(
            [system], {system.id: [child]}, {}, {}, plans if plans is not None else {child.id: [plan]},
        ))))
        return await svc.build_plan_context(None, 'R1', 17, 1001, requested)


@pytest.mark.asyncio
async def test_high_score_matches_its_actual_threshold_and_reports_context():
    result = await context(98, 99, 'SYS_BONE_OSTEO')
    assert result['primary_indicator']['indicator_score'] == 98
    assert result['plan']['plan_id'] == 17
    assert result['product_ids'] == [30]
    assert result['related_indicators'] == [result['primary_indicator']]


@pytest.mark.asyncio
@pytest.mark.parametrize('score,threshold', [(99, 99), (100, 99), (None, 99), (True, 99), (48, 0)])
async def test_missing_invalid_or_nonmatching_score_is_unavailable(score, threshold):
    with pytest.raises(svc.ReportPlanNotFoundError):
        await context(score, threshold)


@pytest.mark.asyncio
async def test_zero_is_a_real_score():
    assert (await context(0, 1))['primary_indicator']['indicator_score'] == 0


@pytest.mark.asyncio
async def test_explicit_wrong_indicator_never_falls_back():
    with pytest.raises(svc.ReportPlanNotFoundError):
        await context(requested='SYS_CARDIO_LIPID')


@pytest.mark.asyncio
async def test_effective_overlay_suppression_and_wrong_report_branch():
    with pytest.raises(svc.ReportPlanNotFoundError):
        await context(plans={})
    document = female_doc()
    document['ddsReportInfo']['firstTarget'][1]['secondTarget'] = []
    with pytest.raises(svc.ReportPlanNotFoundError):
        await context(doc=document)
