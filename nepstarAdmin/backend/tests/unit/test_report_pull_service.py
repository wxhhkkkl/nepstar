"""拉取区间、分页与凭据解析。"""

from datetime import datetime

import pytest

from app.config import settings
from app.services import report_pull_service as svc


def test_range_inclusive_end_day(monkeypatch):
    monkeypatch.setattr(settings, "HAIXIN_PULL_MAX_DAYS", 31)
    start, end = svc.parse_range("2026-11-06", "2026-11-13")
    assert start == datetime(2026, 11, 6, 0, 0, 0)
    assert end == datetime(2026, 11, 14, 0, 0, 0)


def test_default_range_is_single_day(monkeypatch):
    monkeypatch.setattr(settings, "HAIXIN_PULL_DEFAULT_DAYS", 1)
    monkeypatch.setattr(settings, "HAIXIN_PULL_MAX_DAYS", 31)
    start, end = svc.parse_range(None, "2026-11-13")
    assert start == datetime(2026, 11, 13, 0, 0, 0)
    assert end == datetime(2026, 11, 14, 0, 0, 0)


def test_range_rejects_reverse_and_too_long(monkeypatch):
    monkeypatch.setattr(settings, "HAIXIN_PULL_MAX_DAYS", 31)
    with pytest.raises(svc.PullParamError):
        svc.parse_range("2026-11-14", "2026-11-13")
    with pytest.raises(svc.PullParamError):
        svc.parse_range("2026-10-01", "2026-11-13")


def test_page_defaults_and_cap(monkeypatch):
    monkeypatch.setattr(settings, "HAIXIN_PULL_DEFAULT_PAGE_SIZE", 50)
    monkeypatch.setattr(settings, "HAIXIN_PULL_MAX_PAGE_SIZE", 100)
    assert svc.resolve_page(0, 0) == (1, 50)
    assert svc.resolve_page(2, 999) == (2, 100)


def test_resolve_secret_supports_rotation(monkeypatch):
    monkeypatch.setattr(settings, "HAIXIN_APP_KEY", "new")
    monkeypatch.setattr(settings, "HAIXIN_APP_SECRET", "new-secret")
    monkeypatch.setattr(settings, "HAIXIN_APP_KEYS", {"old": "old-secret", "new": "ignored"})
    assert svc.resolve_secret("new") == "new-secret"
    assert svc.resolve_secret("old") == "old-secret"
    assert svc.resolve_secret("missing") is None
