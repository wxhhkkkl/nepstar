"""AI 咨询必须使用独立且明确指向 nepstar 的写连接。"""

import pytest

from app import database


@pytest.mark.parametrize(
    "url",
    [
        "",
        "mysql+aiomysql://test:test@127.0.0.1:3306/platform",
        "mysql+aiomysql://test:test@127.0.0.1:3306/kj_fastplus",
        "sqlite+aiosqlite:///nepstar.db",
        "mysql+aiomysql://test:test@127.0.0.1:3306/",
    ],
)
def test_refuses_missing_or_non_nepstar_write_target(monkeypatch, url):
    monkeypatch.setattr(database.settings, "NEPSTAR_DATABASE_URL", url)

    with pytest.raises(database.AiConsultStorageConfigurationError):
        database.get_ai_consult_sessionmaker()


def test_uses_a_dedicated_nepstar_engine_instead_of_the_legacy_session(monkeypatch):
    monkeypatch.setattr(
        database.settings,
        "NEPSTAR_DATABASE_URL",
        "mysql+aiomysql://test:test@127.0.0.1:3306/nepstar",
    )

    maker = database.get_ai_consult_sessionmaker()

    assert maker.kw["bind"] is not database.engine
    assert maker.kw["bind"].url.database == "nepstar"


def test_startup_probe_keeps_consult_unavailable_for_an_unsafe_target(monkeypatch):
    monkeypatch.setattr(
        database.settings,
        "NEPSTAR_DATABASE_URL",
        "mysql+aiomysql://test:test@127.0.0.1:3306/platform",
    )

    assert database.ai_consult_storage_ready() is False
