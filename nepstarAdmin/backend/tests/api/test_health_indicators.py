"""API contract tests for /api/v1/indicators.

These hit the live `nepstar` DB via the ASGI client + admin token (repo convention).
Requires the alembic 003 tables present and a seeded `admin` user. Codes are
timestamped to keep runs idempotent.
"""

import uuid

import pytest

from tests.api.health_helpers import make_client

BASE = "/api/v1/indicators"


@pytest.fixture
async def client():
    async with make_client() as ac:
        yield ac


def _code() -> str:
    return "HT" + uuid.uuid4().hex[:8].upper()


@pytest.mark.asyncio
async def test_tree_requires_auth(client):
    r = await client.get(f"{BASE}/tree")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_tree_empty_for_fresh(client, admin_headers):
    r = await client.get(f"{BASE}/tree", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 200
    assert isinstance(body["data"], list)


@pytest.mark.asyncio
async def test_create_level1_and_duplicate_code_rejected(client, admin_headers):
    code = _code()
    r = await client.post(
        BASE,
        json={"code": code, "name": "测试一级指标", "parent_id": None},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["data"]["code"] == code
    nid = r.json()["data"]["id"]

    # duplicate code -> business error envelope
    r2 = await client.post(
        BASE,
        json={"code": code, "name": "重复编码"},
        headers=admin_headers,
    )
    body2 = r2.json()
    assert body2["code"] != 200
    assert body2["message"] == "indicator.code_exists"

    # cleanup
    dr = await client.delete(f"{BASE}/{nid}", headers=admin_headers)
    assert dr.json()["code"] == 200


@pytest.mark.asyncio
async def test_level1_with_children_cannot_delete(client, admin_headers):
    code1, code2 = _code(), _code()
    l1 = (
        await client.post(BASE, json={"code": code1, "name": "父指标"}, headers=admin_headers)
    ).json()["data"]
    l2 = (
        await client.post(
            BASE,
            json={"code": code2, "name": "子指标", "parent_id": l1["id"]},
            headers=admin_headers,
        )
    ).json()["data"]

    # deleting level-1 with children -> 409 has_children
    r = await client.delete(f"{BASE}/{l1['id']}", headers=admin_headers)
    assert r.json()["code"] == 409
    assert r.json()["message"] == "indicator.has_children"

    # delete children then parent succeeds
    assert (await client.delete(f"{BASE}/{l2['id']}", headers=admin_headers)).json()["code"] == 200
    assert (await client.delete(f"{BASE}/{l1['id']}", headers=admin_headers)).json()["code"] == 200


@pytest.mark.asyncio
async def test_keyword_search(client, admin_headers):
    code = _code()
    created = (
        await client.post(BASE, json={"code": code, "name": "体脂专项指标"}, headers=admin_headers)
    ).json()["data"]
    r = await client.get(f"{BASE}/tree", params={"keyword": "体脂专项"}, headers=admin_headers)
    names = [n["name"] for n in r.json()["data"]]
    assert "体脂专项指标" in names
    await client.delete(f"{BASE}/{created['id']}", headers=admin_headers)


# --- 报告展示相关：target_id 登记与报告文案（US4） ---


def _target() -> int:
    """用一个几乎不可能撞车的 targetId，避免影响真实配置。"""
    return 900000 + uuid.uuid4().int % 90000


@pytest.mark.asyncio
async def test_create_and_read_back_report_fields(client, admin_headers):
    code = _code()
    target = _target()
    r = await client.post(
        BASE,
        headers=admin_headers,
        json={
            "code": code,
            "name": "报告文案测试",
            "target_id": target,
            "report_status_text": "重点关注",
            "report_summary": "一句话摘要",
            "report_interpretation": "结论解读",
            "report_actions": ["建议一", "建议二"],
        },
    )
    body = r.json()
    assert body["code"] == 200, body
    created = body["data"]
    try:
        assert created["target_id"] == target
        assert created["report_actions"] == ["建议一", "建议二"]
        assert created["report_summary"] == "一句话摘要"

        tree = (await client.get(f"{BASE}/tree", headers=admin_headers)).json()["data"]
        node = next(n for n in tree if n["code"] == code)
        assert node["target_id"] == target
        assert node["report_interpretation"] == "结论解读"
    finally:
        await client.delete(f"{BASE}/{created['id']}", headers=admin_headers)


@pytest.mark.asyncio
async def test_duplicate_target_id_returns_conflict(client, admin_headers):
    """同一 targetId 不得登记到两个指标（FR-032、SC-012）。"""
    target = _target()
    first = (
        await client.post(
            BASE, headers=admin_headers, json={"code": _code(), "name": "占位", "target_id": target}
        )
    ).json()["data"]
    try:
        r = await client.post(
            BASE,
            headers=admin_headers,
            json={"code": _code(), "name": "撞车", "target_id": target},
        )
        body = r.json()
        assert body["code"] == 409
        assert body["message"] == "indicator.target_id_conflict"
    finally:
        await client.delete(f"{BASE}/{first['id']}", headers=admin_headers)


@pytest.mark.asyncio
async def test_clearing_target_id_with_explicit_null(client, admin_headers):
    """显式传 null 表示清空登记——否则运营没法取消登记。"""
    code = _code()
    created = (
        await client.post(
            BASE, headers=admin_headers, json={"code": code, "name": "可清空", "target_id": _target()}
        )
    ).json()["data"]
    try:
        r = await client.put(
            f"{BASE}/{created['id']}", headers=admin_headers, json={"target_id": None}
        )
        body = r.json()
        assert body["code"] == 200, body
        assert body["data"]["target_id"] is None
    finally:
        await client.delete(f"{BASE}/{created['id']}", headers=admin_headers)


@pytest.mark.asyncio
async def test_non_positive_target_id_is_rejected_with_key(client, admin_headers):
    r = await client.post(
        BASE, headers=admin_headers, json={"code": _code(), "name": "非法", "target_id": 0}
    )
    body = r.json()
    assert body["code"] == 400
    assert body["message"] == "indicator.target_id_required"
