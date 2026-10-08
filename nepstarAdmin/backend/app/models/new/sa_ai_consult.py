"""AI 咨询业务表；全部显式限定在 nepstar schema。"""

from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ...database import Base


SCHEMA = "nepstar"


class SAAiConsultGuest(Base):
    __tablename__ = "sa_ai_consult_guest"
    __table_args__ = (UniqueConstraint("token_digest", name="uk_ai_guest_token_digest"), {"schema": SCHEMA})

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    report_code: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)


class SAAiConsultSettings(Base):
    __tablename__ = "sa_ai_consult_settings"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    provider_code: Mapped[str | None] = mapped_column(String(50))
    model_code: Mapped[str | None] = mapped_column(String(100))
    maintenance_text: Mapped[str | None] = mapped_column(Text)
    daily_success_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    per_minute_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    global_daily_token_limit: Mapped[int] = mapped_column(BigInteger, nullable=False)
    max_concurrent_generations: Mapped[int] = mapped_column(Integer, nullable=False)
    max_question_chars: Mapped[int] = mapped_column(Integer, nullable=False)
    retention_days: Mapped[int] = mapped_column(Integer, nullable=False)
    active_rule_version_id: Mapped[int | None] = mapped_column(BigInteger)
    updated_by: Mapped[int | None] = mapped_column(BigInteger)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    row_version: Mapped[int] = mapped_column(Integer, nullable=False)


class SAAiConsultRuleVersion(Base):
    __tablename__ = "sa_ai_consult_rule_version"
    __table_args__ = (UniqueConstraint("version", name="uk_ai_rule_version"), {"schema": SCHEMA})

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    published_by: Mapped[int | None] = mapped_column(BigInteger)
    published_at: Mapped[datetime | None] = mapped_column(DateTime)


class SAAiConsultConsent(Base):
    __tablename__ = "sa_ai_consult_consent"
    __table_args__ = (Index("idx_ai_consent_guest_decided", "guest_id", "decided_at"), {"schema": SCHEMA})

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("nepstar.sa_ai_consult_guest.id"), nullable=False)
    notice_version: Mapped[str] = mapped_column(String(40), nullable=False)
    provider_code: Mapped[str] = mapped_column(String(50), nullable=False)
    data_scope_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    choice: Mapped[str] = mapped_column(String(20), nullable=False)
    decided_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime)


class SAAiConsultSession(Base):
    __tablename__ = "sa_ai_consult_session"
    __table_args__ = (
        Index("idx_ai_session_guest_report_activity", "guest_id", "report_code", "last_activity_at"),
        Index("idx_ai_session_expires", "expires_at"),
        {"schema": SCHEMA},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("nepstar.sa_ai_consult_guest.id"), nullable=False)
    report_code: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    source_plan_id: Mapped[int | None] = mapped_column(BigInteger)
    consent_id: Mapped[int] = mapped_column(ForeignKey("nepstar.sa_ai_consult_consent.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    generation_epoch: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class SAAiConsultTurn(Base):
    __tablename__ = "sa_ai_consult_turn"
    __table_args__ = (
        UniqueConstraint("session_id", "client_request_id", name="uk_ai_turn_request"),
        Index("idx_ai_turn_session_sequence", "session_id", "sequence"),
        {"schema": SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("nepstar.sa_ai_consult_session.id"), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    client_request_id: Mapped[str] = mapped_column(String(36), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    answer_text: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    evidence_refs_json: Mapped[str | None] = mapped_column(Text)
    rule_version_id: Mapped[int | None] = mapped_column(BigInteger)
    feedback_value: Mapped[str | None] = mapped_column(String(20))
    feedback_reason: Mapped[str | None] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)


class SAAiConsultGeneration(Base):
    __tablename__ = "sa_ai_consult_generation"
    __table_args__ = (UniqueConstraint("turn_id", "attempt_number", name="uk_ai_generation_attempt"), {"schema": SCHEMA})

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    turn_id: Mapped[int] = mapped_column(ForeignKey("nepstar.sa_ai_consult_turn.id"), nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    generation_epoch: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    partial_text: Mapped[str | None] = mapped_column(Text)
    provider_request_id: Mapped[str | None] = mapped_column(String(100))
    model_code: Mapped[str | None] = mapped_column(String(100))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    error_category: Mapped[str | None] = mapped_column(String(50))
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    first_valid_chunk_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class SAAiConsultAdminAudit(Base):
    __tablename__ = "sa_ai_consult_admin_audit"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor_admin_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(64))
    change_summary_json: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
