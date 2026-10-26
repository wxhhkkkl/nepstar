"""Isolated report-plan ASGI contract; no app.main, engine connection or guest."""
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
import pytest

from app.api import report_view
from app.database import get_db
from app.services import report_view_service as svc, report_source
from tests.fixtures.plan_detail import PLAN_DETAIL


@pytest.mark.asyncio
async def test_public_plan_endpoint_validates_identity_and_errors_without_admin_auth():
    app = FastAPI()
    app.include_router(report_view.router, prefix='/api/v1')
    async def fake_db():
        yield None
    app.dependency_overrides[get_db] = fake_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        url = '/api/v1/report-view/R1/plans/17'
        assert (await client.get(url)).status_code == 422
        with patch.object(svc, 'build_plan_detail', AsyncMock(return_value=PLAN_DETAIL)) as build:
            response = await client.get(url + '?customer_id=1001&indicator_code=SYS_BONE_OSTEO')
            assert response.status_code == 200
            assert response.json()['data']['plan']['plan_id'] == 17
            assert response.headers['cache-control'] == 'no-store'
            build.assert_awaited_once_with(None, 'R1', 17, 1001, 'SYS_BONE_OSTEO')
        for error, code, message in [(svc.ReportPlanNotFoundError(), 404, 'report.plan_not_found'),
                                     (svc.ReportNotReadyError(), 409, 'report.not_ready'),
                                     (report_source.ReportSourceUnavailableError('private connection'), 503, 'report.unavailable')]:
            with patch.object(svc, 'build_plan_detail', AsyncMock(side_effect=error)):
                response = await client.get(url + '?customer_id=1001')
                assert response.json()['code'] == code
                assert response.json()['message'] == message
                assert 'private' not in response.text
        assert (await client.get('/api/v1/report-view/R1/plans/0?customer_id=1001')).status_code == 422
