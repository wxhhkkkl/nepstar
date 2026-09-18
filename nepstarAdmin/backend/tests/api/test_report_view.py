"""API contract tests for /api/v1/report-view.

访问控制与其他接口不同：这两个端点**不要求后台登录**（FR-021）。
组装逻辑在 report_view_service 中，这里只验证路由、错误映射与响应封装。
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.services import report_source, report_view_service
from tests.api.health_helpers import make_client

BASE = "/api/v1/report-view"
CODE = "KH503LS0005865V220721182530852"
CUSTOMER = 1001


@pytest.fixture
async def client():
    async with make_client() as ac:
        yield ac


def home_url(code=CODE, customer=CUSTOMER):
    return f"{BASE}/{code}/home?customer_id={customer}"


SAMPLE_PAYLOAD = {
    "report": {
        "report_code": CODE,
        "total_score": 82,
        "warning_threshold": 70,
        "gender": "female",
        "peer_percent": 22,
        "actual_age": 57,
        "healthy_life_expectancy": 86.1,
    },
    "systems": [
        {
            "system_code": "SYS_CARDIO",
            "name": "心血管",
            "score": 91,
            "sort_order": 1,
            "trend": {"series": [80, 82, 84, 86, 88, 91]},
        }
    ],
    "ai_consult": {"enabled": True, "title": "AI 长寿咨询", "entry_type": "image", "entry_url": "/x.png"},
    "features": {"save_report_enabled": False},
}


# --- 访问控制 ---


@pytest.mark.asyncio
async def test_home_does_not_require_admin_login(client):
    """报告查看者不需要后台凭证（FR-021）。缺 customer_id 是 422，而不是 401。"""
    r = await client.get(f"{BASE}/{CODE}/home")
    assert r.status_code != 401
    assert r.status_code == 422


# --- 成功路径 ---


@pytest.mark.asyncio
async def test_home_returns_aggregated_payload(client):
    with patch.object(
        report_view_service, "build_home", AsyncMock(return_value=SAMPLE_PAYLOAD)
    ):
        r = await client.get(home_url())
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 200
    assert body["data"]["report"]["total_score"] == 82
    assert body["data"]["systems"][0]["system_code"] == "SYS_CARDIO"
    assert body["data"]["features"]["save_report_enabled"] is False


@pytest.mark.asyncio
async def test_home_returns_cardiac_trend_and_empty_for_others(client):
    """仅心血管有趋势（FR-034）——契约层面再确认一次。"""
    payload = {
        **SAMPLE_PAYLOAD,
        "systems": [
            {"system_code": "SYS_CARDIO", "trend": {"series": [1, 2, 3]}},
            {"system_code": "SYS_BONE", "trend": {"series": []}},
        ],
    }
    with patch.object(report_view_service, "build_home", AsyncMock(return_value=payload)):
        r = await client.get(home_url())
    systems = {s["system_code"]: s for s in r.json()["data"]["systems"]}
    assert systems["SYS_CARDIO"]["trend"]["series"] == [1, 2, 3]
    assert systems["SYS_BONE"]["trend"]["series"] == []


# --- 错误映射 ---


@pytest.mark.asyncio
async def test_not_found_maps_to_report_not_found(client):
    with patch.object(
        report_view_service,
        "build_home",
        AsyncMock(side_effect=report_view_service.ReportNotFoundError("not_found")),
    ):
        r = await client.get(home_url())
    body = r.json()
    assert body["code"] == 404
    assert body["message"] == "report.not_found"


@pytest.mark.asyncio
async def test_not_ready_maps_to_report_not_ready(client):
    with patch.object(
        report_view_service,
        "build_home",
        AsyncMock(side_effect=report_view_service.ReportNotReadyError()),
    ):
        r = await client.get(home_url())
    body = r.json()
    assert body["code"] == 409
    assert body["message"] == "report.not_ready"


@pytest.mark.asyncio
async def test_source_failure_maps_to_report_unavailable(client):
    """数据源故障必须与"报告不存在"可区分（FR-038、SC-014）。"""
    with patch.object(
        report_view_service,
        "build_home",
        AsyncMock(side_effect=report_source.ReportSourceUnavailableError("timeout")),
    ):
        r = await client.get(home_url())
    body = r.json()
    assert body["code"] == 503
    assert body["message"] == "report.unavailable"


@pytest.mark.asyncio
async def test_missing_report_and_access_denied_are_indistinguishable(client):
    """对外必须完全一致，避免靠错误差异枚举报告编号（FR-019、SC-007）。"""
    bodies = []
    for reason in ("not_found", "access_denied"):
        with patch.object(
            report_view_service,
            "build_home",
            AsyncMock(side_effect=report_view_service.ReportNotFoundError(reason)),
        ):
            r = await client.get(home_url())
        bodies.append({k: v for k, v in r.json().items() if k != "timestamp"})
    assert bodies[0] == bodies[1]


# --- 系统详情 ---

DETAIL = {
    "report_code": CODE,
    "system": {
        "system_code": "SYS_BONE",
        "name": "骨骼",
        "score": 54,
        "status_text": "重点关注",
        "summary": "骨质疏松风险突出",
        "visualization": {"categories": ["骨质疏松"], "series": [48]},
        "trend": {"series": []},
        "indicators": [
            {"indicator_code": "SYS_BONE_OSTEO", "name": "骨质疏松", "score": 48, "weight": 25}
        ],
        "direct_measurements": [],
        "interpretation": "骨质疏松是本次骨骼维度的主要影响项。",
        "actions": ["评估钙与维生素 D 摄入"],
        "recommendation": None,
    },
}


def detail_url(system_code="SYS_BONE", code=CODE, customer=CUSTOMER):
    return f"{BASE}/{code}/systems/{system_code}?customer_id={customer}"


@pytest.mark.asyncio
async def test_detail_returns_system_payload(client):
    with patch.object(
        report_view_service, "build_system_detail", AsyncMock(return_value=DETAIL)
    ):
        r = await client.get(detail_url())
    assert r.status_code == 200
    system = r.json()["data"]["system"]
    assert system["system_code"] == "SYS_BONE"
    assert system["indicators"][0]["weight"] == 25
    assert system["interpretation"]
    assert system["actions"] == ["评估钙与维生素 D 摄入"]


@pytest.mark.asyncio
async def test_detail_does_not_require_admin_login(client):
    r = await client.get(f"{BASE}/{CODE}/systems/SYS_BONE")
    assert r.status_code == 422  # 缺 customer_id，而不是 401


@pytest.mark.asyncio
async def test_unknown_system_maps_to_system_not_found(client):
    """不得回退到第一个系统（FR-007）。"""
    with patch.object(
        report_view_service,
        "build_system_detail",
        AsyncMock(side_effect=report_view_service.ReportSystemNotFoundError()),
    ):
        r = await client.get(detail_url("SYS_NOPE"))
    body = r.json()
    assert body["code"] == 404
    assert body["message"] == "report.system_not_found"


@pytest.mark.asyncio
async def test_detail_keeps_not_found_and_unavailable_distinct(client):
    for exc, code, message in (
        (report_view_service.ReportNotFoundError("not_found"), 404, "report.not_found"),
        (report_source.ReportSourceUnavailableError("x"), 503, "report.unavailable"),
    ):
        with patch.object(report_view_service, "build_system_detail", AsyncMock(side_effect=exc)):
            body = (await client.get(detail_url())).json()
        assert (body["code"], body["message"]) == (code, message)


# --- 推荐：首页与详情必须一致（FR-018） ---

REC = {
    "trigger_indicator_code": "SYS_BONE_OSTEO",
    "issue": "骨质疏松 · 活力值 48",
    "plan_id": 2,
    "plan_name": "骨质疏松钙流失健康管理方案",
    "title": "骨质疏松钙流失健康管理方案",
    "description": "提供钙营养与维生素 D 的连续管理参考。",
    "tags": [],
    "action_label": None,
    "action_hint": None,
    "products": [{"product_id": 2, "name": "钙流失健康管理礼盒", "image_url": "u", "image_alt": "a"}],
}


@pytest.mark.asyncio
async def test_recommendation_is_identical_on_home_and_detail(client):
    home_payload = {
        **SAMPLE_PAYLOAD,
        "systems": [{"system_code": "SYS_BONE", "recommendation": REC}],
    }
    detail_payload = {"report_code": CODE, "system": {**DETAIL["system"], "recommendation": REC}}

    with patch.object(report_view_service, "build_home", AsyncMock(return_value=home_payload)):
        home_body = (await client.get(home_url())).json()
    with patch.object(
        report_view_service, "build_system_detail", AsyncMock(return_value=detail_payload)
    ):
        detail_body = (await client.get(detail_url())).json()

    from_home = home_body["data"]["systems"][0]["recommendation"]
    from_detail = detail_body["data"]["system"]["recommendation"]
    assert from_home == from_detail
    assert from_home["products"][0]["name"] == "钙流失健康管理礼盒"


@pytest.mark.asyncio
async def test_system_without_recommendation_returns_null(client):
    payload = {**SAMPLE_PAYLOAD, "systems": [{"system_code": "SYS_CARDIO", "recommendation": None}]}
    with patch.object(report_view_service, "build_home", AsyncMock(return_value=payload)):
        body = (await client.get(home_url())).json()
    assert body["data"]["systems"][0]["recommendation"] is None


# --- 入口配置与功能开关（US5） ---


@pytest.mark.asyncio
async def test_ai_consult_and_feature_flags_are_returned(client):
    with patch.object(
        report_view_service, "build_home", AsyncMock(return_value=SAMPLE_PAYLOAD)
    ):
        data = (await client.get(home_url())).json()["data"]
    ai = data["ai_consult"]
    assert set(ai) == {"enabled", "title", "entry_type", "entry_url"}
    assert isinstance(ai["enabled"], bool) and ai["entry_url"]
    assert set(data["features"]) == {"save_report_enabled"}
