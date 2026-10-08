"""公开报告下的匿名咨询入口；真实模型与对话接口尚未启用。"""

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import (
    AiConsultStorageConfigurationError,
    async_session,
    get_ai_consult_sessionmaker,
)
from ..schemas.ai_consult import GuestContextCreate
from ..schemas.response import ApiResponse
from ..security.ai_consult_access import (
    GuestAccessConfigurationError,
    build_guest_context,
)


router = APIRouter(prefix="/ai-consult", tags=["ai-consult"])


def _error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": status_code, "message": message, "data": None},
        headers={"Cache-Control": "no-store"},
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
    async with write_sessionmaker() as write_db:
        write_db.add(guest)
        await write_db.commit()

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
