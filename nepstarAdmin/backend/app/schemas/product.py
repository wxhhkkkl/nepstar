"""Pydantic schemas for products (商品)."""

from pydantic import BaseModel, Field


class ProductImageIn(BaseModel):
    url: str = Field(..., max_length=500)
    sort_order: int = 0


class ProductCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = Field(default=None, max_length=500)
    detail_html: str | None = None
    status: int = 1
    sort_order: int = 0
    images: list[ProductImageIn] = []


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    detail_html: str | None = None
    status: int | None = None
    sort_order: int | None = None
    images: list[ProductImageIn] | None = None
