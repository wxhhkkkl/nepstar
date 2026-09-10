"""Product business logic (商品 + 图片，封面=首图，删除守卫)."""

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import NEPSTAR_SCHEMA
from ..models.new.sa_product import SAProduct, SAProductImage
from ..schemas.product import ProductCreate, ProductUpdate


def _table_ref(table: str) -> str:
    return f"{NEPSTAR_SCHEMA}.{table}" if NEPSTAR_SCHEMA else table


def _list_row(row: SAProduct) -> dict:
    return {
        "id": row.id,
        "name": row.product_name,
        "description": row.description,
        "cover_url": row.cover_url,
        "status": row.status,
        "sort_order": row.sort_order,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


async def _images(db: AsyncSession, product_id: int) -> list[dict]:
    rows = (
        (
            await db.execute(
                select(SAProductImage)
                .where(SAProductImage.product_id == product_id)
                .order_by(SAProductImage.sort_order, SAProductImage.id)
            )
        )
        .scalars()
        .all()
    )
    return [{"id": r.id, "url": r.image_url, "sort_order": r.sort_order} for r in rows]


async def _referenced_in_plan(db: AsyncSession, product_id: int) -> bool:
    stmt = text(f"SELECT 1 FROM {_table_ref('sa_plan_product')} WHERE product_id = :p LIMIT 1")
    return (await db.execute(stmt, {"p": product_id})).first() is not None


async def list_products(
    db: AsyncSession, page: int = 1, page_size: int = 10, keyword: str = ""
) -> dict:
    stmt = select(SAProduct)
    count_stmt = select(func.count()).select_from(SAProduct)
    if keyword:
        cond = or_(
            SAProduct.product_name.contains(keyword), SAProduct.description.contains(keyword)
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = (await db.execute(count_stmt)).scalar() or 0
    rows = (
        (
            await db.execute(
                stmt.order_by(SAProduct.sort_order, SAProduct.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return {
        "records": [_list_row(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_product_detail(db: AsyncSession, product_id: int) -> dict:
    row = (
        await db.execute(select(SAProduct).where(SAProduct.id == product_id))
    ).scalar_one_or_none()
    if row is None:
        raise ValueError("product.not_found")
    detail = _list_row(row)
    detail["detail_html"] = row.detail_html
    detail["images"] = await _images(db, product_id)
    return detail


async def _replace_images(db: AsyncSession, product_id: int, images: list) -> str | None:
    """Delete-then-insert the image set; returns the new cover url (first by sort_order)."""
    if not images:
        raise ValueError("product.image_required")
    ordered = sorted(images, key=lambda i: i.sort_order)
    if len(ordered) > settings.PRODUCT_MAX_IMAGE_COUNT:
        raise ValueError("product.too_many_images")
    existing = (
        (await db.execute(select(SAProductImage).where(SAProductImage.product_id == product_id)))
        .scalars()
        .all()
    )
    for img in existing:
        await db.delete(img)
    await db.flush()  # flush deletes before inserts to avoid duplicate keys
    for img in ordered:
        db.add(SAProductImage(product_id=product_id, image_url=img.url, sort_order=img.sort_order))
    return ordered[0].url if ordered else None


async def create_product(db: AsyncSession, data: ProductCreate) -> dict:
    if not data.images:
        raise ValueError("product.image_required")
    row = SAProduct(
        product_name=data.name,
        description=data.description,
        detail_html=data.detail_html,
        status=data.status,
        sort_order=data.sort_order,
    )
    db.add(row)
    await db.flush()
    row.cover_url = await _replace_images(db, row.id, data.images)
    await db.commit()
    return await get_product_detail(db, row.id)


async def update_product(db: AsyncSession, product_id: int, data: ProductUpdate) -> dict:
    row = (
        await db.execute(select(SAProduct).where(SAProduct.id == product_id))
    ).scalar_one_or_none()
    if row is None:
        raise ValueError("product.not_found")
    if data.name is not None:
        row.product_name = data.name
    if data.description is not None:
        row.description = data.description
    if data.detail_html is not None:
        row.detail_html = data.detail_html
    if data.status is not None:
        row.status = data.status
    if data.sort_order is not None:
        row.sort_order = data.sort_order
    if data.images is not None:
        row.cover_url = await _replace_images(db, product_id, data.images)
    await db.commit()
    return await get_product_detail(db, product_id)


async def delete_product(db: AsyncSession, product_id: int) -> None:
    row = (
        await db.execute(select(SAProduct).where(SAProduct.id == product_id))
    ).scalar_one_or_none()
    if row is None:
        raise ValueError("product.not_found")
    if await _referenced_in_plan(db, product_id):
        raise ValueError("product.in_use")
    for img in (
        (await db.execute(select(SAProductImage).where(SAProductImage.product_id == product_id)))
        .scalars()
        .all()
    ):
        await db.delete(img)
    await db.delete(row)
    await db.commit()
