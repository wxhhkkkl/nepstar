"""HTTP RBAC contracts with actual SQL on SQLite memory, never production DBs.

Only get_db/storage dependencies are replaced. JWT verification, user/role/menu
filters, precise route permissions, handlers and response encoding run normally.
This is not a MySQL locking or deployment integration test.
"""

import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Integer, MetaData, create_engine, select
from sqlalchemy.orm import Session

from app.api import ai_consult_admin, auth, roles, users
from app.config import settings
from app.database import get_db
from app.models.new.sa_ai_consult import (
    SAAiConsultAdminAudit, SAAiConsultRuleVersion, SAAiConsultSettings,
    SAAiConsultGuest, SAAiConsultConsent, SAAiConsultSession,
    SAAiConsultTurn, SAAiConsultGeneration,
)
from app.models.new.sa_junctions import SARoleMenu, SAUserRole
from app.models.new.sa_menu import SAMenu
from app.models.new.sa_role import SARole
from app.models.new.sa_user import SAUser
from app.security.jwt import create_token
from app.services.ai_consult_rules import rule_content_hash


class MemorySession:
    """Small async facade over SQLite; SQL itself is not mocked."""

    def __init__(self, session):
        self.session = session
        self.queries = []

    async def execute(self, statement):
        self.queries.append(statement)
        return self.session.execute(statement)

    async def scalar(self, statement):
        self.queries.append(statement)
        return self.session.scalar(statement)

    async def get(self, entity, key):
        self.queries.append(entity)
        return self.session.get(entity, key)

    def add(self, row):
        self.session.add(row)

    async def flush(self):
        self.session.flush()

    async def commit(self):
        self.session.commit()

    @asynccontextmanager
    async def begin(self):
        with self.session.begin():
            yield


@pytest.fixture
def admin_app(monkeypatch):
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "isolated-rbac-test-key-not-production-" * 2)
    monkeypatch.setattr(settings, "AI_CONSULT_PROVIDER_API_KEY", "secret-must-never-be-returned")
    # Literal SQLite memory URL, no application connection URL or startup hooks.
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.exec_driver_sql("ATTACH DATABASE ':memory:' AS nepstar")
        metadata = MetaData()
        for model in (SAUser, SARole, SAMenu, SAUserRole, SARoleMenu,
                      SAAiConsultSettings, SAAiConsultRuleVersion, SAAiConsultAdminAudit,
                      SAAiConsultGuest, SAAiConsultConsent, SAAiConsultSession,
                      SAAiConsultTurn, SAAiConsultGeneration):
            table = model.__table__.to_metadata(metadata)
            # SQLite's generated primary keys require INTEGER, not BIGINT.
            if model is not SAAiConsultSession:
                table.c.id.type = Integer()
        metadata.create_all(connection)
    with Session(engine) as db:
        db.add(SAUser(id=7, username="operator", password="unused", real_name="Operator",
                      status=1, created_by=1))
        db.add(SARole(id=12, role_code="operator", role_name="Operator", status=1))
        db.add(SAUserRole(id=1, user_id=7, role_id=12))
        for menu_id, path in ((10, "/health"), (41, "/health/ai-consult-settings"),
                              (42, "/health/ai-consult-overview"), (43, "/unrelated")):
            db.add(SAMenu(id=menu_id, parent_id=None if menu_id == 10 else 10,
                          route_path=path, status=1, name_zh=path, name_en=path,
                          name_es=path, sort_order=menu_id))
        db.add(SARoleMenu(id=1, role_id=12, menu_id=41, actions="view"))
        db.add(SAAiConsultSettings(
            id=1, enabled=False, provider_code="openai_compatible", model_code="test-model",
            daily_success_limit=20, per_minute_limit=5, global_daily_token_limit=100000,
            max_concurrent_generations=2, max_question_chars=500, retention_days=30,
            active_rule_version_id=None, row_version=1, updated_at=datetime(2026, 10, 9),
        ))
        content = "Explain clearly without diagnosing or prescribing."
        db.add(SAAiConsultRuleVersion(
            id=3, version="rbac-v1", status="draft", content=content,
            content_hash=rule_content_hash(content), created_by=7, created_at=datetime(2026, 10, 9),
        ))
        db.commit()

    storage_requests = []

    async def memory_auth_db():
        with Session(engine, expire_on_commit=False) as db:
            yield MemorySession(db)

    async def memory_storage_db():
        with Session(engine, expire_on_commit=False) as db:
            adapter = MemorySession(db)
            storage_requests.append(adapter)
            yield adapter

    app = FastAPI()
    for router in (ai_consult_admin.router, auth.router, roles.router, users.router):
        app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_db] = memory_auth_db
    app.dependency_overrides[ai_consult_admin.get_admin_settings_db] = memory_storage_db
    yield app, engine, storage_requests, {"Authorization": f"Bearer {create_token(7, 'operator')}"}
    engine.dispose()


ENDPOINTS = [
    ("GET", "/settings", None, "view"),
    ("PUT", "/settings", {"expected_row_version": 1}, "edit"),
    ("PUT", "/service-state", {"expected_row_version": 1, "enabled": False}, "edit"),
    ("GET", "/rules", None, "view"),
    ("GET", "/rules/3", None, "view"),
    ("GET", "/audit", None, "view"),
    ("GET", "/operations", None, "overview"),
    ("GET", "/dashboard", None, "overview"),
    ("GET", "/sessions", None, "overview"),
    ("GET", "/sessions/00000000-0000-4000-8000-000000000001", None, "conversation"),
    ("POST", "/rules", {"version": "rbac-v2", "content": "Use plain language."}, "edit"),
    ("POST", "/rules/3/publish", {"expected_row_version": 1}, "publish"),
    ("POST", "/rules/3/activate", {"expected_row_version": 1}, "publish"),
]


def allow_service_control(monkeypatch, engine):
    for flag in ("GUEST_ENABLED", "SESSIONS_ENABLED", "ANSWERS_ENABLED", "OPERATIONS_READY"):
        monkeypatch.setattr(settings, f"AI_CONSULT_{flag}", None)
    monkeypatch.setattr(settings, "AI_CONSULT_TOKEN_HMAC_KEY", "test-only-token-key-" * 3)
    monkeypatch.setattr(ai_consult_admin, "default_provider", type("Provider", (), {
        "available": True, "provider_code": "openai_compatible", "model_code": "test-model",
    })())
    with Session(engine) as db:
        db.get(SARoleMenu, 1).actions = "view,edit"
        db.get(SAAiConsultSettings, 1).guest_create_limit_per_minute = 20
        db.commit()


@pytest.mark.asyncio
async def test_service_switch_opens_pauses_and_audits_without_changing_other_settings(admin_app, monkeypatch):
    app, engine, _, headers = admin_app
    allow_service_control(monkeypatch, engine)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        initial = await client.get("/api/v1/ai-consult/admin/settings", headers=headers)
        assert initial.json()["data"]["runtime"]["can_enable"] is True
        opened = await client.put("/api/v1/ai-consult/admin/service-state", headers=headers,
                                  json={"expected_row_version": 1, "enabled": True})
        paused = await client.put("/api/v1/ai-consult/admin/service-state", headers=headers,
                                  json={"expected_row_version": 2, "enabled": False})
    assert opened.status_code == paused.status_code == 200
    assert opened.json()["data"]["settings"]["enabled"] is True
    assert paused.json()["data"]["settings"]["enabled"] is False
    assert paused.json()["data"]["settings"]["row_version"] == 3
    with Session(engine) as db:
        config = db.get(SAAiConsultSettings, 1)
        assert config.daily_success_limit == 20 and config.model_code == "test-model"
        audits = db.scalars(select(SAAiConsultAdminAudit).order_by(SAAiConsultAdminAudit.id)).all()
        assert [a.action for a in audits] == ["service.resume", "service.pause"]
        assert all(a.actor_admin_id == 7 and a.target_id == "1" for a in audits)
    assert "secret-must-never-be-returned" not in paused.text


@pytest.mark.asyncio
async def test_pause_works_even_with_broken_provider_and_deployment_disabled(admin_app, monkeypatch):
    app, engine, _, headers = admin_app
    allow_service_control(monkeypatch, engine)
    monkeypatch.setattr(settings, "AI_CONSULT_ANSWERS_ENABLED", False)
    monkeypatch.setattr(ai_consult_admin.default_provider, "available", False)
    with Session(engine) as db:
        db.get(SAAiConsultSettings, 1).enabled = True
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        paused = await client.put("/api/v1/ai-consult/admin/service-state", headers=headers,
                                  json={"expected_row_version": 1, "enabled": False})
        blocked = await client.put("/api/v1/ai-consult/admin/service-state", headers=headers,
                                   json={"expected_row_version": 2, "enabled": True})
    assert paused.status_code == 200
    assert blocked.status_code == 409
    assert blocked.json()["message"] == "consult.admin_activation_blocked"
    assert "部署" in blocked.json()["data"]["detail"]
    with Session(engine) as db:
        assert db.get(SAAiConsultSettings, 1).enabled is False
        assert db.get(SAAiConsultSettings, 1).row_version == 2


@pytest.mark.asyncio
async def test_stale_control_cannot_override_another_admin_and_retry_is_idempotent(admin_app, monkeypatch):
    app, engine, _, headers = admin_app
    allow_service_control(monkeypatch, engine)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        opened = await client.put("/api/v1/ai-consult/admin/service-state", headers=headers,
                                  json={"expected_row_version": 1, "enabled": True})
        stale = await client.put("/api/v1/ai-consult/admin/service-state", headers=headers,
                                 json={"expected_row_version": 1, "enabled": False})
        retry = await client.put("/api/v1/ai-consult/admin/service-state", headers=headers,
                                 json={"expected_row_version": 2, "enabled": True})
    assert opened.status_code == retry.status_code == 200 and stale.status_code == 409
    assert retry.json()["data"]["settings"]["row_version"] == 2
    with Session(engine) as db:
        assert len(db.scalars(select(SAAiConsultAdminAudit)).all()) == 1


@pytest.mark.asyncio
async def test_quota_save_does_not_turn_an_enabled_service_off(admin_app, monkeypatch):
    app, engine, _, headers = admin_app
    allow_service_control(monkeypatch, engine)
    with Session(engine) as db:
        db.get(SAAiConsultSettings, 1).enabled = True
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        saved = await client.put("/api/v1/ai-consult/admin/settings", headers=headers, json={
            "expected_row_version": 1, "enabled": True, "max_question_chars": 200,
        })
    assert saved.status_code == 200
    assert saved.json()["data"]["settings"]["enabled"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid", ["false", 0, None])
async def test_service_control_requires_strict_boolean(admin_app, monkeypatch, invalid):
    app, engine, _, headers = admin_app
    allow_service_control(monkeypatch, engine)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put("/api/v1/ai-consult/admin/service-state", headers=headers,
                                    json={"expected_row_version": 1, "enabled": invalid})
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path,payload,action", ENDPOINTS)
async def test_wrong_page_or_action_never_reaches_consult_storage(admin_app, method, path, payload, action):
    app, engine, storage, headers = admin_app
    with Session(engine) as db:
        grant = db.get(SARoleMenu, 1)
        grant.actions = "edit" if action in ("view", "overview") else "view"
        # All actions on an unrelated menu must not authorize an AI endpoint.
        db.add(SARoleMenu(id=2, role_id=12, menu_id=43, actions="view,edit,publish"))
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.request(method, f"/api/v1/ai-consult/admin{path}", json=payload, headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "consult.admin_forbidden"
    assert storage == []


@pytest.mark.asyncio
@pytest.mark.parametrize("blocked", ["user", "locked", "role", "admin_role", "menu", "no_role"])
async def test_inactive_accounts_roles_or_menus_cannot_publish(admin_app, blocked):
    app, engine, storage, headers = admin_app
    with Session(engine) as db:
        db.get(SARoleMenu, 1).actions = "view,edit,publish"
        if blocked == "user":
            db.get(SAUser, 7).status = 0
        elif blocked == "locked":
            db.get(SAUser, 7).locked_until = datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=5)
        elif blocked in ("role", "admin_role"):
            db.get(SARole, 12).status = 0
            if blocked == "admin_role":
                db.get(SARole, 12).role_code = "admin"
        elif blocked == "menu":
            db.get(SAMenu, 41).status = 0
        else:
            db.delete(db.get(SAUserRole, 1))
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/ai-consult/admin/rules/3/publish",
                                     json={"expected_row_version": 1}, headers=headers)
    assert response.status_code == (401 if blocked == "user" else 423 if blocked == "locked" else 403)
    assert storage == []


@pytest.mark.asyncio
async def test_settings_response_hides_secret_and_wrong_quota_stays_unmodified(admin_app):
    app, engine, _, headers = admin_app
    with Session(engine) as db:
        db.get(SARoleMenu, 1).actions = "view,edit"
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/ai-consult/admin/settings", headers=headers)
        invalid = await client.put("/api/v1/ai-consult/admin/settings", headers=headers,
                                   json={"expected_row_version": 1, "daily_success_limit": None})
    assert response.status_code == 200
    assert response.json()["data"]["runtime"]["provider_secret_configured"] is True
    assert "secret-must-never-be-returned" not in response.text
    assert invalid.status_code == 422
    with Session(engine) as db:
        assert db.get(SAAiConsultSettings, 1).daily_success_limit == 20
        assert db.get(SAAiConsultSettings, 1).row_version == 1
        assert db.scalars(select(SAAiConsultAdminAudit)).all() == []


@pytest.mark.asyncio
async def test_publisher_publishes_with_audit_but_cannot_edit_settings(admin_app):
    app, engine, _, headers = admin_app
    with Session(engine) as db:
        db.get(SARoleMenu, 1).actions = "view,publish"
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        published = await client.post("/api/v1/ai-consult/admin/rules/3/publish", headers=headers,
                                      json={"expected_row_version": 1})
        edit = await client.put("/api/v1/ai-consult/admin/settings", headers=headers,
                                json={"expected_row_version": 2})
        audit = await client.get("/api/v1/ai-consult/admin/audit", headers=headers)
    assert published.status_code == 200
    assert edit.status_code == 403
    assert audit.status_code == 200
    assert audit.json()["data"]["entries"][0]["action"] == "rule.publish"
    with Session(engine) as db:
        assert db.get(SAAiConsultSettings, 1).enabled is False
        assert db.get(SAAiConsultSettings, 1).active_rule_version_id == 3
        assert db.get(SAAiConsultRuleVersion, 3).published_by == 7
        assert len(db.scalars(select(SAAiConsultAdminAudit)).all()) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("path,payload", [
    ("/roles/12", {"role_name": "operator", "menu_permissions": [{"menu_id": 41, "actions": "view,publish"}]}),
    ("/users/7", {"role_ids": [12]}),
])
async def test_operator_cannot_self_grant_role_or_user_permissions(admin_app, path, payload):
    app, engine, _, headers = admin_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put(f"/api/v1{path}", json=payload, headers=headers)
    assert response.status_code == 403
    with Session(engine) as db:
        assert db.get(SARoleMenu, 1).actions == "view"


@pytest.mark.asyncio
async def test_auth_me_actions_match_api_permissions_with_whitespace_and_duplicates(admin_app):
    app, engine, _, headers = admin_app
    with Session(engine) as db:
        db.get(SARoleMenu, 1).actions = " view , publish ,view, ,publish "
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        profile = await client.get("/api/v1/auth/me", headers=headers)
        config = await client.get("/api/v1/ai-consult/admin/settings", headers=headers)
    assert profile.status_code == config.status_code == 200
    assert profile.json()["data"]["permissions"] == {"41": ["view", "publish"]}
    assert profile.json()["data"]["menus"][0]["children"][0]["route_path"] == "/health/ai-consult-settings"


@pytest.mark.asyncio
async def test_revoking_permission_takes_effect_for_existing_jwt(admin_app):
    app, engine, storage, headers = admin_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        before = await client.get("/api/v1/ai-consult/admin/settings", headers=headers)
        with Session(engine) as db:
            db.get(SARoleMenu, 1).actions = ""
            db.commit()
        storage.clear()
        after = await client.get("/api/v1/ai-consult/admin/settings", headers=headers)
    assert before.status_code == 200
    assert after.status_code == 403
    assert storage == []


@pytest.mark.asyncio
async def test_conflicting_publish_rolls_back_without_rule_or_audit_changes(admin_app):
    app, engine, _, headers = admin_app
    with Session(engine) as db:
        db.get(SARoleMenu, 1).actions = "view,publish"
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/ai-consult/admin/rules/3/publish", headers=headers,
                                     json={"expected_row_version": 0})
    assert response.status_code == 409
    with Session(engine) as db:
        assert db.get(SAAiConsultRuleVersion, 3).status == "draft"
        assert db.get(SAAiConsultSettings, 1).row_version == 1
        assert db.scalars(select(SAAiConsultAdminAudit)).all() == []


@pytest.mark.asyncio
async def test_active_admin_role_can_publish_without_menu_grant(admin_app):
    app, engine, _, headers = admin_app
    with Session(engine) as db:
        db.get(SARole, 12).role_code = "admin"
        db.delete(db.get(SARoleMenu, 1))
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/ai-consult/admin/rules/3/publish", headers=headers,
                                     json={"expected_row_version": 1})
    assert response.status_code == 200
    with Session(engine) as db:
        audit = db.scalars(select(SAAiConsultAdminAudit)).one()
        assert audit.actor_admin_id == 7
        assert "from_rule_version_id" in json.loads(audit.change_summary_json)


@pytest.mark.asyncio
@pytest.mark.parametrize("authorization", [None, "Bearer report-bound-token-not-admin-jwt"])
async def test_public_report_access_does_not_authorize_admin_endpoints(admin_app, authorization):
    app, _, storage, _ = admin_app
    headers = {"Authorization": authorization} if authorization else {}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/ai-consult/admin/settings", headers=headers)
    assert response.status_code in (401, 403)
    assert storage == []


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path,payload,action", [
    ("GET", "/settings", None, "preview"),
    ("PUT", "/settings", {"expected_row_version": 1}, "superedit"),
    ("POST", "/rules/3/publish", {"expected_row_version": 1}, "republish"),
])
async def test_action_substrings_do_not_grant_access(admin_app, method, path, payload, action):
    app, engine, storage, headers = admin_app
    with Session(engine) as db:
        db.get(SARoleMenu, 1).actions = action
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.request(method, f"/api/v1/ai-consult/admin{path}", json=payload, headers=headers)
    assert response.status_code == 403
    assert storage == []


@pytest.mark.asyncio
async def test_multiple_active_roles_merge_actions_and_inactive_role_loses_publish(admin_app):
    app, engine, _, headers = admin_app
    with Session(engine) as db:
        db.add(SARole(id=13, role_code="publisher", role_name="Publisher", status=1))
        db.add(SAUserRole(id=2, user_id=7, role_id=13))
        db.add(SARoleMenu(id=2, role_id=13, menu_id=41, actions="publish,view"))
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        profile = await client.get("/api/v1/auth/me", headers=headers)
        assert profile.json()["data"]["permissions"] == {"41": ["view", "publish"]}
        with Session(engine) as db:
            db.get(SARole, 13).status = 0
            db.commit()
        inactive_profile = await client.get("/api/v1/auth/me", headers=headers)
        denied = await client.post("/api/v1/ai-consult/admin/rules/3/publish", headers=headers,
                                   json={"expected_row_version": 1})
    assert inactive_profile.json()["data"]["permissions"] == {"41": ["view"]}
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_editor_saves_draft_and_viewer_reads_it_without_publishing(admin_app):
    app, engine, _, headers = admin_app
    with Session(engine) as db:
        db.get(SARoleMenu, 1).actions = "view,edit"
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/ai-consult/admin/rules", headers=headers,
                                    json={"version": "rbac-v2", "content": "Use plain language."})
        assert created.status_code == 200
        rule_id = created.json()["data"]["id"]
        listed = await client.get("/api/v1/ai-consult/admin/rules", headers=headers)
        detail = await client.get(f"/api/v1/ai-consult/admin/rules/{rule_id}", headers=headers)
        denied = await client.post(f"/api/v1/ai-consult/admin/rules/{rule_id}/publish", headers=headers,
                                   json={"expected_row_version": 1})
    assert listed.status_code == detail.status_code == 200
    assert detail.json()["data"]["content"] == "Use plain language."
    assert all("content" not in rule for rule in listed.json()["data"]["rules"])
    assert denied.status_code == 403
    with Session(engine) as db:
        assert db.get(SAAiConsultRuleVersion, rule_id).status == "draft"
        assert db.scalars(select(SAAiConsultAdminAudit)).one().action == "rule.draft_create"


@pytest.mark.asyncio
async def test_http_settings_save_audits_changes_without_enabling_service(admin_app):
    app, engine, _, headers = admin_app
    with Session(engine) as db:
        db.get(SARoleMenu, 1).actions = "view,edit"
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        enabled = await client.put("/api/v1/ai-consult/admin/settings", headers=headers,
                                   json={"expected_row_version": 1, "enabled": True})
        saved = await client.put("/api/v1/ai-consult/admin/settings", headers=headers,
                                 json={"expected_row_version": 1, "max_question_chars": 200})
    assert enabled.status_code == 409
    assert enabled.json()["message"] == "consult.admin_activation_blocked"
    assert saved.status_code == 200
    assert saved.json()["data"]["settings"]["max_question_chars"] == 200
    assert "secret-must-never-be-returned" not in saved.text
    with Session(engine) as db:
        assert db.get(SAAiConsultSettings, 1).enabled is False
        audit = db.scalars(select(SAAiConsultAdminAudit)).one()
        assert "max_question_chars" in json.loads(audit.change_summary_json)["changed_fields"]
