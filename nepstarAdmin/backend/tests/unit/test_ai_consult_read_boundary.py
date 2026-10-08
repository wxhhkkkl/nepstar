"""AI 取数边界只用假报告与假数据库；不连接真实数据源。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table, delete, select, text, update

from app.models.new.sa_indicator import SAIndicator


inspect_base_table = Table(
    "inspect_base", MetaData(), Column("status", Integer), Column("report_date", String),
    Column("ranking", Integer), Column("customer_id", Integer),
    Column("inspect_date", String), Column("report_code", String),
)


class FakeReadDb:
    def __init__(self):
        self.execute = AsyncMock(return_value="read result")


@pytest.mark.asyncio
async def test_read_guard_allows_known_report_selects_but_rejects_writes_and_unknown_sql():
    from app.services.ai_consult_sources import ReadBoundaryViolation, ReadOnlyReportSession

    underlying = FakeReadDb()
    guarded = ReadOnlyReportSession(underlying)
    assert await guarded.execute(select(SAIndicator)) == "read result"
    assert await guarded.execute(
        select(SAIndicator).order_by(SAIndicator.sort_order, SAIndicator.id)
    ) == "read result"
    assert await guarded.execute(
        select(
            inspect_base_table.c.status, inspect_base_table.c.report_date,
            inspect_base_table.c.ranking, inspect_base_table.c.customer_id,
            inspect_base_table.c.inspect_date,
        ).where(inspect_base_table.c.report_code == "R1")
    ) == "read result"
    assert await guarded.execute(text(
        "SELECT target_id, inspect_name, inspect_level, parent_id, proportion "
        "FROM inspect_target WHERE target_id IN :ids"
    )) == "read result"
    assert await guarded.execute(text(
        "SELECT pi.indicator_id, p.id, p.plan_name, p.description, "
        "p.trigger_score_below, p.sort_order FROM nepstar.sa_plan_indicator pi "
        "JOIN nepstar.sa_plan p ON p.id = pi.plan_id "
        "WHERE p.status = 1 AND pi.indicator_id IN :ids "
        "ORDER BY pi.indicator_id, p.sort_order, p.id"
    )) == "read result"
    assert await guarded.execute(text(
        "SELECT report_code, inspect_date FROM inspect_base "
        "WHERE customer_id = :cid AND status = 1 AND report_code <> :current_code "
        "ORDER BY inspect_date DESC, report_code DESC LIMIT :n"
    )) == "read result"
    assert await guarded.execute(text(
        "SELECT report_code FROM inspect_base WHERE customer_id = :cid AND status = 1 "
        "AND (:ex IS NULL OR report_code <> :ex) ORDER BY inspect_date DESC LIMIT :n"
    )) == "read result"
    assert await guarded.execute(text(
        "SELECT pp.plan_id, pr.id, pr.product_name, pr.cover_url "
        "FROM nepstar.sa_plan_product pp JOIN nepstar.sa_product pr ON pr.id = pp.product_id "
        "WHERE pr.status = 1 AND pp.plan_id IN :ids ORDER BY pp.plan_id, pp.sort_order, pr.id"
    )) == "read result"
    allowed_count = underlying.execute.await_count
    other = SAIndicator.__table__.alias("other")

    forbidden = [
        update(SAIndicator).values(status=0),
        delete(SAIndicator),
        text("DROP TABLE inspect_base"),
        text("SELECT * FROM inspect_base"),
        text("SELECT report_code FROM inspect_base; DELETE FROM inspect_base"),
        select(SAIndicator).with_for_update(),
        select(SAIndicator).where(SAIndicator.status == 1),
        select(SAIndicator).join(other, SAIndicator.id == other.c.id),
        select(inspect_base_table.c.customer_id),
        select(text("secret FROM private_table")),
    ]
    for statement in forbidden:
        with pytest.raises(ReadBoundaryViolation):
            await guarded.execute(statement)
    assert underlying.execute.await_count == allowed_count
    with pytest.raises(ReadBoundaryViolation):
        guarded.add(object())


@pytest.mark.asyncio
async def test_only_named_tools_and_bound_report_scope_can_reach_sources(monkeypatch):
    from app.services import ai_consult_sources

    home_loader = AsyncMock(return_value={
        "report": {"report_code": "R1", "report_date": "2026-10-08", "total_score": 82,
                   "serial_number": "SECRET", "actual_age": 48},
        "systems": [
            {"system_code": "SYS_LUNG", "name": "肺功能", "score": 80, "recommendation": {"products": ["SECRET"]}},
            {"system_code": "SYS_BAD", "name": "异常", "score": 102},
        ],
    })
    detail_loader = AsyncMock(return_value={
        "report_code": "R1",
        "system": {"system_code": "SYS_LUNG", "name": "肺功能"},
        "indicator": {"indicator_code": "SYS_LUNG_SLEEP", "name": "呼吸睡眠", "score": 98,
                      "description": "测试描述", "trend": [{"date": "2026-12-01", "score": 99}],
                      "customer_id": 1001},
    })
    monkeypatch.setattr(
        ai_consult_sources, "_report_view_service",
        lambda: SimpleNamespace(build_home=home_loader, build_indicator_detail=detail_loader),
    )
    scope = SimpleNamespace(report_code="R1", customer_id=1001)
    db = FakeReadDb()

    for tool, indicator in (("arbitrary_sql", None), ("https://example.com", None),
                            ("indicator", "SYS_LUNG_SLEEP;DROP")):
        with pytest.raises(ai_consult_sources.ReadBoundaryViolation):
            await ai_consult_sources.read_report_tool(db, scope, tool, indicator_code=indicator)
    home_loader.assert_not_awaited()
    detail_loader.assert_not_awaited()

    home = await ai_consult_sources.read_report_tool(db, scope, "home")
    detail = await ai_consult_sources.read_report_tool(
        db, scope, "indicator", indicator_code="SYS_LUNG_SLEEP"
    )
    assert home == {"report_code": "R1", "report_date": "2026-10-08", "total_score": 82,
                    "systems": [{"system_code": "SYS_LUNG", "name": "肺功能", "score": 80}]}
    assert detail == {"report_code": "R1", "system": {"system_code": "SYS_LUNG", "name": "肺功能"},
                      "indicator": {"indicator_code": "SYS_LUNG_SLEEP", "name": "呼吸睡眠",
                                    "score": 98, "description": "测试描述"}}
    assert isinstance(home_loader.await_args.args[0], ai_consult_sources.ReadOnlyReportSession)
    assert detail_loader.await_args.args[1:] == ("R1", "SYS_LUNG_SLEEP", 1001)


@pytest.mark.asyncio
async def test_invalid_scope_or_mismatched_report_fails_closed(monkeypatch):
    from app.services import ai_consult_sources

    loader = AsyncMock(return_value={"report": {"report_code": "OTHER", "report_date": "2026-10-08"}, "systems": []})
    monkeypatch.setattr(
        ai_consult_sources, "_report_view_service",
        lambda: SimpleNamespace(build_home=loader),
    )
    db = FakeReadDb()
    for scope in (SimpleNamespace(report_code="https://example.com", customer_id=1),
                  SimpleNamespace(report_code="R1", customer_id=0)):
        with pytest.raises(ai_consult_sources.ReadBoundaryViolation):
            await ai_consult_sources.read_report_tool(db, scope, "home")
    loader.assert_not_awaited()
    with pytest.raises(ai_consult_sources.ReadBoundaryViolation):
        await ai_consult_sources.read_report_tool(
            db, SimpleNamespace(report_code="R1", customer_id=1001), "home"
        )


@pytest.mark.asyncio
async def test_non_finite_scores_are_omitted_without_exposing_raw_data(monkeypatch):
    from app.services import ai_consult_sources

    loader = AsyncMock(return_value={
        "report": {"report_code": "R1", "report_date": "2026-10-08", "total_score": float("inf")},
        "systems": [{"system_code": "SYS_LUNG", "name": "肺功能", "score": float("nan")}],
    })
    monkeypatch.setattr(
        ai_consult_sources, "_report_view_service",
        lambda: SimpleNamespace(build_home=loader),
    )
    result = await ai_consult_sources.read_report_tool(
        FakeReadDb(), SimpleNamespace(report_code="R1", customer_id=1001), "home"
    )
    assert result["total_score"] is None
    assert result["systems"] == []
