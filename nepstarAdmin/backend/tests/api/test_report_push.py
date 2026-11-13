"""后台人工推送、推送记录与重发路由。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.main import app
from app.security.rbac import check_permission
from app.services import report_push_service

RESULT = {"record_id": 9, "status": "success", "failure_reason": None}


@pytest.fixture
def as_admin():
    app.dependency_overrides[check_permission] = lambda: SimpleNamespace(id=1)
    yield
    app.dependency_overrides.pop(check_permission, None)


async def test_manual_push_success(client: AsyncClient, as_admin, monkeypatch):
    handler = AsyncMock(return_value=RESULT)
    monkeypatch.setattr(report_push_service, "manual_push", handler)

    response = await client.post("/api/v1/reports/123/push")

    body = response.json()
    assert body["code"] == 200
    assert body["data"] == RESULT
    handler.assert_awaited_once()


async def test_manual_push_not_found(client: AsyncClient, as_admin, monkeypatch):
    monkeypatch.setattr(
        report_push_service,
        "manual_push",
        AsyncMock(side_effect=report_push_service.ReportNotFoundError()),
    )
    response = await client.post("/api/v1/reports/123/push")
    assert response.json()["code"] == 404


async def test_manual_push_forbidden(client: AsyncClient, as_admin, monkeypatch):
    monkeypatch.setattr(
        report_push_service,
        "manual_push",
        AsyncMock(side_effect=report_push_service.ReportForbiddenError()),
    )
    response = await client.post("/api/v1/reports/123/push")
    assert response.json()["code"] == 403


async def test_manual_push_invalid(client: AsyncClient, as_admin, monkeypatch):
    monkeypatch.setattr(
        report_push_service,
        "manual_push",
        AsyncMock(side_effect=report_push_service.ReportInvalidError()),
    )
    response = await client.post("/api/v1/reports/123/push")
    assert response.json()["code"] == 409


async def test_list_push_records(client: AsyncClient, as_admin, monkeypatch):
    data = {"records": [], "total": 0, "page": 1, "page_size": 20}
    handler = AsyncMock(return_value=data)
    monkeypatch.setattr(report_push_service, "list_push_records", handler)

    response = await client.get(
        "/api/v1/reports/push-records?status=failed&trigger_type=auto&sn=KH503"
    )

    body = response.json()
    assert body["code"] == 200
    assert body["data"] == data
    kwargs = handler.await_args.kwargs
    assert kwargs["status"] == "failed"
    assert kwargs["trigger_type"] == "auto"
    assert kwargs["sn"] == "KH503"


async def test_repush_creates_new_record(client: AsyncClient, as_admin, monkeypatch):
    handler = AsyncMock(return_value=RESULT)
    monkeypatch.setattr(report_push_service, "repush_record", handler)

    response = await client.post("/api/v1/reports/push-records/9/repush")

    body = response.json()
    assert body["code"] == 200
    assert body["data"] == RESULT


async def test_repush_missing_record(client: AsyncClient, as_admin, monkeypatch):
    monkeypatch.setattr(
        report_push_service,
        "repush_record",
        AsyncMock(side_effect=report_push_service.ReportNotFoundError()),
    )
    response = await client.post("/api/v1/reports/push-records/9/repush")
    assert response.json()["code"] == 404
