"""Create anonymous AI consultation tables in nepstar only.

Revision ID: 006
Revises: 005

Do not run through the repository's default alembic.ini: its sample URL targets
another database. This revision additionally checks the configured and current
database before issuing any DDL; the migration runner must use nepstar itself.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "nepstar"


def _assert_nepstar_target() -> None:
    bind = op.get_bind()
    configured_database = getattr(getattr(bind.engine, "url", None), "database", None)
    if configured_database != SCHEMA:
        raise RuntimeError("AI consult migration requires a nepstar connection URL")
    if bind.exec_driver_sql("SELECT DATABASE()").scalar() != SCHEMA:
        raise RuntimeError("AI consult migration requires nepstar as the current database")


def _create(name: str, *items) -> None:
    op.create_table(
        name, *items, schema=SCHEMA, mysql_engine="InnoDB", mysql_charset="utf8mb4"
    )


def upgrade() -> None:
    _assert_nepstar_target()

    _create(
        "sa_ai_consult_guest",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("token_digest", sa.String(64), nullable=False),
        sa.Column("report_code", sa.String(64), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_digest", name="uk_ai_guest_token_digest"),
    )
    _create(
        "sa_ai_consult_settings",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("provider_code", sa.String(50)),
        sa.Column("model_code", sa.String(100)),
        sa.Column("maintenance_text", sa.Text()),
        sa.Column("daily_success_limit", sa.Integer(), nullable=False),
        sa.Column("per_minute_limit", sa.Integer(), nullable=False),
        sa.Column("global_daily_token_limit", sa.BigInteger(), nullable=False),
        sa.Column("max_concurrent_generations", sa.Integer(), nullable=False),
        sa.Column("max_question_chars", sa.Integer(), nullable=False),
        sa.Column("retention_days", sa.Integer(), nullable=False),
        sa.Column("active_rule_version_id", sa.BigInteger()),
        sa.Column("updated_by", sa.BigInteger()),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("row_version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    _create(
        "sa_ai_consult_rule_version",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("version", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("published_by", sa.BigInteger()),
        sa.Column("published_at", sa.DateTime()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version", name="uk_ai_rule_version"),
    )
    _create(
        "sa_ai_consult_consent",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("guest_id", sa.BigInteger(), nullable=False),
        sa.Column("notice_version", sa.String(40), nullable=False),
        sa.Column("provider_code", sa.String(50), nullable=False),
        sa.Column("data_scope_hash", sa.String(64), nullable=False),
        sa.Column("choice", sa.String(20), nullable=False),
        sa.Column("decided_at", sa.DateTime(), nullable=False),
        sa.Column("withdrawn_at", sa.DateTime()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["guest_id"], ["nepstar.sa_ai_consult_guest.id"]),
    )
    op.create_index(
        "idx_ai_consent_guest_decided", "sa_ai_consult_consent", ["guest_id", "decided_at"], schema=SCHEMA
    )
    _create(
        "sa_ai_consult_session",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("guest_id", sa.BigInteger(), nullable=False),
        sa.Column("report_code", sa.String(64), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("source_plan_id", sa.BigInteger()),
        sa.Column("consent_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(255)),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime()),
        sa.Column("generation_epoch", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["guest_id"], ["nepstar.sa_ai_consult_guest.id"]),
        sa.ForeignKeyConstraint(["consent_id"], ["nepstar.sa_ai_consult_consent.id"]),
    )
    op.create_index(
        "idx_ai_session_guest_report_activity",
        "sa_ai_consult_session", ["guest_id", "report_code", "last_activity_at"], schema=SCHEMA,
    )
    op.create_index("idx_ai_session_expires", "sa_ai_consult_session", ["expires_at"], schema=SCHEMA)
    _create(
        "sa_ai_consult_turn",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("client_request_id", sa.String(36), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("answer_text", sa.Text()),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("evidence_refs_json", sa.Text()),
        sa.Column("rule_version_id", sa.BigInteger()),
        sa.Column("feedback_value", sa.String(20)),
        sa.Column("feedback_reason", sa.String(30)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "client_request_id", name="uk_ai_turn_request"),
        sa.ForeignKeyConstraint(["session_id"], ["nepstar.sa_ai_consult_session.id"]),
    )
    op.create_index(
        "idx_ai_turn_session_sequence", "sa_ai_consult_turn", ["session_id", "sequence"], schema=SCHEMA
    )
    _create(
        "sa_ai_consult_generation",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("turn_id", sa.BigInteger(), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("generation_epoch", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("partial_text", sa.Text()),
        sa.Column("provider_request_id", sa.String(100)),
        sa.Column("model_code", sa.String(100)),
        sa.Column("prompt_tokens", sa.Integer()),
        sa.Column("completion_tokens", sa.Integer()),
        sa.Column("error_category", sa.String(50)),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("first_valid_chunk_at", sa.DateTime()),
        sa.Column("finished_at", sa.DateTime()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("turn_id", "attempt_number", name="uk_ai_generation_attempt"),
        sa.ForeignKeyConstraint(["turn_id"], ["nepstar.sa_ai_consult_turn.id"]),
    )
    _create(
        "sa_ai_consult_admin_audit",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("actor_admin_id", sa.BigInteger(), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("target_id", sa.String(64)),
        sa.Column("change_summary_json", sa.Text()),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    _assert_nepstar_target()
    op.drop_table("sa_ai_consult_admin_audit", schema=SCHEMA)
    op.drop_table("sa_ai_consult_generation", schema=SCHEMA)
    op.drop_index("idx_ai_turn_session_sequence", table_name="sa_ai_consult_turn", schema=SCHEMA)
    op.drop_table("sa_ai_consult_turn", schema=SCHEMA)
    op.drop_index("idx_ai_session_expires", table_name="sa_ai_consult_session", schema=SCHEMA)
    op.drop_index("idx_ai_session_guest_report_activity", table_name="sa_ai_consult_session", schema=SCHEMA)
    op.drop_table("sa_ai_consult_session", schema=SCHEMA)
    op.drop_index("idx_ai_consent_guest_decided", table_name="sa_ai_consult_consent", schema=SCHEMA)
    op.drop_table("sa_ai_consult_consent", schema=SCHEMA)
    op.drop_table("sa_ai_consult_rule_version", schema=SCHEMA)
    op.drop_table("sa_ai_consult_settings", schema=SCHEMA)
    op.drop_table("sa_ai_consult_guest", schema=SCHEMA)
