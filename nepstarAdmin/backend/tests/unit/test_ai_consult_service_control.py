"""Emergency controls: pure memory/fake SQL, no application DB or model calls."""

from types import SimpleNamespace

import pytest
from sqlalchemy.dialects import mysql

from app.config import settings
from app.services.ai_consult_control import deployment_allows, last_pause_revision


@pytest.mark.parametrize("value,allowed", [(None, True), (True, True), (False, False)])
def test_unset_deployment_flags_delegate_to_database_but_false_is_a_hard_kill(monkeypatch, value, allowed):
    for flag in ("GUEST_ENABLED", "SESSIONS_ENABLED", "ANSWERS_ENABLED", "OPERATIONS_READY"):
        monkeypatch.setattr(settings, f"AI_CONSULT_{flag}", value)
    assert deployment_allows("guest", "sessions", "answers", "operations") is allowed


async def test_pause_revision_is_nepstar_only_current_read_under_settings_lock():
    class Db:
        async def execute(self, statement):
            self.statement = statement
            return SimpleNamespace(scalar_one_or_none=lambda: 14)
    db = Db()
    assert await last_pause_revision(db) == 14
    sql = str(db.statement.compile(dialect=mysql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "nepstar.sa_ai_consult_admin_audit" in sql
    assert "service.pause" in sql and "FOR UPDATE" in sql
    assert "ORDER BY" in sql and "LIMIT 1" in sql


async def test_no_pause_record_has_revision_zero():
    class Db:
        async def execute(self, statement):
            return SimpleNamespace(scalar_one_or_none=lambda: None)
    assert await last_pause_revision(Db()) == 0


@pytest.mark.asyncio
async def test_public_entry_state_is_read_only_and_failure_is_local(monkeypatch):
    from app.services.ai_consult_control import public_entry_status
    from unittest.mock import AsyncMock
    config = SimpleNamespace(enabled=True, maintenance_text=None, provider_code='x', model_code='y')
    db = SimpleNamespace(execute=AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: config)))
    for flag in ('GUEST_ENABLED', 'SESSIONS_ENABLED', 'ANSWERS_ENABLED', 'OPERATIONS_READY'):
        monkeypatch.setattr(settings, f'AI_CONSULT_{flag}', True)
    assert (await public_entry_status(db, provider_ready=True))['status'] == 'available'
    config.maintenance_text = '维护中'
    assert (await public_entry_status(db, provider_ready=True))['status'] == 'maintenance'
    db.execute.side_effect = RuntimeError('private connection details')
    result = await public_entry_status(db, provider_ready=True)
    assert result['status'] == 'unavailable'
    assert 'private' not in str(result)


@pytest.mark.asyncio
async def test_optional_status_read_has_a_deadline(monkeypatch):
    import asyncio
    from app.services import ai_consult_control as control
    from unittest.mock import AsyncMock
    monkeypatch.setattr(control, '_ENTRY_READ_TIMEOUT_SECONDS', .01)
    for flag in ('GUEST_ENABLED', 'SESSIONS_ENABLED', 'ANSWERS_ENABLED', 'OPERATIONS_READY'):
        monkeypatch.setattr(settings, f'AI_CONSULT_{flag}', True)
    async def stalled(*args):
        await asyncio.sleep(5)
    result = await control.public_entry_status(SimpleNamespace(execute=AsyncMock(side_effect=stalled)), provider_ready=True)
    assert result['status'] == 'unavailable'
