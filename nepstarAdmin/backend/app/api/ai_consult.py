"""公开报告下的匿名咨询入口；真实模型与对话接口尚未启用。"""

from fastapi import APIRouter, Header, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import (
    AiConsultStorageConfigurationError,
    async_session,
    get_ai_consult_sessionmaker,
)
from ..schemas.ai_consult import ConsentCreate, GuestContextCreate
from ..schemas.response import ApiResponse
from ..security.ai_consult_access import (
    GuestAccessConfigurationError,
    GuestAccessDenied,
    build_guest_context,
    require_guest,
)
from ..services.ai_consult_consent import ConsentMismatch, ConsentUnavailable, record_consent
from ..services.ai_consult_entry_guard import GuestEntryDisabled, GuestRateLimited, reserve_guest_creation


router = APIRouter(prefix="/ai-consult", tags=["ai-consult"])


def _error(status_code: int, message: str, *, retry_after_seconds: int | None = None) -> JSONResponse:
    headers = {"Cache-Control": "no-store"}
    if retry_after_seconds is not None:
        headers["Retry-After"] = str(retry_after_seconds)
    return JSONResponse(
        status_code=status_code,
        content={
            "code": status_code,
            "message": message,
            "data": {"retry_after_seconds": retry_after_seconds} if retry_after_seconds is not None else None,
        },
        headers=headers,
    )


async def verify_public_report(db: AsyncSession, report_code: str, customer_id: int) -> None:
    """仅复用现有只读报告归属/就绪检查，不复用聊天写会话。"""
    from ..services import report_source, report_view_service

    try:
        await report_view_service._load_document_and_meta(db, report_code, customer_id)
    except report_view_service.ReportViewError as exc:
        raise HTTPException(status_code=exc.code, detail="consult.report_unavailable") from exc
    except report_source.ReportSourceUnavailableError as exc:
        raise HTTPException(status_code=503, detail="consult.report_unavailable") from exc


@router.post("/guest-contexts")
async def create_guest_context(req: GuestContextCreate, response: Response):
    """创建独立 guest；路由暂不挂到主应用，待限流和告知流程完成。"""
    if not settings.AI_CONSULT_GUEST_ENABLED:
        return _error(503, "consult.disabled")
    try:
        token, guest = build_guest_context(req.report_code, req.customer_id)
        write_sessionmaker = get_ai_consult_sessionmaker()
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")

    async with async_session() as read_db:
        try:
            await verify_public_report(read_db, req.report_code, req.customer_id)
        except HTTPException as exc:
            return _error(exc.status_code, str(exc.detail))
    try:
        async with write_sessionmaker() as write_db:
            async with write_db.begin():
                await reserve_guest_creation(write_db)
                write_db.add(guest)
    except GuestEntryDisabled:
        return _error(503, "consult.disabled")
    except GuestRateLimited as exc:
        return _error(429, "consult.rate_limited", retry_after_seconds=exc.retry_after_seconds)

    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(
        message="ok",
        data={
            "guest_token": token,
            "expires_at": guest.expires_at.isoformat() + "Z",
            "report_code": guest.report_code,
            "customer_id": guest.customer_id,
        },
    )


@router.post("/consents")
async def create_consent(
    req: ConsentCreate,
    response: Response,
    authorization: str | None = Header(default=None),
):
    """持有当前报告 guest 凭证的访问者记录同意或撤回；不调用模型。"""
    if not settings.AI_CONSULT_GUEST_ENABLED:
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    token = authorization.removeprefix("Bearer ")
    try:
        write_sessionmaker = get_ai_consult_sessionmaker()
        async with write_sessionmaker() as write_db:
            async with write_db.begin():
                guest = await require_guest(write_db, token, req.report_code)
                consent = await record_consent(
                    write_db,
                    guest,
                    notice_version=req.notice_version,
                    provider_code=req.provider_code,
                    accepted=req.accepted,
                )
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError, ConsentUnavailable):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    except ConsentMismatch:
        return _error(409, "consult.notice_changed")

    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(
        message="ok",
        data={
            "choice": consent.choice,
            "notice_version": consent.notice_version,
            "provider_code": consent.provider_code,
            "decided_at": consent.decided_at.isoformat() + "Z",
        },
    )
