"""API test: admin's /auth/me exposes the 健康管理 menus (FR-001)."""

import pytest

from tests.api.health_helpers import make_client


@pytest.fixture
async def client():
    async with make_client() as ac:
        yield ac


def _collect_routes(nodes, out: set[str]) -> None:
    for n in nodes or []:
        if n.get("route_path"):
            out.add(n["route_path"])
        _collect_routes(n.get("children"), out)


@pytest.mark.asyncio
async def test_admin_me_contains_health_module_menus(client, admin_headers):
    r = await client.get("/api/v1/auth/me", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 200
    routes: set[str] = set()
    _collect_routes(body["data"].get("menus"), routes)
    assert {"/health", "/health/indicators", "/health/products", "/health/plans"} <= routes
