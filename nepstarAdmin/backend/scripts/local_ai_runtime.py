"""Loopback-only AI development app; normal/production app is unchanged.

Start with: .venv/bin/python scripts/local_ai_runtime.py
Only nepstar writes are routed to the explicitly validated local instance.
Legacy/config readers reject DML/DDL and use READ ONLY MySQL transactions.
Default is closed. --enable-consult allows admin control of a preconfigured local
browser trial; it never changes the database switch, calls a model or transmits
a report at startup.
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
from contextlib import asynccontextmanager, suppress
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy import delete, event, select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session
from sqlalchemy.sql import visitors
from sqlalchemy.sql.elements import TextClause
from sqlalchemy.sql.selectable import TableClause


BACKEND = Path(__file__).resolve().parents[1]
DEFAULT_LOCAL_URL = "mysql+aiomysql://root@127.0.0.1:3306/nepstar"
REPORT_REGISTRY_TABLES = {"sa_indicator", "sa_plan", "sa_plan_indicator", "sa_plan_product", "sa_product", "sa_product_image"}


class LocalIsolationError(RuntimeError):
    """Fixed safe message: never echo SQL, configuration, or user parameters."""


class SafeExceptionLog(logging.Filter):
    def filter(self, record):
        if record.exc_info or record.exc_text:
            record.msg = "local_request_failed"
            record.args = ()
            record.exc_info = record.exc_text = record.stack_info = None
        return True


def safe_structured_event(_logger, _method, values):
    # Existing report logging includes its full identifier; never emit it here.
    result = {"event": "report_view" if values.get("event") == "report_view" else "local_service_event"}
    if type(values.get("duration_ms")) is int:
        result["duration_ms"] = values["duration_ms"]
    if values.get("outcome") in {"success", "not_found", "unavailable", "not_ready"}:
        result["outcome"] = values["outcome"]
    return result


def local_write_url(raw):
    try:
        url = make_url(raw)
    except Exception:
        raise LocalIsolationError("Invalid local write target") from None
    if (url.drivername != "mysql+aiomysql" or url.host != "127.0.0.1"
            or url.port is None or url.database != "nepstar" or url.query):
        raise LocalIsolationError("Exact loopback nepstar write target required")
    return url


def _schemas(statement):
    return {item.schema for item in visitors.iterate(statement) if isinstance(item, TableClause)}


def assert_read_statement(statement):
    sql = " ".join(statement.upper().split())
    if (not re.match(r"^(SELECT|SHOW|DESCRIBE)\s", sql) or ";" in sql
            or re.search(r"\b(FOR UPDATE|LOCK IN SHARE MODE|INTO OUTFILE|INTO DUMPFILE)\b", sql)):
        raise LocalIsolationError("Non-read SQL rejected on the report reader")


def assert_local_write_statement(sql, compiled_statement):
    normalized = " ".join(sql.upper().split())
    if re.fullmatch(r"(?:SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT) [A-Z0-9_]+", normalized):
        return
    if (re.match(r"^(SELECT|SHOW|DESCRIBE)\s", normalized) and ";" not in normalized
            and not re.search(r"\bINTO (OUTFILE|DUMPFILE)\b", normalized)):
        return
    if (compiled_statement is None or not getattr(compiled_statement, "is_dml", False)
            or _schemas(compiled_statement) != {"nepstar"}):
        raise LocalIsolationError("Only compiled nepstar DML is allowed on the local writer")


def routed_session_class(writer, reader, registry_reader=None):
    class LocalRoutingSession(Session):
        def get_bind(self, mapper=None, clause=None, **kwargs):
            schemas = _schemas(clause) if clause is not None and not isinstance(clause, TextClause) else set()
            names = {item.name for item in visitors.iterate(clause) if isinstance(item, TableClause)} if clause is not None else set()
            if mapper is not None:
                schemas |= _schemas(mapper.persist_selectable)
                names |= {mapper.persist_selectable.name}
            if isinstance(clause, TextClause):
                assert_read_statement(clause.text)
                tables = re.findall(r"\b(?:FROM|JOIN)\s+([A-Za-z0-9_.`]+)", clause.text, re.I)
                schemas |= {name.replace("`", "").split(".")[0] if "." in name else None for name in tables}
                names |= {name.replace("`", "").split(".")[-1] for name in tables}
            if "nepstar" in schemas:
                if schemas != {"nepstar"}:
                    raise LocalIsolationError("Cross-instance queries are not supported")
                if registry_reader is not None and not self._flushing and not getattr(clause, "is_dml", False):
                    if names & REPORT_REGISTRY_TABLES:
                        if not names <= REPORT_REGISTRY_TABLES:
                            raise LocalIsolationError("Report registry cannot join local auth or consultation tables")
                        return registry_reader
                return writer
            if self._flushing or getattr(clause, "is_dml", False):
                raise LocalIsolationError("Writes to report or config databases are forbidden")
            return reader
    return LocalRoutingSession


def _protect_reader(engine):
    @event.listens_for(engine, "connect")
    def read_only(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
        finally:
            cursor.close()

    @event.listens_for(engine, "before_cursor_execute")
    def reject_writes(_conn, _cursor, statement, _parameters, _context, _many):
        assert_read_statement(statement)


def configure_database(raw_url, *, read_report_registry=False):
    local_write_url(raw_url)
    if "app.database" in sys.modules:
        raise LocalIsolationError("Local routing must be installed before importing the application")
    # Process-only override; do not edit .env or the production startup entry.
    from app.config import settings
    original_registry_url = settings.NEPSTAR_DATABASE_URL
    settings.NEPSTAR_DATABASE_URL = raw_url
    from app import database
    for engine in (database.engine.sync_engine, database.sync_engine,
                   getattr(database.config_engine, "sync_engine", None), database.config_sync_engine):
        if engine is not None:
            _protect_reader(engine)
    writer_maker = database.get_ai_consult_sessionmaker()
    local_engine = writer_maker.kw["bind"]
    # Used only by report_plan_source to overlay explicit local plan snapshots;
    # the ordinary application never sets this process-local capability.
    database.local_plan_overlay_sessionmaker = writer_maker if read_report_registry else None
    registry_engine = None
    if read_report_registry:
        source_url = make_url(original_registry_url)
        if (source_url.drivername != "mysql+aiomysql" or source_url.database != "nepstar"
                or not source_url.host or source_url.query):
            raise LocalIsolationError("Explicit report registry read target required")
        registry_engine = create_async_engine(source_url, echo=False, pool_pre_ping=True)
        _protect_reader(registry_engine.sync_engine)
        database.local_report_registry_engine = registry_engine

    @event.listens_for(local_engine.sync_engine, "before_cursor_execute")
    def guard_local(_conn, _cursor, statement, _parameters, context, _many):
        compiled = getattr(context, "compiled", None)
        assert_local_write_statement(statement, getattr(compiled, "statement", None))

    database.async_session = async_sessionmaker(
        class_=AsyncSession, expire_on_commit=False,
        sync_session_class=routed_session_class(local_engine.sync_engine, database.engine.sync_engine,
                                               registry_engine.sync_engine if registry_engine is not None else None),
    )
    return database, settings


def apply_local_gates(settings, *, enable_consult=False):
    try:
        from .ai_consult_preflight import FLAGS
    except ImportError:
        from ai_consult_preflight import FLAGS
    if any(getattr(settings, flag) for flag in FLAGS):
        raise LocalIsolationError("Production environment gates must remain disabled")
    for flag in FLAGS:
        setattr(settings, flag, bool(enable_consult))


def validate_local_consult_configuration(config, rule, settings, provider):
    try:
        from .local_ai_policy import validate_browser_policy
    except ImportError:
        from local_ai_policy import validate_browser_policy
    from app.services.ai_consult_provider import provider_matches_configuration

    # A paused database switch must not prevent the local service from booting:
    # the administrator needs the service-state endpoint to resume it.
    validate_browser_policy(config, rule, settings.AI_CONSULT_PROVIDER_MODEL.strip(),
                            require_enabled=False, admin_managed=True)
    if (len(settings.AI_CONSULT_TOKEN_HMAC_KEY.encode()) < 32
            or urlsplit(getattr(provider, "endpoint", "")).hostname != "api.deepseek.com"
            or not provider_matches_configuration(provider, config.provider_code, config.model_code)):
        raise LocalIsolationError("Local credentials/provider must be ready")


def create_app(raw_url=DEFAULT_LOCAL_URL, *, enable_consult=False):
    import structlog
    from fastapi import Depends, FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse

    structlog.configure(processors=[safe_structured_event, structlog.processors.JSONRenderer()])
    database, settings = configure_database(raw_url, read_report_registry=True)
    apply_local_gates(settings, enable_consult=enable_consult)
    from app import mongo
    from app.api import (
        ai_consult,
        ai_consult_admin,
        auth,
        dashboard,
        indicators,
        plans,
        products,
        report_view,
    )
    from app.models.new.sa_indicator import SAIndicator
    from app.models.new.sa_plan import SAPlan, SAPlanIndicator, SAPlanProduct
    from app.models.new.sa_product import SAProduct
    from app.schemas.plan import PlanUpdate
    from app.schemas.response import ApiResponse
    from app.security.rbac import get_current_user
    from app.services import plan_service
    from app.services.ai_consult_admin_menu import seed_ai_consult_admin_menu
    from app.services.health_seed import seed_health_menus
    from app.services.organization_service import seed_root_org
    from app.services.role_service import seed_admin_role

    @asynccontextmanager
    async def lifespan(_app):
        recovery_task = None
        try:
            if enable_consult:
                from app.models.new.sa_ai_consult import SAAiConsultSettings, SAAiConsultRuleVersion
                async with database.get_ai_consult_sessionmaker()() as db:
                    config = await db.get(SAAiConsultSettings, 1)
                    rule = await db.get(SAAiConsultRuleVersion, config.active_rule_version_id) if config else None
                    validate_local_consult_configuration(config, rule, settings, ai_consult.answer_provider)
            async with database.async_session() as db:
                await seed_root_org(db)
                await seed_health_menus(db)
                await seed_admin_role(db)
            await seed_ai_consult_admin_menu()
            await mongo.connect()
            if enable_consult and settings.AI_CONSULT_OPERATIONS_READY is not False:
                from app.services.ai_consult_recovery import run_generation_recovery_job

                async def recover_stale_generations():
                    while True:
                        try:
                            await run_generation_recovery_job()
                        except asyncio.CancelledError:
                            raise
                        except Exception:
                            logging.getLogger("uvicorn.error").warning(
                                "local_ai_generation_recovery_failed"
                            )
                        await asyncio.sleep(60)

                recovery_task = asyncio.create_task(recover_stale_generations())
        except Exception:
            raise LocalIsolationError("Local AI startup failed; no remote writes are allowed") from None
        try:
            yield
        finally:
            if recovery_task is not None:
                recovery_task.cancel()
                with suppress(asyncio.CancelledError):
                    await recovery_task
            await mongo.close()
            await database.get_ai_consult_sessionmaker().kw["bind"].dispose()
            await database.engine.dispose()
            if database.config_engine is not None:
                await database.config_engine.dispose()
            await database.local_report_registry_engine.dispose()
            database.sync_engine.dispose()
            if database.config_sync_engine is not None:
                database.config_sync_engine.dispose()

    app = FastAPI(title="Local isolated AI consultation", lifespan=lifespan)
    app.add_middleware(CORSMiddleware,
                       allow_origins=["http://127.0.0.1:5173", "http://127.0.0.1:5175",
                                      "http://localhost:5173", "http://localhost:5175"],
                       allow_methods=["*"], allow_headers=["*"])
    for router in (
        auth.router,
        dashboard.router,
        report_view.router,
        ai_consult.router,
        ai_consult_admin.router,
    ):
        app.include_router(router, prefix="/api/v1")
    # 目录与未编辑方案仍来自只读报告配置连接。方案 PUT 首次修改时会把该方案
    # 及关联 ID 快照保存到本地 nepstar；列表/详情随后优先返回本地快照。
    # 不挂载指标/商品 CRUD，也不开放 OSS 上传。
    app.add_api_route("/api/v1/indicators/tree", indicators.get_indicator_tree,
                      methods=["GET"], tags=["indicators"])

    async def local_plan_list(page: int = 1, page_size: int = 10, keyword: str = "",
                              _user=Depends(get_current_user)):
        async with database.async_session() as source_db:
            data = await plan_service.list_plans(source_db, page, page_size, keyword)
        plan_ids = [item["id"] for item in data["records"]]
        if plan_ids:
            async with database.get_ai_consult_sessionmaker()() as local_db:
                local_rows = (await local_db.execute(
                    select(SAPlan).where(SAPlan.id.in_(plan_ids), SAPlan.updated_at.is_not(None))
                )).scalars().all()
                local_by_id = {row.id: row for row in local_rows}
                product_counts, indicator_counts = await plan_service._counts(
                    local_db, list(local_by_id)
                )
            for item in data["records"]:
                row = local_by_id.get(item["id"])
                if row is not None:
                    item.update({
                        "name": row.plan_name,
                        "description": row.description,
                        "trigger_score_below": row.trigger_score_below,
                        "status": row.status,
                        "sort_order": row.sort_order,
                        "updated_at": row.updated_at,
                        "product_count": product_counts.get(row.id, 0),
                        "indicator_count": indicator_counts.get(row.id, 0),
                    })
        return ApiResponse(data=data)

    async def local_plan_detail(plan_id: int, _user=Depends(get_current_user)):
        try:
            async with database.async_session() as source_db, database.get_ai_consult_sessionmaker()() as local_db:
                data = await _local_plan_detail(source_db, local_db, plan_id)
        except ValueError as exc:
            return ApiResponse(code=404, message=str(exc))
        return ApiResponse(data=data)

    async def _local_plan_detail(source_db, local_db, plan_id: int) -> dict:
        row = (await local_db.execute(
            select(SAPlan).where(SAPlan.id == plan_id, SAPlan.updated_at.is_not(None))
        )).scalar_one_or_none()
        if row is None:
            return await plan_service.get_plan_detail(source_db, plan_id)

        product_links = (await local_db.execute(
            select(SAPlanProduct.product_id, SAPlanProduct.sort_order)
            .where(SAPlanProduct.plan_id == plan_id)
            .order_by(SAPlanProduct.sort_order, SAPlanProduct.id)
        )).all()
        product_ids = [link.product_id for link in product_links]
        product_rows = []
        if product_ids:
            product_rows = (await source_db.execute(
                select(SAProduct.id, SAProduct.product_name, SAProduct.cover_url)
                .where(SAProduct.id.in_(product_ids))
            )).all()
        product_by_id = {item.id: item for item in product_rows}

        indicator_ids = (await local_db.execute(
            select(SAPlanIndicator.indicator_id)
            .where(SAPlanIndicator.plan_id == plan_id)
        )).scalars().all()
        indicator_rows = []
        if indicator_ids:
            indicator_rows = (await source_db.execute(
                select(SAIndicator.id, SAIndicator.parent_id, SAIndicator.ind_code,
                       SAIndicator.ind_name, SAIndicator.sort_order, SAIndicator.status)
                .where(SAIndicator.id.in_(indicator_ids))
            )).all()
        indicator_by_id = {item.id: item for item in indicator_rows}
        missing_parents = {
            item.parent_id for item in indicator_rows
            if item.parent_id is not None and item.parent_id not in indicator_by_id
        }
        parent_rows = []
        if missing_parents:
            parent_rows = (await source_db.execute(
                select(SAIndicator.id, SAIndicator.ind_name, SAIndicator.sort_order)
                .where(SAIndicator.id.in_(missing_parents))
            )).all()
        parent_names = {
            item.id: item.ind_name for item in indicator_rows if item.parent_id is None
        }
        parent_rank = {
            item.id: (item.sort_order, item.id)
            for item in indicator_rows if item.parent_id is None
        }
        for parent in parent_rows:
            parent_names[parent.id] = parent.ind_name
            parent_rank[parent.id] = (parent.sort_order, parent.id)
        indicators_data = []
        for item in indicator_rows:
            indicators_data.append({
                "indicator_id": item.id,
                "level": 1 if item.parent_id is None else 2,
                "code": item.ind_code,
                "name": item.ind_name,
                "parent_id": item.parent_id,
                "parent_name": parent_names.get(item.parent_id) if item.parent_id else None,
                "status": item.status,
                "sort_order": item.sort_order,
            })

        def indicator_key(item):
            if item["parent_id"] is None:
                category = (item["sort_order"], item["indicator_id"])
                depth = 0
            else:
                category = parent_rank.get(item["parent_id"], (10**9, item["parent_id"]))
                depth = 1
            return (category, depth, item["sort_order"], item["indicator_id"])

        return {
            "id": row.id,
            "name": row.plan_name,
            "description": row.description,
            "trigger_score_below": row.trigger_score_below,
            "status": row.status,
            "sort_order": row.sort_order,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "products": [
                {"product_id": link.product_id,
                 "name": product_by_id[link.product_id].product_name,
                 "cover_url": product_by_id[link.product_id].cover_url,
                 "sort_order": link.sort_order}
                for link in product_links if link.product_id in product_by_id
            ],
            "indicators": [
                {key: value for key, value in item.items() if key != "sort_order"}
                for item in sorted(indicators_data, key=indicator_key)
            ],
        }

    async def local_plan_update(plan_id: int, req: PlanUpdate,
                                _user=Depends(get_current_user)):
        try:
            async with database.get_ai_consult_sessionmaker()() as local_db:
                existing = (await local_db.execute(
                    select(SAPlan).where(SAPlan.id == plan_id)
                )).scalar_one_or_none()
                already_local = existing is not None and existing.updated_at is not None
                await local_db.rollback()

            async with database.async_session() as source_db:
                source_detail = None
                if not already_local:
                    source_detail = await plan_service.get_plan_detail(source_db, plan_id)
                product_ids = (plan_service.dedup_ids(req.product_ids)
                               if req.product_ids is not None else None)
                indicator_ids = (plan_service.dedup_ids(req.indicator_ids)
                                 if req.indicator_ids is not None else None)
                for ids, model, error in (
                    (product_ids, SAProduct, "plan.product_not_found"),
                    (indicator_ids, SAIndicator, "plan.indicator_not_found"),
                ):
                    if ids:
                        found = set((await source_db.execute(
                            select(model.id).where(model.id.in_(ids))
                        )).scalars().all())
                        if any(item_id not in found for item_id in ids):
                            raise ValueError(error)

            async with database.get_ai_consult_sessionmaker()() as local_db:
                async with local_db.begin():
                    row = (await local_db.execute(
                        select(SAPlan).where(SAPlan.id == plan_id).with_for_update()
                    )).scalar_one_or_none()
                    if row is None or row.updated_at is None:
                        if source_detail is None:
                            raise ValueError("plan.not_found")
                        if row is None:
                            row = SAPlan(id=plan_id)
                            local_db.add(row)
                        row.plan_name = source_detail["name"]
                        row.description = source_detail["description"]
                        row.trigger_score_below = source_detail["trigger_score_below"]
                        row.status = source_detail["status"]
                        row.sort_order = source_detail["sort_order"]
                        row.created_at = source_detail["created_at"]
                        await local_db.flush()
                        await local_db.execute(delete(SAPlanProduct).where(
                            SAPlanProduct.plan_id == plan_id
                        ))
                        await local_db.execute(delete(SAPlanIndicator).where(
                            SAPlanIndicator.plan_id == plan_id
                        ))
                        for item in source_detail["products"]:
                            local_db.add(SAPlanProduct(
                                plan_id=plan_id, product_id=item["product_id"],
                                sort_order=item["sort_order"],
                            ))
                        for item in source_detail["indicators"]:
                            local_db.add(SAPlanIndicator(
                                plan_id=plan_id, indicator_id=item["indicator_id"],
                            ))

                    if req.name is not None:
                        row.plan_name = req.name
                    if req.description is not None:
                        row.description = req.description
                    if req.trigger_score_below is not None:
                        row.trigger_score_below = req.trigger_score_below
                    if req.status is not None:
                        row.status = req.status
                    if req.sort_order is not None:
                        row.sort_order = req.sort_order
                    if product_ids is not None:
                        await local_db.execute(delete(SAPlanProduct).where(
                            SAPlanProduct.plan_id == plan_id
                        ))
                        for index, product_id in enumerate(product_ids):
                            local_db.add(SAPlanProduct(
                                plan_id=plan_id, product_id=product_id, sort_order=index,
                            ))
                    if indicator_ids is not None:
                        await local_db.execute(delete(SAPlanIndicator).where(
                            SAPlanIndicator.plan_id == plan_id
                        ))
                        for indicator_id in indicator_ids:
                            local_db.add(SAPlanIndicator(
                                plan_id=plan_id, indicator_id=indicator_id,
                            ))
                    row.updated_at = datetime.utcnow()

            async with database.async_session() as source_db, database.get_ai_consult_sessionmaker()() as local_db:
                data = await _local_plan_detail(source_db, local_db, plan_id)
            return ApiResponse(data=data)
        except ValueError as exc:
            return ApiResponse(code=400, message=str(exc))

    app.add_api_route("/api/v1/plans", local_plan_list,
                      methods=["GET"], tags=["plans"])
    app.add_api_route("/api/v1/plans/{plan_id}", local_plan_detail,
                      methods=["GET"], tags=["plans"])
    app.add_api_route("/api/v1/plans/{plan_id}", local_plan_update,
                      methods=["PUT"], tags=["plans"])
    app.add_api_route("/api/v1/products", products.list_products,
                      methods=["GET"], tags=["products"])
    app.add_api_route("/api/v1/products/{product_id}", products.get_product,
                      methods=["GET"], tags=["products"])

    @app.exception_handler(Exception)
    async def safe_error(_request, _error):
        # Keep local diagnostics useful without emitting report identifiers,
        # query strings, SQL, or exception messages that may contain data.
        route = _request.scope.get("route")
        route_template = getattr(route, "path", "/unmatched")
        logging.getLogger("uvicorn.error").error(
            "local_request_failed exception_type=%s path=%s",
            type(_error).__name__,
            route_template,
        )
        return JSONResponse(status_code=503, content={
            "code": 503, "message": "local.service_unavailable", "data": None,
        })

    @app.get("/api/v1/health")
    async def health():
        enabled = False
        if enable_consult:
            from app.models.new.sa_ai_consult import SAAiConsultSettings
            async with database.get_ai_consult_sessionmaker()() as db:
                config = await db.get(SAAiConsultSettings, 1)
                enabled = bool(config and config.enabled)
        return {"status": "ok", "mode": "local_ai_isolated", "ai_enabled": enabled}

    return app


def main():
    parser = argparse.ArgumentParser(description="本地 AI 联调服务，仅监听 127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--enable-consult", action="store_true", help="允许后台控制已配置的本机咨询，不自动修改数据库总开关")
    args = parser.parse_args()
    os.chdir(BACKEND)
    sys.path.insert(0, str(BACKEND))
    try:
        app = create_app(os.environ.get("AI_CONSULT_LOCAL_RUNTIME_URL", DEFAULT_LOCAL_URL), enable_consult=args.enable_consult)
    except Exception as exc:
        print(json.dumps({"status": "local_start_blocked", "error_category": type(exc).__name__}))
        return 2
    import uvicorn
    logging.getLogger("uvicorn.error").addFilter(SafeExceptionLog())
    # Do not log report query strings or Authorization, and do not use a reloader
    # that might restart the original production-style entry by mistake.
    uvicorn.run(app, host="127.0.0.1", port=args.port, access_log=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
