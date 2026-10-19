"""候选欢迎页契约：纯内存报告与 nepstar 替身，不导入公共数据库夹具。"""

import hashlib
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.api import ai_consult
from app.config import settings
from app.models.new.sa_ai_consult import SAAiConsultConsent
from app.security.ai_consult_access import build_guest_context
from app.services.ai_consult_consent import public_data_scope_text


class FakeSession:
    def __init__(self, guest, policy, latest_consent=None):
        self.guest = guest
        self.policy = policy
        self.latest_consent = latest_consent
        self.statements = []
        self.added = []

    async def execute(self, statement):
        self.statements.append(statement)
        query = str(statement)
        if "sa_ai_consult_settings" in query:
            value = self.policy
        elif "sa_ai_consult_consent" in query:
            value = self.latest_consent
        else:
            value = self.guest
        return SimpleNamespace(scalar_one_or_none=lambda: value)

    def add(self, row):
        self.added.append(row)

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
def bootstrap_app(monkeypatch):
    monkeypatch.setattr(settings, "AI_CONSULT_GUEST_ENABLED", True)
    monkeypatch.setattr(settings, "AI_CONSULT_OPERATIONS_READY", True)
    monkeypatch.setattr(settings, "AI_CONSULT_SESSIONS_ENABLED", False)
    monkeypatch.setattr(settings, "AI_CONSULT_ANSWERS_ENABLED", False)
    monkeypatch.setattr(settings, "AI_CONSULT_TOKEN_HMAC_KEY", "bootstrap-test-hmac-key-" * 3)
    token, guest = build_guest_context("R-REAL", 1001, now=datetime(2026, 10, 8, 12, 0))
    guest.id = 7
    scope = "仅使用当前报告指标和本次问题。"
    policy = SimpleNamespace(
        enabled=True,
        provider_code="fake-provider",
        model_code="fake-model",
        notice_version="v1",
        notice_text="告知测试正文。",
        data_scope_text=scope,
        data_scope_hash=hashlib.sha256(scope.encode()).hexdigest(),
        max_question_chars=250,
    )
    write_db = FakeSession(guest, policy)
    report_home = {
        "report": {
            "report_code": "R-REAL",
            "report_date": "2026-10-08",
            "total_score": 82,
            "serial_number": "private-serial-must-not-copy",
        },
        "systems": [
            {"system_code": "SYS_LUNG", "name": "肺功能", "score": 80},
            {"system_code": "SYS_CARDIO", "name": "心血管", "score": 91},
        ],
    }
    loader = AsyncMock(return_value=report_home)
    monkeypatch.setattr(ai_consult, "async_session", FakeReadSession)
    monkeypatch.setattr(ai_consult, "get_ai_consult_sessionmaker", lambda: lambda: write_db)
    monkeypatch.setattr(ai_consult, "load_public_report_home", loader, raising=False)
    app = FastAPI()
    app.include_router(ai_consult.router, prefix="/api/v1")
    return app, token, write_db, loader


@pytest.mark.asyncio
async def test_bootstrap_uses_bound_report_without_exposing_a_required_consent_step(bootstrap_app):
    app, token, write_db, loader = bootstrap_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get(
            "/api/v1/ai-consult/bootstrap?report_code=R-REAL",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert result.status_code == 200
    data = result.json()["data"]
    assert data["report_date"] == "2026-10-08"
    assert data["report_summary"] == "本次报告总分 82 分，展示 2 个身体系统。"
    assert data["report_score"] == 82
    assert data["focus_systems"] == [{"name": "肺功能", "score": 80}, {"name": "心血管", "score": 91}]
    assert data["management_plans"] == []
    assert len(data["suggested_questions"]) == 3
    assert "肺功能" in data["suggested_questions"][0]
    assert "notice" not in data
    assert "consent_status" not in data
    assert data["service_status"] == "unavailable"
    assert data["remaining_today"] is None
    assert data["max_question_chars"] == 250
    assert "private-serial" not in str(data)
    assert "customer_id" not in data
    assert result.headers["cache-control"] == "no-store"
    loader.assert_awaited_once()
    assert loader.await_args.args[1:] == ("R-REAL", 1001)
    assert write_db.added == []


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [None, True, -1, 501, "250"])
async def test_bootstrap_question_limit_has_safe_legacy_fallback(bootstrap_app, limit):
    app, token, write_db, _ = bootstrap_app
    write_db.policy.max_question_chars = limit
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get(
            "/api/v1/ai-consult/bootstrap?report_code=R-REAL",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert result.status_code == 200
    assert result.json()["data"]["max_question_chars"] == 500


@pytest.mark.asyncio
async def test_bootstrap_preserves_zero_as_unlimited_question_length(bootstrap_app):
    app, token, write_db, _ = bootstrap_app
    write_db.policy.max_question_chars = 0
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get(
            "/api/v1/ai-consult/bootstrap?report_code=R-REAL",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert result.status_code == 200
    assert result.json()["data"]["max_question_chars"] == 0


@pytest.mark.asyncio
async def test_bootstrap_rejects_other_report_and_missing_or_expired_guest(bootstrap_app):
    app, token, write_db, loader = bootstrap_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        missing = await client.get("/api/v1/ai-consult/bootstrap?report_code=R-REAL")
        other = await client.get(
            "/api/v1/ai-consult/bootstrap?report_code=R-OTHER",
            headers={"Authorization": f"Bearer {token}"},
        )
        write_db.guest.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
        expired = await client.get(
            "/api/v1/ai-consult/bootstrap?report_code=R-REAL",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert missing.status_code == 401
    assert other.status_code == expired.status_code == 403
    loader.assert_not_awaited()


@pytest.mark.asyncio
async def test_bootstrap_fails_closed_when_report_source_unavailable(bootstrap_app):
    app, token, _, loader = bootstrap_app
    loader.side_effect = HTTPException(status_code=503, detail="consult.report_unavailable")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get(
            "/api/v1/ai-consult/bootstrap?report_code=R-REAL",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert result.status_code == 503
    assert result.json()["data"] is None


@pytest.mark.asyncio
async def test_bootstrap_respects_a_legacy_withdrawal_without_requiring_a_consent_row(bootstrap_app, monkeypatch):
    app, token, write_db, _ = bootstrap_app
    monkeypatch.setattr(settings, "AI_CONSULT_SESSIONS_ENABLED", True)
    monkeypatch.setattr(settings, "AI_CONSULT_ANSWERS_ENABLED", True)
    monkeypatch.setattr(ai_consult, "answer_provider", SimpleNamespace(
        available=True, provider_code="fake-provider", model_code="fake-model",
    ))
    monkeypatch.setattr(ai_consult, "remaining_daily_successes", AsyncMock(return_value=20))
    write_db.policy.daily_success_limit = 20
    grant = SAAiConsultConsent(
        guest_id=7,
        notice_version="v1",
        notice_content_hash=hashlib.sha256("告知测试正文。".encode()).hexdigest(),
        provider_code="fake-provider",
        data_scope_hash=hashlib.sha256(public_data_scope_text(write_db.policy).encode()).hexdigest(),
        choice="granted",
        decided_at=datetime(2026, 10, 8, 12, 0),
    )
    write_db.latest_consent = grant
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        granted = await client.get(
            "/api/v1/ai-consult/bootstrap?report_code=R-REAL",
            headers={"Authorization": f"Bearer {token}"},
        )
        write_db.latest_consent = SAAiConsultConsent(
            guest_id=7,
            notice_version="v1",
            notice_content_hash=grant.notice_content_hash,
            provider_code="fake-provider",
            data_scope_hash=grant.data_scope_hash,
            choice="withdrawn",
            decided_at=datetime(2026, 10, 8, 12, 1),
            withdrawn_at=datetime(2026, 10, 8, 12, 1),
        )
        withdrawn = await client.get(
            "/api/v1/ai-consult/bootstrap?report_code=R-REAL",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert granted.json()["data"]["service_status"] == "available"
    assert withdrawn.json()["data"]["service_status"] == "unavailable"
    assert "consent_status" not in granted.json()["data"]
    write_db.latest_consent = None
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        no_choice = await client.get("/api/v1/ai-consult/bootstrap?report_code=R-REAL", headers={"Authorization": f"Bearer {token}"})
    assert no_choice.json()["data"]["service_status"] == "available"


@pytest.mark.asyncio
async def test_bootstrap_existing_guest_sees_maintenance_without_model_access(bootstrap_app):
    app, token, write_db, _ = bootstrap_app
    write_db.policy.maintenance_text = "  服务维护中，请稍后再试。  "
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get(
            "/api/v1/ai-consult/bootstrap?report_code=R-REAL",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert result.status_code == 200
    assert result.json()["data"]["service_status"] == "maintenance"
    assert result.json()["data"]["maintenance_text"] == "服务维护中，请稍后再试。"


def test_welcome_questions_never_invent_missing_scores_or_systems():
    from app.services.ai_consult_sessions import build_welcome_context

    empty = build_welcome_context({
        "report": {"report_date": "2026-10-08", "total_score": None},
        "systems": [],
    })
    assert len(empty["suggested_questions"]) == 3
    assert empty["report_score"] is None
    assert "None" not in empty["report_summary"] + str(empty["suggested_questions"])
    assert "0 分" not in str(empty)
    assert "肺功能" not in str(empty)

    malformed = build_welcome_context({
        "report": {"report_date": "2026-10-08", "total_score": float("nan")},
        "systems": [{"name": "示例系统", "score": float("nan")}],
    })
    assert "nan" not in str(malformed).lower()
    assert "示例系统" not in str(malformed)


def test_welcome_plans_only_project_current_report_matches():
    from app.services.ai_consult_sessions import build_welcome_context

    system = {
        "system_code": "SYS_LUNG", "name": "肺功能", "score": 84,
        "indicators": [{"indicator_code": "SYS_LUNG_VC", "name": "肺活量", "score": 60}],
        "recommendation": {
            "plan_id": 7, "plan_name": "肺功能健康管理方案",
            "trigger_indicator_code": "SYS_LUNG_VC", "indicator_score": 60,
            "trigger_score_below": 80, "description": "保持适量运动。",
            "products": [{"name": "管理方案", "image_url": "/uploads/plan.png", "private_field": "not-public"}],
        },
    }
    home = {"report": {"total_score": 82}, "systems": [system]}
    data = build_welcome_context(home)
    assert len(data["management_plans"]) == 1
    plan = data["management_plans"][0]
    assert plan["plan_id"] == 7
    assert plan["indicator_name"] == "肺活量"
    assert plan["indicator_score"] == 60
    assert plan["image_url"] == "/uploads/plan.png"
    assert plan["description"] == "保持适量运动。"
    assert "private_field" not in str(data)

    system["recommendation"]["trigger_score_below"] = 60
    assert build_welcome_context(home)["management_plans"] == []
    system["recommendation"]["trigger_score_below"] = 80
    system["recommendation"]["trigger_indicator_code"] = "SYS_CARDIO_LIPID"
    assert build_welcome_context(home)["management_plans"] == []
