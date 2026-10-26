"""Reproducible offline plan-feature checks; never import tests/conftest or open a socket.

Run from backend: .venv/bin/python scripts/test_report_plan.py
Optional arguments replace the default test selection (pytest options are accepted).
"""
from pathlib import Path
import socket
import sys
import types
from unittest.mock import patch


BACKEND = Path(__file__).resolve().parents[1]
TESTS = [
    'tests/unit/test_report_plan_context.py',
    'tests/unit/test_report_plan_api.py',
    'tests/unit/test_product_content.py',
    'tests/unit/test_report_plan_source.py',
    'tests/unit/test_report_view_service.py',
    'tests/unit/test_ai_consult_plan_sources.py',
    'tests/unit/test_ai_consult_read_boundary.py',
    'tests/unit/test_ai_consult_evidence.py',
    'tests/unit/test_ai_consult_service_control.py',
    'tests/unit/test_local_ai_runtime.py',
    'tests/api/test_ai_consult_plan_context.py',
]


def main():
    sys.path.insert(0, str(BACKEND))
    import pytest
    from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table
    from sqlalchemy.exc import SQLAlchemyError

    # Existing production models reflect this legacy table at import time.
    # Supply the exact metadata needed by the read-boundary tests without IO.
    legacy = types.ModuleType('app.models.old.inspect_base')
    legacy.inspect_base_table = Table(
        'inspect_base', MetaData(), Column('status', Integer), Column('report_code', String),
        Column('customer_id', Integer), Column('report_date', DateTime),
        Column('inspect_date', DateTime), Column('ranking', String),
    )
    sys.modules[legacy.__name__] = legacy
    selection = sys.argv[1:] or [str(BACKEND / name) for name in TESTS]
    with (
        patch('sqlalchemy.engine.Engine.connect', side_effect=SQLAlchemyError('Offline test: SQL connections forbidden')),
        patch.object(socket.socket, 'connect', side_effect=AssertionError('Offline test: network forbidden')),
        patch.object(socket.socket, 'connect_ex', side_effect=AssertionError('Offline test: network forbidden')),
    ):
        return pytest.main(['--noconftest', f'--confcutdir={BACKEND / "tests/unit"}', '-q', '--tb=short', *selection])


if __name__ == '__main__':
    raise SystemExit(main())
