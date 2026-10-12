"""System-admin configuration for the anonymous AI consultation feature.

All feature configuration and audit writes use the dedicated nepstar session.
Provider secrets are never accepted from or returned by these endpoints.
"""

import hashlib
import json
import re
from datetime import UTC, date, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import AiConsultStorageConfigurationError, get_ai_consult_sessionmaker
from ..models.new.sa_ai_consult import (
    SAAiConsultAdminAudit,
    SAAiConsultRuleVersion,
    SAAiConsultSettings,
)
from ..schemas.ai_consult_admin import (
    AiConsultRuleActivation,
    AiConsultRuleDraftCreate,
    AiConsultSettingsUpdate,
    AiConsultServiceStateUpdate,
)
from ..schemas.response import ApiResponse
from ..security.ai_consult_admin_permission import require_ai_consult_system_admin
from ..services.ai_consult_provider import (
    default_provider,
    provider_matches_configuration,
)
from ..services.ai_consult_operations import load_operations_summary
from ..services.ai_consult_admin_history import load_dashboard, list_sessions, load_session_detail
from ..services.ai_consult_rules import rule_content_hash
from ..services.ai_consult_control import DEPLOYMENT_GATES, deployment_allows

router = APIRouter(prefix="/ai-consult/admin", tags=["ai-consult-admin"])
AUDITED_SETTINGS_FIELDS = (
    "enabled",
    "provider_code",
    "model_code",
    "maintenance_text",
    "notice_version",
    "notice_text",
    "data_scope_text",
    "guest_create_limit_per_minute",
    "daily_success_limit",
    "per_minute_limit",
    "global_daily_token_limit",
    "max_concurrent_generations",
    "max_question_chars",
)
_RULE_PRIVATE_DATA = re.compile(
    r"\b(?:KH|KJ)[A-Z0-9]{12,}\b|"
    r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)|"
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}",
    re.IGNORECASE,
)
_AUDIT_VERSION = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$")
_AUDIT_HASH = re.compile(r"^[a-f0-9]{64}$")
_MAX_AUDIT_SUMMARY_CHARS = 4096
_VISIBLE_ADMIN_AUDIT_ACTIONS = (
    "settings.update",
    "service.pause",
    "service.resume",
    "rule.draft_create",
    "rule.publish",
    "rule.activate",
)


class SettingsVersionConflict(Exception):
    def __init__(self, current_row_version: int):
        self.current_row_version = current_row_version


async def get_admin_settings_db():
    try:
        writer = get_ai_consult_sessionmaker()
    except AiConsultStorageConfigurationError as exc:
        raise HTTPException(status_code=503, detail="consult.admin_storage_unavailable") from exc
    async with writer() as db:
        yield db


def _runtime(config: SAAiConsultSettings | None) -> dict:
    provider_matches = bool(
        config
        and provider_matches_configuration(
            default_provider, config.provider_code, config.model_code
        )
    )
    gates = {name: deployment_allows(name) for name in DEPLOYMENT_GATES}
    blocked = ""
    if not all(gates.values()):
        names = {"guest": "入口", "sessions": "会话", "answers": "问答", "operations": "运营保护"}
        blocked = "部署环境已禁用：" + "、".join(names[k] for k, v in gates.items() if not v) + "。请检查当前 API 服务器配置。"
    elif config is None:
        blocked = "请先保存咨询设置。"
    elif len(settings.AI_CONSULT_TOKEN_HMAC_KEY.encode("utf-8")) < 32:
        blocked = "服务端聊天凭证摘要密钥尚未配置完整。"
    elif not provider_matches:
        blocked = "服务端模型不可用或与后台配置不匹配，请检查服务端模型与密钥配置。"
    elif config.maintenance_text and config.maintenance_text.strip():
        blocked = "当前仍有维护提示，请先完成维护配置。"
    elif any(getattr(config, name, 0) <= 0 for name in (
        "guest_create_limit_per_minute", "daily_success_limit", "per_minute_limit",
        "global_daily_token_limit", "max_concurrent_generations", "max_question_chars",
    )):
        blocked = "请先配置大于 0 的入口频率、问答额度、token 预算和并发上限。"
    return {
        "provider_code": getattr(default_provider, "provider_code", "disabled"),
        "model_code": getattr(default_provider, "model_code", "") or None,
        "provider_secret_configured": bool(settings.AI_CONSULT_PROVIDER_API_KEY),
        "provider_matches_settings": provider_matches,
        "feature_gates": gates,
        "can_enable": not blocked,
        "service_available": bool(config and config.enabled and not blocked),
        "activation_block_reason": blocked,
    }


def _public_settings(config: SAAiConsultSettings | None) -> dict:
    if config is None:
        return {
            "configured": False,
            "id": 1,
            "enabled": False,
            "provider_code": "openai_compatible",
            "model_code": "",
            "maintenance_text": "",
            "notice_version": "",
            "notice_text": "",
            "data_scope_text": "",
            "guest_create_limit_per_minute": 0,
            "daily_success_limit": 0,
            "per_minute_limit": 0,
            "global_daily_token_limit": 0,
            "max_concurrent_generations": 0,
            "max_question_chars": 500,
            "active_rule_version_id": None,
            "row_version": 0,
            "updated_at": None,
        }
    return {
        "configured": True,
        "id": config.id,
        "enabled": bool(config.enabled),
        "provider_code": config.provider_code or "",
        "model_code": config.model_code or "",
        "maintenance_text": config.maintenance_text or "",
        "notice_version": config.notice_version or "",
        "notice_text": config.notice_text or "",
        "data_scope_text": config.data_scope_text or "",
        "guest_create_limit_per_minute": config.guest_create_limit_per_minute,
        "daily_success_limit": config.daily_success_limit,
        "per_minute_limit": config.per_minute_limit,
        "global_daily_token_limit": config.global_daily_token_limit,
        "max_concurrent_generations": config.max_concurrent_generations,
        "max_question_chars": config.max_question_chars,
        "active_rule_version_id": config.active_rule_version_id,
        "row_version": config.row_version,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


@router.get("/settings")
async def get_settings(
    _user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    try:
        result = await db.execute(
            select(SAAiConsultSettings).where(SAAiConsultSettings.id == 1)
        )
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": 503, "message": "consult.admin_storage_unavailable", "data": None},
        )
    config = result.scalar_one_or_none()
    return _history_response({"settings": _public_settings(config), "runtime": _runtime(config)})


@router.get("/operations")
async def get_operations(
    _user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    try:
        summary = await load_operations_summary(db)
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": 503, "message": "consult.admin_storage_unavailable", "data": None},
        )
    return ApiResponse(data=summary)


def _history_response(data=None, *, status=200, message="success"):
    return JSONResponse(status_code=status, headers={
        "Cache-Control": "no-store", "Pragma": "no-cache", "Vary": "Authorization",
        "Referrer-Policy": "no-referrer",
    }, content=jsonable_encoder(ApiResponse(code=status, message=message, data=data)))


@router.get("/dashboard")
async def get_dashboard(
    day: date | None = Query(default=None),
    month: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    _user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    try:
        return _history_response(await load_dashboard(db, day=day, month=month))
    except (ValueError, OverflowError):
        return _history_response(status=422, message="consult.admin_period_invalid")
    except Exception:
        return _history_response(status=503, message="consult.admin_storage_unavailable")


@router.get("/sessions")
async def get_admin_sessions(
    report_code: str | None = Query(default=None, max_length=64),
    customer_id: int | None = Query(default=None, gt=0),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    state: Literal["empty", "active", "ended"] | None = Query(default=None),
    page: int = Query(default=1, ge=1, le=10000),
    page_size: int = Query(default=20, ge=1, le=100),
    _user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    try:
        return _history_response(await list_sessions(
            db, report_code=report_code, customer_id=customer_id, start_date=start_date, end_date=end_date,
            state=state, page=page, page_size=page_size))
    except (ValueError, OverflowError):
        return _history_response(status=422, message="consult.admin_period_invalid")
    except Exception:
        return _history_response(status=503, message="consult.admin_storage_unavailable")


@router.get("/sessions/{session_id}")
async def get_admin_session_detail(
    session_id: UUID,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=100000),
    _user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    try:
        detail = await load_session_detail(db, str(session_id), actor_admin_id=_user.id, limit=limit, offset=offset)
        if detail is None:
            return _history_response(status=404, message="consult.admin_session_not_found")
        return _history_response(detail)
    except Exception:
        # Do not return content if recording authorized content access fails.
        return _history_response(status=503, message="consult.admin_storage_unavailable")


def _public_rule(rule: SAAiConsultRuleVersion, *, active_id: int | None) -> dict:
    return {
        "id": rule.id,
        "version": rule.version,
        "status": rule.status,
        "active": rule.id == active_id,
        "content_hash": rule.content_hash,
        "created_by": rule.created_by,
        "created_at": rule.created_at.isoformat() + "Z",
        "published_by": rule.published_by,
        "published_at": rule.published_at.isoformat() + "Z" if rule.published_at else None,
    }


def _public_audit(entry: SAAiConsultAdminAudit) -> dict:
    """Return only bounded, known audit metadata; never expose stored JSON verbatim."""
    stored_summary = entry.change_summary_json
    try:
        raw_summary = (
            json.loads(stored_summary)
            if isinstance(stored_summary, str) and len(stored_summary) <= _MAX_AUDIT_SUMMARY_CHARS
            else {}
        )
    except (TypeError, ValueError):
        raw_summary = {}
    if not isinstance(raw_summary, dict):
        raw_summary = {}

    summary: dict = {}
    changed_fields = raw_summary.get("changed_fields")
    if isinstance(changed_fields, list):
        summary["changed_fields"] = sorted({
            value for value in changed_fields
            if isinstance(value, str) and value in AUDITED_SETTINGS_FIELDS
        })
    for key in ("from_row_version", "to_row_version", "from_rule_version_id", "to_rule_version_id"):
        value = raw_summary.get(key)
        if type(value) is int and value >= 0:
            summary[key] = value
    version = raw_summary.get("version")
    if isinstance(version, str) and _AUDIT_VERSION.fullmatch(version):
        summary["version"] = version
    content_hash = raw_summary.get("content_hash")
    if isinstance(content_hash, str) and _AUDIT_HASH.fullmatch(content_hash):
        summary["content_hash"] = content_hash
    content_length = raw_summary.get("content_length")
    if type(content_length) is int and 0 <= content_length <= 2000:
        summary["content_length"] = content_length

    target_id = entry.target_id
    if not isinstance(target_id, str) or len(target_id) > 64 or not target_id.isdigit():
        target_id = None
    occurred_at = entry.occurred_at
    return {
        "id": entry.id,
        "actor_admin_id": entry.actor_admin_id,
        "action": entry.action if entry.action in _VISIBLE_ADMIN_AUDIT_ACTIONS else "unknown",
        "target_id": target_id,
        "change_summary": summary,
        "occurred_at": occurred_at.isoformat(timespec="seconds") + "Z",
    }


@router.get("/audit")
async def list_admin_audit(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0, le=10000),
    _user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    try:
        entries = (
            await db.execute(
                select(SAAiConsultAdminAudit)
                .where(SAAiConsultAdminAudit.action.in_(_VISIBLE_ADMIN_AUDIT_ACTIONS))
                .order_by(desc(SAAiConsultAdminAudit.occurred_at), desc(SAAiConsultAdminAudit.id))
                .limit(limit + 1)
                .offset(offset)
            )
        ).scalars().all()
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": 503, "message": "consult.admin_storage_unavailable", "data": None},
        )
    has_more = len(entries) > limit
    return ApiResponse(data={
        "entries": [_public_audit(entry) for entry in entries[:limit]],
        "limit": limit,
        "offset": offset,
        "has_more": has_more,
    })


@router.get("/rules")
async def list_rule_versions(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=10000),
    _user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    try:
        config = await db.scalar(
            select(SAAiConsultSettings).where(SAAiConsultSettings.id == 1)
        )
        rules = (
            await db.execute(
                select(SAAiConsultRuleVersion)
                .order_by(desc(SAAiConsultRuleVersion.created_at), desc(SAAiConsultRuleVersion.id))
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": 503, "message": "consult.admin_storage_unavailable", "data": None},
        )
    active_id = config.active_rule_version_id if config else None
    return ApiResponse(data={
        "rules": [_public_rule(rule, active_id=active_id) for rule in rules],
        "active_rule_version_id": active_id,
        "limit": limit,
        "offset": offset,
    })


@router.get("/rules/{rule_id}")
async def get_rule_version(
    rule_id: int,
    _user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    if rule_id <= 0:
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "consult.admin_rule_not_found", "data": None},
        )
    try:
        config = await db.scalar(
            select(SAAiConsultSettings).where(SAAiConsultSettings.id == 1)
        )
        rule = await db.get(SAAiConsultRuleVersion, rule_id)
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": 503, "message": "consult.admin_storage_unavailable", "data": None},
        )
    if rule is None:
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "consult.admin_rule_not_found", "data": None},
        )
    if rule.content_hash != rule_content_hash(rule.content):
        return JSONResponse(
            status_code=409,
            content={"code": 409, "message": "consult.admin_rule_integrity_failed", "data": None},
        )
    active_id = config.active_rule_version_id if config else None
    return ApiResponse(data={**_public_rule(rule, active_id=active_id), "content": rule.content})


@router.post("/rules")
async def create_rule_draft(
    request: AiConsultRuleDraftCreate,
    user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    content = request.content.strip()
    if not content:
        return JSONResponse(
            status_code=422,
            content={"code": 422, "message": "consult.admin_rule_content_required", "data": None},
        )
    if _RULE_PRIVATE_DATA.search(content):
        return JSONResponse(
            status_code=422,
            content={"code": 422, "message": "consult.admin_rule_private_data", "data": None},
        )
    now = datetime.utcnow()
    content_hash = rule_content_hash(content)
    try:
        async with db.begin():
            exists = await db.scalar(
                select(SAAiConsultRuleVersion.id).where(
                    SAAiConsultRuleVersion.version == request.version
                )
            )
            if exists is not None:
                return JSONResponse(
                    status_code=409,
                    content={"code": 409, "message": "consult.admin_rule_version_exists", "data": None},
                )
            rule = SAAiConsultRuleVersion(
                version=request.version,
                status="draft",
                content=content,
                content_hash=content_hash,
                created_by=user.id,
                created_at=now,
                published_by=None,
                published_at=None,
            )
            db.add(rule)
            await db.flush()
            db.add(SAAiConsultAdminAudit(
                actor_admin_id=user.id,
                action="rule.draft_create",
                target_id=str(rule.id),
                change_summary_json=json.dumps(
                    {"version": rule.version, "content_hash": content_hash, "content_length": len(content)},
                    separators=(",", ":"),
                ),
                occurred_at=now,
            ))
    except IntegrityError:
        return JSONResponse(
            status_code=409,
            content={"code": 409, "message": "consult.admin_rule_version_exists", "data": None},
        )
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": 503, "message": "consult.admin_save_failed", "data": None},
        )
    return ApiResponse(data=_public_rule(rule, active_id=None))


async def _activate_rule_version(
    rule_id: int,
    request: AiConsultRuleActivation,
    user,
    db: AsyncSession,
    *,
    allow_draft: bool,
):
    if rule_id <= 0:
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "consult.admin_rule_not_found", "data": None},
        )
    now = datetime.utcnow()
    try:
        async with db.begin():
            config = (
                await db.execute(
                    select(SAAiConsultSettings)
                    .where(SAAiConsultSettings.id == 1)
                    .with_for_update()
                )
            ).scalar_one_or_none()
            if config is None:
                return JSONResponse(
                    status_code=409,
                    content={"code": 409, "message": "consult.admin_settings_missing", "data": None},
                )
            if request.expected_row_version != config.row_version:
                raise SettingsVersionConflict(config.row_version)
            rule = (
                await db.execute(
                    select(SAAiConsultRuleVersion)
                    .where(SAAiConsultRuleVersion.id == rule_id)
                    .with_for_update()
                )
            ).scalar_one_or_none()
            if rule is None:
                return JSONResponse(
                    status_code=404,
                    content={"code": 404, "message": "consult.admin_rule_not_found", "data": None},
                )
            valid_status = rule.status == "draft" if allow_draft else rule.status in {"published", "retired"}
            if not valid_status:
                return JSONResponse(
                    status_code=409,
                    content={"code": 409, "message": "consult.admin_rule_state_conflict", "data": None},
                )
            if rule.content_hash != rule_content_hash(rule.content):
                return JSONResponse(
                    status_code=409,
                    content={"code": 409, "message": "consult.admin_rule_integrity_failed", "data": None},
                )

            previous_id = config.active_rule_version_id
            if previous_id != rule.id:
                if previous_id is not None:
                    previous = await db.get(SAAiConsultRuleVersion, previous_id)
                    if previous is not None and previous.status == "published":
                        previous.status = "retired"
                if allow_draft:
                    rule.status = "published"
                    rule.published_by = user.id
                    rule.published_at = now
                else:
                    rule.status = "published"
                config.active_rule_version_id = rule.id
                config.row_version += 1
                config.updated_by = user.id
                config.updated_at = now
                db.add(SAAiConsultAdminAudit(
                    actor_admin_id=user.id,
                    action="rule.publish" if allow_draft else "rule.activate",
                    target_id=str(rule.id),
                    change_summary_json=json.dumps(
                        {
                            "from_rule_version_id": previous_id,
                            "to_rule_version_id": rule.id,
                            "from_row_version": request.expected_row_version,
                            "to_row_version": config.row_version,
                        },
                        separators=(",", ":"),
                    ),
                    occurred_at=now,
                ))
            active_id = config.active_rule_version_id
            row_version = config.row_version
    except SettingsVersionConflict as exc:
        return JSONResponse(
            status_code=409,
            content={
                "code": 409,
                "message": "consult.admin_version_conflict",
                "data": {"current_row_version": exc.current_row_version},
            },
        )
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": 503, "message": "consult.admin_save_failed", "data": None},
        )
    return ApiResponse(data={
        "rule": _public_rule(rule, active_id=active_id),
        "active_rule_version_id": active_id,
        "row_version": row_version,
    })


@router.post("/rules/{rule_id}/publish")
async def publish_rule_version(
    rule_id: int,
    request: AiConsultRuleActivation,
    user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    return await _activate_rule_version(rule_id, request, user, db, allow_draft=True)


@router.post("/rules/{rule_id}/activate")
async def activate_rule_version(
    rule_id: int,
    request: AiConsultRuleActivation,
    user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    return await _activate_rule_version(rule_id, request, user, db, allow_draft=False)


@router.put("/settings")
async def update_settings(
    request: AiConsultSettingsUpdate,
    user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    now = datetime.utcnow()
    try:
        async with db.begin():
            result = await db.execute(
                select(SAAiConsultSettings)
                .where(SAAiConsultSettings.id == 1)
                .with_for_update()
            )
            config = result.scalar_one_or_none()
            actual_version = config.row_version if config else 0
            if request.expected_row_version != actual_version:
                raise SettingsVersionConflict(actual_version)
            if request.enabled != bool(config and config.enabled):
                return JSONResponse(status_code=409, content={
                    "code": 409, "message": "consult.admin_activation_blocked",
                    "data": {"detail": "请使用独立的 AI 咨询服务开关，保存额度不会切换服务状态。"},
                })

            scope_text = request.data_scope_text.strip()
            values = {
                "enabled": bool(config and config.enabled),
                "provider_code": request.provider_code,
                "model_code": request.model_code.strip() or None,
                "maintenance_text": request.maintenance_text.strip() or None,
                "notice_version": request.notice_version.strip() or None,
                "notice_text": request.notice_text.strip() or None,
                "data_scope_text": scope_text or None,
                "data_scope_hash": hashlib.sha256(scope_text.encode("utf-8")).hexdigest()
                if scope_text
                else None,
                "guest_create_limit_per_minute": request.guest_create_limit_per_minute,
                "daily_success_limit": request.daily_success_limit,
                "per_minute_limit": request.per_minute_limit,
                "global_daily_token_limit": request.global_daily_token_limit,
                "max_concurrent_generations": request.max_concurrent_generations,
                "max_question_chars": request.max_question_chars,
                "updated_by": user.id,
                "updated_at": now,
                "row_version": actual_version + 1,
            }
            changed_fields = (
                [key for key in AUDITED_SETTINGS_FIELDS if getattr(config, key) != values[key]]
                if config
                else list(AUDITED_SETTINGS_FIELDS)
            )
            if config is None:
                config = SAAiConsultSettings(
                    id=1,
                    guest_create_window_start=None,
                    guest_create_count=0,
                    retention_days=30,
                    active_rule_version_id=None,
                    **values,
                )
                db.add(config)
            else:
                for key, value in values.items():
                    setattr(config, key, value)

            db.add(
                SAAiConsultAdminAudit(
                    actor_admin_id=user.id,
                    action="settings.update",
                    target_id="1",
                    change_summary_json=json.dumps(
                        {
                            "changed_fields": changed_fields,
                            "from_row_version": actual_version,
                            "to_row_version": actual_version + 1,
                        },
                        separators=(",", ":"),
                    ),
                    occurred_at=now,
                )
            )
    except SettingsVersionConflict as exc:
        return JSONResponse(
            status_code=409,
            content={
                "code": 409,
                "message": "consult.admin_version_conflict",
                "data": {"current_row_version": exc.current_row_version},
            },
        )
    except AiConsultStorageConfigurationError:
        return JSONResponse(
            status_code=503,
            content={"code": 503, "message": "consult.admin_storage_unavailable", "data": None},
        )
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"code": 503, "message": "consult.admin_save_failed", "data": None},
        )

    return ApiResponse(
        data={"settings": _public_settings(config), "runtime": _runtime(config)}
    )


@router.put("/service-state")
async def update_service_state(
    request: AiConsultServiceStateUpdate,
    user=Depends(require_ai_consult_system_admin),
    db: AsyncSession = Depends(get_admin_settings_db),
):
    """Emergency pause is always available; resume cannot override deployment vetoes."""
    try:
        async with db.begin():
            result = await db.execute(
                select(SAAiConsultSettings).where(SAAiConsultSettings.id == 1).with_for_update()
            )
            config = result.scalar_one_or_none()
            actual_version = config.row_version if config else 0
            if request.expected_row_version != actual_version:
                raise SettingsVersionConflict(actual_version)
            if config is None:
                return JSONResponse(status_code=409, content={
                    "code": 409, "message": "consult.admin_settings_required", "data": None,
                })
            if request.enabled and not _runtime(config)["can_enable"]:
                return JSONResponse(status_code=409, content={
                    "code": 409, "message": "consult.admin_activation_blocked",
                    "data": {"detail": _runtime(config)["activation_block_reason"]},
                })
            if bool(config.enabled) != request.enabled:
                now = datetime.now(UTC).replace(tzinfo=None)
                config.enabled = request.enabled
                config.row_version += 1
                config.updated_by, config.updated_at = user.id, now
                db.add(SAAiConsultAdminAudit(
                    actor_admin_id=user.id,
                    action="service.resume" if request.enabled else "service.pause",
                    target_id="1",
                    change_summary_json=json.dumps({
                        "changed_fields": ["enabled"],
                        "from_row_version": actual_version,
                        "to_row_version": config.row_version,
                    }, separators=(",", ":")),
                    occurred_at=now,
                ))
    except SettingsVersionConflict as exc:
        return JSONResponse(status_code=409, content={
            "code": 409, "message": "consult.admin_version_conflict",
            "data": {"current_row_version": exc.current_row_version},
        })
    except Exception:
        return JSONResponse(status_code=503, content={
            "code": 503, "message": "consult.admin_save_failed", "data": None,
        })
    return _history_response({"settings": _public_settings(config), "runtime": _runtime(config)})
