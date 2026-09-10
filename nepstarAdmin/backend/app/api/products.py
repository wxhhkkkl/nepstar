"""Product management API routes (商品 + 图片上传 OSS)."""

import os

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..schemas.product import ProductCreate, ProductUpdate
from ..schemas.response import ApiResponse
from ..security.rbac import get_current_user
from ..services import oss_service, product_service

router = APIRouter(prefix="/products", tags=["products"])


@router.get("")
async def list_products(
    page: int = 1,
    page_size: int = 10,
    keyword: str = "",
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    data = await product_service.list_products(db, page, page_size, keyword)
    return ApiResponse(data=data)


@router.post("/upload-image")
async def upload_product_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload one image to OSS bucket `nepstar` and return its public URL."""
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        return ApiResponse(code=400, message="product.upload_invalid_type")
    data = await file.read()
    if len(data) > settings.OSS_UPLOAD_MAX_BYTES:
        return ApiResponse(code=400, message="product.upload_too_large")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    try:
        url = oss_service.upload_image(data, ext, content_type)
    except ValueError as e:
        return ApiResponse(code=400, message=str(e))
    return ApiResponse(data={"url": url})


@router.get("/{product_id}")
async def get_product(
    product_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    try:
        data = await product_service.get_product_detail(db, product_id)
    except ValueError as e:
        return ApiResponse(code=404, message=str(e))
    return ApiResponse(data=data)


@router.post("")
async def create_product(
    req: ProductCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    try:
        data = await product_service.create_product(db, req)
    except ValueError as e:
        return ApiResponse(code=400, message=str(e))
    return ApiResponse(data=data)


@router.put("/{product_id}")
async def update_product(
    product_id: int,
    req: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        data = await product_service.update_product(db, product_id, req)
    except ValueError as e:
        return ApiResponse(code=400, message=str(e))
    return ApiResponse(data=data)


@router.delete("/{product_id}")
async def delete_product(
    product_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    try:
        await product_service.delete_product(db, product_id)
    except ValueError as e:
        return ApiResponse(code=409, message=str(e))
    return ApiResponse()
