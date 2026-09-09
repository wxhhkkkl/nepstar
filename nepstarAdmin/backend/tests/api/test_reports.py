"""Integration tests for /reports API endpoints."""

import pytest
from httpx import AsyncClient


class TestListReportsAPI:
    """Test GET /reports endpoint."""

    @pytest.mark.asyncio
    async def test_requires_auth(self, client: AsyncClient):
        """未认证请求应返回 401。"""
        response = await client.get("/api/v1/reports")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_returns_paginated_reports(self, client: AsyncClient, admin_headers):
        """Admin 获取分页报告列表。"""
        response = await client.get("/api/v1/reports", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "records" in data["data"]
        assert "total" in data["data"]
        assert data["data"]["page"] == 1
        assert data["data"]["page_size"] == 20

    @pytest.mark.asyncio
    async def test_admin_response_has_expected_fields(self, client: AsyncClient, admin_headers):
        """Admin 响应包含所有预期字段。"""
        response = await client.get("/api/v1/reports", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        records = data["data"]["records"]
        if records:
            record = records[0]
            expected_fields = [
                "report_id", "report_code", "customer_id", "device_sn",
                "device_name", "inspect_date", "total_score", "status",
                "status_text", "mobile", "name", "report_url"
            ]
            for field in expected_fields:
                assert field in record, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_limited_user_can_access(self, client: AsyncClient, limited_user_headers):
        """有限权限用户可访问报告列表。"""
        response = await client.get("/api/v1/reports", headers=limited_user_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_pagination_params(self, client: AsyncClient, admin_headers):
        """分页参数正确生效。"""
        response = await client.get(
            "/api/v1/reports?page=2&page_size=5", headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["page"] == 2
        assert data["data"]["page_size"] == 5

    @pytest.mark.asyncio
    async def test_empty_result_when_no_reports_match(self, client: AsyncClient, admin_headers):
        """无匹配报告时返回空列表。"""
        response = await client.get(
            "/api/v1/reports?sn=ZZZZ_NOT_EXIST_999", headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["records"] == []
        assert data["data"]["total"] == 0


class TestGetReportDetailAPI:
    """Test GET /reports/{report_id} endpoint."""

    @pytest.mark.asyncio
    async def test_requires_auth(self, client: AsyncClient):
        """未认证请求应返回 401。"""
        response = await client.get("/api/v1/reports/1")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_not_found_returns_404(self, client: AsyncClient, admin_headers):
        """不存在的报告返回 404。"""
        response = await client.get("/api/v1/reports/99999999", headers=admin_headers)
        assert response.status_code == 200  # ApiResponse always returns 200
        data = response.json()
        assert data["code"] == 404

    @pytest.mark.asyncio
    async def test_detail_has_expected_fields(self, client: AsyncClient, admin_headers):
        """报告详情包含预期字段。"""
        # 先获取列表取第一条的 ID
        list_resp = await client.get("/api/v1/reports?page_size=1", headers=admin_headers)
        list_data = list_resp.json()
        records = list_data["data"]["records"]
        if records:
            report_id = records[0]["report_id"]
            response = await client.get(f"/api/v1/reports/{report_id}", headers=admin_headers)
            assert response.status_code == 200
            data = response.json()
            assert data["code"] == 200
            assert "report" in data["data"]
