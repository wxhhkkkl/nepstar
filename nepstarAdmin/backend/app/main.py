"""FastAPI application entry point."""

import asyncio
from contextlib import suppress

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import mongo
from .api import (
    auth,
    ai_consult,
    ai_consult_admin,
    customers,
    dashboard,
    devices,
    indicators,
    menus,
    organizations,
    plans,
    products,
    report_view,
    reports,
    roles,
    users,
)
from .database import ai_consult_storage_ready, async_session
from .config import settings
from .i18n import get_message
from .services.health_seed import seed_health_menus
from .services.ai_consult_admin_menu import seed_ai_consult_admin_menu
from .services.ai_consult_recovery import run_generation_recovery_job
from .services.organization_service import seed_root_org
from .services.role_service import seed_admin_role

# Structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


async def _ai_consult_recovery_loop() -> None:
    """Each worker may sweep; row locks and rechecks make overlap harmless."""
    while True:
        try:
            recovered = await run_generation_recovery_job()
            if recovered:
                logger.info("ai_consult_generations_recovered", count=recovered)
        except Exception:
            logger.warning("ai_consult_generation_recovery_failed", exc_info=True)
        await asyncio.sleep(60)

app = FastAPI(
    title="Smart Admin API",
    description="三语智能设备管理后台",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(roles.router, prefix="/api/v1")
app.include_router(menus.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(devices.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(customers.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(indicators.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(plans.router, prefix="/api/v1")
# 报告展示接口：无 JWT，凭报告编号 + 客户标识访问
app.include_router(report_view.router, prefix="/api/v1")
# AI 匿名咨询接口已挂载；入口/会话/问答/运营保护开关默认关闭，公开侧保持 fail-closed。
app.include_router(ai_consult.router, prefix="/api/v1")
app.include_router(ai_consult_admin.router, prefix="/api/v1")


# Error handler middleware
@app.exception_handler(400)
async def bad_request_handler(request: Request, exc: Exception):
    lang = request.headers.get("Accept-Language", "zh-CN")
    return JSONResponse(status_code=400, content={"code": 400, "message": get_message("common.validation_error", lang), "data": None})


@app.exception_handler(401)
async def unauthorized_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=401, content={"code": 401, "message": "Unauthorized", "data": None})


@app.exception_handler(403)
async def forbidden_handler(request: Request, exc: Exception):
    lang = request.headers.get("Accept-Language", "zh-CN")
    return JSONResponse(status_code=403, content={"code": 403, "message": get_message("common.forbidden", lang), "data": None})


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"code": 500, "message": str(exc), "data": None})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"\n{'='*60}")
    print(f"UNHANDLED ERROR: {request.method} {request.url.path}")
    traceback.print_exc()
    print(f"{'='*60}\n")
    return JSONResponse(status_code=500, content={"code": 500, "message": str(exc), "data": None})


@app.on_event("startup")
async def startup_event():
    """Ensure root organization and admin role exist on application startup."""
    if not ai_consult_storage_ready():
        logger.warning("ai_consult_storage_unavailable")
    async with async_session() as db:
        await seed_root_org(db)
        await seed_health_menus(db)  # 健康管理菜单，须在 seed_admin_role 之前执行以便自动授权
        await seed_admin_role(db)
    if ai_consult_storage_ready():
        try:
            await seed_ai_consult_admin_menu()
        except Exception:
            logger.warning("ai_consult_admin_menu_seed_skipped", exc_info=True)
    # 报告数据源（MongoDB，只读）。未配置 MONGODB_URL 时跳过，不影响其余功能
    await mongo.connect()
    if settings.AI_CONSULT_OPERATIONS_READY is not False and ai_consult_storage_ready():
        app.state.ai_consult_recovery_task = asyncio.create_task(
            _ai_consult_recovery_loop()
        )


@app.on_event("shutdown")
async def shutdown_event():
    recovery_task = getattr(app.state, "ai_consult_recovery_task", None)
    if recovery_task is not None:
        recovery_task.cancel()
        with suppress(asyncio.CancelledError):
            await recovery_task
    await mongo.close()


@app.get("/api/v1/health")
async def health_check():
    logger.info("health_check")
    return {"status": "ok"}
