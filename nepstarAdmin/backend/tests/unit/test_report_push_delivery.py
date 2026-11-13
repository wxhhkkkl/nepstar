"""出站推送参数、字段映射与失败原因。"""

import httpx
import pytest

from app.config import settings
from app.services import report_push_service as svc


class FakeResponse:
    def __init__(self, status_code=200, body=None, json_error=False):
        self.status_code = status_code
        self._body = body
        self._json_error = json_error

    def json(self):
        if self._json_error:
            raise ValueError("not json")
        return self._body


class FakeClient:
    def __init__(self, response):
        self.response = response
        self.calls = []

    async def post(self, url, data=None):
        self.calls.append(("POST", url, data))
        return self.response

    async def get(self, url, params=None):
        self.calls.append(("GET", url, params))
        return self.response


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(settings, "HAIXIN_PUSH_ENABLED", True)
    monkeypatch.setattr(settings, "HAIXIN_PUSH_URL", "http://partner.local/push")
    monkeypatch.setattr(settings, "HAIXIN_APP_KEY", "app-key")
    monkeypatch.setattr(settings, "HAIXIN_APP_SECRET", "secret")
    monkeypatch.setattr(settings, "HAIXIN_PUSH_METHOD", "POST")
    monkeypatch.setattr(settings, "HAIXIN_PUSH_TIMEOUT_SECONDS", 5.0)
    monkeypatch.setattr(settings, "HAIXIN_PUSH_FIELD_MAP", {})


def _report():
    return {
        "report_code": "KH503-001",
        "customer_id": 1001,
        "device_sn": "SN-001",
        "inspect_date": "2026-11-13 10:00:00",
        "total_score": 88,
        "report_url": "http://report.local/common.html?reportId=KH503-001&customerId=1001",
    }


async def test_disabled_does_not_send(monkeypatch):
    monkeypatch.setattr(settings, "HAIXIN_PUSH_ENABLED", False)
    result = await svc.deliver_report(_report())
    assert result.status == "failed"
    assert result.failure_reason == "delivery.disabled"


async def test_missing_config(configured, monkeypatch):
    monkeypatch.setattr(settings, "HAIXIN_APP_SECRET", "")
    result = await svc.deliver_report(_report())
    assert result.status == "failed"
    assert result.failure_reason == "delivery.config_missing"


async def test_success_and_signed_form(configured):
    client = FakeClient(FakeResponse(200, {"code": "0", "message": "ok"}))
    result = await svc.deliver_report(_report(), client=client)
    assert result.status == "success"
    method, url, data = client.calls[0]
    assert (method, url) == ("POST", "http://partner.local/push")
    assert data["appKey"] == "app-key"
    assert data["reportId"] == "KH503-001"
    assert data["customerId"] == "1001"
    assert data["sign"]
    assert "secret" not in result.response_summary.lower()


async def test_field_map_override(configured, monkeypatch):
    monkeypatch.setattr(
        settings,
        "HAIXIN_PUSH_FIELD_MAP",
        {"report_code": "reportNo", "customer_id": "memberId"},
    )
    params = svc.build_push_params(_report(), timestamp=1700000000)
    assert params["reportNo"] == "KH503-001"
    assert params["memberId"] == "1001"
    assert "reportId" not in params


async def test_rejected_business_code(configured):
    client = FakeClient(FakeResponse(200, {"code": "9", "message": "denied"}))
    result = await svc.deliver_report(_report(), client=client)
    assert result.status == "failed"
    assert result.failure_reason == "delivery.rejected"
    assert "denied" in result.response_summary


async def test_timeout(configured):
    class TimeoutClient:
        async def post(self, url, data=None):
            raise httpx.TimeoutException("slow")

    result = await svc.deliver_report(_report(), client=TimeoutClient())
    assert result.failure_reason == "delivery.timeout"


async def test_bad_response(configured):
    client = FakeClient(FakeResponse(200, json_error=True))
    result = await svc.deliver_report(_report(), client=client)
    assert result.failure_reason == "delivery.bad_response"
