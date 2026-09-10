"""Unit tests for plan_service — AsyncMock against db; dedup helper is pure."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.new.sa_indicator import SAIndicator
from app.models.new.sa_plan import SAPlan, SAPlanIndicator, SAPlanProduct
from app.models.new.sa_product import SAProduct
from app.services.plan_service import dedup_ids


def res(rows_all=None, scalar_one=None, scalars_all=None, scalar=None, first=None):
    r = MagicMock()
    r.all.return_value = rows_all if rows_all is not None else []
    r.scalar_one_or_none.return_value = scalar_one
    r.scalar.return_value = scalar
    r.first.return_value = first
    r.scalars.return_value.all.return_value = scalars_all if scalars_all is not None else []
    return r


def plan_row(id=1, name="体重管理方案"):
    r = MagicMock(spec=SAPlan)
    r.id = id
    r.plan_name = name
    r.description = None
    r.status = 1
    r.sort_order = 0
    r.created_at = None
    r.updated_at = None
    return r


def test_dedup_ids_preserves_first_seen_order():
    assert dedup_ids([3, 1, 3, 2, 1]) == [3, 1, 2]
    assert dedup_ids([]) == []


@pytest.mark.asyncio
async def test_create_plan_unknown_product_rejected():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=res(scalars_all=[]))  # none of the ids exist
    from app.schemas.plan import PlanCreate
    from app.services.plan_service import create_plan

    with pytest.raises(ValueError, match="plan.product_not_found"):
        await create_plan(db, PlanCreate(name="方案", product_ids=[999]))


@pytest.mark.asyncio
async def test_create_plan_unknown_indicator_rejected():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            res(scalars_all=[1]),  # product exists
            res(scalars_all=[]),  # no existing plan_product rows
            res(scalars_all=[]),  # indicator id does not exist
        ]
    )
    from app.schemas.plan import PlanCreate
    from app.services.plan_service import create_plan

    with pytest.raises(ValueError, match="plan.indicator_not_found"):
        await create_plan(db, PlanCreate(name="方案", product_ids=[1], indicator_ids=[999]))


@pytest.mark.asyncio
async def test_delete_plan_removes_own_junctions_then_plan():
    db = AsyncMock()
    jp = MagicMock(spec=SAPlanProduct)
    ji = MagicMock(spec=SAPlanIndicator)
    db.execute = AsyncMock(
        side_effect=[
            res(scalar_one=plan_row()),  # plan lookup
            res(scalars_all=[jp]),  # plan_product rows
            res(scalars_all=[ji]),  # plan_indicator rows
        ]
    )
    from app.services.plan_service import delete_plan

    await delete_plan(db, 1)
    assert db.delete.await_count == 3  # 2 junctions + plan
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_detail_derives_indicator_level_and_parent_name():
    pp = MagicMock(spec=SAPlanProduct)
    pp.product_id = 2
    pp.sort_order = 0
    prod = MagicMock(spec=SAProduct)
    prod.product_name = "复合维生素"
    prod.cover_url = "https://x/a.jpg"

    ji = MagicMock(spec=SAPlanIndicator)
    ji.indicator_id = 9
    ind = MagicMock(spec=SAIndicator)
    ind.id = 9
    ind.parent_id = 5
    ind.ind_code = "HT0011"
    ind.ind_name = "体脂率"
    ind.status = 1

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            res(scalar_one=plan_row()),  # plan
            res(rows_all=[(pp, prod)]),  # products join
            res(rows_all=[(ji, ind)]),  # indicators join
            res(rows_all=[(5, "体重管理", 1)]),  # missing parent meta (id, name, sort_order)
        ]
    )
    from app.services.plan_service import get_plan_detail

    detail = await get_plan_detail(db, 1)
    assert detail["products"][0]["name"] == "复合维生素"
    assert detail["indicators"][0]["level"] == 2
    assert detail["indicators"][0]["parent_name"] == "体重管理"


def ind_row(id, parent_id, sort_order, name):
    r = MagicMock(spec=SAIndicator)
    r.id = id
    r.parent_id = parent_id
    r.ind_code = f"C{id}"
    r.ind_name = name
    r.status = 1
    r.sort_order = sort_order
    return r


@pytest.mark.asyncio
async def test_detail_orders_indicators_grouped_by_category():
    """FR-305: grouped, deterministic order — category by sort_order, then its children."""
    cat_b = ind_row(20, None, 2, "乙类")
    cat_a = ind_row(10, None, 1, "甲类")
    child_a = ind_row(11, 10, 5, "甲-子")
    child_b = ind_row(21, 20, 1, "乙-子")

    def ji(ind):
        m = MagicMock(spec=SAPlanIndicator)
        m.indicator_id = ind.id
        return m

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[
        res(scalar_one=plan_row()),  # plan
        res(rows_all=[]),            # products join
        # indicators joined in a deliberately scrambled order
        res(rows_all=[(ji(cat_b), cat_b), (ji(child_a), child_a),
                      (ji(cat_a), cat_a), (ji(child_b), child_b)]),
    ])
    from app.services.plan_service import get_plan_detail

    detail = await get_plan_detail(db, 1)
    assert [i["indicator_id"] for i in detail["indicators"]] == [10, 11, 20, 21]
    assert [i["level"] for i in detail["indicators"]] == [1, 2, 1, 2]
