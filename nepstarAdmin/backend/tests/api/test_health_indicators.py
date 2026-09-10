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
