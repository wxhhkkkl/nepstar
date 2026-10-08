"""入口配额与告知授权只使用内存替身，不访问任何数据库。"""

import hashlib
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDb:
    def __init__(self, settings=None, consent=None):
        self.settings = settings
        self.consent = consent
        self.statements = []
        self.added = []

    async def execute(self, statement):
        self.statements.append(statement)
        if "sa_ai_consult_settings" in str(statement):
            return FakeResult(self.settings)
        return FakeResult(self.consent)

    def add(self, row):
        self.added.append(row)


def ready_settings(**overrides):
    scope_text = "发送当前报告相关指标和当前问题，不发送聊天历史以外的个人资料。"
    values = dict(
        enabled=True,
        guest_create_limit_per_minute=2,
        guest_create_window_start=None,
        guest_create_count=0,
        provider_code="fake-provider",
        notice_version="v1",
        notice_text="测试告知，不用于真实健康数据。",
        data_scope_text=scope_text,
        data_scope_hash=hashlib.sha256(scope_text.encode()).hexdigest(),
    )
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.asyncio
async def test_guest_creation_uses_locked_global_minute_bucket_and_recovers():
    from app.services.ai_consult_entry_guard import GuestRateLimited, reserve_guest_creation

    config = ready_settings()
    db = FakeDb(settings=config)
    at = datetime(2026, 10, 8, 12, 34, 20)
    await reserve_guest_creation(db, now=at)
    await reserve_guest_creation(db, now=at + timedelta(seconds=1))
    assert config.guest_create_count == 2
    assert all(statement._for_update_arg is not None for statement in db.statements)

    with pytest.raises(GuestRateLimited) as error:
        await reserve_guest_creation(db, now=at + timedelta(seconds=2))
    assert error.value.retry_after_seconds == 38

    await reserve_guest_creation(db, now=at + timedelta(minutes=1))
    assert config.guest_create_count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("config", [None, ready_settings(enabled=False), ready_settings(guest_create_limit_per_minute=0)])
async def test_guest_creation_fails_closed_without_active_policy(config):
    from app.services.ai_consult_entry_guard import GuestEntryDisabled, reserve_guest_creation

    with pytest.raises(GuestEntryDisabled):
        await reserve_guest_creation(FakeDb(settings=config), now=datetime(2026, 10, 8, 12, 0))


@pytest.mark.asyncio
async def test_consent_accepts_only_current_published_notice_and_provider():
    from app.services.ai_consult_consent import ConsentMismatch, record_consent

    db = FakeDb(settings=ready_settings())
    guest = SimpleNamespace(id=7)
    with pytest.raises(ConsentMismatch):
        await record_consent(db, guest, notice_version="old", provider_code="fake-provider", accepted=True)
    with pytest.raises(ConsentMismatch):
        await record_consent(db, guest, notice_version="v1", provider_code="other", accepted=True)
    assert db.added == []

    accepted = await record_consent(db, guest, notice_version="v1", provider_code="fake-provider", accepted=True)
    assert accepted.guest_id == 7
    assert accepted.choice == "granted"
    assert accepted.data_scope_hash == db.settings.data_scope_hash
    assert db.added == [accepted]


@pytest.mark.asyncio
async def test_consent_refusal_or_withdrawal_never_grants_model_access():
    from app.services.ai_consult_consent import consent_is_current, record_consent

    config = ready_settings()
    db = FakeDb(settings=config)
    guest = SimpleNamespace(id=8)
    refused = await record_consent(db, guest, notice_version="v1", provider_code="fake-provider", accepted=False)
    assert refused.choice == "withdrawn"
    assert refused.withdrawn_at is not None
    assert not consent_is_current(refused, config, guest.id)

    granted = await record_consent(db, guest, notice_version="v1", provider_code="fake-provider", accepted=True)
    assert consent_is_current(granted, config, guest.id)
    assert not consent_is_current(granted, ready_settings(notice_version="v2"), guest.id)
    assert not consent_is_current(granted, ready_settings(notice_text="文案变更但管理员忘记升版本"), guest.id)
    assert not consent_is_current(granted, ready_settings(data_scope_hash="b" * 64), guest.id)
    assert not consent_is_current(granted, ready_settings(provider_code="new"), guest.id)
    assert not consent_is_current(granted, config, guest.id + 1)


@pytest.mark.asyncio
async def test_consent_fails_closed_without_complete_notice():
    from app.services.ai_consult_consent import ConsentUnavailable, record_consent

    guest = SimpleNamespace(id=9)
    for config in (
        None,
        ready_settings(notice_text=""),
        ready_settings(data_scope_hash=None),
        ready_settings(data_scope_text="已更改的发送范围"),
    ):
        with pytest.raises(ConsentUnavailable):
            await record_consent(FakeDb(settings=config), guest, notice_version="v1", provider_code="fake-provider", accepted=True)


@pytest.mark.asyncio
async def test_latest_withdrawal_blocks_an_earlier_grant():
    from app.services.ai_consult_consent import record_consent, require_current_consent

    db = FakeDb(settings=ready_settings())
    guest = SimpleNamespace(id=19)
    granted = await record_consent(db, guest, notice_version="v1", provider_code="fake-provider", accepted=True)
    db.consent = granted
    assert await require_current_consent(db, guest.id) is granted
    withdrawn = await record_consent(db, guest, notice_version="v1", provider_code="fake-provider", accepted=False)
    db.consent = withdrawn
    assert await require_current_consent(db, guest.id) is None
    assert "ORDER BY" in str(db.statements[-1])


@pytest.mark.asyncio
async def test_session_creation_can_lock_notice_settings_against_concurrent_withdrawal():
    from app.services.ai_consult_consent import record_consent, require_current_consent

    db = FakeDb(settings=ready_settings())
    guest = SimpleNamespace(id=23)
    db.consent = await record_consent(db, guest, notice_version="v1", provider_code="fake-provider", accepted=True)
    db.statements.clear()
    assert await require_current_consent(db, guest.id, lock=True) is db.consent
    assert db.statements[0]._for_update_arg is not None
