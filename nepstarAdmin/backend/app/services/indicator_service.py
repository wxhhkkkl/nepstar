"""Health indicator business logic (两级指标：一级分类 + 二级指标项)."""

import json

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import NEPSTAR_SCHEMA
from ..models.new.sa_indicator import SAIndicator
from ..schemas.indicator import IndicatorCreate, IndicatorUpdate


def _node(row) -> dict:
    """Serialize a row to the wire shape (code/name aliases)."""
    return {
        "id": row.id,
        "parent_id": row.parent_id,
        "code": row.ind_code,
        "name": row.ind_name,
        "description": row.description,
        "sort_order": row.sort_order,
        "status": row.status,
        "target_id": row.target_id,
        "report_status_text": row.report_status_text,
        "report_summary": row.report_summary,
        "report_interpretation": row.report_interpretation,
        "report_actions": _parse_actions(row.report_actions),
    }


def _parse_actions(raw) -> list[str]:
    """report_actions 以 JSON 文本存储；非法或为空时按空数组处理。"""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return [str(x) for x in parsed] if isinstance(parsed, list) else []


def _serialize_actions(actions: list[str] | None) -> str | None:
    return json.dumps(actions, ensure_ascii=False) if actions else None


def _table_ref(table: str) -> str:
    return f"{NEPSTAR_SCHEMA}.{table}" if NEPSTAR_SCHEMA else table


async def _code_exists(db: AsyncSession, code: str, exclude_id: int | None = None) -> bool:
    stmt = select(SAIndicator.id).where(SAIndicator.ind_code == code)
    if exclude_id is not None:
        stmt = stmt.where(SAIndicator.id != exclude_id)
    return (await db.execute(stmt.limit(1))).first() is not None


async def _validate_target_id(
    db: AsyncSession, target_id: int | None, exclude_id: int | None = None
) -> None:
    """校验 target_id 合法且未被其他指标占用（FR-032、SC-012）。

    不做存在性校验——报告数据源是外部系统，后台不应因外部系统不可达而阻塞配置维护。
    """
    if target_id is None:
        return
    if target_id <= 0:
        raise ValueError("indicator.target_id_required")
    stmt = select(SAIndicator.id).where(SAIndicator.target_id == target_id)
    if exclude_id is not None:
        stmt = stmt.where(SAIndicator.id != exclude_id)
    if (await db.execute(stmt.limit(1))).first() is not None:
        raise ValueError("indicator.target_id_conflict")


async def _referenced_in_plan(db: AsyncSession, indicator_id: int) -> bool:
    stmt = text(f"SELECT 1 FROM {_table_ref('sa_plan_indicator')} WHERE indicator_id = :i LIMIT 1")
    return (await db.execute(stmt, {"i": indicator_id})).first() is not None


async def get_tree(db: AsyncSession, keyword: str = "", status: int | None = None) -> list[dict]:
    """Return level-1 nodes (with their level-2 children), ordered by sort_order then id.

    keyword matches code/name on either level: a matching level-1 keeps all its children;
    a matching level-2 keeps its parent wrapper and only the matched child.
    """
    all_rows = (
        (await db.execute(select(SAIndicator).order_by(SAIndicator.sort_order, SAIndicator.id)))
        .scalars()
        .all()
    )
    if status is not None:
        all_rows = [r for r in all_rows if r.status == status]

    def matches(r: SAIndicator) -> bool:
        kw = keyword.strip().lower()
        return not kw or kw in (r.ind_code or "").lower() or kw in (r.ind_name or "").lower()

    levels2 = [r for r in all_rows if r.parent_id is not None]
    parents = [r for r in all_rows if r.parent_id is None]
    parent_map = {r.id: _node(r) for r in parents}

    for child in levels2:
        if not matches(child):
            continue
        node = _node(child)
        node["children"] = []
        parent_node = parent_map.get(child.parent_id)
        if parent_node is not None:
            parent_node.setdefault("children", []).append(node)

    result = []
    for p in parents:
        pnode = parent_map[p.id]
        if matches(p):
            result.append(pnode)  # parent matched → keep all (already attached) children
        elif pnode.get("children"):
            result.append(pnode)  # only matching children
    return result


async def get_by_id(db: AsyncSession, indicator_id: int) -> dict:
    row = (
        await db.execute(select(SAIndicator).where(SAIndicator.id == indicator_id))
    ).scalar_one_or_none()
    if row is None:
        raise ValueError("indicator.not_found")
    return _node(row)


async def _validate_parent(db: AsyncSession, parent_id: int | None) -> None:
    if parent_id is None:
        return
    parent = (
        await db.execute(select(SAIndicator).where(SAIndicator.id == parent_id))
    ).scalar_one_or_none()
    if parent is None:
        raise ValueError("indicator.parent_not_found")
    if parent.parent_id is not None:
        raise ValueError("indicator.parent_must_be_level1")


async def create_indicator(db: AsyncSession, data: IndicatorCreate) -> dict:
    await _validate_parent(db, data.parent_id)
    if await _code_exists(db, data.code):
        raise ValueError("indicator.code_exists")
    await _validate_target_id(db, data.target_id)
    row = SAIndicator(
        parent_id=data.parent_id,
        ind_code=data.code,
        ind_name=data.name,
        description=data.description,
        sort_order=data.sort_order,
        status=data.status,
        target_id=data.target_id,
        report_status_text=data.report_status_text,
        report_summary=data.report_summary,
        report_interpretation=data.report_interpretation,
        report_actions=_serialize_actions(data.report_actions),
    )
    db.add(row)
    await db.flush()
    await db.commit()
    await db.refresh(row)
    return _node(row)


async def update_indicator(db: AsyncSession, indicator_id: int, data: IndicatorUpdate) -> dict:
    row = (
        await db.execute(select(SAIndicator).where(SAIndicator.id == indicator_id))
    ).scalar_one_or_none()
    if row is None:
        raise ValueError("indicator.not_found")
    if (
        data.code is not None
        and data.code != row.ind_code
        and await _code_exists(db, data.code, exclude_id=indicator_id)
    ):
        raise ValueError("indicator.code_exists")
    if data.parent_id is not None:
        if data.parent_id == indicator_id:
            raise ValueError("indicator.parent_must_be_level1")
        await _validate_parent(db, data.parent_id)
        row.parent_id = data.parent_id
    if data.code is not None:
        row.ind_code = data.code
    if data.name is not None:
        row.ind_name = data.name
    if data.description is not None:
        row.description = data.description
    if data.sort_order is not None:
        row.sort_order = data.sort_order
    if data.status is not None:
        row.status = data.status
    # 用 model_fields_set 区分"未传"与"显式传 null"：后者表示清除登记
    if "target_id" in data.model_fields_set:
        await _validate_target_id(db, data.target_id, exclude_id=indicator_id)
        row.target_id = data.target_id
    # 同理：显式传 null 表示清空该段文案
    for field in ("report_status_text", "report_summary", "report_interpretation"):
        if field in data.model_fields_set:
            setattr(row, field, getattr(data, field))
    if "report_actions" in data.model_fields_set:
        row.report_actions = _serialize_actions(data.report_actions)
    await db.commit()
    await db.refresh(row)
    return _node(row)


async def delete_indicator(db: AsyncSession, indicator_id: int) -> None:
    row = (
        await db.execute(select(SAIndicator).where(SAIndicator.id == indicator_id))
    ).scalar_one_or_none()
    if row is None:
        raise ValueError("indicator.not_found")
    has_children = (
        await db.execute(
            select(SAIndicator.id).where(SAIndicator.parent_id == indicator_id).limit(1)
        )
    ).first() is not None
    if has_children:
        raise ValueError("indicator.has_children")
    if await _referenced_in_plan(db, indicator_id):
        raise ValueError("indicator.in_use")
    await db.delete(row)
    await db.commit()
