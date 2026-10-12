"""Local opt-in gates do not alter dotenv or bypass published notice/rules."""

import hashlib
from types import SimpleNamespace

import pytest


def valid_policy():
    from scripts.local_ai_policy import LOCAL_BROWSER_VERSION, LOCAL_BROWSER_NOTICE, LOCAL_BROWSER_SCOPE, LOCAL_BROWSER_RULE
    config = SimpleNamespace(enabled=True, provider_code="openai_compatible", model_code="test-model",
                             notice_version=LOCAL_BROWSER_VERSION, notice_text=LOCAL_BROWSER_NOTICE,
                             data_scope_text=LOCAL_BROWSER_SCOPE,
                             data_scope_hash=hashlib.sha256(LOCAL_BROWSER_SCOPE.encode()).hexdigest(),
                             active_rule_version_id=2, maintenance_text=None,
                             guest_create_limit_per_minute=10, daily_success_limit=10, per_minute_limit=3,
                             global_daily_token_limit=100000, max_concurrent_generations=1, max_question_chars=300)
    rule = SimpleNamespace(id=2, version=LOCAL_BROWSER_VERSION, status="published", content=LOCAL_BROWSER_RULE,
                           content_hash=hashlib.sha256(LOCAL_BROWSER_RULE.encode()).hexdigest())
    return config, rule


def test_local_policy_requires_published_current_real_report_notice():
    from scripts.local_ai_policy import validate_browser_policy
    config, rule = valid_policy()
    validate_browser_policy(config, rule, "test-model")
    config.notice_version = "local-consult-v1"
    with pytest.raises(ValueError):
        validate_browser_policy(config, rule, "test-model")


@pytest.mark.parametrize("field,value", [("enabled", False), ("data_scope_hash", "invalid"),
                                          ("max_concurrent_generations", 0), ("daily_success_limit", 0),
                                          ("model_code", "different-model"), ("maintenance_text", "maintenance")])
def test_local_policy_fails_closed_on_incomplete_or_changed_configuration(field, value):
    from scripts.local_ai_policy import validate_browser_policy
    config, rule = valid_policy()
    setattr(config, field, value)
    with pytest.raises(ValueError):
        validate_browser_policy(config, rule, "test-model")


def test_pre_enable_validation_still_checks_all_other_fields():
    from scripts.local_ai_policy import validate_browser_policy
    config, rule = valid_policy()
    config.enabled = False
    validate_browser_policy(config, rule, "test-model", require_enabled=False)
    rule.content_hash = "invalid"
    with pytest.raises(ValueError):
        validate_browser_policy(config, rule, "test-model", require_enabled=False)


def test_admin_managed_startup_accepts_paused_service_and_saved_quota():
    from scripts.local_ai_runtime import validate_local_consult_configuration

    config, rule = valid_policy()
    config.enabled = False
    config.daily_success_limit = 20
    settings = SimpleNamespace(AI_CONSULT_PROVIDER_MODEL="test-model", AI_CONSULT_TOKEN_HMAC_KEY="x" * 32)
    provider = SimpleNamespace(endpoint="https://api.deepseek.com/chat/completions",
                               available=True, provider_code="openai_compatible", model_code="test-model")
    validate_local_consult_configuration(config, rule, settings, provider)
    assert config.enabled is False
    assert config.daily_success_limit == 20


@pytest.mark.parametrize("field,lower,upper", [
    ("guest_create_limit_per_minute", 0, 1000), ("daily_success_limit", 0, 1000),
    ("per_minute_limit", 0, 60), ("global_daily_token_limit", 0, 100000000),
    ("max_concurrent_generations", 0, 100), ("max_question_chars", 1, 500),
])
def test_admin_managed_limits_reuse_admin_bounds(field, lower, upper):
    from scripts.local_ai_policy import validate_browser_policy

    config, rule = valid_policy()
    config.enabled = False
    for value in (lower, upper):
        setattr(config, field, value)
        validate_browser_policy(config, rule, "test-model", require_enabled=False, admin_managed=True)
    for value in (lower - 1, upper + 1, True, "20"):
        setattr(config, field, value)
        with pytest.raises(ValueError):
            validate_browser_policy(config, rule, "test-model", require_enabled=False, admin_managed=True)


@pytest.mark.parametrize("invalid", ["notice", "rule", "key", "host", "model", "unavailable"])
def test_admin_managed_startup_keeps_notice_rules_and_provider_checks(invalid):
    from scripts.local_ai_runtime import validate_local_consult_configuration, LocalIsolationError

    config, rule = valid_policy()
    config.enabled = False
    settings = SimpleNamespace(AI_CONSULT_PROVIDER_MODEL="test-model", AI_CONSULT_TOKEN_HMAC_KEY="x" * 32)
    provider = SimpleNamespace(endpoint="https://api.deepseek.com/chat/completions",
                               available=True, provider_code="openai_compatible", model_code="test-model")
    if invalid == "notice":
        config.notice_version = "unknown"
    elif invalid == "rule":
        rule.status = "draft"
    elif invalid == "key":
        settings.AI_CONSULT_TOKEN_HMAC_KEY = "short"
    elif invalid == "host":
        provider.endpoint = "https://other.example/chat/completions"
    elif invalid == "model":
        provider.model_code = "different-model"
    else:
        provider.available = False
    with pytest.raises((ValueError, LocalIsolationError)):
        validate_local_consult_configuration(config, rule, settings, provider)


def test_process_gates_are_explicit_and_do_not_accept_enabled_dotenv():
    from scripts.local_ai_runtime import apply_local_gates, LocalIsolationError
    from scripts.ai_consult_preflight import FLAGS
    settings = SimpleNamespace(**dict.fromkeys(FLAGS, False))
    apply_local_gates(settings, enable_consult=False)
    assert not any(getattr(settings, name) for name in FLAGS)
    apply_local_gates(settings, enable_consult=True)
    assert all(getattr(settings, name) for name in FLAGS)
    with pytest.raises(LocalIsolationError):
        apply_local_gates(settings, enable_consult=True)
