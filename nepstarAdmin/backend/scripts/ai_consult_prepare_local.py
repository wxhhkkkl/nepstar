"""Create only new AI tables on a loopback nepstar; never deploy or enable AI.

This local bootstrap runs 006/007/008 directly, without the default Alembic config,
earlier migrations, version stamps, application imports, or network AI calls.
Existing AI objects cause refusal, never overwrite/repair/drop them.
"""

import argparse
import hashlib
import importlib.util
import json
import os
from datetime import UTC, datetime
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.engine import make_url

try:
    from .ai_consult_preflight import evaluate, load_configuration
except ImportError:
    from ai_consult_preflight import evaluate, load_configuration


BACKEND = Path(__file__).resolve().parents[1]
TABLES = {
    "sa_ai_consult_guest", "sa_ai_consult_settings", "sa_ai_consult_rule_version",
    "sa_ai_consult_consent", "sa_ai_consult_session", "sa_ai_consult_turn",
    "sa_ai_consult_generation", "sa_ai_consult_admin_audit",
}
DEFAULT_LOCAL_URL = "mysql+pymysql://root@127.0.0.1:3306/nepstar"


def local_url(raw):
    url = make_url(raw)
    if (url.drivername != "mysql+pymysql" or url.host != "127.0.0.1"
            or url.port is None or url.database != "nepstar" or url.query):
        raise ValueError("Explicit loopback nepstar required")
    return url


def preparation_action(existing):
    if any(name.startswith("sa_ai_consult_") for name in existing):
        raise ValueError("Existing AI objects must not be overwritten")
    return "create"


def initial_settings(model):
    scope = "仅使用本次报告的必要指标和当前问题进行咨询。咨询问题与回答在后台永久保存，前台每次进入开始新咨询，不展示历史咨询。"
    return {
        "id": 1, "enabled": False, "provider_code": "openai_compatible",
        "model_code": model, "maintenance_text": "本地联调准备中，AI 咨询尚未启用。",
        "notice_version": "local-draft-v1",
        "notice_text": "本地联调告知草稿，尚未启用或批准真实报告外发。AI 回答仅供健康信息参考，不能替代医疗诊断、处方或就医建议。",
        "data_scope_text": scope,
        "data_scope_hash": hashlib.sha256(scope.encode("utf-8")).hexdigest(),
        "guest_create_limit_per_minute": 0, "guest_create_count": 0,
        "daily_success_limit": 0, "per_minute_limit": 0,
        "global_daily_token_limit": 0, "max_concurrent_generations": 0,
        "max_question_chars": 500,
        # Compatibility field only; no consultation content cleanup is scheduled.
        "retention_days": 30, "active_rule_version_id": None,
        "updated_at": datetime.now(UTC).replace(tzinfo=None), "row_version": 1,
    }


def prepare(url, config, *, apply=False):
    url = local_url(url)
    if not evaluate(config, prepare_pilot=True)["offline_checks_passed"]:
        raise ValueError("Offline preparation gates must pass with AI disabled")
    engine = sa.create_engine(url, connect_args={"connect_timeout": 5}, echo=False)
    try:
        with engine.connect() as connection:
            if not apply:
                connection.exec_driver_sql("SET SESSION TRANSACTION READ ONLY")
            if connection.exec_driver_sql("SELECT DATABASE()").scalar() != "nepstar":
                raise ValueError("Unexpected current database")
            before = set(sa.inspect(connection).get_table_names(schema="nepstar"))
            preparation_action(before)
            if not apply:
                return {"status": "prepared_not_applied", "writes": False,
                        "new_ai_tables": len(TABLES), "existing_tables": len(before)}
            connection.commit()
            operations = Operations(MigrationContext.configure(connection))
            for revision in (
                "006_ai_consult",
                "007_ai_consult_source_indicator",
                "008_ai_consult_optional_consent",
            ):
                path = BACKEND / "alembic" / "versions" / f"{revision}.py"
                spec = importlib.util.spec_from_file_location(revision, path)
                migration = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(migration)
                migration.op = operations
                migration.upgrade()
            values = initial_settings(config["AI_CONSULT_PROVIDER_MODEL"].strip())
            names = ", ".join(values)
            placeholders = ", ".join(f":{name}" for name in values)
            connection.execute(sa.text(
                f"INSERT INTO nepstar.sa_ai_consult_settings ({names}) VALUES ({placeholders})"
            ), values)
            connection.commit()
            inspector = sa.inspect(connection)
            after = set(inspector.get_table_names(schema="nepstar"))
            columns = {
                item["name"]: item
                for item in inspector.get_columns("sa_ai_consult_session", schema="nepstar")
            }
            if (
                after != before | TABLES
                or "source_indicator_code" not in columns
                or columns["consent_id"]["nullable"] is not True
            ):
                raise ValueError("Local bootstrap verification failed")
            return {"status": "local_preparation_passed", "writes": True,
                    "new_ai_tables": len(TABLES), "existing_tables_preserved": len(before),
                    "settings_enabled": False, "quotas_enabled": False,
                    "published_rule": False, "application_config_changed": False}
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="只准备本机 nepstar 的新 AI 表；不启用服务")
    parser.add_argument("--env-file", default=".env")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        result = prepare(
            os.environ.get("AI_CONSULT_LOCAL_DATABASE_URL", DEFAULT_LOCAL_URL),
            load_configuration(args.env_file), apply=args.apply,
        )
    except Exception as exc:
        # MySQL DDL is not transactional. Never attempt an automatic drop/retry.
        print(json.dumps({"status": "blocked", "error_category": type(exc).__name__,
                          "review_partial_ddl_if_apply": args.apply}))
        return 2
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
