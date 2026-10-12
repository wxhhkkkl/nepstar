"""Opt-in read-only report-path test for explicit synthetic staging targets.

No .env fallback is allowed. A subprocess pins every report source to explicit
staging credentials, checks MySQL grants, audits SQL/Mongo commands, and reads
only the synthetic report named by the caller. It never writes data.
"""

from __future__ import annotations

import os
import json
import re
import subprocess
import sys
from urllib.parse import urlparse

import pytest
from sqlalchemy.engine import make_url


CONFIRMATION = "READ_ONLY_STAGING_ONLY"
AUDIT_PREFIX = "READ_ONLY_ACCEPTANCE="
_WRITE_PRIVILEGES = re.compile(
    r"\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRIGGER|EVENT|EXECUTE|"
    r"INDEX|REFERENCES|FILE|SUPER|GRANT OPTION|ALL PRIVILEGES)\b",
    re.IGNORECASE,
)


def validate_readonly_mysql_target(raw_url: str, confirmation: str) -> str:
    """Validate explicit external read target before opening a socket."""
    if confirmation != CONFIRMATION:
        raise ValueError("Explicit read-only staging confirmation is required")
    parsed = make_url(raw_url)
    if (
        parsed.drivername != "mysql+aiomysql"
        or not parsed.host
        or not parsed.port
        or not parsed.database
        or parsed.database.casefold() == "nepstar"
        or parsed.query
    ):
        raise ValueError("Use an explicit mysql+aiomysql external read-only database URL")
    return raw_url


def validate_readonly_mongo_target(raw_uri: str, database: str, collection: str, confirmation: str) -> str:
    """Validate explicit Mongo target; never derive it from application settings."""
    if confirmation != CONFIRMATION:
        raise ValueError("Explicit read-only staging confirmation is required")
    parsed = urlparse(raw_uri)
    if (
        parsed.scheme not in {"mongodb", "mongodb+srv"}
        or not parsed.hostname
        or not database.strip()
        or not collection.strip()
        or database.casefold() == "nepstar"
    ):
        raise ValueError("Use an explicit MongoDB external read-only target")
    return raw_uri


def assert_select_only_grants(grants: list[str]) -> None:
    """Fail closed unless SHOW GRANTS contains only USAGE/SELECT privileges."""
    if not grants:
        raise AssertionError("Database returned no grants for current user")
    saw_select = False
    for grant in grants:
        normalized = " ".join(grant.upper().split())
        if _WRITE_PRIVILEGES.search(normalized):
            raise AssertionError("MySQL account has a write-capable privilege")
        match = re.search(r"\bGRANT\s+(.+?)\s+ON\s+.+?\s+TO\s+", normalized)
        if not match:
            raise AssertionError("Unrecognized grant; cannot prove read-only access")
        privileges = {item.strip() for item in match.group(1).split(",")}
        if not privileges or not privileges <= {"USAGE", "SELECT"}:
            raise AssertionError("MySQL grant exceeds SELECT-only policy")
        saw_select = saw_select or "SELECT" in privileges
    if not saw_select:
        raise AssertionError("MySQL account has no explicit SELECT grant")


def assert_read_only_mongo_roles(roles: list[dict[str, str]], database: str) -> None:
    """Fail closed unless the Mongo principal has only the built-in DB read role."""
    if not roles or any(
        role.get("role") != "read" or role.get("db") != database
        for role in roles
    ):
        raise AssertionError("MongoDB account must have only the read role on the staging database")


def read_audit_summary(stdout: str) -> dict:
    """Only forward the fixed count fields, never subprocess logs or identifiers."""
    lines = [line[len(AUDIT_PREFIX):] for line in stdout.splitlines() if line.startswith(AUDIT_PREFIX)]
    if len(lines) != 1:
        raise AssertionError("A unique read-only audit summary is required")
    try:
        result = json.loads(lines[0])
    except ValueError:
        raise AssertionError("Invalid read-only audit summary") from None
    count_names = {"mysql_read_commands", "mongo_commands", "mysql_write_commands", "mongo_write_commands"}
    if (not isinstance(result, dict) or set(result) != count_names | {"report_path_verified"}
            or any(type(result[key]) is not int or result[key] < 0 for key in count_names)
            or result["report_path_verified"] is not True
            or result["mysql_read_commands"] < 1 or result["mongo_commands"] < 2
            or result["mysql_write_commands"] != 0 or result["mongo_write_commands"] != 0):
        raise AssertionError("Read-only full-path audit did not prove zero writes")
    return result


def test_external_target_guards_reject_unsafe_targets():
    safe_confirmation = CONFIRMATION
    safe_mysql = "mysql+aiomysql://readonly:secret@staging.example:53306/platform"
    assert validate_readonly_mysql_target(safe_mysql, safe_confirmation) == safe_mysql
    with pytest.raises(ValueError):
        validate_readonly_mysql_target(safe_mysql, "")
    with pytest.raises(ValueError):
        validate_readonly_mysql_target(
            "mysql+aiomysql://readonly:secret@staging.example:53306/nepstar",
            safe_confirmation,
        )
    with pytest.raises(ValueError):
        validate_readonly_mysql_target(
            "mysql+aiomysql://readonly:secret@staging.example:53306/platform?charset=utf8",
            safe_confirmation,
        )
    with pytest.raises(ValueError):
        validate_readonly_mongo_target("https://staging.example", "reports", "report", safe_confirmation)
    with pytest.raises(ValueError):
        validate_readonly_mongo_target("mongodb://staging.example", "nepstar", "report", safe_confirmation)


def test_grant_guard_accepts_select_and_rejects_write_privileges():
    assert_select_only_grants([
        "GRANT USAGE ON *.* TO `consult_reader`@`%`",
        "GRANT SELECT ON `platform`.* TO `consult_reader`@`%`",
    ])
    for grants in (
        ["GRANT SELECT, UPDATE ON `platform`.* TO `consult_reader`@`%`"],
        ["GRANT ALL PRIVILEGES ON `platform`.* TO `consult_reader`@`%`"],
        ["GRANT `reader_role`@`%` TO `consult_reader`@`%`"],
        [],
    ):
        with pytest.raises(AssertionError):
            assert_select_only_grants(grants)


def test_mongo_role_guard_requires_database_scoped_read_only_role():
    assert_read_only_mongo_roles([{"role": "read", "db": "receive_report_stage"}], "receive_report_stage")
    for roles in (
        [],
        [{"role": "readWrite", "db": "receive_report_stage"}],
        [{"role": "read", "db": "admin"}],
        [
            {"role": "read", "db": "receive_report_stage"},
            {"role": "readWrite", "db": "receive_report_stage"},
        ],
    ):
        with pytest.raises(AssertionError):
            assert_read_only_mongo_roles(roles, "receive_report_stage")


def test_audit_summary_accepts_only_verified_zero_write_counts_without_logs():
    audit = {"mysql_read_commands": 5, "mongo_commands": 3, "mysql_write_commands": 0,
             "mongo_write_commands": 0, "report_path_verified": True}
    output = "private-log-sentinel\n" + AUDIT_PREFIX + json.dumps(audit)
    assert read_audit_summary(output) == audit
    assert "private-log-sentinel" not in json.dumps(read_audit_summary(output))
    for change in ({"mongo_write_commands": 1}, {"report_path_verified": False},
                   {"mongo_commands": 1}, {"mysql_read_commands": True}, {"report_code": "private"}):
        with pytest.raises(AssertionError):
            read_audit_summary(AUDIT_PREFIX + json.dumps({**audit, **change}))
    with pytest.raises(AssertionError):
        read_audit_summary(output + "\n" + AUDIT_PREFIX + json.dumps(audit))


def test_live_integration_requires_complete_explicit_synthetic_fixture(monkeypatch):
    names = (
        "AI_CONSULT_READONLY_TEST_CONFIRM",
        "AI_CONSULT_READONLY_MYSQL_URL",
        "AI_CONSULT_READONLY_MONGO_URI",
        "AI_CONSULT_READONLY_MONGO_DATABASE",
        "AI_CONSULT_READONLY_MONGO_COLLECTION",
        "AI_CONSULT_READONLY_REPORT_CODE",
        "AI_CONSULT_READONLY_CUSTOMER_ID",
    )
    for name in names:
        monkeypatch.delenv(name, raising=False)
    assert _live_targets() is None

    monkeypatch.setenv("AI_CONSULT_READONLY_MYSQL_URL", "mysql+aiomysql://u:p@host:53306/platform")
    with pytest.raises(RuntimeError):
        _live_targets()

    values = {
        "AI_CONSULT_READONLY_TEST_CONFIRM": CONFIRMATION,
        "AI_CONSULT_READONLY_MYSQL_URL": "mysql+aiomysql://u:p@host:53306/platform",
        "AI_CONSULT_READONLY_MONGO_URI": "mongodb://host:27017",
        "AI_CONSULT_READONLY_MONGO_DATABASE": "receive_report",
        "AI_CONSULT_READONLY_MONGO_COLLECTION": "reportV2Info",
        "AI_CONSULT_READONLY_REPORT_CODE": "KH503LS0014998K260729093902424",
        "AI_CONSULT_READONLY_CUSTOMER_ID": "15439954",
    }
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    with pytest.raises(RuntimeError, match="synthetic staging report"):
        _live_targets()


def _live_targets() -> tuple[str, str, str, str, str, str] | None:
    names = (
        "AI_CONSULT_READONLY_TEST_CONFIRM",
        "AI_CONSULT_READONLY_MYSQL_URL",
        "AI_CONSULT_READONLY_MONGO_URI",
        "AI_CONSULT_READONLY_MONGO_DATABASE",
        "AI_CONSULT_READONLY_MONGO_COLLECTION",
        "AI_CONSULT_READONLY_REPORT_CODE",
        "AI_CONSULT_READONLY_CUSTOMER_ID",
    )
    supplied = [bool(os.environ.get(name)) for name in names]
    if not any(supplied):
        return None
    if not all(supplied):
        raise RuntimeError("Read-only integration requires all explicit staging variables")
    confirmation, mysql_url, mongo_uri, mongo_database, mongo_collection, report_code, customer_id = (
        os.environ[name] for name in names
    )
    if confirmation != CONFIRMATION:
        raise RuntimeError("Read-only integration confirmation did not match")
    if not re.fullmatch(r"AI-CONSULT-TEST-[A-Z0-9-]{1,48}", report_code):
        raise RuntimeError("Use a synthetic staging report with AI-CONSULT-TEST- prefix")
    if not customer_id.isdecimal() or int(customer_id) <= 0:
        raise RuntimeError("Provide the synthetic staging report's positive customer ID")
    return (
        validate_readonly_mysql_target(mysql_url, confirmation),
        validate_readonly_mongo_target(mongo_uri, mongo_database, mongo_collection, confirmation),
        mongo_database,
        mongo_collection,
        report_code,
        customer_id,
    )


@pytest.mark.asyncio
async def test_explicit_staging_mysql_and_mongo_accounts_are_read_only():
    targets = _live_targets()
    if targets is None:
        pytest.skip("No explicit read-only staging targets supplied; .env is never used")
    mysql_url, mongo_uri, mongo_database, mongo_collection, report_code, customer_id = targets

    child_env = os.environ.copy()
    child_env.update({
        # All app-side read engines in the subprocess are forced to the explicit staging URL.
        "DATABASE_URL": mysql_url,
        "CONFIG_DATABASE_URL": "",
        # Schema metadata only; the consultation write session factory is never invoked.
        "NEPSTAR_DATABASE_URL": "mysql+aiomysql://disabled:disabled@127.0.0.1:1/nepstar",
        "MONGODB_URL": mongo_uri,
        "MONGODB_DB": mongo_database,
        "MONGODB_COLLECTION": mongo_collection,
        "MONGODB_TIMEOUT_MS": "5000",
        "AI_CONSULT_GUEST_ENABLED": "false",
        "AI_CONSULT_SESSIONS_ENABLED": "false",
        "AI_CONSULT_ANSWERS_ENABLED": "false",
        "AI_CONSULT_OPERATIONS_READY": "false",
        "AI_CONSULT_PROVIDER": "disabled",
        "AI_CONSULT_PROVIDER_API_KEY": "",
    })
    script = r'''
import asyncio, json, os, re
from sqlalchemy import event, text
from sqlalchemy.engine import Engine

sql_commands = []
mongo_writes = []
mongo_commands = []
def audit_sql(_conn, _cursor, statement, _params, _context, _many):
    normalized = " ".join(statement.split()).upper()
    sql_commands.append(normalized)
    if not normalized.startswith(("SELECT ", "SHOW ", "DESCRIBE ", "EXPLAIN ")):
        raise AssertionError("Non-read SQL blocked before execution")
event.listen(Engine, "before_cursor_execute", audit_sql)

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import monitoring
class MongoAudit(monitoring.CommandListener):
    def started(self, event):
        mongo_commands.append(event.command_name)
        if event.command_name.casefold() in {
            "insert", "update", "delete", "findandmodify", "bulkwrite", "create",
            "drop", "dropdatabase", "renamecollection", "createindexes", "dropindexes",
            "committransaction", "aborttransaction", "applyops", "mapreduce",
        }:
            mongo_writes.append(event.command_name)
    def succeeded(self, _event): pass
    def failed(self, _event): pass

from app.api.ai_consult import verify_public_report, load_public_report_home
from app import mongo
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

def assert_grants(grants):
    saw_select = False
    writes = re.compile(r"\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRIGGER|EVENT|EXECUTE|INDEX|REFERENCES|FILE|SUPER|GRANT OPTION|ALL PRIVILEGES)\b", re.I)
    for grant in grants:
        normalized = " ".join(grant.upper().split())
        if writes.search(normalized):
            raise AssertionError("MySQL user has a write privilege")
        match = re.search(r"\bGRANT\s+(.+?)\s+ON\s+.+?\s+TO\s+", normalized)
        if not match or not set(x.strip() for x in match.group(1).split(",")) <= {"USAGE", "SELECT"}:
            raise AssertionError("MySQL grants are not provably SELECT-only")
        saw_select |= "SELECT" in match.group(1).split(",")
    if not saw_select:
        raise AssertionError("Missing SELECT grant")

async def main():
    url = os.environ["AI_CONSULT_READONLY_MYSQL_URL"]
    engine = create_async_engine(url, pool_pre_ping=True, pool_size=1, max_overflow=0)
    try:
        async with engine.connect() as conn:
            database = await conn.scalar(text("SELECT DATABASE()"))
            if not database or database.casefold() == "nepstar":
                raise AssertionError("MySQL read target is invalid")
            grants = list((await conn.execute(text("SHOW GRANTS FOR CURRENT_USER"))).scalars())
            assert_grants(grants)
        mongo._client = AsyncIOMotorClient(
            os.environ["MONGODB_URL"], event_listeners=[MongoAudit()], retryWrites=False,
            serverSelectionTimeoutMS=5000, connectTimeoutMS=5000, socketTimeoutMS=5000,
            appname="ai-consult-read-only-acceptance",
        )
        mongo_status = await mongo._client.admin.command({"connectionStatus": 1})
        roles = mongo_status.get("authInfo", {}).get("authenticatedUserRoles", [])
        if not roles or any(
            role.get("role") != "read" or role.get("db") != os.environ["MONGODB_DB"]
            for role in roles
        ):
            raise AssertionError("MongoDB account is not restricted to read on the staging database")
        session_maker = async_sessionmaker(engine, expire_on_commit=False)
        async with session_maker() as db:
            await verify_public_report(db, os.environ["AI_CONSULT_READONLY_REPORT_CODE"], int(os.environ["AI_CONSULT_READONLY_CUSTOMER_ID"]))
            home = await load_public_report_home(db, os.environ["AI_CONSULT_READONLY_REPORT_CODE"], int(os.environ["AI_CONSULT_READONLY_CUSTOMER_ID"]))
        if home.get("report", {}).get("report_code") != os.environ["AI_CONSULT_READONLY_REPORT_CODE"]:
            raise AssertionError("The verified report did not match the synthetic fixture")
        if not sql_commands or mongo_writes:
            raise AssertionError("Read audit was empty or observed a MongoDB write command")
        print("READ_ONLY_ACCEPTANCE=" + json.dumps({
            "mysql_read_commands": len(sql_commands), "mongo_commands": len(mongo_commands),
            "mysql_write_commands": 0, "mongo_write_commands": len(mongo_writes),
            "report_path_verified": True,
        }))
    finally:
        await mongo.close()
        await engine.dispose()

asyncio.run(main())
'''
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    child_env["AI_CONSULT_READONLY_MYSQL_URL"] = mysql_url
    child_env["AI_CONSULT_READONLY_REPORT_CODE"] = report_code
    child_env["AI_CONSULT_READONLY_CUSTOMER_ID"] = customer_id
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=backend_root,
        env=child_env,
        capture_output=True,
        text=True,
        timeout=90,
        check=False,
    )
    assert result.returncode == 0, "Staging read-only report path failed; captured output is withheld to avoid leaking credentials or health data"
    audit = read_audit_summary(result.stdout)
    print(AUDIT_PREFIX + json.dumps(audit))
