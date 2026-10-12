"""Local session routing has no real engine, database or provider calls."""

import logging
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Column, Integer, MetaData, Table, delete, insert, select, text, update

from scripts.local_ai_runtime import (
    LocalIsolationError, local_write_url, routed_session_class,
    assert_read_statement, assert_local_write_statement,
    SafeExceptionLog,
    safe_structured_event,
)


@pytest.fixture
def routing():
    metadata = MetaData()
    local = Table("sa_user", metadata, Column("id", Integer), schema="nepstar")
    legacy = Table("inspect_base", metadata, Column("id", Integer))
    writer, reader = object(), object()
    session = routed_session_class(writer, reader)()
    return session, local, legacy, writer, reader


@pytest.mark.parametrize("url", [
    "mysql+aiomysql://root@remote.example:3306/nepstar",
    "mysql+aiomysql://root@localhost:3306/nepstar",
    "mysql+aiomysql://root@127.0.0.1:3306/platform",
    "mysql+aiomysql://root@127.0.0.1:3306/nepstar?host=remote.example",
    "mysql+aiomysql://root@127.0.0.1/nepstar",
    "mysql+pymysql://root@127.0.0.1:3306/nepstar",
])
def test_write_target_is_exact_loopback_nepstar(url):
    with pytest.raises(LocalIsolationError):
        local_write_url(url)


def test_queries_route_by_table_not_the_shared_default_url(routing):
    session, local, legacy, writer, reader = routing
    assert session.get_bind(clause=select(local)) is writer
    assert session.get_bind(clause=select(legacy)) is reader
    assert session.get_bind(mapper=SimpleNamespace(persist_selectable=local)) is writer
    assert session.get_bind(clause=text("SELECT p.id FROM nepstar.sa_plan p")) is writer
    assert session.get_bind(clause=text("SELECT report_code FROM inspect_base")) is reader


@pytest.mark.parametrize("operation", [insert, update, delete])
def test_old_database_dml_is_rejected_before_connection(routing, operation):
    session, local, legacy, writer, _reader = routing
    assert session.get_bind(clause=operation(local)) is writer
    with pytest.raises(LocalIsolationError):
        session.get_bind(clause=operation(legacy))


def test_flush_of_old_mapper_and_cross_instance_join_are_rejected(routing):
    session, local, legacy, _writer, _reader = routing
    session._flushing = True
    with pytest.raises(LocalIsolationError):
        session.get_bind(mapper=SimpleNamespace(persist_selectable=legacy))
    session._flushing = False
    with pytest.raises(LocalIsolationError):
        session.get_bind(clause=select(local.c.id, legacy.c.id))
    with pytest.raises(LocalIsolationError):
        session.get_bind(clause=text("SELECT p.id FROM nepstar.sa_plan p JOIN inspect_base b ON p.id=b.id"))


@pytest.mark.parametrize("sql", [
    "UPDATE inspect_base SET status=1", "DELETE FROM nepstar.sa_user",
    "CREATE TABLE x (id INT)", "CALL some_procedure()", "SET DATABASE=nepstar",
    "SELECT * FROM inspect_base FOR UPDATE", "SELECT 1 INTO OUTFILE :path",
    "SELECT 1; DELETE FROM inspect_base", "/* comment */ UPDATE inspect_base SET status=1",
])
def test_remote_sql_filter_rejects_non_reads(sql):
    with pytest.raises(LocalIsolationError):
        assert_read_statement(sql)


@pytest.mark.parametrize("sql", ["SELECT 1", "SHOW CREATE TABLE inspect_base", "DESCRIBE inspect_base"])
def test_reflection_and_regular_reads_are_allowed(sql):
    assert_read_statement(sql)


def test_writer_filter_allows_only_compiled_nepstar_dml(routing):
    _session, local, legacy, _writer, _reader = routing
    assert_local_write_statement("INSERT INTO nepstar.sa_user (id) VALUES (%s)", insert(local))
    with pytest.raises(LocalIsolationError):
        assert_local_write_statement("INSERT INTO inspect_base (id) VALUES (%s)", insert(legacy))
    with pytest.raises(LocalIsolationError):
        assert_local_write_statement("UPDATE nepstar.sa_user SET id=1", text("UPDATE nepstar.sa_user SET id=1"))


def test_local_error_log_never_keeps_exception_or_sensitive_args():
    record = logging.LogRecord("uvicorn.error", logging.ERROR, "test", 1,
                               "unsafe %s", ("private-value",),
                               (RuntimeError, RuntimeError("private-value"), None))
    assert SafeExceptionLog().filter(record)
    assert record.getMessage() == "local_request_failed"
    assert record.exc_info is record.exc_text is record.stack_info is None


def test_structured_log_drops_report_identifiers_and_other_private_fields():
    sanitized = safe_structured_event(None, "info", {
        "event": "report_view", "duration_ms": 10, "outcome": "not_found",
        "report_code": "PRIVATE-REPORT", "customer_id": 42,
        "question": "private-question", "authorization": "private-key",
    })
    assert sanitized == {"event": "report_view", "duration_ms": 10, "outcome": "not_found"}


def test_report_registry_reads_are_separate_from_local_auth_and_ai_writes(routing):
    _session, local_user, legacy, writer, reader = routing
    registry = object()
    local = Table("sa_indicator", MetaData(), Column("id", Integer), schema="nepstar")
    session = routed_session_class(writer, reader, registry)()
    assert session.get_bind(clause=select(local)) is registry
    assert session.get_bind(clause=select(local_user)) is writer
    assert session.get_bind(clause=select(legacy)) is reader
    assert session.get_bind(clause=insert(local)) is writer
    assert session.get_bind(clause=text("SELECT p.id FROM nepstar.sa_plan p JOIN nepstar.sa_plan_indicator pi ON pi.plan_id=p.id")) is registry
    with pytest.raises(LocalIsolationError):
        session.get_bind(clause=select(local.c.id, local_user.c.id))


@pytest.fixture
def tree_app(monkeypatch):
    from fastapi import APIRouter
    from scripts import local_ai_runtime
    from app import api
    from app.database import get_db
    from app.services import indicator_service

    # 不运行 lifespan、不连接数据库，不启用模型或改变生产开关。
    class EmptyResult:
        def scalars(self):
            return self

        def all(self):
            return []

        def scalar_one_or_none(self):
            return None

    class SessionContext:
        async def __aenter__(self):
            return db

        async def __aexit__(self, *_args):
            return False

    db = SimpleNamespace(execute=AsyncMock(return_value=EmptyResult()), rollback=AsyncMock())
    database = SimpleNamespace(
        async_session=lambda: SessionContext(),
        get_ai_consult_sessionmaker=lambda: (lambda: SessionContext()),
    )
    monkeypatch.setattr(local_ai_runtime, "configure_database", lambda *a, **kw: (database, SimpleNamespace()))
    monkeypatch.setattr(local_ai_runtime, "apply_local_gates", lambda *a, **kw: None)
    # 本测试只核验管理查询路由；不要导入会反射外部库表的真实报告路由。
    report_router = SimpleNamespace(router=APIRouter())
    monkeypatch.setitem(sys.modules, "app.api.report_view", report_router)
    monkeypatch.setattr(api, "report_view", report_router, raising=False)
    app = local_ai_runtime.create_app()

    async def fake_db():
        yield db

    app.dependency_overrides[get_db] = fake_db
    loader = AsyncMock(return_value=[{"id": 1, "name": "肺功能", "children": []}])
    monkeypatch.setattr(indicator_service, "get_tree", loader)
    return app, db, loader


@pytest.mark.asyncio
async def test_local_indicator_tree_restores_authenticated_read_without_mounting_crud(tree_app):
    from app.security.rbac import get_current_user

    app, db, loader = tree_app
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get("/api/v1/indicators/tree?keyword=肺&status=1")
        assert result.status_code == 200
        assert result.json()["data"][0]["name"] == "肺功能"
        for method, path in (("POST", "/api/v1/indicators"),
                             ("PUT", "/api/v1/indicators/1"),
                             ("DELETE", "/api/v1/indicators/1")):
            denied = await client.request(method, path, json={})
            assert denied.status_code in {404, 405}
    loader.assert_awaited_once_with(db, keyword="肺", status=1)


@pytest.mark.asyncio
async def test_local_indicator_tree_still_requires_admin_login(tree_app):
    app, _db, loader = tree_app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get("/api/v1/indicators/tree?keyword=")
    assert result.status_code in {401, 403}
    loader.assert_not_awaited()


@pytest.mark.asyncio
async def test_local_dashboard_route_is_mounted_and_authenticated(tree_app, monkeypatch):
    from app.security.rbac import get_current_user
    from app.services import dashboard_service

    app, _db, _loader = tree_app
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    monkeypatch.setattr(
        dashboard_service,
        "get_dashboard_stats",
        AsyncMock(return_value={"device_count": 0, "report_count": 0, "customer_count": 0}),
    )
    monkeypatch.setattr(
        dashboard_service,
        "get_dashboard_trend",
        AsyncMock(return_value={"granularity": "daily", "points": []}),
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/dashboard?start_date=2026-10-01&end_date=2026-10-12")

    assert response.status_code == 200
    assert response.json()["data"]["stats"]["device_count"] == 0


@pytest.mark.parametrize("resource", ["plans", "products"])
@pytest.mark.asyncio
async def test_local_plan_and_product_lists_restore_authenticated_reads(tree_app, monkeypatch, resource):
    from app.security.rbac import get_current_user
    from app.services import plan_service, product_service

    app, db, _loader = tree_app
    service = plan_service if resource == "plans" else product_service
    data = {"records": [{"id": 7, "name": "测试配置"}], "total": 1, "page": 2, "page_size": 5}
    loader = AsyncMock(return_value=data)
    monkeypatch.setattr(service, f"list_{resource}", loader)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get(f"/api/v1/{resource}?page=2&page_size=5&keyword=健康")
    assert result.status_code == 200
    assert result.json()["data"] == data
    loader.assert_awaited_once_with(db, 2, 5, "健康")


@pytest.mark.parametrize("resource", ["plans", "products"])
@pytest.mark.asyncio
async def test_local_plan_and_product_details_restore_authenticated_reads(tree_app, monkeypatch, resource):
    from app.security.rbac import get_current_user
    from app.services import plan_service, product_service

    app, db, _loader = tree_app
    service, singular = (plan_service, "plan") if resource == "plans" else (product_service, "product")
    data = {"id": 7, "name": "测试配置"}
    loader = AsyncMock(return_value=data)
    monkeypatch.setattr(service, f"get_{singular}_detail", loader)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get(f"/api/v1/{resource}/7")
    assert result.status_code == 200
    assert result.json()["data"] == data
    loader.assert_awaited_once_with(db, 7)


@pytest.mark.parametrize("resource,detail", [("plans", False), ("products", False),
                                           ("plans", True), ("products", True)])
@pytest.mark.asyncio
async def test_local_plan_and_product_reads_still_require_admin_login(tree_app, monkeypatch, resource, detail):
    from app.services import plan_service, product_service

    app, _db, _loader = tree_app
    service, singular = (plan_service, "plan") if resource == "plans" else (product_service, "product")
    loader = AsyncMock()
    monkeypatch.setattr(service, f"get_{singular}_detail" if detail else f"list_{resource}", loader)
    suffix = "/7" if detail else "?page=1&page_size=10&keyword="
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get(f"/api/v1/{resource}{suffix}")
    assert result.status_code in {401, 403}
    loader.assert_not_awaited()


@pytest.mark.parametrize("method,path", [
    ("POST", "/api/v1/plans"), ("PUT", "/api/v1/plans/7"), ("DELETE", "/api/v1/plans/7"),
    ("POST", "/api/v1/products"), ("PUT", "/api/v1/products/7"), ("DELETE", "/api/v1/products/7"),
    ("POST", "/api/v1/products/upload-image"),
])
@pytest.mark.asyncio
async def test_local_plan_and_product_writes_and_oss_upload_stay_unmounted(tree_app, method, path):
    from app.security.rbac import get_current_user

    app, _db, _loader = tree_app
    if method == "PUT" and path == "/api/v1/plans/7":
        assert "put" in app.openapi()["paths"]["/api/v1/plans/{plan_id}"]
        return
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.request(method, path, json={})
    assert result.status_code in {404, 405}
