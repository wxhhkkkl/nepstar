"""FastAPI application entry point."""

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import auth, customers, dashboard, devices, menus, organizations, reports, roles, users
from .database import async_session
from .i18n import get_message
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
    async with async_session() as db:
        await seed_root_org(db)
        await seed_admin_role(db)


@app.get("/api/v1/health")
async def health_check():
    logger.info("health_check")
    return {"status": "ok"}
