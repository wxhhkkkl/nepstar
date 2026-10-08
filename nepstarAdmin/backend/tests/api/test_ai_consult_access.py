"""仅在隔离的 FastAPI 应用中测试匿名入口；不导入旧库公共夹具。"""

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.api import ai_consult
from app.config import settings


class FakeWriteSession:
    def __init__(self):
        self.rows = []
        self.commits = 0

    def add(self, row):
        self.rows.append(row)

    async def commit(self):
        self.commits += 1

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeReadSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.fixture
def isolated_app(monkeypatch):
    app = FastAPI()
    app.include_router(ai_consult.router, prefix="/api/v1")
    write_db = FakeWriteSession()
    monkeypatch.setattr(ai_consult, "async_session", FakeReadSession)
    monkeypatch.setattr(ai_consult, "get_ai_consult_sessionmaker", lambda: lambda: write_db)
    monkeypatch.setattr(settings, "AI_CONSULT_GUEST_ENABLED", True)
    monkeypatch.setattr(settings, "AI_CONSULT_TOKEN_HMAC_KEY", "test-only-hmac-key-" * 3)
    verify = AsyncMock()
    monkeypatch.setattr(ai_consult, "verify_public_report", verify)
    return app, write_db, verify


@pytest.mark.asyncio
async def test_two_visitors_of_one_public_report_receive_distinct_private_contexts(isolated_app):
    app, write_db, verify = isolated_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.post("/api/v1/ai-consult/guest-contexts", json={"report_code": "R1", "customer_id": 1001})
        second = await client.post("/api/v1/ai-consult/guest-contexts", json={"report_code": "R1", "customer_id": 1001})

    assert first.status_code == second.status_code == 200
    first_data, second_data = first.json()["data"], second.json()["data"]
    assert first_data["guest_token"] != second_data["guest_token"]
    assert first_data["report_code"] == second_data["report_code"] == "R1"
    assert len(write_db.rows) == write_db.commits == 2
    assert write_db.rows[0].token_digest != write_db.rows[1].token_digest
    assert verify.await_count == 2
    assert first.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_invalid_public_report_does_not_create_a_guest(isolated_app):
    app, write_db, verify = isolated_app
    verify.side_effect = HTTPException(status_code=404, detail="consult.report_unavailable")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/ai-consult/guest-contexts", json={"report_code": "R2", "customer_id": 9999})

    assert response.status_code == 404
    assert response.json()["message"] == "consult.report_unavailable"
    assert response.json()["data"] is None
    assert write_db.rows == []


@pytest.mark.asyncio
async def test_guest_issuance_is_disabled_by_default_or_without_a_secret(isolated_app, monkeypatch):
    app, write_db, verify = isolated_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        monkeypatch.setattr(settings, "AI_CONSULT_GUEST_ENABLED", False)
        disabled = await client.post("/api/v1/ai-consult/guest-contexts", json={"report_code": "R1", "customer_id": 1001})
        monkeypatch.setattr(settings, "AI_CONSULT_GUEST_ENABLED", True)
        monkeypatch.setattr(settings, "AI_CONSULT_TOKEN_HMAC_KEY", "")
        no_secret = await client.post("/api/v1/ai-consult/guest-contexts", json={"report_code": "R1", "customer_id": 1001})

    assert disabled.status_code == no_secret.status_code == 503
    assert disabled.json()["message"] == no_secret.json()["message"] == "consult.disabled"
    assert write_db.rows == []
    assert verify.await_count <= 1
