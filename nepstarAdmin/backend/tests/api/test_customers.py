"""Integration tests for /customers API endpoints."""

import pytest
from httpx import AsyncClient


class TestListCustomersAPI:
    """Test GET /customers endpoint."""

    @pytest.mark.asyncio
    async def test_requires_auth(self, client: AsyncClient):
        """未认证请求应返回 401。"""
        response = await client.get("/api/v1/customers")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_returns_paginated_customers(self, client: AsyncClient, admin_headers):
        """Admin 获取分页客户列表。"""
        response = await client.get("/api/v1/customers", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "records" in data["data"]
        assert "total" in data["data"]
        assert data["data"]["page"] == 1
        assert data["data"]["page_size"] == 20

    @pytest.mark.asyncio
    async def test_response_has_expected_fields(self, client: AsyncClient, admin_headers):
        """响应包含所有预期字段（7 列）。"""
        response = await client.get("/api/v1/customers", headers=admin_headers)
        assert response.status_code == 200
        records = response.json()["data"]["records"]
        if records:
            record = records[0]
            for field in ["customer_id", "name", "mobile", "age", "sex",
                          "latest_inspect_date", "report_count"]:
                assert field in record, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_limited_user_can_access(self, client: AsyncClient, limited_user_headers):
        """有限权限用户可访问客户列表。"""
        response = await client.get("/api/v1/customers", headers=limited_user_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_pagination_params(self, client: AsyncClient, admin_headers):
        """分页参数生效。"""
        response = await client.get(
            "/api/v1/customers?page=2&page_size=5", headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["page"] == 2
        assert data["data"]["page_size"] == 5
