"""Local configuration templates cannot store secrets or activate production."""

from types import SimpleNamespace

import pytest

from scripts.configure_local_ai import RULE_CONTENT, RULE_VERSION, guard_rule, settings_payload


def test_local_configuration_is_small_disabled_and_explains_synthetic_scope():
    values = settings_payload("configured-model", 4)
    assert values["expected_row_version"] == 4
    assert values["enabled"] is False
    assert values["model_code"] == "configured-model"
    assert values["daily_success_limit"] == 10
    assert values["per_minute_limit"] == 3
    assert values["max_concurrent_generations"] == 1
    assert values["global_daily_token_limit"] == 100000
    assert values["max_question_chars"] == 300
    assert "虚构" in values["notice_text"]
    assert "DeepSeek" in values["notice_text"]
    assert "永久" in values["data_scope_text"]
    assert "历史" in values["data_scope_text"]
    assert not any("secret" in name or "key" in name for name in values)


def test_configuration_payload_matches_existing_admin_validation():
    from app.schemas.ai_consult_admin import AiConsultSettingsUpdate, AiConsultRuleDraftCreate
    assert AiConsultSettingsUpdate(**settings_payload("test-model", 1)).enabled is False
    assert AiConsultRuleDraftCreate(version=RULE_VERSION, content=RULE_CONTENT).content


def test_existing_user_rules_are_never_overwritten():
    with pytest.raises(ValueError):
        guard_rule(SimpleNamespace(id=1, content="user-maintained rule", status="draft"), None)
    with pytest.raises(ValueError):
        guard_rule(None, 2)
    assert guard_rule(None, None) is None
    matching = SimpleNamespace(id=1, content=RULE_CONTENT, status="published")
    assert guard_rule(matching, 1) is matching


def test_settings_comparison_normalizes_empty_text_and_checks_scope_hash():
    import hashlib
    from scripts.configure_local_ai import settings_need_update

    payload = settings_payload("test-model", 5)
    stored = {key: value for key, value in payload.items() if key != "expected_row_version"}
    stored["maintenance_text"] = None  # The admin API stores an empty string as NULL.
    stored["data_scope_hash"] = hashlib.sha256(payload["data_scope_text"].encode("utf-8")).hexdigest()
    row = SimpleNamespace(**stored)
    assert settings_need_update(row, payload) is False
    row.per_minute_limit = 4
    assert settings_need_update(row, payload) is True
    row.per_minute_limit = 3
    row.data_scope_hash = "outdated"
    assert settings_need_update(row, payload) is True


def test_browser_trial_notice_discloses_real_evidence_without_enabling_admin_payload():
    from scripts.configure_local_ai import browser_settings_payload
    from scripts.local_ai_policy import LOCAL_BROWSER_VERSION

    values = browser_settings_payload("test-model", 5)
    assert values["enabled"] is False  # Enabled only by a separate local audited transaction.
    assert values["notice_version"] == LOCAL_BROWSER_VERSION
    assert "必要报告指标" in values["notice_text"]
    assert "明确同意" in values["notice_text"]
    assert "DeepSeek" in values["notice_text"]
    assert "虚构" not in values["notice_text"]
    assert "永久" in values["data_scope_text"]
    assert "不展示历史" in values["data_scope_text"]
