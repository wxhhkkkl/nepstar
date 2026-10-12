"""Local bootstrap must never use the shared application's write URL."""

import pytest

from scripts.ai_consult_prepare_local import local_url, preparation_action, initial_settings, prepare


@pytest.mark.parametrize("raw", [
    "mysql+pymysql://u:p@db.example/nepstar",
    "mysql+pymysql://u:p@localhost:3306/nepstar",
    "mysql+pymysql://u:p@127.0.0.1:3306/platform",
    "mysql+aiomysql://u:p@127.0.0.1:3306/nepstar",
    "mysql+pymysql://u:p@127.0.0.1:3306/nepstar?host=db.example",
    "mysql+pymysql://u:p@127.0.0.1/nepstar",
])
def test_only_explicit_loopback_nepstar_is_allowed(raw):
    with pytest.raises(ValueError):
        local_url(raw)


def test_local_target_does_not_fall_back_to_remote_config():
    assert local_url("mysql+pymysql://root@127.0.0.1:3306/nepstar").host == "127.0.0.1"


def test_any_existing_ai_object_blocks_writes():
    assert preparation_action(set()) == "create"
    assert preparation_action({"sa_user", "sa_indicator"}) == "create"
    with pytest.raises(ValueError):
        preparation_action({"sa_ai_consult_settings"})
    with pytest.raises(ValueError):
        preparation_action({"sa_ai_consult_unrecognized"})


def test_initial_settings_are_disabled_unpublished_and_do_not_store_secrets():
    values = initial_settings("test-model")
    assert values["enabled"] is False
    assert values["active_rule_version_id"] is None
    assert values["model_code"] == "test-model"
    assert values["daily_success_limit"] == values["global_daily_token_limit"] == 0
    assert "永久" in values["data_scope_text"]
    assert "历史" in values["data_scope_text"]
    assert not any("key" in name or "secret" in name for name in values)


def test_incomplete_config_blocks_before_engine_creation(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Must not create engine for invalid configuration")
    monkeypatch.setattr("scripts.ai_consult_prepare_local.sa.create_engine", forbidden)
    with pytest.raises(ValueError):
        prepare("mysql+pymysql://root@127.0.0.1:3306/nepstar", {}, apply=True)
