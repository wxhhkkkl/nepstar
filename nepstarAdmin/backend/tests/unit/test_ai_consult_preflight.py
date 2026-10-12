"""Deployment checks use synthetic configuration only, without app startup."""

import ast
import json
import os
import socket
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.ai_consult_preflight import evaluate, load_configuration


def prepared_config():
    return {
        "AI_CONSULT_GUEST_ENABLED": "false", "AI_CONSULT_SESSIONS_ENABLED": "false",
        "AI_CONSULT_ANSWERS_ENABLED": "false", "AI_CONSULT_OPERATIONS_READY": "false",
        "NEPSTAR_DATABASE_URL": "mysql+aiomysql://user:password@db.example.invalid/nepstar",
        "AI_CONSULT_TOKEN_HMAC_KEY": "h" * 32,
        "AI_CONSULT_PROVIDER": "openai_compatible",
        "AI_CONSULT_PROVIDER_BASE_URL": "https://model.example.invalid/v1",
        "AI_CONSULT_PROVIDER_API_KEY": "test-api-key-not-real",
        "AI_CONSULT_PROVIDER_MODEL": "test-model",
        "AI_CONSULT_PROVIDER_ALLOWED_HOSTS": "model.example.invalid",
        "AI_CONSULT_PROVIDER_TIMEOUT_SECONDS": "20",
    }


def test_defaults_pass_only_closed_deployment_not_activation():
    result = evaluate({})
    assert result["offline_checks_passed"] is True
    assert result["ready_to_enable"] is False
    assert result["manual_gates"]
    assert any(check["status"] == "warning" for check in result["checks"])
    assert all(check["status"] == "warning" for check in result["checks"]
               if check["id"].endswith(("_ENABLED", "_READY")))


def test_prepare_pilot_cannot_treat_unset_delegated_flags_as_explicitly_closed():
    config = prepared_config()
    del config["AI_CONSULT_ANSWERS_ENABLED"]
    result = evaluate(config, prepare_pilot=True)
    assert result["offline_checks_passed"] is False
    assert next(c for c in result["checks"] if c["id"] == "AI_CONSULT_ANSWERS_ENABLED")["status"] == "blocked"


def test_prepared_configuration_never_means_online_approval(monkeypatch):
    def no_network(*_args, **_kwargs):
        raise AssertionError("Offline preflight must not open sockets")

    monkeypatch.setattr(socket, "socket", no_network)
    result = evaluate(prepared_config(), prepare_pilot=True)
    assert result["offline_checks_passed"] is True
    assert result["ready_to_enable"] is False
    assert "app.main" not in sys.modules


@pytest.mark.parametrize("name", [
    "AI_CONSULT_GUEST_ENABLED", "AI_CONSULT_SESSIONS_ENABLED",
    "AI_CONSULT_ANSWERS_ENABLED", "AI_CONSULT_OPERATIONS_READY",
])
@pytest.mark.parametrize("value", ["true", "1", "yes", "invalid", "", " False "])
def test_all_activation_flags_must_be_unambiguously_closed(name, value):
    result = evaluate({name: value})
    assert result["offline_checks_passed"] is False
    assert next(c for c in result["checks"] if c["id"] == name)["status"] == "blocked"


@pytest.mark.parametrize("value", ["false", "0", "no", "OFF", "f", "n"])
def test_recognized_closed_flags(value):
    assert evaluate({"AI_CONSULT_ANSWERS_ENABLED": value})["offline_checks_passed"] is True


@pytest.mark.parametrize("url", [
    "mysql+aiomysql://user:secret@host/platform",
    "mysql+aiomysql://user:secret@host/nepstar?database=platform",
    "mysql+pymysql://user:secret@host/nepstar",
    "mysql+aiomysql://user:secret@host/",
    "sqlite:///nepstar", "not-a-url",
])
def test_wrong_write_database_or_driver_is_blocked_without_leaking_url(url):
    result = evaluate({"NEPSTAR_DATABASE_URL": url})
    assert result["offline_checks_passed"] is False
    assert url not in json.dumps(result)
    assert "secret" not in json.dumps(result)


@pytest.mark.parametrize("field", [
    "NEPSTAR_DATABASE_URL", "AI_CONSULT_TOKEN_HMAC_KEY", "AI_CONSULT_PROVIDER_API_KEY",
    "AI_CONSULT_PROVIDER_MODEL", "AI_CONSULT_PROVIDER_ALLOWED_HOSTS",
])
def test_preparing_pilot_requires_each_configuration_field(field):
    config = prepared_config()
    del config[field]
    assert evaluate(config, prepare_pilot=True)["offline_checks_passed"] is False


@pytest.mark.parametrize("base_url", [
    "http://model.example.invalid/v1", "https://127.0.0.1/v1",
    "https://user:secret@model.example.invalid/v1",
    "https://model.example.invalid:443/v1", "https://other.example.invalid/v1",
    "https://model.example.invalid/v1?api_key=secret", "https://model.example.invalid/v1#secret",
    "https://model.example.invalid/../v1",
    "https://model.example.invalid:bad/v1",
])
def test_provider_url_matches_runtime_safe_boundary(base_url):
    config = prepared_config()
    config["AI_CONSULT_PROVIDER_BASE_URL"] = base_url
    assert evaluate(config, prepare_pilot=True)["offline_checks_passed"] is False


@pytest.mark.parametrize("base_url", ["https://model.example.invalid", "https://model.example.invalid/"])
def test_offline_check_accepts_the_official_root_style_base_url(base_url):
    config = prepared_config()
    config["AI_CONSULT_PROVIDER_BASE_URL"] = base_url
    assert evaluate(config, prepare_pilot=True)["offline_checks_passed"] is True


@pytest.mark.parametrize("value", ["nan", "inf", "0", "61", "bad"])
def test_provider_timeout_has_a_finite_runtime_supported_range(value):
    config = prepared_config()
    config["AI_CONSULT_PROVIDER_TIMEOUT_SECONDS"] = value
    assert evaluate(config, prepare_pilot=True)["offline_checks_passed"] is False


def test_no_secret_or_connection_identifier_is_in_output():
    config = prepared_config()
    config["AI_CONSULT_TOKEN_HMAC_KEY"] = "sensitive-hmac-sentinel" * 2
    config["AI_CONSULT_PROVIDER_API_KEY"] = "sensitive-api-sentinel"
    result = json.dumps(evaluate(config, prepare_pilot=True))
    for name, value in config.items():
        if name.endswith(("_ENABLED", "_READY")):
            continue  # Public boolean policy values are not credentials/identifiers.
        assert value not in result


def test_env_loading_is_case_insensitive_with_process_environment_precedence(tmp_path):
    env_file = tmp_path / "synthetic.env"
    env_file.write_text("ai_consult_answers_enabled=true\nAI_CONSULT_PROVIDER=disabled\n", encoding="utf-8")
    config = load_configuration(env_file, {"AI_CONSULT_ANSWERS_ENABLED": "false"})
    assert config["AI_CONSULT_ANSWERS_ENABLED"] == "false"
    assert evaluate(config)["offline_checks_passed"] is True
    assert evaluate(load_configuration(env_file, {}))["offline_checks_passed"] is False


def test_explicit_missing_env_file_does_not_silently_pass(tmp_path):
    with pytest.raises(OSError):
        load_configuration(tmp_path / "missing.env", {})


@pytest.mark.parametrize("content", [
    'AI_CONSULT_ANSWERS_ENABLED="unterminated-secret',
    "AI_CONSULT_ANSWERS_ENABLED=false\nai_consult_answers_enabled=true",
])
def test_malformed_or_ambiguous_environment_file_is_rejected(tmp_path, content):
    env_file = tmp_path / "synthetic.env"
    env_file.write_text(content, encoding="utf-8")
    with pytest.raises(ValueError):
        load_configuration(env_file, {})


def test_safe_defaults_match_runtime_settings_without_importing_the_app():
    backend = Path(__file__).resolve().parents[2]
    config_tree = ast.parse((backend / "app" / "config.py").read_text(encoding="utf-8"))
    settings_class = next(node for node in config_tree.body
                          if isinstance(node, ast.ClassDef) and node.name == "Settings")
    defaults = {node.target.id: ast.literal_eval(node.value)
                for node in settings_class.body if isinstance(node, ast.AnnAssign)
                and node.target.id.startswith("AI_CONSULT_")}
    for flag in ("AI_CONSULT_GUEST_ENABLED", "AI_CONSULT_SESSIONS_ENABLED",
                 "AI_CONSULT_ANSWERS_ENABLED", "AI_CONSULT_OPERATIONS_READY"):
        assert defaults[flag] is None  # Database master switch defaults False; env False remains a veto.
    assert defaults["AI_CONSULT_PROVIDER"] == "disabled"


def test_cli_masks_configuration_errors(tmp_path):
    script = Path(__file__).resolve().parents[2] / "scripts" / "ai_consult_preflight.py"
    env_file = tmp_path / "synthetic.env"
    env_file.write_text('AI_CONSULT_PROVIDER_API_KEY="unterminated-secret', encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(script), "--env-file", str(env_file)],
        cwd=tmp_path, capture_output=True, text=True, timeout=5,
    )
    assert result.returncode == 2
    assert json.loads(result.stdout)["ready_to_enable"] is False
    assert "unterminated-secret" not in result.stdout + result.stderr


def test_cli_exit_status_and_json_never_start_the_application(tmp_path):
    script = Path(__file__).resolve().parents[2] / "scripts" / "ai_consult_preflight.py"
    config = prepared_config()
    config["AI_CONSULT_ANSWERS_ENABLED"] = "true"
    env_file = tmp_path / "synthetic.env"
    env_file.write_text("\n".join(f"{k}={v}" for k, v in config.items()), encoding="utf-8")
    environment = {key: value for key, value in os.environ.items()
                   if not key.upper().startswith("AI_CONSULT_") and key.upper() != "NEPSTAR_DATABASE_URL"}
    result = subprocess.run(
        [sys.executable, str(script), "--env-file", str(env_file), "--prepare-pilot"],
        cwd=tmp_path, env=environment, capture_output=True, text=True, timeout=5,
    )
    assert result.returncode == 2
    assert json.loads(result.stdout)["offline_checks_passed"] is False
    for key in ("NEPSTAR_DATABASE_URL", "AI_CONSULT_PROVIDER_API_KEY", "AI_CONSULT_TOKEN_HMAC_KEY"):
        assert config[key] not in result.stdout + result.stderr
