"""设备回调路由：快速受理、重复与非法载荷。"""

from unittest.mock import AsyncMock

from httpx import AsyncClient

from app.services import report_push_service
from app.services.report_push_service import CallbackDecision

VALID = {
    "reportId": "KH503LS0005835V261106093253957",
    "deviceId": "KH503LS0005835V",
    "h5Url": "http://kj101.jiankangzhan.com/common.html?reportId=X&customerId=1",
    "appCustomerInfo": '{"userName":"袁勇","mobile":"28982108221"}',
    "printH5": "http://kj101.jiankangzhan.com/print/print151.html?reportId=X",
    "modelType": 30,
    "exceptionTab": '[{"key":"107","value":"2"}]',
    "customerType": 1,
}


async def test_accepts_and_spawns_delivery(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(
        report_push_service,
        "handle_callback",
        AsyncMock(return_value=CallbackDecision(5, duplicate=False, should_deliver=True)),
    )
    spawned = []
    monkeypatch.setattr(
        report_push_service, "spawn_auto_delivery", lambda record_id: spawned.append(record_id)
    )

    response = await client.post("/api/v1/report-callback/device", json=VALID)

    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 200
    assert body["data"] == {"accepted": True, "duplicate": False}
    assert spawned == [5]


async def test_duplicate_does_not_spawn(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(
        report_push_service,
        "handle_callback",
        AsyncMock(return_value=CallbackDecision(None, duplicate=True, should_deliver=False)),
    )
    spawned = []
    monkeypatch.setattr(
        report_push_service, "spawn_auto_delivery", lambda record_id: spawned.append(record_id)
    )

    response = await client.post("/api/v1/report-callback/device", json=VALID)

    body = response.json()
    assert body["data"]["duplicate"] is True
    assert spawned == []


async def test_invalid_payload_returns_400(client: AsyncClient):
    response = await client.post(
        "/api/v1/report-callback/device", json={"deviceId": "KH503LS0005835V"}
    )
    assert response.json()["code"] == 400


async def test_extra_fields_are_accepted_and_not_persisted(client: AsyncClient, monkeypatch):
    handler = AsyncMock(
        return_value=CallbackDecision(None, duplicate=True, should_deliver=False)
    )
    monkeypatch.setattr(report_push_service, "handle_callback", handler)

    response = await client.post("/api/v1/report-callback/device", json=VALID)

    assert response.json()["code"] == 200
    handled = handler.await_args
    assert handled.args[1] == VALID["reportId"]
    assert handled.args[2] == VALID["deviceId"]
    # 只传定位字段，不把 appCustomerInfo 传给服务层
    assert len(handled.args) == 3
