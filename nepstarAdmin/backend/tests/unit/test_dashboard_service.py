"""Unit tests for dashboard_service — stats and trend queries."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.dashboard_service import get_dashboard_stats, get_dashboard_trend


class TestDashboardStats:
    @pytest.mark.asyncio
    async def test_stats_has_all_three_keys(self):
        db = AsyncMock()
        mock = MagicMock()
        mock.scalar.return_value = 42
        db.execute = AsyncMock(return_value=mock)

        with patch("app.services.dashboard_service.get_user_authorized_orgs",
                   new_callable=AsyncMock) as m:
            m.return_value = ([], [])
            result = await get_dashboard_stats(db, user_id=1)
            assert "device_count" in result
            assert "report_count" in result
            assert "customer_count" in result

    @pytest.mark.asyncio
    async def test_admin_gets_all_in_dept_id(self):
        db = AsyncMock()
        mock = MagicMock()
        mock.scalar.return_value = 100
        db.execute = AsyncMock(return_value=mock)

        with patch("app.services.dashboard_service.get_user_authorized_orgs",
                   new_callable=AsyncMock):
            result = await get_dashboard_stats(db, user_id=1)
            assert result["device_count"] == 100
            assert result["report_count"] == 100
            assert result["customer_count"] == 100

    @pytest.mark.asyncio
    async def test_device_count_zero_when_table_unavailable(self):
        with patch("app.services.dashboard_service.inspect_base_table", None):
            db = AsyncMock()
            result = await get_dashboard_stats(db, user_id=1)
            assert result["device_count"] == 0


class TestDashboardTrend:
    @pytest.mark.asyncio
    async def test_trend_returns_points_array(self):
        db = AsyncMock()
        mock = MagicMock()
        mock.all.return_value = []
        db.execute = AsyncMock(return_value=mock)

        with patch("app.services.dashboard_service.get_user_authorized_orgs",
                   new_callable=AsyncMock):
            result = await get_dashboard_trend(db, user_id=1, start_date="2025-06-01",
                                               end_date="2025-06-30")
            assert "points" in result
            assert result["granularity"] == "daily"

    @pytest.mark.asyncio
    async def test_weekly_granularity_over_30_days(self):
        db = AsyncMock()
        mock = MagicMock()
        mock.all.return_value = []
        db.execute = AsyncMock(return_value=mock)

        result = await get_dashboard_trend(db, user_id=1, start_date="2025-01-01",
                                           end_date="2025-03-31")
        assert result["granularity"] == "weekly"
