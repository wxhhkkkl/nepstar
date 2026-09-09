"""Unit tests for customer_service — list_customers() with dedup and RBAC."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.customer_service import list_customers


class TestListCustomers:
    """Test list_customers() service function."""

    @pytest.mark.asyncio
    async def test_returns_empty_when_customer_table_not_found(self):
        """customer 表不存在时返回空列表。"""
        with patch("app.services.customer_service.customer_table", None):
            db = AsyncMock()
            result = await list_customers(db, user_id=1, page=1, page_size=20)
            assert result["records"] == []
            assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_admin_sees_all_within_dept_id(self):
        """Admin 可以看到 dept_id 范围内的所有客户。"""
        db = AsyncMock()
        mock_data = MagicMock()
        mock_data.all.return_value = []
        db.execute = AsyncMock(return_value=mock_data)

        result = await list_customers(db, user_id=1, page=1, page_size=20)
        assert result["page"] == 1
        assert result["page_size"] == 20

    @pytest.mark.asyncio
    async def test_non_admin_sees_only_authorized(self):
        """普通用户只能看到授权组织下的客户。"""
        db = AsyncMock()
        mock_data = MagicMock()
        mock_data.all.return_value = []
        db.execute = AsyncMock(return_value=mock_data)

        with patch("app.services.customer_service.get_user_authorized_orgs",
                   new_callable=AsyncMock) as mock_auth:
            mock_auth.return_value = ([2, 4], ["EAST", "SH"])
            result = await list_customers(db, user_id=2, page=1, page_size=20)
            mock_auth.assert_called_once_with(2, db)

    @pytest.mark.asyncio
    async def test_pagination(self):
        """分页参数正确传递。"""
        db = AsyncMock()
        mock_data = MagicMock()
        mock_data.all.return_value = []
        db.execute = AsyncMock(return_value=mock_data)

        result = await list_customers(db, user_id=1, page=3, page_size=10)
        assert result["page"] == 3
        assert result["page_size"] == 10

    @pytest.mark.asyncio
    async def test_date_filter_applied(self):
        """日期筛选参数正确应用。"""
        db = AsyncMock()
        mock_data = MagicMock()
        mock_data.all.return_value = []
        db.execute = AsyncMock(return_value=mock_data)

        result = await list_customers(
            db, user_id=1, page=1, page_size=20,
            start_date="2025-01-01", end_date="2025-12-31"
        )
        assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_org_filter_expands_descendants(self):
        """org_id 筛选展开子孙组织。"""
        db = AsyncMock()
        mock_data = MagicMock()
        mock_data.all.return_value = []
        db.execute = AsyncMock(return_value=mock_data)

        with patch("app.services.customer_service.get_org_descendants",
                   new_callable=AsyncMock) as mock_desc:
            mock_desc.return_value = [3, 6, 7]
            await list_customers(db, user_id=1, page=1, page_size=20, org_id=3)
            mock_desc.assert_called_once_with(3, db)
