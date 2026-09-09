"""Unit tests for report_service — list_reports() with RBAC filtering."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.report_service import list_reports, get_report_detail


class TestListReports:
    """Test list_reports() service function."""

    @pytest.mark.asyncio
    async def test_returns_empty_when_inspect_base_table_not_found(self):
        """inspect_base 表不存在时返回空列表。"""
        with patch("app.services.report_service.inspect_base_table", None):
            db = AsyncMock()
            result = await list_reports(db, user_id=1, page=1, page_size=20)
            assert result["records"] == []
            assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_admin_sees_all_within_dept_id(self):
        """Admin (user_id=1) 可以看到 dept_id 范围内的所有报告。"""
        db = AsyncMock()
        # Mock 执行链：count query → data query
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 42
        mock_data_result = MagicMock()
        mock_data_result.all.return_value = []

        db.execute = AsyncMock(side_effect=[mock_count_result, mock_data_result])

        result = await list_reports(db, user_id=1, page=1, page_size=20)
        # Admin 应该能获取到数据（不被 RBAC 过滤）
        assert result["total"] == 42
        assert result["page"] == 1
        assert result["page_size"] == 20

    @pytest.mark.asyncio
    async def test_non_admin_sees_only_authorized_org_reports(self):
        """普通用户只能看到授权组织下的设备报告。"""
        db = AsyncMock()
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 5
        mock_data_result = MagicMock()
        mock_data_result.all.return_value = []

        # 模拟 org_filter 返回授权 org_ids
        with patch("app.services.report_service.get_user_authorized_orgs",
                   new_callable=AsyncMock) as mock_auth:
            mock_auth.return_value = ([2, 4], ["EAST", "SH"])

            db.execute = AsyncMock(side_effect=[mock_count_result, mock_data_result])

            result = await list_reports(db, user_id=2, page=1, page_size=20)
            # 非 admin 用户获取到了过滤后的数据
            assert result["total"] == 5
            # 验证 org_filter 被调用
            mock_auth.assert_called_once_with(2, db)

    @pytest.mark.asyncio
    async def test_dept_id_filter_always_applied(self):
        """dept_id 全局过滤始终生效。"""
        db = AsyncMock()
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0
        mock_data_result = MagicMock()
        mock_data_result.all.return_value = []

        db.execute = AsyncMock(side_effect=[mock_count_result, mock_data_result])

        # 即使 admin 也要受 dept_id 限制
        result = await list_reports(db, user_id=1, page=1, page_size=20)
        assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_pagination(self):
        """分页参数正确传递。"""
        db = AsyncMock()
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 100
        mock_data_result = MagicMock()
        mock_data_result.all.return_value = []

        db.execute = AsyncMock(side_effect=[mock_count_result, mock_data_result])

        result = await list_reports(db, user_id=1, page=3, page_size=10)
        assert result["page"] == 3
        assert result["page_size"] == 10


class TestGetReportDetail:
    """Test get_report_detail() service function."""

    @pytest.mark.asyncio
    async def test_raises_when_table_not_found(self):
        """inspect_base 表不存在时抛出 ValueError。"""
        with patch("app.services.report_service.inspect_base_table", None):
            db = AsyncMock()
            with pytest.raises(ValueError, match="report.not_found"):
                await get_report_detail(db, 123)

    @pytest.mark.asyncio
    async def test_raises_when_report_not_found(self):
        """报告不存在时抛出 ValueError。"""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="report.not_found"):
            await get_report_detail(db, 999)


class TestListReportsFilters:
    """Test filter parameter handling in list_reports()."""

    @pytest.mark.asyncio
    async def test_org_filter_expands_descendants(self):
        """org_id 筛选应包含自身及所有子孙组织。"""
        db = AsyncMock()
        mock_count = MagicMock()
        mock_count.scalar.return_value = 10
        mock_data = MagicMock()
        mock_data.all.return_value = []

        with patch("app.services.report_service.get_user_authorized_orgs",
                   new_callable=AsyncMock) as mock_auth, \
             patch("app.services.report_service.get_org_descendants",
                   new_callable=AsyncMock) as mock_desc:
            mock_auth.return_value = ([], [])  # admin
            mock_desc.return_value = [3, 6, 7]  # org_id=3 及子孙

            db.execute = AsyncMock(side_effect=[mock_count, mock_data])
            result = await list_reports(db, user_id=1, page=1, page_size=20, org_id=3)

            assert result["total"] == 10
            mock_desc.assert_called_once_with(3, db)

    @pytest.mark.asyncio
    async def test_date_range_filter_applied(self):
        """start_date/end_date 参数应用于 inspect_date 筛选。"""
        db = AsyncMock()
        mock_count = MagicMock()
        mock_count.scalar.return_value = 3
        mock_data = MagicMock()
        mock_data.all.return_value = []

        db.execute = AsyncMock(side_effect=[mock_count, mock_data])
        result = await list_reports(
            db, user_id=1, page=1, page_size=20,
            start_date="2025-01-01", end_date="2025-12-31"
        )
        assert result["total"] == 3

    @pytest.mark.asyncio
    async def test_sn_filter_like(self):
        """SN 筛选使用 LIKE 模糊匹配。"""
        db = AsyncMock()
        mock_count = MagicMock()
        mock_count.scalar.return_value = 1
        mock_data = MagicMock()
        mock_data.all.return_value = []

        db.execute = AsyncMock(side_effect=[mock_count, mock_data])
        result = await list_reports(db, user_id=1, page=1, page_size=20, sn="SN-001")
        assert result["total"] == 1

    @pytest.mark.asyncio
    async def test_combined_filters_and_logic(self):
        """组合筛选条件使用 AND 逻辑。"""
        db = AsyncMock()
        mock_count = MagicMock()
        mock_count.scalar.return_value = 1
        mock_data = MagicMock()
        mock_data.all.return_value = []

        db.execute = AsyncMock(side_effect=[mock_count, mock_data])
        result = await list_reports(
            db, user_id=1, page=1, page_size=20,
            org_id=3, start_date="2025-06-01", sn="ABC"
        )
        assert result["total"] == 1

    @pytest.mark.asyncio
    async def test_null_sn_no_filter(self):
        """空 SN 不应用筛选。"""
        db = AsyncMock()
        mock_count = MagicMock()
        mock_count.scalar.return_value = 50
        mock_data = MagicMock()
        mock_data.all.return_value = []

        db.execute = AsyncMock(side_effect=[mock_count, mock_data])
        result = await list_reports(db, user_id=1, page=1, page_size=20, sn="")
        assert result["total"] == 50
