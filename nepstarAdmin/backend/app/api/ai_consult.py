"""公开报告下的匿名咨询候选入口；真实模型与主应用接入尚未启用。"""

import asyncio
import json

from fastapi import APIRouter, Header, HTTPException, Query, Response
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import (
    AiConsultStorageConfigurationError,
    async_session,
    get_ai_consult_sessionmaker,
)
from ..schemas.ai_consult import (
    ConsentCreate,
    ConsultSessionCreate,
    ConsultTurnCreate,
    GuestContextCreate,
)
from ..schemas.response import ApiResponse
from ..security.ai_consult_access import (
    GuestAccessConfigurationError,
    GuestAccessDenied,
    build_guest_context,
    require_guest,
)
from ..services.ai_consult_consent import (
    ConsentMismatch,
    ConsentUnavailable,
    load_notice_state,
    record_consent,
    require_current_consent,
)
from ..services.ai_consult_entry_guard import GuestEntryDisabled, GuestRateLimited, reserve_guest_creation
from ..services.ai_consult_pipeline import CandidateOutcome, prepare_answer_candidate
from ..services.ai_consult_provider import default_provider
from ..services.ai_consult_sessions import (
    ConsultReportDateUnavailable,
    build_welcome_context,
    get_guest_session,
    list_guest_sessions,
    new_home_session,
    public_session,
    verified_report_date,
)
from ..services.ai_consult_turns import (
    TurnConflict,
    TurnInProgress,
    finalize_turn,
    start_turn,
    valid_request_id,
)


router = APIRouter(prefix="/ai-consult", tags=["ai-consult"])
answer_provider = default_provider  # 未获准外发真实健康信息前固定为禁用实现


class _ConsentRequired(Exception):
    pass


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


async def load_public_report_home(db: AsyncSession, report_code: str, customer_id: int) -> dict:
    """用既有只读报告聚合核对归属并取得真实欢迎上下文。"""
    from ..services import report_source, report_view_service

    try:
        return await report_view_service.build_home(db, report_code, customer_id)
    except report_view_service.ReportViewError as exc:
        raise HTTPException(status_code=exc.code, detail="consult.report_unavailable") from exc
    except report_source.ReportSourceUnavailableError as exc:
        raise HTTPException(status_code=503, detail="consult.report_unavailable") from exc


@router.post("/guest-contexts")
async def create_guest_context(req: GuestContextCreate, response: Response):
    """创建独立 guest；路由暂不挂到主应用，待会话隔离和上线评估完成。"""
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


@router.get("/bootstrap")
async def get_bootstrap(
    report_code: str,
    response: Response,
    authorization: str | None = Header(default=None),
):
    """返回当前 guest 可查看的真实报告摘要与告知；不创建会话或调用模型。"""
    if not settings.AI_CONSULT_GUEST_ENABLED:
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    token = authorization.removeprefix("Bearer ")
    try:
        write_sessionmaker = get_ai_consult_sessionmaker()
        async with write_sessionmaker() as write_db:
            guest = await require_guest(write_db, token, report_code)
            notice_config, consent_granted = await load_notice_state(write_db, guest.id)
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")

    async with async_session() as read_db:
        try:
            home = await load_public_report_home(read_db, guest.report_code, guest.customer_id)
        except HTTPException as exc:
            return _error(exc.status_code, str(exc.detail))

    context = build_welcome_context(home)
    notice = None
    if notice_config is not None:
        notice = {
            "version": notice_config.notice_version,
            "text": notice_config.notice_text,
            "provider_code": notice_config.provider_code,
            "data_scope_text": notice_config.data_scope_text,
        }
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(
        message="ok",
        data={
            **context,
            "notice": notice,
            "consent_status": "granted" if consent_granted else "required",
            "service_status": "unavailable",  # 模型接入和上线评估尚未完成
            "remaining_today": None,  # 额度统计未实现，不伪造数字
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


@router.post("/sessions")
async def create_session(
    req: ConsultSessionCreate,
    response: Response,
    authorization: str | None = Header(default=None),
):
    """只为当前 guest 和当前已验证报告建首页会话；方案来源尚不接受。"""
    if not settings.AI_CONSULT_GUEST_ENABLED or not settings.AI_CONSULT_SESSIONS_ENABLED:
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    token = authorization.removeprefix("Bearer ")
    try:
        writer = get_ai_consult_sessionmaker()
        async with writer() as lookup_db:
            guest = await require_guest(lookup_db, token, req.report_code)
        async with async_session() as read_db:
            home = await load_public_report_home(read_db, guest.report_code, guest.customer_id)
        report_date = verified_report_date(home, guest.report_code)
        async with writer() as write_db:
            async with write_db.begin():
                # 报告读取之后重新检查凭证；同意写入与此处锁同一配置行。
                guest = await require_guest(write_db, token, req.report_code)
                consent = await require_current_consent(write_db, guest.id, lock=True)
                if consent is None:
                    raise _ConsentRequired()
                item = new_home_session(guest, consent, report_date)
                write_db.add(item)
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    except HTTPException as exc:
        return _error(exc.status_code, str(exc.detail))
    except ConsultReportDateUnavailable:
        return _error(503, "consult.report_unavailable")
    except _ConsentRequired:
        return _error(403, "consult.consent_required")

    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(message="ok", data=public_session(item))


@router.get("/sessions")
async def get_sessions(
    response: Response,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
):
    """只列当前匿名访客在这一份报告里的有效会话。"""
    if not settings.AI_CONSULT_GUEST_ENABLED or not settings.AI_CONSULT_SESSIONS_ENABLED:
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    try:
        writer = get_ai_consult_sessionmaker()
        async with writer() as db:
            guest = await require_guest(db, authorization.removeprefix("Bearer "), report_code)
            items = await list_guest_sessions(db, guest, report_code)
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    response.headers["Cache-Control"] = "no-store"
    return ApiResponse(message="ok", data={"sessions": [public_session(item) for item in items]})


@router.get("/sessions/{session_id}")
async def get_session_detail(
    session_id: str,
    response: Response,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
):
    """会话主键不足以授权；SQL 同时限定 guest、报告、状态与有效期。"""
    if not settings.AI_CONSULT_GUEST_ENABLED or not settings.AI_CONSULT_SESSIONS_ENABLED:
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    try:
        writer = get_ai_consult_sessionmaker()
        async with writer() as db:
            guest = await require_guest(db, authorization.removeprefix("Bearer "), report_code)
            item = await get_guest_session(db, guest, report_code, session_id)
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    if item is None:
        return _error(404, "consult.session_not_found")
    response.headers["Cache-Control"] = "no-store"
    return ApiResponse(message="ok", data={**public_session(item), "turns": []})


def _sse_event(event: str, *, session_id: str, start, seq: int, **data) -> str:
    payload = {
        "session_id": session_id,
        "turn_id": start.turn_id,
        "generation_id": start.generation_id,
        "seq": seq,
        **data,
    }
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _stream_headers() -> dict[str, str]:
    return {
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        "Referrer-Policy": "no-referrer",
    }


@router.post("/sessions/{session_id}/turns")
async def create_turn(
    session_id: str,
    req: ConsultTurnCreate,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    """候选 SSE：事务保存结果后才发送已校验的回答片段。"""
    if not (
        settings.AI_CONSULT_GUEST_ENABLED
        and settings.AI_CONSULT_SESSIONS_ENABLED
        and settings.AI_CONSULT_ANSWERS_ENABLED
    ):
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    if not valid_request_id(idempotency_key) or not req.question.strip():
        return _error(400, "consult.invalid_question")
    token = authorization.removeprefix("Bearer ")
    try:
        writer = get_ai_consult_sessionmaker()
        async with writer() as db:
            async with db.begin():
                guest = await require_guest(db, token, report_code)
                session = await get_guest_session(db, guest, report_code, session_id, lock=True)
                if session is None:
                    return _error(404, "consult.session_not_found")
                consent = await require_current_consent(db, guest.id, lock=True)
                if consent is None or consent.id != session.consent_id:
                    return _error(403, "consult.consent_required")
                started = await start_turn(db, session, idempotency_key, req.question)
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    except TurnConflict:
        return _error(409, "consult.idempotency_conflict")
    except TurnInProgress:
        return _error(409, "consult.in_progress")
    except ValueError:
        return _error(400, "consult.invalid_question")

    async def events():
        yield _sse_event("accepted", session_id=session_id, start=started, seq=1)
        if started.replay:
            if started.status == "completed" and started.answer and started.evidence:
                yield _sse_event("delta", session_id=session_id, start=started, seq=2,
                                 text=started.answer)
                yield _sse_event("evidence", session_id=session_id, start=started, seq=3,
                                 items=started.evidence)
                yield _sse_event("completed", session_id=session_id, start=started, seq=4,
                                 answer=started.answer, remaining_today=None)
            else:
                yield _sse_event("error", session_id=session_id, start=started, seq=2,
                                 code="consult.in_progress" if started.status == "running"
                                 else "consult.failed", retryable=started.status == "running")
            return

        yield _sse_event("status", session_id=session_id, start=started, seq=2,
                         phase="reading_evidence")
        yield _sse_event("status", session_id=session_id, start=started, seq=3,
                         phase="answering")
        try:
            async with async_session() as read_db:
                outcome = await prepare_answer_candidate(
                    read_db, session, req.question, provider=answer_provider
                )
        except asyncio.CancelledError:
            outcome = CandidateOutcome("interrupted", "", [], "system")
            try:
                await _finish(outcome)
            except Exception:
                pass
            raise
        except Exception:
            outcome = CandidateOutcome("report_unavailable", "", [], "system")

        try:
            completed = await _finish(outcome)
        except (GuestAccessDenied, TurnConflict, _ConsentRequired):
            yield _sse_event("error", session_id=session_id, start=started, seq=4,
                             code="consult.access_changed", retryable=False)
            return
        except Exception:
            yield _sse_event("error", session_id=session_id, start=started, seq=4,
                             code="consult.storage_unavailable", retryable=True)
            return
        if not completed:
            code = {
                "provider_unavailable": "consult.provider_unavailable",
                "report_unavailable": "consult.report_unavailable",
                "insufficient_evidence": "consult.insufficient_evidence",
                "emergency": "consult.urgent_help",
                "clinical_boundary": "consult.clinical_boundary",
                "longevity_boundary": "consult.longevity_boundary",
                "private_input": "consult.private_input",
            }.get(outcome.state, "consult.unsafe_answer")
            yield _sse_event("error", session_id=session_id, start=started, seq=4,
                             code=code, message=outcome.text,
                             retryable=code in {"consult.provider_unavailable", "consult.report_unavailable"})
            return
        yield _sse_event("delta", session_id=session_id, start=started, seq=4,
                         text=outcome.text)
        yield _sse_event("evidence", session_id=session_id, start=started, seq=5,
                         items=outcome.evidence)
        yield _sse_event("completed", session_id=session_id, start=started, seq=6,
                         answer=outcome.text, remaining_today=None)

    async def _finish(outcome: CandidateOutcome) -> bool:
        async with writer() as db:
            async with db.begin():
                guest = await require_guest(db, token, report_code)
                session = await get_guest_session(db, guest, report_code, session_id, lock=True)
                if session is None:
                    raise TurnConflict("Session no longer available")
                consent = await require_current_consent(db, guest.id, lock=True)
                if consent is None or consent.id != session.consent_id:
                    raise _ConsentRequired()
                return await finalize_turn(db, session, started, outcome)

    return StreamingResponse(events(), media_type="text/event-stream", headers=_stream_headers())
