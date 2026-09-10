"""API contract tests for /api/v1/plans — end-to-end with real products/indicators.

Proves strict-precise indicator association: ticking a level-1 node does NOT pull
in its level-2 children.
"""

import uuid

import pytest

from tests.api.health_helpers import make_client

PLANS = "/api/v1/plans"
PRODUCTS = "/api/v1/products"
INDICATORS = "/api/v1/indicators"


@pytest.fixture
async def client():
    async with make_client() as ac:
        yield ac


def _code() -> str:
    return "HP" + uuid.uuid4().hex[:8].upper()


async def _make_product(client, headers, name):
    r = await client.post(
        PRODUCTS,
        json={"name": name, "images": [{"url": "https://x/p.jpg", "sort_order": 0}]},
        headers=headers,
    )
    return r.json()["data"]["id"]


async def _make_indicator(client, headers, name, parent_id=None):
    r = await client.post(
        INDICATORS, json={"code": _code(), "name": name, "parent_id": parent_id}, headers=headers
    )
    return r.json()["data"]["id"]


@pytest.mark.asyncio
async def test_plan_strict_indicator_association_and_counts(client, admin_headers):
    prod_id = await _make_product(client, admin_headers, "方案用商品")
    l1 = await _make_indicator(client, admin_headers, "父指标")
    c1 = await _make_indicator(client, admin_headers, "子指标一", parent_id=l1)
    c2 = await _make_indicator(client, admin_headers, "子指标二", parent_id=l1)

    # tick the L1 node and only ONE of its children
    create = await client.post(
        PLANS,
        json={"name": "严格关联方案", "product_ids": [prod_id], "indicator_ids": [l1, c1]},
        headers=admin_headers,
    )
    body = create.json()
    assert body["code"] == 200, body
    plan_id = body["data"]["id"]

    detail = (await client.get(f"{PLANS}/{plan_id}", headers=admin_headers)).json()["data"]
    assert [p["product_id"] for p in detail["products"]] == [prod_id]
    got = {(i["indicator_id"], i["level"]) for i in detail["indicators"]}
    assert got == {(l1, 1), (c1, 2)}, "level-1 tick must NOT auto-include its other children"
    assert c2 not in {i["indicator_id"] for i in detail["indicators"]}

    # list shows the association counts
    listing = (
        await client.get(PLANS, params={"keyword": "严格关联方案"}, headers=admin_headers)
    ).json()["data"]
    row = next(r for r in listing["records"] if r["id"] == plan_id)
    assert row["product_count"] == 1
    assert row["indicator_count"] == 2

    # replacement on update: swap association to the other child only
    upd = await client.put(
        f"{PLANS}/{plan_id}", json={"indicator_ids": [c2]}, headers=admin_headers
    )
    assert upd.json()["code"] == 200
    detail2 = (await client.get(f"{PLANS}/{plan_id}", headers=admin_headers)).json()["data"]
    assert [i["indicator_id"] for i in detail2["indicators"]] == [c2]

    # delete plan (cascades its own junctions), then clean up catalog rows
    assert (await client.delete(f"{PLANS}/{plan_id}", headers=admin_headers)).json()["code"] == 200
    assert (await client.delete(f"{PRODUCTS}/{prod_id}", headers=admin_headers)).json()[
        "code"
    ] == 200
    for iid in (c1, c2):
        await client.delete(f"{INDICATORS}/{iid}", headers=admin_headers)
    await client.delete(f"{INDICATORS}/{l1}", headers=admin_headers)


@pytest.mark.asyncio
async def test_plan_allows_empty_associations(client, admin_headers):
    r = await client.post(PLANS, json={"name": "空方案"}, headers=admin_headers)
    body = r.json()
    assert body["code"] == 200, body
    pid = body["data"]["id"]
    detail = (await client.get(f"{PLANS}/{pid}", headers=admin_headers)).json()["data"]
    assert detail["products"] == []
    assert detail["indicators"] == []
    await client.delete(f"{PLANS}/{pid}", headers=admin_headers)


@pytest.mark.asyncio
async def test_plan_unknown_product_rejected(client, admin_headers):
    r = await client.post(
        PLANS, json={"name": "坏方案", "product_ids": [999999]}, headers=admin_headers
    )
    assert r.json()["code"] == 400
    assert r.json()["message"] == "plan.product_not_found"
