"""咨询迁移只可在 nepstar 执行，且只可操作新咨询表。"""

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import Column
from sqlalchemy.engine import make_url


MIGRATION = Path(__file__).parents[2] / "alembic/versions/006_ai_consult.py"
TABLES = {
    "sa_ai_consult_guest",
    "sa_ai_consult_settings",
    "sa_ai_consult_rule_version",
    "sa_ai_consult_consent",
    "sa_ai_consult_session",
    "sa_ai_consult_turn",
    "sa_ai_consult_generation",
    "sa_ai_consult_admin_audit",
}


def load_migration(path=MIGRATION):
    spec = importlib.util.spec_from_file_location("ai_consult_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeBind:
    def __init__(self, url_database, current_database):
        self.engine = SimpleNamespace(
            url=make_url(f"mysql+pymysql://test:test@127.0.0.1:3306/{url_database}")
        )
        self.current_database = current_database

    def exec_driver_sql(self, statement):
        assert statement == "SELECT DATABASE()"
        return SimpleNamespace(scalar=lambda: self.current_database)


@pytest.mark.parametrize("url_database,current_database", [("platform", "platform"), ("nepstar", "platform")])
@pytest.mark.parametrize("path", [MIGRATION, MIGRATION.with_name("007_ai_consult_source_indicator.py"), MIGRATION.with_name("008_ai_consult_optional_consent.py")])
@pytest.mark.parametrize("direction", ["upgrade", "downgrade"])
def test_migration_rejects_any_non_nepstar_target_before_ddl(monkeypatch, url_database, current_database, path, direction):
    migration = load_migration(path)
    created = []
    monkeypatch.setattr(migration.op, "get_bind", lambda: FakeBind(url_database, current_database))
    monkeypatch.setattr(migration.op, "create_table", lambda *args, **kwargs: created.append(args[0]))
    monkeypatch.setattr(migration.op, "add_column", lambda *args, **kwargs: created.append(args[0]))
    monkeypatch.setattr(migration.op, "alter_column", lambda *args, **kwargs: created.append(args[0]))
    monkeypatch.setattr(migration.op, "drop_table", lambda *args, **kwargs: created.append(args[0]))
    monkeypatch.setattr(migration.op, "drop_column", lambda *args, **kwargs: created.append(args[0]))

    with pytest.raises(RuntimeError):
        getattr(migration, direction)()

    assert created == []


def test_optional_consent_migration_only_changes_nullability_in_nepstar(monkeypatch):
    migration = load_migration(MIGRATION.with_name("008_ai_consult_optional_consent.py"))
    changes = []
    monkeypatch.setattr(migration.op, "get_bind", lambda: FakeBind("nepstar", "nepstar"))
    monkeypatch.setattr(migration.op, "alter_column", lambda *args, **kwargs: changes.append((args, kwargs)))
    migration.upgrade()
    assert migration.revision == "008" and migration.down_revision == "007"
    assert len(changes) == 1
    args, options = changes[0]
    assert args == ("sa_ai_consult_session", "consent_id")
    assert options["schema"] == "nepstar"
    assert options["nullable"] is True and options["existing_nullable"] is False
    from app.models.new.sa_ai_consult import SAAiConsultSession
    assert SAAiConsultSession.__table__.c.consent_id.nullable is True


@pytest.mark.parametrize("null_count,allowed", [(0, True), (1, False)])
def test_optional_consent_downgrade_never_discards_existing_sessions(monkeypatch, null_count, allowed):
    migration = load_migration(MIGRATION.with_name("008_ai_consult_optional_consent.py"))
    bind = FakeBind("nepstar", "nepstar")
    queries, changes = [], []
    def count(statement):
        queries.append(str(statement))
        return SimpleNamespace(scalar_one=lambda: null_count)
    bind.execute = count
    monkeypatch.setattr(migration.op, "get_bind", lambda: bind)
    monkeypatch.setattr(migration.op, "alter_column", lambda *args, **kwargs: changes.append((args, kwargs)))
    if allowed:
        migration.downgrade()
        assert changes[0][1]["nullable"] is False
        assert changes[0][1]["schema"] == "nepstar"
    else:
        with pytest.raises(RuntimeError, match="without consent"):
            migration.downgrade()
        assert changes == []
    assert queries == ["SELECT COUNT(*) FROM nepstar.sa_ai_consult_session WHERE consent_id IS NULL"]


def test_migration_creates_only_explicit_nepstar_consult_objects(monkeypatch):
    migration = load_migration()
    tables = []
    indexes = []
    monkeypatch.setattr(migration.op, "get_bind", lambda: FakeBind("nepstar", "nepstar"))
    monkeypatch.setattr(migration.op, "create_table", lambda name, *args, **kwargs: tables.append((name, kwargs)))
    monkeypatch.setattr(migration.op, "create_index", lambda name, table, *args, **kwargs: indexes.append((table, kwargs)))

    migration.upgrade()

    assert {name for name, _ in tables} == TABLES
    assert all(options.get("schema") == "nepstar" for _, options in tables)
    assert all(table in TABLES and options.get("schema") == "nepstar" for table, options in indexes)


def test_models_use_explicit_nepstar_schema():
    from app.models.new import sa_ai_consult

    model_tables = {
        value.__table__
        for value in vars(sa_ai_consult).values()
        if isinstance(value, type) and hasattr(value, "__table__")
    }
    assert {table.name for table in model_tables} == TABLES
    assert all(table.schema == "nepstar" for table in model_tables)


def test_migration_columns_match_the_consult_models(monkeypatch):
    from app.models.new import sa_ai_consult

    migration = load_migration()
    captured = {}
    monkeypatch.setattr(migration.op, "get_bind", lambda: FakeBind("nepstar", "nepstar"))
    monkeypatch.setattr(
        migration.op,
        "create_table",
        lambda name, *items, **kwargs: captured.update({
            name: {item.name for item in items if isinstance(item, Column)}
        }),
    )
    monkeypatch.setattr(migration.op, "create_index", lambda *args, **kwargs: None)

    migration.upgrade()

    # The latest model includes the indicator column introduced by 007.
    followup = load_migration(MIGRATION.with_name("007_ai_consult_source_indicator.py"))
    def capture_add_column(table, column, **kwargs):
        assert table == "sa_ai_consult_session"
        assert kwargs["schema"] == "nepstar"
        captured[table].add(column.name)
    monkeypatch.setattr(followup.op, "add_column", capture_add_column)
    followup.upgrade()

    model_tables = {
        value.__table__.name: value.__table__
        for value in vars(sa_ai_consult).values()
        if isinstance(value, type) and hasattr(value, "__table__")
    }
    assert captured == {
        name: {column.name for column in table.columns}
        for name, table in model_tables.items()
    }
