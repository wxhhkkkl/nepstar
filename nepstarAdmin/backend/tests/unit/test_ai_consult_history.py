"""旧报告 AI 历史趋势：只读替身，未来记录绝不能进入回答依据。"""

from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest


@pytest.fixture(autouse=True)
def isolated_target_reader(monkeypatch):
    from app.services import ai_consult_sources

    def find_target(first_targets, system_target_id, indicator_target_id):
        for system in first_targets or []:
            if system.get("targetId") == system_target_id:
                return next(
                    (child for child in system.get("secondTarget", [])
                     if child.get("targetId") == indicator_target_id),
                    None,
                )
        return None

    monkeypatch.setattr(
        ai_consult_sources, "_report_source",
        lambda: SimpleNamespace(find_target_under_system=find_target),
        raising=False,
    )


def report_node(score):
    return {
        "ddsReportInfo": {
            "firstTarget": [{
                "targetId": 10,
                "secondTarget": [{"targetId": 20, "score": score}],
            }]
        }
    }


class FakeRows:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeReadDb:
    def __init__(self, rows):
        self.rows = rows
        self.statements = []

    async def execute(self, statement, params=None):
        self.statements.append((statement, params))
        return FakeRows(self.rows)


class FakeMongo:
    def __init__(self, documents):
        self.documents = documents
        self.queries = []

    def find(self, query, projection):
        self.queries.append((query, projection))
        docs = [self.documents[code] for code in query["_id"]["$in"] if code in self.documents]
        return SimpleNamespace(to_list=AsyncMock(return_value=docs))


@pytest.mark.asyncio
async def test_history_uses_bound_customer_and_old_report_time_ceiling():
    from app.services.ai_consult_sources import fetch_bounded_indicator_history

    current_date = date(2026, 7, 29)
    inspected_at = datetime(2026, 7, 29, 9, 39)
    rows = [
        ("PAST", datetime(2026, 7, 1, 12), datetime(2026, 7, 2, 12), 1001),
        ("FUTURE", datetime(2026, 8, 1, 12), datetime(2026, 8, 2, 12), 1001),
        ("OTHER_USER", datetime(2026, 7, 1, 12), datetime(2026, 7, 2, 12), 2002),
    ]
    db = FakeReadDb(rows)
    mongo = FakeMongo({
        "PAST": {"_id": "PAST", **report_node(88)},
        "FUTURE": {"_id": "FUTURE", **report_node(99)},
        "OTHER_USER": {"_id": "OTHER_USER", **report_node(77)},
    })
    points = await fetch_bounded_indicator_history(
        db,
        SimpleNamespace(report_code="CURRENT", customer_id=1001, report_date=current_date),
        system_target_id=10,
        indicator_target_id=20,
        current_inspect_date=inspected_at,
        current_report_timestamp=datetime(2026, 7, 29, 10),
        current_score=90,
        collection=mongo,
    )
    assert points == [
        {"report_code": "PAST", "date": "2026-07-01", "score": 88},
        {"report_code": "CURRENT", "date": "2026-07-29", "score": 90},
    ]
    assert len(db.statements) == 1
    sql, params = db.statements[0]
    assert str(sql).startswith("SELECT report_code, inspect_date, report_date, customer_id FROM inspect_base")
    assert "customer_id = :cid" in str(sql)
    assert "inspect_date <= :cutoff" in str(sql)
    assert "report_date <= :report_time" in str(sql)
    assert params["cid"] == 1001
    assert params["cutoff"] == inspected_at
    assert params["report_time"] == datetime(2026, 7, 29, 10)
    assert params["n"] == 60
    assert mongo.queries[0][1] == {"ddsReportInfo.firstTarget": 1}
    assert set(mongo.queries[0][0]["_id"]["$in"]) == {"PAST"}


@pytest.mark.asyncio
async def test_history_skips_missing_invalid_and_other_indicator_points_and_caps_at_six():
    from app.services.ai_consult_sources import fetch_bounded_indicator_history

    rows = [
        (f"R{i}", datetime(2026, 6, i, 12), datetime(2026, 6, i, 13), 1001)
        for i in range(1, 9)
    ]
    rows += [("BAD_DATE", "not-a-date", "not-a-date", 1001)]
    docs = {f"R{i}": {"_id": f"R{i}", **report_node(80 + i)} for i in range(1, 9)}
    docs["R2"] = {"_id": "R2", **report_node(120)}
    docs["R3"] = {"_id": "R3", **report_node(None)}
    docs["R4"] = {"_id": "R4", **report_node(84)}
    db = FakeReadDb(rows)
    mongo = FakeMongo(docs)
    points = await fetch_bounded_indicator_history(
        db,
        SimpleNamespace(report_code="CURRENT", customer_id=1001, report_date=date(2026, 7, 1)),
        system_target_id=10,
        indicator_target_id=20,
        current_inspect_date=datetime(2026, 7, 1, 12),
        current_report_timestamp=datetime(2026, 7, 1, 13),
        current_score=None,
        collection=mongo,
    )
    assert len(points) <= 6
    assert all(0 <= item["score"] <= 100 for item in points)
    assert "R2" not in {item["report_code"] for item in points}
    assert "R3" not in {item["report_code"] for item in points}
    assert "BAD_DATE" not in {item["report_code"] for item in points}


@pytest.mark.asyncio
async def test_missing_or_invalid_current_date_never_queries_history():
    from app.services.ai_consult_sources import ReadBoundaryViolation, fetch_bounded_indicator_history

    db = FakeReadDb([])
    mongo = FakeMongo({})
    base = dict(
        system_target_id=10, indicator_target_id=20, current_score=90,
        current_report_timestamp=datetime(2026, 7, 1, 13), collection=mongo,
    )
    for scope, inspected in [
        (SimpleNamespace(report_code="R1", customer_id=1, report_date=None), datetime(2026, 7, 1)),
        (SimpleNamespace(report_code="R1", customer_id=1, report_date=date(2026, 7, 1)), None),
        (SimpleNamespace(report_code="R1", customer_id=1, report_date=date(2026, 7, 1)),
         datetime(2026, 8, 1)),
    ]:
        with pytest.raises(ReadBoundaryViolation):
            await fetch_bounded_indicator_history(
                db, scope, current_inspect_date=inspected, **base
            )
    assert db.statements == []
    assert mongo.queries == []


@pytest.mark.asyncio
async def test_no_history_returns_only_valid_current_point():
    from app.services.ai_consult_sources import fetch_bounded_indicator_history

    db = FakeReadDb([])
    mongo = FakeMongo({})
    points = await fetch_bounded_indicator_history(
        db,
        SimpleNamespace(report_code="R1", customer_id=1001, report_date=date(2026, 7, 1)),
        system_target_id=10,
        indicator_target_id=20,
        current_inspect_date=datetime(2026, 7, 1, 12),
        current_report_timestamp=datetime(2026, 7, 1, 13),
        current_score=91,
        collection=mongo,
    )
    assert points == [{"report_code": "R1", "date": "2026-07-01", "score": 91}]
    assert mongo.queries == []
