"""API contract tests for /api/v1/products (live DB; OSS stubbed)."""

import pytest

from app.config import settings
from app.services import oss_service
from tests.api.health_helpers import make_client

BASE = "/api/v1/products"


@pytest.fixture
async def client():
    async with make_client() as ac:
        yield ac


@pytest.mark.asyncio
async def test_list_products(client, admin_headers):
    r = await client.get(BASE, headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 200
    assert "records" in body["data"]
    assert "total" in body["data"]


@pytest.mark.asyncio
async def test_create_rejects_exceeding_image_limit(client, admin_headers, monkeypatch):
    """FR-204: count limit enforced server-side (bypassing the FE uploader)."""
    monkeypatch.setattr(settings, "PRODUCT_MAX_IMAGE_COUNT", 1)
    r = await client.post(
        BASE,
        json={
            "name": "超限商品",
            "images": [
                {"url": "https://x/1.jpg", "sort_order": 0},
                {"url": "https://x/2.jpg", "sort_order": 1},
            ],
        },
        headers=admin_headers,
    )
    assert r.json()["code"] == 400
    assert r.json()["message"] == "product.too_many_images"


@pytest.mark.asyncio
async def test_create_requires_image(client, admin_headers):
    r = await client.post(BASE, json={"name": "无图商品"}, headers=admin_headers)
    assert r.json()["code"] == 400
    assert r.json()["message"] == "product.image_required"


@pytest.mark.asyncio
async def test_create_detail_and_delete(client, admin_headers):
    payload = {
        "name": "测试商品-维生素",
        "description": "说明",
        "detail_html": "<p>图文详情</p>",
        "images": [
            {"url": "https://nepstar.example/health/products/a.jpg", "sort_order": 0},
            {"url": "https://nepstar.example/health/products/b.jpg", "sort_order": 1},
        ],
    }
    r = await client.post(BASE, json=payload, headers=admin_headers)
    body = r.json()
    assert body["code"] == 200, body
    pid = body["data"]["id"]
    assert body["data"]["cover_url"] == "https://nepstar.example/health/products/a.jpg"

    detail = (await client.get(f"{BASE}/{pid}", headers=admin_headers)).json()["data"]
    assert len(detail["images"]) == 2
    assert detail["detail_html"] == "<p>图文详情</p>"

    # update replaces the image set
    upd = await client.put(
        f"{BASE}/{pid}",
        json={
            "images": [{"url": "https://nepstar.example/health/products/c.jpg", "sort_order": 0}]
        },
        headers=admin_headers,
    )
    assert upd.json()["code"] == 200
    assert len(upd.json()["data"]["images"]) == 1

    assert (await client.delete(f"{BASE}/{pid}", headers=admin_headers)).json()["code"] == 200


@pytest.mark.asyncio
async def test_upload_rejects_non_image(client, admin_headers):
    r = await client.post(
        f"{BASE}/upload-image",
        files={"file": ("a.txt", b"hello", "text/plain")},
        headers=admin_headers,
    )
    assert r.json()["code"] == 400
    assert r.json()["message"] == "product.upload_invalid_type"


@pytest.mark.asyncio
async def test_upload_too_large(client, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "OSS_UPLOAD_MAX_BYTES", 1)
    r = await client.post(
        f"{BASE}/upload-image",
        files={"file": ("a.png", b"xx", "image/png")},
        headers=admin_headers,
    )
    assert r.json()["code"] == 400
    assert r.json()["message"] == "product.upload_too_large"


@pytest.mark.asyncio
async def test_upload_success_stubbed_oss(client, admin_headers, monkeypatch):
    monkeypatch.setattr(
        oss_service,
        "upload_image",
        lambda data, ext=".jpg", content_type=None: "https://nepstar.example/health/products/x.png",
    )
    r = await client.post(
        f"{BASE}/upload-image",
        files={"file": ("a.png", b"png-bytes", "image/png")},
        headers=admin_headers,
    )
    body = r.json()
    assert body["code"] == 200, body
    assert body["data"]["url"].startswith("https://nepstar.example/health/products/")
