"""Explicit, report-bound AI plan reads; no external source or model access."""
from types import SimpleNamespace
from datetime import date
from unittest.mock import AsyncMock
import pytest

from app.services import ai_consult_sources as sources
from app.services import ai_consult_plan_context as context
from tests.fixtures.plan_detail import PLAN_DETAIL


def scope():
    return SimpleNamespace(report_code='R1', customer_id=1001, report_date=date(2026, 10, 7))


def home():
    p = PLAN_DETAIL['primary_indicator']
    return {'report_code': 'R1', 'report_date': '2026-10-07', 'systems': [{
        'system_code': p['system_code'], 'name': p['system_name'],
        'indicators': [{'indicator_code': p['indicator_code'], 'name': p['indicator_name'], 'score': p['indicator_score']}],
        'recommendation': {'plan_id': 999},
    }]}


@pytest.mark.asyncio
async def test_plan_source_is_explicit_and_does_not_expose_products(monkeypatch):
    build = AsyncMock(return_value={**PLAN_DETAIL, 'product_ids': [30], 'private': 'never'})
    monkeypatch.setattr(sources, '_report_view_service', lambda: SimpleNamespace(build_plan_context=build))
    data = await sources.read_report_tool(None, scope(), 'plan_context', indicator_code='SYS_BONE_OSTEO', plan_id=17)
    assert data['plan_id'] == 17
    assert data['indicator_score'] == 98
    assert 'products' not in data and 'product_ids' not in data and 'private' not in data
    assert isinstance(build.call_args.args[0], sources.ReadOnlyReportSession)
    with pytest.raises(sources.ReadBoundaryViolation):
        await sources.read_report_tool(None, scope(), 'plan_context', plan_id=17)


@pytest.mark.asyncio
async def test_non_displayed_plan_remains_valid_but_stale_and_conflicting_plans_do_not():
    data = {**PLAN_DETAIL['primary_indicator'], 'report_code': 'R1', 'plan_id': 17,
            'plan_name': '已维护测试方案', 'description': '公开说明'}
    reader = AsyncMock(return_value=data)
    result = await context.resolve_current_entry_context(None, scope(), home(), plan_id=17, indicator_code='SYS_BONE_OSTEO', reader=reader)
    assert result['type'] == 'plan' and result['plan_id'] == 17
    reader.return_value = {**data, 'indicator_score': 97}
    assert (await context.resolve_current_entry_context(None, scope(), home(), plan_id=17, indicator_code='SYS_BONE_OSTEO', reader=reader))['stale_plan']
    reader.return_value = {}
    assert (await context.resolve_current_entry_context(None, scope(), home(), plan_id=17, indicator_code='SYS_BONE_OSTEO', reader=reader))['type'] == 'indicator'


@pytest.mark.asyncio
async def test_each_answer_revalidates_plan_and_stale_plan_does_not_call_provider():
    from app.services.ai_consult_pipeline import prepare_answer_candidate
    from tests.api.test_ai_consult_plan_context import Provider
    live = {**PLAN_DETAIL['primary_indicator'], 'report_code': 'R1', 'plan_id': 17, 'plan_name': '已维护测试方案', 'description': '公开说明'}
    async def reader(db, bound, tool_name, *, indicator_code=None, plan_id=None):
        if tool_name == 'home':
            return home()
        if tool_name == 'plan_context':
            return live
        return {'report_code': 'R1', 'system': {'system_code': 'SYS_BONE'},
                'indicator': {'indicator_code': 'SYS_BONE_OSTEO', 'name': '骨质疏松', 'score': 98}}
    provider = Provider()
    result = await prepare_answer_candidate(None, scope(), '为什么给我推荐这个方案？', reader=reader, provider=provider,
                                            requested_plan_id=17, requested_indicator_code='SYS_BONE_OSTEO')
    assert result.state == 'reviewed_candidate'
    assert len(provider.calls) == 1
    live = {}
    await prepare_answer_candidate(None, scope(), '为什么给我推荐这个方案？', reader=reader, provider=provider,
                                   requested_plan_id=17, requested_indicator_code='SYS_BONE_OSTEO')
    assert len(provider.calls) == 1
