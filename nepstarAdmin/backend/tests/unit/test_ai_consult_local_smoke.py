"""Smoke fixture boundaries are checked without local storage or model I/O."""

import asyncio
from types import SimpleNamespace

import pytest

from scripts.ai_consult_local_smoke import CUSTOMER_ID, REPORT_CODE, assert_fixture_scope, overlay_synthetic_policy, synthetic_reader


@pytest.mark.parametrize("code,customer", [("REAL-REPORT", CUSTOMER_ID), (REPORT_CODE, 999)])
def test_no_real_report_scope_is_accepted(code, customer):
    with pytest.raises(ValueError):
        assert_fixture_scope(code, customer)


def test_fixture_reader_never_uses_report_database():
    scope = SimpleNamespace(report_code=REPORT_CODE, customer_id=CUSTOMER_ID)
    home = asyncio.run(synthetic_reader(object(), scope, "home"))
    assert home["report_code"] == REPORT_CODE
    with pytest.raises(ValueError):
        asyncio.run(synthetic_reader(object(), scope, "history"))


def test_test_only_activation_overlay_cannot_be_flushed_to_database():
    from sqlalchemy import inspect
    from app.models.new.sa_ai_consult import SAAiConsultSettings
    row = SAAiConsultSettings(enabled=False, notice_version="local-consult-v1", active_rule_version_id=1)
    overlay_synthetic_policy(row)
    assert row.enabled is True
    assert inspect(row).attrs.enabled.history.has_changes() is False
    with pytest.raises(ValueError):
        overlay_synthetic_policy(row)
