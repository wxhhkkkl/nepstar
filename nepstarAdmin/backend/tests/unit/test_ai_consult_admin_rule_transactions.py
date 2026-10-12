import copy
import json
from datetime import datetime

from app.api.ai_consult_admin import activate_rule_version, publish_rule_version, update_settings
from app.models.new.sa_ai_consult import (
    SAAiConsultAdminAudit,
    SAAiConsultRuleVersion,
    SAAiConsultSettings,
)
from app.schemas.ai_consult_admin import AiConsultRuleActivation, AiConsultSettingsUpdate
from app.services.ai_consult_rules import rule_content_hash


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeTransaction:
    def __init__(self, db):
        self.db = db
        self.snapshot = None

    async def __aenter__(self):
        self.snapshot = (
            copy.deepcopy(self.db.settings),
            copy.deepcopy(self.db.rules),
            copy.deepcopy(self.db.audit_rows),
        )
        return self

    async def __aexit__(self, exception_type, _exception, _traceback):
        if exception_type is not None:
            self.db.settings, self.db.rules, self.db.audit_rows = self.snapshot
            self.db.rolled_back = True
        else:
            self.db.committed = True
        return False


class FakeNepstarSession:
    """In-memory unit-of-work double; never creates an engine or opens a connection."""

    def __init__(self, settings, rules):
        self.settings = settings
        self.rules = rules
        self.audit_rows = []
        self.locked_models = []
        self.committed = False
        self.rolled_back = False

    def begin(self):
        return FakeTransaction(self)

    async def execute(self, statement):
        entity = statement.column_descriptions[0]["entity"]
        assert statement._for_update_arg is not None
        self.locked_models.append(entity)
        if entity is SAAiConsultSettings:
            return FakeResult(self.settings)
        if entity is SAAiConsultRuleVersion:
            params = statement.compile().params
            rule_id = next(value for value in params.values() if type(value) is int)
            return FakeResult(self.rules.get(rule_id))
        raise AssertionError(f"Unexpected query entity: {entity}")

    async def get(self, entity, key):
        assert entity is SAAiConsultRuleVersion
        return self.rules.get(key)

    def add(self, item):
        if isinstance(item, SAAiConsultSettings):
            assert self.settings is None
            self.settings = item
            return
        assert isinstance(item, SAAiConsultAdminAudit)
        self.audit_rows.append(item)


def make_rule(rule_id, version, status, *, created_at=None, published_at=None, published_by=None):
    content = f"Use a calm, concise tone for {version}."
    return SAAiConsultRuleVersion(
        id=rule_id,
        version=version,
        status=status,
        content=content,
        content_hash=rule_content_hash(content),
        created_by=7,
        created_at=created_at or datetime(2026, 10, 1),
        published_by=published_by,
        published_at=published_at,
    )


def make_settings(*, active_rule_version_id=2, row_version=8):
    return SAAiConsultSettings(
        id=1,
        enabled=False,
        provider_code="openai_compatible",
        model_code="model-v1",
        maintenance_text=None,
        notice_version="notice-v1",
        notice_text="旧告知说明",
        data_scope_text="本次问题与相关报告事实",
        data_scope_hash=None,
        guest_create_limit_per_minute=5,
        guest_create_window_start=None,
        daily_success_limit=10,
        per_minute_limit=3,
        global_daily_token_limit=100000,
        max_concurrent_generations=2,
        max_question_chars=500,
        retention_days=30,
        active_rule_version_id=active_rule_version_id,
        row_version=row_version,
        updated_by=5,
        updated_at=datetime(2026, 10, 1),
    )


async def test_publish_locks_settings_and_rule_and_commits_audit():
    old_rule = make_rule(2, "2026-09-v1", "published", published_at=datetime(2026, 9, 1), published_by=5)
    draft = make_rule(3, "2026-10-v2", "draft")
    db = FakeNepstarSession(make_settings(), {2: old_rule, 3: draft})
    user = type("User", (), {"id": 12})()

    response = await publish_rule_version(
        3, AiConsultRuleActivation(expected_row_version=8), user, db
    )

    assert response.code == 200
    assert response.data["active_rule_version_id"] == 3
    assert response.data["row_version"] == 9
    assert db.settings.active_rule_version_id == 3
    assert db.settings.row_version == 9
    assert old_rule.status == "retired"
    assert draft.status == "published"
    assert draft.published_by == 12
    assert db.locked_models == [SAAiConsultSettings, SAAiConsultRuleVersion]
    assert db.committed is True
    assert db.rolled_back is False
    assert len(db.audit_rows) == 1
    audit = db.audit_rows[0]
    assert audit.action == "rule.publish"
    assert audit.actor_admin_id == 12
    assert audit.target_id == "3"
    assert json.loads(audit.change_summary_json) == {
        "from_rule_version_id": 2,
        "to_rule_version_id": 3,
        "from_row_version": 8,
        "to_row_version": 9,
    }
    assert draft.content not in audit.change_summary_json


async def test_activate_retired_rule_rolls_active_pointer_and_records_audit():
    previous = make_rule(
        3, "2026-10-v2", "published", published_at=datetime(2026, 10, 2), published_by=12
    )
    target = make_rule(
        2, "2026-09-v1", "retired", published_at=datetime(2026, 9, 1), published_by=5
    )
    db = FakeNepstarSession(make_settings(active_rule_version_id=3, row_version=9), {2: target, 3: previous})
    user = type("User", (), {"id": 15})()

    response = await activate_rule_version(
        2, AiConsultRuleActivation(expected_row_version=9), user, db
    )

    assert response.code == 200
    assert db.settings.active_rule_version_id == 2
    assert db.settings.row_version == 10
    assert target.status == "published"
    assert previous.status == "retired"
    assert db.committed is True
    assert len(db.audit_rows) == 1
    audit = db.audit_rows[0]
    assert audit.action == "rule.activate"
    assert audit.actor_admin_id == 15
    assert json.loads(audit.change_summary_json) == {
        "from_rule_version_id": 3,
        "to_rule_version_id": 2,
        "from_row_version": 9,
        "to_row_version": 10,
    }


async def test_row_version_conflict_rolls_back_without_rule_or_audit_changes():
    old_rule = make_rule(2, "2026-09-v1", "published", published_at=datetime(2026, 9, 1), published_by=5)
    draft = make_rule(3, "2026-10-v2", "draft")
    db = FakeNepstarSession(make_settings(row_version=8), {2: old_rule, 3: draft})
    user = type("User", (), {"id": 12})()

    response = await publish_rule_version(
        3, AiConsultRuleActivation(expected_row_version=7), user, db
    )

    assert response.status_code == 409
    assert json.loads(response.body)["message"] == "consult.admin_version_conflict"
    assert db.settings.active_rule_version_id == 2
    assert db.settings.row_version == 8
    assert db.rules[2].status == "published"
    assert db.rules[3].status == "draft"
    assert db.audit_rows == []
    assert db.rolled_back is True
    assert db.committed is False


def settings_update_request(expected_row_version):
    return AiConsultSettingsUpdate(
        expected_row_version=expected_row_version,
        enabled=False,
        provider_code="openai_compatible",
        model_code="model-v2",
        maintenance_text="稍后重试",
        notice_version="notice-v2",
        notice_text="更新后的数据使用说明",
        data_scope_text="本次问题、对话上下文与相关报告事实",
        guest_create_limit_per_minute=8,
        daily_success_limit=12,
        per_minute_limit=4,
        global_daily_token_limit=120000,
        max_concurrent_generations=3,
        max_question_chars=250,
    )


async def test_first_settings_save_keeps_configured_question_limit():
    db = FakeNepstarSession(None, {})
    user = type("User", (), {"id": 22})()

    response = await update_settings(settings_update_request(0), user, db)

    assert response.code == 200
    assert db.committed is True
    assert db.settings.enabled is False
    assert db.settings.max_question_chars == 250
    assert response.data["settings"]["max_question_chars"] == 250
    assert response.data["settings"]["row_version"] == 1
    assert len(db.audit_rows) == 1


async def test_settings_update_audits_field_names_only_and_never_echoes_secret():
    config = make_settings(row_version=4)
    secret_sentinel = "sentinel-provider-secret-do-not-return"
    config.provider_api_key = secret_sentinel
    db = FakeNepstarSession(config, {})
    user = type("User", (), {"id": 22})()

    response = await update_settings(settings_update_request(4), user, db)

    assert response.code == 200
    assert db.settings.row_version == 5
    assert db.settings.model_code == "model-v2"
    assert db.settings.max_question_chars == 250
    assert response.data["settings"]["max_question_chars"] == 250
    assert db.settings.updated_by == 22
    assert db.committed is True
    assert len(db.audit_rows) == 1
    audit = db.audit_rows[0]
    assert audit.action == "settings.update"
    assert audit.actor_admin_id == 22
    assert json.loads(audit.change_summary_json) == {
        "changed_fields": [
            "model_code",
            "maintenance_text",
            "notice_version",
            "notice_text",
            "data_scope_text",
            "guest_create_limit_per_minute",
            "daily_success_limit",
            "per_minute_limit",
            "global_daily_token_limit",
            "max_concurrent_generations",
            "max_question_chars",
        ],
        "from_row_version": 4,
        "to_row_version": 5,
    }
    serialized_response = response.model_dump_json()
    assert secret_sentinel not in serialized_response
    assert secret_sentinel not in audit.change_summary_json
    assert "更新后的数据使用说明" not in audit.change_summary_json
    assert "本次问题、对话上下文与相关报告事实" not in audit.change_summary_json
    assert "provider_api_key" not in response.data["settings"]


async def test_settings_version_conflict_rolls_back_and_does_not_audit():
    config = make_settings(row_version=5)
    original_notice = config.notice_text
    db = FakeNepstarSession(config, {})
    user = type("User", (), {"id": 22})()

    response = await update_settings(settings_update_request(4), user, db)

    assert response.status_code == 409
    assert json.loads(response.body)["message"] == "consult.admin_version_conflict"
    assert db.settings.row_version == 5
    assert db.settings.notice_text == original_notice
    assert db.audit_rows == []
    assert db.rolled_back is True
    assert db.committed is False
