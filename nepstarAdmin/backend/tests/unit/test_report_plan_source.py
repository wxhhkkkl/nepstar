"""只读方案源的隔离测试；使用 SQL 替身，不连接任何数据库。"""

import pytest

from app.services.report_plan_source import fetch_plans_for_indicators


class Result:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeDB:
    def __init__(self, plan_rows, product_rows=()):
        self.results = [list(plan_rows), list(product_rows)]
        self.queries = []

    async def execute(self, statement):
        self.queries.append((str(statement), statement.compile().params))
        return Result(self.results.pop(0))


@pytest.mark.asyncio
async def test_empty_input_does_not_query():
    db = FakeDB(())
    assert await fetch_plans_for_indicators(db, []) == {}
    assert db.queries == []


@pytest.mark.asyncio
async def test_only_enabled_linked_plans_can_enter_report_result():
    # 方案已下架或解除关联时，查询无命中行，报告不可再显示旧方案。
    db = FakeDB(())
    assert await fetch_plans_for_indicators(db, [12]) == {}
    assert len(db.queries) == 1
    sql, params = db.queries[0]
    assert "sa_plan_indicator" in sql and "JOIN" in sql and "sa_plan" in sql
    assert "p.status = 1" in sql
    assert "ORDER BY pi.indicator_id, p.sort_order, p.id" in sql
    assert params["ids"] == (12,)


@pytest.mark.asyncio
async def test_default_threshold_and_enabled_product_filter():
    db = FakeDB([(12, 17, "睡眠方案", "保持规律作息", None, 1)], [])
    result = await fetch_plans_for_indicators(db, [12])
    assert result[12][0]["plan_id"] == 17
    assert result[12][0]["trigger_score_below"] == 80
    assert result[12][0]["products"] == []
    assert "pr.status = 1" in db.queries[1][0]
    assert "sa_plan_product" in db.queries[1][0]


@pytest.mark.asyncio
async def test_shared_plan_product_is_available_to_each_linked_indicator():
    db = FakeDB(
        [
            (12, 17, "睡眠方案", None, 80, 1),
            (13, 17, "睡眠方案", None, 80, 1),
        ],
        [(17, 30, "健康商品", "/assets/product.png")],
    )
    result = await fetch_plans_for_indicators(db, [12, 13])
    expected = [{
        "product_id": 30, "name": "健康商品",
        "image_url": "/assets/product.png", "image_alt": "健康商品",
    }]
    assert result[12][0]["products"] == expected
    assert result[13][0]["products"] == expected
    assert db.queries[1][1]["ids"] == (17,)
