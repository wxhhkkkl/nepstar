"""Unit tests for indicator_service — AsyncMock against db, no DB required."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.models.new.sa_indicator import SAIndicator
from app.schemas.indicator import IndicatorCreate, IndicatorUpdate


def mock_row(id, parent_id, code="HT001", name="体重管理", status=1, sort_order=1):
    r = MagicMock(spec=SAIndicator)
    r.id = id
    r.parent_id = parent_id
    r.ind_code = code
    r.ind_name = name
    r.description = None
    r.status = status
    r.sort_order = sort_order
    return r


def db_result(scalar_one_or_none=None, first=None, scalars_all=None):
    """Result mock exposing the accessors indicator_service uses."""
    r = MagicMock()
    r.scalar_one_or_none.return_value = scalar_one_or_none
    r.first.return_value = first
    r.scalars.return_value.all.return_value = scalars_all if scalars_all is not None else []
    return r


@pytest.mark.asyncio
async def test_create_level1_success():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=db_result(first=None))  # code does not exist
    from app.services.indicator_service import create_indicator

    out = await create_indicator(db, IndicatorCreate(code="HT002", name="营养管理"))
    assert out["code"] == "HT002"
    assert out["name"] == "营养管理"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_duplicate_code_rejected():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=db_result(first=(1,)))  # code exists
    from app.services.indicator_service import create_indicator

    with pytest.raises(ValueError, match="indicator.code_exists"):
        await create_indicator(db, IndicatorCreate(code="HT001", name="重复"))


@pytest.mark.asyncio
async def test_create_level2_under_level2_rejected():
    # parent is itself a level-2 (parent_id not None) → depth > 2 forbidden
    parent = mock_row(9, parent_id=1)  # level-2
    db = AsyncMock()
    db.execute = AsyncMock(return_value=db_result(scalar_one_or_none=parent))
    from app.services.indicator_service import create_indicator

    with pytest.raises(ValueError, match="indicator.parent_must_be_level1"):
        await create_indicator(db, IndicatorCreate(parent_id=9, code="HT009", name="三层"))


@pytest.mark.asyncio
async def test_create_level2_under_level1_success():
    level1 = mock_row(1, parent_id=None)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[
        db_result(scalar_one_or_none=level1),  # parent lookup
        db_result(first=None),                  # code not exists
    ])
    from app.services.indicator_service import create_indicator

    out = await create_indicator(db, IndicatorCreate(parent_id=1, code="HT0011", name="体脂率"))
    assert out["code"] == "HT0011"
    assert out["parent_id"] == 1
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_level1_with_children_rejected():
    row = mock_row(1, parent_id=None)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[
        db_result(scalar_one_or_none=row),
        db_result(first=(1,)),  # has children
    ])
    from app.services.indicator_service import delete_indicator

    with pytest.raises(ValueError, match="indicator.has_children"):
        await delete_indicator(db, 1)


@pytest.mark.asyncio
async def test_delete_indicator_in_use_rejected():
    row = mock_row(4, parent_id=1)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[
        db_result(scalar_one_or_none=row),
        db_result(first=None),   # no children
        db_result(first=(1,)),   # referenced by a plan
    ])
    from app.services.indicator_service import delete_indicator

    with pytest.raises(ValueError, match="indicator.in_use"):
        await delete_indicator(db, 4)


@pytest.mark.asyncio
async def test_delete_indicator_success():
    row = mock_row(4, parent_id=1)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[
        db_result(scalar_one_or_none=row),
        db_result(first=None),  # no children
        db_result(first=None),  # not referenced
    ])
    from app.services.indicator_service import delete_indicator

    await delete_indicator(db, 4)
    db.delete.assert_awaited_once_with(row)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_reject_duplicate_code():
    row = mock_row(1, parent_id=None, code="HT001")
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[
        db_result(scalar_one_or_none=row),
        db_result(first=(2,)),  # another row already uses HT003
    ])
    from app.services.indicator_service import update_indicator

    with pytest.raises(ValueError, match="indicator.code_exists"):
        await update_indicator(db, 1, IndicatorUpdate(code="HT003"))


@pytest.mark.asyncio
async def test_get_tree_groups_children():
    l1 = mock_row(1, parent_id=None, code="HT001")
    l2 = mock_row(4, parent_id=1, code="HT0011", name="体脂率")
    db = AsyncMock()
    db.execute = AsyncMock(return_value=db_result(scalars_all=[l1, l2]))
    from app.services.indicator_service import get_tree

    tree = await get_tree(db)
    assert len(tree) == 1
    assert tree[0]["id"] == 1
    assert [c["code"] for c in tree[0]["children"]] == ["HT0011"]


@pytest.mark.asyncio
async def test_get_tree_keyword_filters_to_matching_child():
    l1 = mock_row(1, parent_id=None, code="HT001", name="体重管理")
    l2a = mock_row(4, parent_id=1, code="HT0011", name="体脂率")
    l2b = mock_row(5, parent_id=1, code="HT0012", name="基础代谢")
    db = AsyncMock()
    db.execute = AsyncMock(return_value=db_result(scalars_all=[l1, l2a, l2b]))
    from app.services.indicator_service import get_tree

    tree = await get_tree(db, keyword="代谢")
    assert len(tree) == 1
    assert [c["code"] for c in tree[0]["children"]] == ["HT0012"]
