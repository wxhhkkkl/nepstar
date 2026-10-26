"""公开报告下的匿名咨询入口；运行开关默认关闭，模型仅在显式安全配置时可用。"""

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, Response
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import (
    AiConsultStorageConfigurationError,
    async_session,
    get_ai_consult_sessionmaker,
)
from ..models.new.sa_ai_consult import SAAiConsultSettings, SAAiConsultTurn
from ..schemas.ai_consult import (
    ConsentCreate,
    ConsultFeedbackUpdate,
    ConsultRetryRequest,
    ConsultStopRequest,
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
    consult_processing_allowed,
    record_consent,
)
from ..services.ai_consult_control import ServicePaused, deployment_allows, last_pause_revision
from ..services.ai_consult_entry_guard import (
    GuestEntryDisabled,
    GuestRateLimited,
    public_maintenance_text,
    reserve_guest_creation,
)
from ..services.ai_consult_followups import (
    follow_up_questions_from_evidence,
    indicator_context_from_evidence,
)
from ..services.ai_consult_pipeline import CandidateOutcome, prepare_answer_candidate
from ..services.ai_consult_plan_context import resolve_current_entry_context
from ..services.ai_consult_provider import default_provider, provider_matches_configuration
from ..services.ai_consult_rules import ConsultRuleUnavailable, load_rule_content
from ..services.ai_consult_sessions import (
    ConsultReportDateUnavailable,
    build_welcome_context,
    end_guest_session,
    get_guest_session,
    is_latest_guest_session,
    new_home_session,
    public_session,
    verified_report_date,
)
from ..services.ai_consult_turns import (
    FeedbackNotAllowed,
    RetryConflict,
    StopConflict,
    TurnConflict,
    TurnInProgress,
    finalize_turn,
    get_session_turn,
    retry_turn,
    save_turn_feedback,
    stop_running_generation,
    start_turn,
    valid_request_id,
)
from ..services.ai_consult_usage import (
    ConsultLimitReached,
    remaining_daily_successes,
    reserve_generation_capacity,
)


router = APIRouter(prefix="/ai-consult", tags=["ai-consult"])
answer_provider = default_provider  # 默认 provider 为 Disabled；只有运维显式配置后才可能外发。


class _MaintenanceMode(Exception):
    def __init__(self, text: str):
        self.text = text


def _error(
    status_code: int,
    message: str,
    *,
    retry_after_seconds: int | None = None,
    maintenance_text: str | None = None,
) -> JSONResponse:
    headers = {"Cache-Control": "no-store"}
    if retry_after_seconds is not None:
        headers["Retry-After"] = str(retry_after_seconds)
    return JSONResponse(
        status_code=status_code,
        content={
            "code": status_code,
            "message": message,
            "data": (
                {"maintenance_text": maintenance_text}
                if message == "consult.maintenance" and maintenance_text
                else {"retry_after_seconds": retry_after_seconds}
                if retry_after_seconds is not None else None
            ),
        },
        headers=headers,
    )


async def verify_public_report(db: AsyncSession, report_code: str, customer_id: int) -> None:
    """仅复用现有只读报告归属/就绪检查，不复用聊天写会话。"""
    from ..services import ai_consult_sources, report_source, report_view_service

    try:
        await report_view_service._load_document_and_meta(
            ai_consult_sources.ReadOnlyReportSession(db), report_code, customer_id
        )
    except report_view_service.ReportViewError as exc:
        raise HTTPException(status_code=exc.code, detail="consult.report_unavailable") from exc
    except report_source.ReportSourceUnavailableError as exc:
        raise HTTPException(status_code=503, detail="consult.report_unavailable") from exc


async def load_public_report_home(db: AsyncSession, report_code: str, customer_id: int) -> dict:
    """用既有只读报告聚合核对归属并取得真实欢迎上下文。"""
    from ..services import ai_consult_sources, report_source, report_view_service

    try:
        return await report_view_service.build_home(
            ai_consult_sources.ReadOnlyReportSession(db), report_code, customer_id
        )
    except report_view_service.ReportViewError as exc:
        raise HTTPException(status_code=exc.code, detail="consult.report_unavailable") from exc
    except report_source.ReportSourceUnavailableError as exc:
        raise HTTPException(status_code=503, detail="consult.report_unavailable") from exc


async def load_public_entry_context(db, guest, home, *, plan_id, indicator_code):
    from ..services import ai_consult_sources, report_source, report_view_service
    try:
        return await resolve_current_entry_context(db, guest, home, plan_id=plan_id, indicator_code=indicator_code)
    except (ai_consult_sources.ReadBoundaryViolation, report_source.ReportSourceUnavailableError, report_view_service.ReportViewError) as exc:
        raise HTTPException(status_code=503, detail='consult.report_unavailable') from exc


@router.post("/guest-contexts")
async def create_guest_context(req: GuestContextCreate, response: Response):
    """创建独立 guest；入口开关关闭、存储未就绪或限流未配置时 fail closed。"""
    if not (settings.AI_CONSULT_GUEST_ENABLED is not False and settings.AI_CONSULT_OPERATIONS_READY is not False):
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
    except GuestEntryDisabled as exc:
        if exc.maintenance_text:
            return _error(503, "consult.maintenance", maintenance_text=exc.maintenance_text)
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
    plan_id: int | None = Query(default=None, gt=0),
    indicator_code: str | None = Query(default=None, min_length=2, max_length=64, pattern=r"^[A-Z][A-Z0-9_]+$"),
    authorization: str | None = Header(default=None),
):
    """返回当前 guest 可查看的真实报告摘要；不创建会话或调用模型。"""
    if not (settings.AI_CONSULT_GUEST_ENABLED is not False and settings.AI_CONSULT_OPERATIONS_READY is not False):
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    token = authorization.removeprefix("Bearer ")
    try:
        write_sessionmaker = get_ai_consult_sessionmaker()
        async with write_sessionmaker() as write_db:
            guest = await require_guest(write_db, token, report_code)
            config_result = await write_db.execute(
                select(SAAiConsultSettings).where(SAAiConsultSettings.id == 1)
            )
            notice_config = config_result.scalar_one_or_none()
            processing_allowed = await consult_processing_allowed(write_db, guest.id)
            maintenance_text = public_maintenance_text(notice_config)
            service_ready = bool(
                settings.AI_CONSULT_GUEST_ENABLED is not False
                and settings.AI_CONSULT_OPERATIONS_READY is not False
                and settings.AI_CONSULT_SESSIONS_ENABLED is not False
                and settings.AI_CONSULT_ANSWERS_ENABLED is not False
                and notice_config is not None
                and notice_config.enabled
                and processing_allowed
                and provider_matches_configuration(
                    answer_provider,
                    notice_config.provider_code,
                    notice_config.model_code,
                )
            )
            service_status = (
                "maintenance" if maintenance_text
                else "available" if service_ready
                else "unavailable"
            )
            remaining_today = None
            if service_status == "available" and notice_config is not None:
                remaining_today = await remaining_daily_successes(
                    write_db,
                    guest_id=guest.id,
                    daily_limit=notice_config.daily_success_limit,
                )
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")

    async with async_session() as read_db:
        try:
            home = await load_public_report_home(read_db, guest.report_code, guest.customer_id)
            entry_context = await load_public_entry_context(read_db, guest, home, plan_id=plan_id, indicator_code=indicator_code) if indicator_code else None
        except HTTPException as exc:
            return _error(exc.status_code, str(exc.detail))

    context = build_welcome_context(home)
    question_limit = getattr(notice_config, "max_question_chars", 500)
    if type(question_limit) is not int or not 0 <= question_limit <= 500:
        question_limit = 500
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(
        message="ok",
        data={
            **context,
            "entry_context": entry_context,
            "service_status": service_status,
            "maintenance_text": maintenance_text,
            "remaining_today": remaining_today,
            "max_question_chars": question_limit,
        },
    )


@router.post("/consents")
async def create_consent(
    req: ConsentCreate,
    response: Response,
    authorization: str | None = Header(default=None),
):
    """持有当前报告 guest 凭证的访问者记录同意或撤回；不调用模型。"""
    if not (settings.AI_CONSULT_GUEST_ENABLED is not False and settings.AI_CONSULT_OPERATIONS_READY is not False):
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
    """只为当前 guest 和报告创建会话；方案与指标来源均按当前报告重新核验。"""
    if not (
        settings.AI_CONSULT_GUEST_ENABLED is not False
        and settings.AI_CONSULT_SESSIONS_ENABLED is not False
        and settings.AI_CONSULT_OPERATIONS_READY is not False
    ):
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
            entry_context = await load_public_entry_context(read_db, guest, home, plan_id=req.plan_id, indicator_code=req.indicator_code) if req.source != 'home' else None
        report_date = verified_report_date(home, guest.report_code)
        if req.source != 'home' and (entry_context is None or entry_context.get('type') != req.source):
            return _error(409, 'consult.entry_unavailable')
        async with writer() as write_db:
            async with write_db.begin():
                # 报告读取之后重新检查访问凭证。
                guest = await require_guest(write_db, token, req.report_code)
                config_result = await write_db.execute(
                    select(SAAiConsultSettings)
                    .where(SAAiConsultSettings.id == 1)
                    .with_for_update()
                )
                config = config_result.scalar_one_or_none()
                maintenance_text = public_maintenance_text(config)
                if maintenance_text:
                    raise _MaintenanceMode(maintenance_text)
                if config is None or not config.enabled:
                    return _error(503, "consult.disabled")
                if not await consult_processing_allowed(write_db, guest.id, lock=True):
                    return _error(403, "consult.processing_withdrawn")
                item = new_home_session(
                    guest,
                    None,
                    report_date,
                    source=req.source,
                    plan_id=req.plan_id,
                    indicator_code=req.indicator_code,
                )
                write_db.add(item)
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    except HTTPException as exc:
        return _error(exc.status_code, str(exc.detail))
    except ConsultReportDateUnavailable:
        return _error(503, "consult.report_unavailable")
    except _MaintenanceMode as exc:
        return _error(503, "consult.maintenance", maintenance_text=exc.text)

    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(message="ok", data=public_session(item))


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    response: Response,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
):
    """Leaving/idle closure remains available while AI generation is disabled."""
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    if not valid_request_id(session_id):
        return _error(404, "consult.session_not_found")
    try:
        writer = get_ai_consult_sessionmaker()
        async with writer() as db:
            async with db.begin():
                guest = await require_guest(db, authorization.removeprefix("Bearer "), report_code)
                item = await end_guest_session(db, guest, report_code, session_id)
                if item is None:
                    return _error(404, "consult.session_not_found")
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.storage_unavailable")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    except Exception:
        return _error(503, "consult.storage_unavailable")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(data={"id": item.id, "status": "ended"})


@router.get("/sessions")
async def get_sessions(
    response: Response,
    report_code: str = Query(min_length=1, max_length=64),
    cursor: str | None = Query(default=None, max_length=160),
    authorization: str | None = Header(default=None),
):
    """产品不提供最近/历史咨询列表；已持有的旧地址也不能读取记录。"""
    del response, report_code, cursor, authorization
    return _error(410, "consult.history_unavailable")


@router.get("/sessions/{session_id}")
async def get_session_detail(
    session_id: str,
    response: Response,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
):
    """不提供已保存的完整会话读取；旧客户端也无法用此路由恢复历史。"""
    del session_id, response, report_code, authorization
    return _error(410, "consult.history_unavailable")


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
):
    """咨询内容按永久留存策略不提供删除端点。"""
    del session_id, report_code, authorization
    return _error(410, "consult.history_unavailable")


@router.get("/sessions/{session_id}/turns/{turn_id}")
async def get_turn_detail(
    session_id: str,
    turn_id: int,
    response: Response,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
):
    """只读一条已授权会话的持久化轮次，不回传未审核草稿。"""
    if not (
        settings.AI_CONSULT_GUEST_ENABLED is not False
        and settings.AI_CONSULT_SESSIONS_ENABLED is not False
        and settings.AI_CONSULT_OPERATIONS_READY is not False
    ):
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    if turn_id <= 0:
        return _error(404, "consult.turn_not_found")
    try:
        writer = get_ai_consult_sessionmaker()
        async with writer() as db:
            guest = await require_guest(db, authorization.removeprefix("Bearer "), report_code)
            if not await consult_processing_allowed(db, guest.id):
                return _error(403, "consult.processing_withdrawn")
            session = await get_guest_session(db, guest, report_code, session_id)
            if session is None:
                return _error(404, "consult.session_not_found")
            if not await is_latest_guest_session(db, guest, report_code, session_id):
                return _error(404, "consult.session_not_found")
            turn = await get_session_turn(db, session.id, turn_id)
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    if turn is None:
        return _error(404, "consult.turn_not_found")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(message="ok", data=turn)


@router.put("/sessions/{session_id}/turns/{turn_id}/feedback")
async def update_turn_feedback(
    session_id: str,
    turn_id: int,
    req: ConsultFeedbackUpdate,
    response: Response,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
):
    """Rate only a completed turn in the current guest's active report session."""
    if not (
        settings.AI_CONSULT_GUEST_ENABLED is not False
        and settings.AI_CONSULT_SESSIONS_ENABLED is not False
        and settings.AI_CONSULT_OPERATIONS_READY is not False
    ):
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    if turn_id <= 0:
        return _error(404, "consult.turn_not_found")
    try:
        writer = get_ai_consult_sessionmaker()
        async with writer() as db:
            async with db.begin():
                guest = await require_guest(db, authorization.removeprefix("Bearer "), report_code)
                session = await get_guest_session(db, guest, report_code, session_id, lock=True)
                if session is None:
                    return _error(404, "consult.session_not_found")
                if not await consult_processing_allowed(db, guest.id, lock=True):
                    return _error(403, "consult.processing_withdrawn")
                if not await is_latest_guest_session(db, guest, report_code, session_id):
                    return _error(404, "consult.session_not_found")
                turn = await save_turn_feedback(
                    db, session.id, turn_id, helpful=req.helpful, reason=req.reason
                )
                if turn is None:
                    return _error(404, "consult.turn_not_found")
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    except FeedbackNotAllowed:
        return _error(409, "consult.feedback_not_allowed")
    except Exception:
        return _error(503, "consult.storage_unavailable")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(data={
        "turn_id": turn.id,
        "feedback_value": turn.feedback_value,
        "feedback_reason": turn.feedback_reason,
    })


@router.post("/sessions/{session_id}/turns/{turn_id}/stop")
async def stop_turn(
    session_id: str,
    turn_id: int,
    req: ConsultStopRequest,
    response: Response,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
):
    """Stop one exact running attempt even if new AI generation is disabled."""
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    if turn_id <= 0:
        return _error(404, "consult.turn_not_found")
    try:
        writer = get_ai_consult_sessionmaker()
        async with writer() as db:
            async with db.begin():
                guest = await require_guest(db, authorization.removeprefix("Bearer "), report_code)
                session = await get_guest_session(db, guest, report_code, session_id, lock=True)
                if session is None:
                    return _error(404, "consult.session_not_found")
                stopped = await stop_running_generation(
                    db, session, turn_id, req.generation_id
                )
                if stopped is None:
                    return _error(404, "consult.turn_not_found")
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    except StopConflict:
        return _error(409, "consult.generation_changed")
    except Exception:
        return _error(503, "consult.storage_unavailable")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return ApiResponse(data={
        "turn_id": turn_id, "generation_id": req.generation_id, "status": "stopped"
    })


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


async def _prior_conversation_context(writer, session) -> dict[str, Any]:
    """Load a few prior user messages and displayed prompts for one bound indicator.

    Assistant answer text and old report facts are deliberately not queried or sent to
    the model. Prompts are extracted only from citations bound to this report/customer;
    every message is later re-filtered against the indicator selected for this turn.
    """
    try:
        async with writer() as db:
            result = await db.execute(
                select(SAAiConsultTurn.question_text, SAAiConsultTurn.evidence_refs_json)
                .where(
                    SAAiConsultTurn.session_id == session.id,
                    SAAiConsultTurn.status == "completed",
                    SAAiConsultTurn.answer_text.is_not(None),
                    SAAiConsultTurn.evidence_refs_json.is_not(None),
                )
                .order_by(SAAiConsultTurn.sequence.desc())
                .limit(5)
            )
            rows = result.all()
            if not rows:
                return {
                    "indicator_code": None, "user_messages": [],
                    "prior_follow_up_questions": [],
                }
            indicator_code = indicator_context_from_evidence(
                rows[0][1],
                report_code=session.report_code,
                customer_id=session.customer_id,
            )
            if not indicator_code:
                return {
                    "indicator_code": None, "user_messages": [],
                    "prior_follow_up_questions": [],
                }
            user_messages = []
            prior_follow_up_questions = []
            seen_questions = set()
            for question_text, evidence_json in rows:
                prior_indicator_code = indicator_context_from_evidence(
                    evidence_json,
                    report_code=session.report_code,
                    customer_id=session.customer_id,
                )
                if prior_indicator_code == indicator_code:
                    user_messages.append({"indicator_code": indicator_code, "text": question_text})
                    for question in follow_up_questions_from_evidence(
                        evidence_json,
                        report_code=session.report_code,
                        customer_id=session.customer_id,
                        indicator_code=indicator_code,
                    ):
                        key = question.casefold()
                        if key not in seen_questions:
                            prior_follow_up_questions.append({
                                "indicator_code": indicator_code,
                                "text": question,
                            })
                            seen_questions.add(key)
                        if len(prior_follow_up_questions) == 4:
                            break
                if len(prior_follow_up_questions) == 4:
                    break
            return {
                "indicator_code": indicator_code,
                "user_messages": user_messages,
                "prior_follow_up_questions": prior_follow_up_questions,
            }
    except Exception:
        # Conversation memory is optional; evidence selection fails closed without it.
        return {
            "indicator_code": None, "user_messages": [],
            "prior_follow_up_questions": [],
        }


# Bounds evidence/rule/model preparation; admission and final storage are separate.
CANDIDATE_PREPARATION_TIMEOUT_SECONDS = 60.0


async def _service_permits_generation(db, pause_revision):
    result = await db.execute(
        select(SAAiConsultSettings).where(SAAiConsultSettings.id == 1)
        .with_for_update().execution_options(populate_existing=True)
    )
    config = result.scalar_one_or_none()
    return bool(
        deployment_allows("guest", "sessions", "answers", "operations")
        and config and config.enabled and not public_maintenance_text(config)
        and provider_matches_configuration(answer_provider, config.provider_code, config.model_code)
        and await last_pause_revision(db) == pause_revision
    )


def _stream_generation(session_id, report_code, token, session, started, question, writer, pause_revision=0):
    async def _finish(outcome: CandidateOutcome) -> tuple[bool, int | None]:
        async with writer() as db:
            async with db.begin():
                guest = await require_guest(db, token, report_code)
                current_session = await get_guest_session(db, guest, report_code, session_id, lock=True)
                if current_session is None:
                    raise TurnConflict("Session no longer available")
                service_ready = await _service_permits_generation(db, pause_revision)
                allowed = await consult_processing_allowed(db, guest.id, lock=True)
                allowed = allowed and await is_latest_guest_session(
                    db, guest, report_code, session_id,
                )
                if not service_ready or not allowed:
                    # Keep real usage and a terminal generation, never store/publish the answer.
                    outcome = CandidateOutcome(
                        "access_changed" if service_ready else "service_paused", "", [], "system",
                        prompt_tokens=outcome.prompt_tokens,
                        completion_tokens=outcome.completion_tokens,
                    )
                completed = await finalize_turn(db, current_session, started, outcome)
                remaining_today = None
                if completed:
                    config = await db.scalar(
                        select(SAAiConsultSettings).where(SAAiConsultSettings.id == 1)
                    )
                    if config is not None and config.enabled:
                        remaining_today = await remaining_daily_successes(
                            db,
                            guest_id=guest.id,
                            daily_limit=config.daily_success_limit,
                        )
            # Raise only after the terminal state has committed, not inside the transaction.
            if not service_ready:
                raise ServicePaused()
            if not allowed:
                raise TurnConflict("Processing choice or active session changed")
            return completed, remaining_today

    async def events():
        yield _sse_event("accepted", session_id=session_id, start=started, seq=1)
        if started.replay:
            try:
                async with writer() as db:
                    async with db.begin():
                        service_ready = await _service_permits_generation(db, pause_revision)
                if not service_ready:
                    yield _sse_event("error", session_id=session_id, start=started, seq=2,
                                     code="consult.disabled", retryable=False)
                    return
            except Exception:
                yield _sse_event("error", session_id=session_id, start=started, seq=2,
                                 code="consult.storage_unavailable", retryable=True)
                return
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
            async with asyncio.timeout(CANDIDATE_PREPARATION_TIMEOUT_SECONDS):
                async with writer() as db:
                    async with db.begin():
                        if not await _service_permits_generation(db, pause_revision):
                            raise ServicePaused()
                conversation_context = await _prior_conversation_context(writer, session)
                async with writer() as rules_db:
                    turn = await rules_db.scalar(
                        select(SAAiConsultTurn).where(
                            SAAiConsultTurn.id == started.turn_id,
                            SAAiConsultTurn.session_id == session_id,
                        )
                    )
                    if turn is None:
                        raise ConsultRuleUnavailable("Consult turn no longer exists")
                    rule_instructions = await load_rule_content(
                        rules_db, turn.rule_version_id, allow_retired=True
                    )
                async with async_session() as read_db:
                    outcome = await prepare_answer_candidate(
                        read_db,
                        session,
                        question,
                        provider=answer_provider,
                        requested_indicator_code=session.source_indicator_code,
                        context_indicator_code=conversation_context["indicator_code"],
                        prior_user_context=conversation_context["user_messages"],
                        prior_follow_up_questions=conversation_context["prior_follow_up_questions"],
                        requested_plan_id=session.source_plan_id if session.source == "plan" else None,
                        rule_instructions=rule_instructions,
                    )
        except ServicePaused:
            outcome = CandidateOutcome("service_paused", "", [], "system", prompt_tokens=0, completion_tokens=0)
        except TimeoutError:
            # Unknown provider usage keeps the reservation conservative, not zero.
            outcome = CandidateOutcome(
                "timeout", "等待时间较长，本次回答未完成，请查询状态或稍后重试。", [], "system",
            )
        except ConsultRuleUnavailable:
            outcome = CandidateOutcome(
                "provider_unavailable", "当前回答规则无法校验，请稍后再试。", [], "system",
                prompt_tokens=0, completion_tokens=0,
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
            completed, remaining_today = await _finish(outcome)
        except ServicePaused:
            yield _sse_event("error", session_id=session_id, start=started, seq=4,
                             code="consult.disabled", retryable=False)
            return
        except (GuestAccessDenied, TurnConflict):
            yield _sse_event("error", session_id=session_id, start=started, seq=4,
                             code="consult.access_changed", retryable=False)
            return
        except Exception:
            yield _sse_event("error", session_id=session_id, start=started, seq=4,
                             code="consult.storage_unavailable", retryable=True)
            return
        if not completed:
            code = {
                "timeout": "consult.timeout",
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
                             retryable=code in {"consult.timeout", "consult.provider_unavailable", "consult.report_unavailable"})
            return
        yield _sse_event("delta", session_id=session_id, start=started, seq=4,
                         text=outcome.text)
        yield _sse_event("evidence", session_id=session_id, start=started, seq=5,
                         items=outcome.evidence)
        yield _sse_event("completed", session_id=session_id, start=started, seq=6,
                         answer=outcome.text, remaining_today=remaining_today)

    return StreamingResponse(events(), media_type="text/event-stream", headers=_stream_headers())


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
        settings.AI_CONSULT_GUEST_ENABLED is not False
        and settings.AI_CONSULT_SESSIONS_ENABLED is not False
        and settings.AI_CONSULT_ANSWERS_ENABLED is not False
        and settings.AI_CONSULT_OPERATIONS_READY is not False
        and getattr(answer_provider, "available", False)
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
                config_result = await db.execute(
                    select(SAAiConsultSettings)
                    .where(SAAiConsultSettings.id == 1)
                    .with_for_update()
                )
                provider_config = config_result.scalar_one_or_none()
                if not await consult_processing_allowed(db, guest.id, lock=True):
                    return _error(403, "consult.processing_withdrawn")
                maintenance_text = public_maintenance_text(provider_config)
                if maintenance_text:
                    return _error(503, "consult.maintenance", maintenance_text=maintenance_text)
                if provider_config is None or not provider_config.enabled or not provider_matches_configuration(
                    answer_provider,
                    provider_config.provider_code,
                    provider_config.model_code,
                ):
                    return _error(503, "consult.disabled")
                try:
                    if provider_config.active_rule_version_id is not None:
                        await load_rule_content(db, provider_config.active_rule_version_id)
                except ConsultRuleUnavailable:
                    return _error(503, "consult.rule_unavailable")
                if not await is_latest_guest_session(db, guest, report_code, session_id):
                    return _error(404, "consult.session_not_found")
                started = await start_turn(
                    db,
                    session,
                    idempotency_key,
                    req.question,
                    rule_version_id=provider_config.active_rule_version_id,
                )
                await reserve_generation_capacity(
                    db,
                    provider_config,
                    guest_id=guest.id,
                    start=started,
                    question=req.question,
                    token_budget=getattr(answer_provider, "token_budget", 0),
                    model_code=getattr(answer_provider, "model_code", ""),
                )
                pause_revision = await last_pause_revision(db)
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    except TurnConflict:
        return _error(409, "consult.idempotency_conflict")
    except TurnInProgress:
        return _error(409, "consult.in_progress")
    except ConsultLimitReached as exc:
        return _error(
            400 if exc.code == "consult.question_too_long"
            else 503 if exc.code in {"consult.disabled", "consult.capacity_busy"}
            else 429,
            exc.code,
            retry_after_seconds=exc.retry_after_seconds,
        )
    except ValueError:
        return _error(400, "consult.invalid_question")

    return _stream_generation(session_id, report_code, token, session, started, req.question, writer, pause_revision)


@router.post("/sessions/{session_id}/turns/{turn_id}/retry")
async def retry_generation(
    session_id: str,
    turn_id: int,
    req: ConsultRetryRequest,
    report_code: str = Query(min_length=1, max_length=64),
    authorization: str | None = Header(default=None),
):
    """Retry the stored question only when its expected attempt is terminal."""
    if not (
        settings.AI_CONSULT_GUEST_ENABLED is not False
        and settings.AI_CONSULT_SESSIONS_ENABLED is not False
        and settings.AI_CONSULT_ANSWERS_ENABLED is not False
        and settings.AI_CONSULT_OPERATIONS_READY is not False
        and getattr(answer_provider, "available", False)
    ):
        return _error(503, "consult.disabled")
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "consult.guest_token_required")
    if turn_id <= 0:
        return _error(404, "consult.turn_not_found")
    token = authorization.removeprefix("Bearer ")
    try:
        writer = get_ai_consult_sessionmaker()
        async with writer() as db:
            async with db.begin():
                guest = await require_guest(db, token, report_code)
                session = await get_guest_session(db, guest, report_code, session_id, lock=True)
                if session is None:
                    return _error(404, "consult.session_not_found")
                config_result = await db.execute(
                    select(SAAiConsultSettings)
                    .where(SAAiConsultSettings.id == 1)
                    .with_for_update()
                )
                provider_config = config_result.scalar_one_or_none()
                if not await consult_processing_allowed(db, guest.id, lock=True):
                    return _error(403, "consult.processing_withdrawn")
                maintenance_text = public_maintenance_text(provider_config)
                if maintenance_text:
                    return _error(503, "consult.maintenance", maintenance_text=maintenance_text)
                if provider_config is None or not provider_config.enabled or not provider_matches_configuration(
                    answer_provider,
                    provider_config.provider_code,
                    provider_config.model_code,
                ):
                    return _error(503, "consult.disabled")
                if not await is_latest_guest_session(db, guest, report_code, session_id):
                    return _error(404, "consult.session_not_found")
                retry = await retry_turn(db, session, turn_id, req.generation_id)
                if retry is None:
                    return _error(404, "consult.turn_not_found")
                started, question = retry
                current_turn = await db.get(SAAiConsultTurn, started.turn_id)
                if current_turn is None:
                    return _error(404, "consult.turn_not_found")
                try:
                    if current_turn.rule_version_id is not None:
                        await load_rule_content(
                            db, current_turn.rule_version_id, allow_retired=True
                        )
                except ConsultRuleUnavailable:
                    return _error(503, "consult.rule_unavailable")
                await reserve_generation_capacity(
                    db,
                    provider_config,
                    guest_id=guest.id,
                    start=started,
                    question=question,
                    token_budget=getattr(answer_provider, "token_budget", 0),
                    model_code=getattr(answer_provider, "model_code", ""),
                )
                pause_revision = await last_pause_revision(db)
    except (GuestAccessConfigurationError, AiConsultStorageConfigurationError):
        return _error(503, "consult.disabled")
    except GuestAccessDenied:
        return _error(403, "consult.guest_token_expired")
    except RetryConflict:
        return _error(409, "consult.generation_changed")
    except TurnInProgress:
        return _error(409, "consult.in_progress")
    except ConsultLimitReached as exc:
        return _error(
            400 if exc.code == "consult.question_too_long"
            else 503 if exc.code in {"consult.disabled", "consult.capacity_busy"}
            else 429,
            exc.code,
            retry_after_seconds=exc.retry_after_seconds,
        )
    return _stream_generation(session_id, report_code, token, session, started, question, writer, pause_revision)
