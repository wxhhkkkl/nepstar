"""客户拉取：签名、时间戳、区间、分页与响应口径。"""

import json
import time
from unittest.mock import AsyncMock

from httpx import AsyncClient

from app.config import settings
from app.services import report_pull_service
from app.utils.haixin_sign import build_sign

SECRET = "test-secret"
EMPTY_DATA = {
    "records": [],
    "total": 0,
    "page": 1,
    "pageSize": 50,
    "startDate": "2026-11-06",
    "endDate": "2026-11-13",
}


def _params(**overrides):
    params = {
        "appKey": "test",
        "timestamp": str(int(time.time())),
        "version": "1.0",
        "startDate": "2026-11-06",
        "endDate": "2026-11-13",
        "page": "1",
        "pageSize": "50",
    }
    params.update(overrides)
    if "sign" not in overrides:
        params["sign"] = build_sign(params, SECRET)
    return params


def _configure(monkeypatch, result=None, error=None):
    monkeypatch.setattr(
        report_pull_service,
        "resolve_secret",
        lambda app_key: SECRET if app_key == "test" else None,
    )
    handler = AsyncMock(return_value=result or EMPTY_DATA)
    if error is not None:
        handler = AsyncMock(side_effect=error)
    monkeypatch.setattr(report_pull_service, "list_reports_for_partner", handler)
    return handler


async def test_success_returns_string_code_and_json_string(client: AsyncClient, monkeypatch):
    _configure(monkeypatch)
    response = await client.get("/api/v1/open/reports", params=_params())
    body = response.json()
    assert body["code"] == "0"
    assert isinstance(body["data"], str)
    assert json.loads(body["data"])["total"] == 0


async def test_bad_signature_rejected(client: AsyncClient, monkeypatch):
    _configure(monkeypatch)
    params = _params()
    params["endDate"] = "2026-11-14"  # 签名后篡改参数
    response = await client.get("/api/v1/open/reports", params=params)
    assert response.json()["code"] == "401"
    assert response.json()["data"] is None


async def test_expired_timestamp_rejected(client: AsyncClient, monkeypatch):
    _configure(monkeypatch)
    stale = str(int(time.time()) - settings.HAIXIN_SIGN_TOLERANCE_SECONDS - 60)
    response = await client.get(
        "/api/v1/open/reports", params=_params(timestamp=stale)
    )
    assert response.json()["code"] == "401"


async def test_unknown_app_key_rejected(client: AsyncClient, monkeypatch):
    _configure(monkeypatch)
    response = await client.get(
        "/api/v1/open/reports", params=_params(appKey="unknown")
    )
    assert response.json()["code"] == "401"


async def test_range_over_limit_rejected_without_query(client: AsyncClient, monkeypatch):
    handler = _configure(monkeypatch)
    params = _params(startDate="2026-01-01", endDate="2026-11-13")
    response = await client.get("/api/v1/open/reports", params=params)
    assert response.json()["code"] == "400"
    handler.assert_not_awaited()


async def test_data_source_unavailable(client: AsyncClient, monkeypatch):
    _configure(monkeypatch, error=report_pull_service.PullUnavailableError())
    response = await client.get("/api/v1/open/reports", params=_params())
    assert response.json()["code"] == "503"


async def test_page_size_is_capped(client: AsyncClient, monkeypatch):
    handler = _configure(monkeypatch)
    response = await client.get(
        "/api/v1/open/reports", params=_params(pageSize="999")
    )
    assert response.json()["code"] == "0"
    args = handler.await_args.args
    assert args[4] == 100
