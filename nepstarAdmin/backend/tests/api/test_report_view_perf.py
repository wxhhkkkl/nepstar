"""报告展示接口的响应时间测量（SC-013：P95 ≤ 3 秒）。

测量基准按 spec 的约定：**20 份不同报告的串行请求，每份报告各请求一次，不含并发压力**。

刻意挑一个报告数很多的客户，让趋势查询（全路径里最慢的一段）每次都真的执行；
否则测出来的只是没有历史时的快路径，说明不了问题。

本测试连真实数据源（MongoDB + 旧库），与其他 tests/api/ 的约定一致。
"""

import math
import time

import pytest
from sqlalchemy import text

from tests.api.health_helpers import make_client

BASE = "/api/v1/report-view"
SAMPLE_SIZE = 20
BUDGET_SECONDS = 3.0


def percentile(values: list[float], p: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, math.ceil(p * len(ordered)) - 1)]


@pytest.fixture
async def client():
    async with make_client() as ac:
        yield ac


async def _sample_reports(client, limit: int = SAMPLE_SIZE):
    """取一个有足够历史记录的客户的最近若干份报告，让趋势查询真实执行。"""
    from app.database import get_db
    from app.main import app

    override = app.dependency_overrides[get_db]
    async for db in override():
        row = (
            await db.execute(
                text(
                    "SELECT customer_id, COUNT(*) n FROM inspect_base "
                    "WHERE status = 1 AND report_code LIKE 'KH503%' "
                    "GROUP BY customer_id HAVING n >= :k "
                    "ORDER BY n DESC LIMIT 1"
                ),
                {"k": limit},
            )
        ).first()
        if row is None:
            pytest.skip("没有足够历史记录的客户，无法测量趋势路径")
        customer_id = row[0]
        codes = (
            await db.execute(
                text(
                    "SELECT report_code FROM inspect_base "
                    "WHERE customer_id = :c AND status = 1 "
                    "ORDER BY inspect_date DESC LIMIT :n"
                ),
                {"c": customer_id, "n": limit},
            )
        ).all()
        return customer_id, [c[0] for c in codes]


@pytest.mark.asyncio
async def test_home_and_detail_p95_within_budget(client):
    customer_id, codes = await _sample_reports(client)
    assert len(codes) >= 2, "样本不足"

    home_times: list[float] = []
    detail_times: list[float] = []
    for code in codes:
        started = time.perf_counter()
        r = await client.get(f"{BASE}/{code}/home?customer_id={customer_id}")
        home_times.append(time.perf_counter() - started)
        assert r.status_code == 200 and r.json()["code"] == 200, r.text

        started = time.perf_counter()
        d = await client.get(f"{BASE}/{code}/systems/SYS_CARDIO?customer_id={customer_id}")
        detail_times.append(time.perf_counter() - started)
        assert d.status_code == 200 and d.json()["code"] == 200, d.text

    home_p95 = percentile(home_times, 0.95)
    detail_p95 = percentile(detail_times, 0.95)
    print(
        f"\n样本 {len(codes)} 份报告 | 首页 P95 {home_p95:.2f}s (max {max(home_times):.2f}s)"
        f" | 详情 P95 {detail_p95:.2f}s (max {max(detail_times):.2f}s)"
    )

    assert home_p95 <= BUDGET_SECONDS, f"首页 P95 {home_p95:.2f}s 超出预算"
    assert detail_p95 <= BUDGET_SECONDS, f"详情 P95 {detail_p95:.2f}s 超出预算"
