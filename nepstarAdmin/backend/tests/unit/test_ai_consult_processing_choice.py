"""Optional processing choices use in-memory sessions, never a database/model."""

from types import SimpleNamespace

import pytest

from app.services import ai_consult_consent


class ChoiceDb:
    def __init__(self, choice=None, *, configured=True):
        self.choice = choice
        self.configured = configured
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        value = (
            SimpleNamespace(id=1) if self.configured else None
        ) if "sa_ai_consult_settings" in str(statement) else self.choice
        return SimpleNamespace(scalar_one_or_none=lambda: value)


@pytest.mark.asyncio
@pytest.mark.parametrize("choice,allowed", [
    (None, True),
    (SimpleNamespace(choice="granted", withdrawn_at=None), True),
    (SimpleNamespace(choice="withdrawn", withdrawn_at=None), False),
    (SimpleNamespace(choice="granted", withdrawn_at="withdrawn"), False),
    (SimpleNamespace(choice="unknown", withdrawn_at=None), False),
])
async def test_optional_choice_does_not_require_a_grant_but_respects_withdrawal(choice, allowed):
    db = ChoiceDb(choice)
    assert await ai_consult_consent.consult_processing_allowed(db, 7) is allowed
    query = db.statements[0]
    assert query.compile().params["guest_id_1"] == 7
    assert "decided_at DESC" in str(query) and "id DESC" in str(query)
    assert query.compile().params["param_1"] == 1


@pytest.mark.asyncio
async def test_choice_check_can_serialize_with_the_legacy_withdrawal_transaction():
    db = ChoiceDb()
    assert await ai_consult_consent.consult_processing_allowed(db, 7, lock=True)
    assert "sa_ai_consult_settings" in str(db.statements[0])
    assert "FOR UPDATE" in str(db.statements[0])
    assert "sa_ai_consult_consent" in str(db.statements[1])


@pytest.mark.asyncio
async def test_locked_check_fails_closed_if_settings_are_missing():
    db = ChoiceDb(configured=False)
    assert not await ai_consult_consent.consult_processing_allowed(db, 7, lock=True)
    assert len(db.statements) == 1
