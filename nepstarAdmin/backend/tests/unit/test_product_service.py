"""Unit tests for product_service — AsyncMock against db, no DB/OSS required."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.new.sa_product import SAProduct, SAProductImage
from app.schemas.product import ProductCreate, ProductImageIn, ProductUpdate


def prod_row(id=1, name="复合维生素", cover=None):
    r = MagicMock(spec=SAProduct)
    r.id = id
    r.product_name = name
    r.description = None
    r.detail_html = "<p>x</p>"
    r.cover_url = cover
    r.status = 1
    r.sort_order = 0
    r.created_at = None
    r.updated_at = None
    return r


def img_row(id, url, sort_order):
    r = MagicMock(spec=SAProductImage)
    r.id = id
    r.product_id = 1
    r.image_url = url
    r.sort_order = sort_order
    return r


def db_result(scalar_one_or_none=None, scalars_all=None, first=None):
    r = MagicMock()
    r.scalar_one_or_none.return_value = scalar_one_or_none
    r.first.return_value = first
    r.scalars.return_value.all.return_value = scalars_all if scalars_all is not None else []
    return r


@pytest.mark.asyncio
async def test_create_requires_at_least_one_image():
    db = AsyncMock()
    from app.services.product_service import create_product

    with pytest.raises(ValueError, match="product.image_required"):
        await create_product(db, ProductCreate(name="无图商品", images=[]))


@pytest.mark.asyncio
async def test_create_sets_cover_to_lowest_sort_order_image():
    db = AsyncMock()
    # existing images lookup (none) → product fetch → images for detail
    db.execute = AsyncMock(
        side_effect=[
            db_result(scalars_all=[]),  # _replace_images existing
            db_result(scalar_one_or_none=prod_row(cover="a.jpg")),  # get_product_detail row
            db_result(
                scalars_all=[img_row(11, "a.jpg", 0), img_row(10, "b.jpg", 1)]
            ),  # detail images
        ]
    )
    from app.services.product_service import create_product

    data = ProductCreate(
        name="商品A",
        images=[
            ProductImageIn(url="b.jpg", sort_order=1),
            ProductImageIn(url="a.jpg", sort_order=0),
        ],
    )
    out = await create_product(db, data)
    assert out["cover_url"] == "a.jpg"  # lowest sort_order image becomes the cover
    assert out["images"][0]["url"] == "a.jpg"
    assert out["images"][1]["url"] == "b.jpg"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_rejects_too_many_images(monkeypatch):
    """FR-204: server-side per-product image count limit (not just the FE uploader)."""
    from app.config import settings
    from app.schemas.product import ProductCreate
    from app.services.product_service import create_product

    monkeypatch.setattr(settings, "PRODUCT_MAX_IMAGE_COUNT", 2)
    db = AsyncMock()
    images = [ProductImageIn(url=f"u{i}.jpg", sort_order=i) for i in range(3)]
    with pytest.raises(ValueError, match="product.too_many_images"):
        await create_product(db, ProductCreate(name="多图商品", images=images))


@pytest.mark.asyncio
async def test_update_replaces_images_and_rejects_empty():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=db_result(scalar_one_or_none=prod_row()))
    from app.services.product_service import update_product

    with pytest.raises(ValueError, match="product.image_required"):
        await update_product(db, 1, ProductUpdate(images=[]))


@pytest.mark.asyncio
async def test_delete_product_in_use_rejected():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            db_result(scalar_one_or_none=prod_row()),
            db_result(first=(1,)),  # referenced by a plan
        ]
    )
    from app.services.product_service import delete_product

    with pytest.raises(ValueError, match="product.in_use"):
        await delete_product(db, 1)


@pytest.mark.asyncio
async def test_delete_product_success_removes_images():
    db = AsyncMock()
    imgs = [img_row(1, "a.jpg", 0), img_row(2, "b.jpg", 1)]
    db.execute = AsyncMock(
        side_effect=[
            db_result(scalar_one_or_none=prod_row()),
            db_result(first=None),  # not referenced
            db_result(scalars_all=imgs),  # images to delete
        ]
    )
    from app.services.product_service import delete_product

    await delete_product(db, 1)
    assert db.delete.await_count == 3  # 2 images + product
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_products_filters_and_pages():
    db = AsyncMock()
    count_res = MagicMock()
    count_res.scalar.return_value = 1
    rows_res = db_result(scalars_all=[prod_row()])
    db.execute = AsyncMock(side_effect=[count_res, rows_res])
    from app.services.product_service import list_products

    out = await list_products(db, page=1, page_size=10, keyword="维")
    assert out["total"] == 1
    assert out["records"][0]["name"] == "复合维生素"
