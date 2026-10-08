"""匿名聊天凭证只证明持有权，不把公开报告参数当作聊天授权。"""

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app.security import ai_consult_access


NOW = datetime(2026, 10, 8, 10, 0, 0)
TEST_KEY = "test-only-hmac-key-" * 3


class FakeSession:
    def __init__(self, guest=None):
        self.guest = guest

    async def execute(self, statement):
        return SimpleNamespace(scalar_one_or_none=lambda: self.guest)


def test_same_public_report_creates_independent_unguessable_guest_secrets():
    first_token, first = ai_consult_access.build_guest_context(
        "R1", 1001, now=NOW, hmac_key=TEST_KEY
    )
    second_token, second = ai_consult_access.build_guest_context(
        "R1", 1001, now=NOW, hmac_key=TEST_KEY
    )

    assert first_token != second_token
    assert len(first_token) >= 43 and len(second_token) >= 43
    assert first.token_digest != second.token_digest
    assert first.report_code == second.report_code == "R1"
    assert first.customer_id == second.customer_id == 1001
    assert first.expires_at == second.expires_at == NOW + timedelta(days=30)
    assert first_token not in vars(first).values()


@pytest.mark.asyncio
async def test_valid_token_resolves_only_its_bound_report():
    token, guest = ai_consult_access.build_guest_context(
        "R1", 1001, now=NOW, hmac_key=TEST_KEY
    )

    assert await ai_consult_access.require_guest(
        FakeSession(guest), token, "R1", now=NOW, hmac_key=TEST_KEY
    ) is guest

    with pytest.raises(ai_consult_access.GuestAccessDenied):
        await ai_consult_access.require_guest(
            FakeSession(guest), token, "R2", now=NOW, hmac_key=TEST_KEY
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("token", ["", "R1", "1001", "a" * 500, "invalid token with spaces"])
async def test_public_report_parameters_and_bad_tokens_never_grant_chat_access(token):
    _, guest = ai_consult_access.build_guest_context(
        "R1", 1001, now=NOW, hmac_key=TEST_KEY
    )

    with pytest.raises(ai_consult_access.GuestAccessDenied):
        await ai_consult_access.require_guest(
            FakeSession(guest), token, "R1", now=NOW, hmac_key=TEST_KEY
        )


@pytest.mark.asyncio
async def test_forged_expired_and_revoked_tokens_are_rejected():
    token, guest = ai_consult_access.build_guest_context(
        "R1", 1001, now=NOW, hmac_key=TEST_KEY
    )
    forged = ai_consult_access.build_guest_context(
        "R1", 1001, now=NOW, hmac_key=TEST_KEY
    )[0]

    with pytest.raises(ai_consult_access.GuestAccessDenied):
        await ai_consult_access.require_guest(
            FakeSession(guest), forged, "R1", now=NOW, hmac_key=TEST_KEY
        )
    with pytest.raises(ai_consult_access.GuestAccessDenied):
        await ai_consult_access.require_guest(
            FakeSession(guest), token, "R1", now=NOW + timedelta(days=30), hmac_key=TEST_KEY
        )
    guest.revoked_at = NOW
    with pytest.raises(ai_consult_access.GuestAccessDenied):
        await ai_consult_access.require_guest(
            FakeSession(guest), token, "R1", now=NOW, hmac_key=TEST_KEY
        )


def test_missing_or_short_hmac_key_fails_closed():
    for key in ("", "short"):
        with pytest.raises(ai_consult_access.GuestAccessConfigurationError):
            ai_consult_access.build_guest_context(
                "R1", 1001, now=NOW, hmac_key=key
            )
