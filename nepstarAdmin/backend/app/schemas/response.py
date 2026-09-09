"""Unified API response envelope."""

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = 200
    message: str = "success"
    data: T | None = None
    timestamp: int = int(datetime.utcnow().timestamp() * 1000)


class PaginatedData(BaseModel):
    records: list[Any]
    total: int
    page: int
    pageSize: int
