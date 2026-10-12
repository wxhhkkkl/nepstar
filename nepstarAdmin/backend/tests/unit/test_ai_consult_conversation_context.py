"""多轮提示上下文只读取 nepstar 会话中的少量用户输入，不读取 AI 答案正文。"""

import json
from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest


def citation(indicator_code, report_code="R1", customer_id=1001, follow_ups=None):
    item = {
        "kind": "report",
        "route": (
            f"#/system/SYS_LUNG/indicator/{indicator_code}"
            f"?reportId={report_code}&customerId={customer_id}"
        ),
    }
    if follow_ups is not None:
        item["follow_up_questions"] = follow_ups
    return json.dumps([item])


def citations(*indicator_codes):
    return json.dumps([{
        "kind": "report",
        "route": (
            f"#/system/SYS_LUNG/indicator/{indicator_code}"
            "?reportId=R1&customerId=1001"
        ),
    } for indicator_code in indicator_codes])


class MemoryResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return list(self._rows)


class MemoryDb:
    def __init__(self, rows):
        self.rows = rows
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return MemoryResult(self.rows)


@pytest.mark.asyncio
async def test_prior_context_query_selects_only_questions_and_bound_citations():
    from app.api.ai_consult import _prior_conversation_context
    from app.models.new.sa_ai_consult import SAAiConsultTurn

    db = MemoryDb([
        ("我最近睡得比较晚", citation("SYS_LUNG_SLEEP", follow_ups=["你每晚是否容易醒来？"])),
        ("呼吸睡眠怎么样？", citation("SYS_LUNG_SLEEP")),
        ("呼吸睡眠怎么样？", citation("SYS_LUNG_SLEEP", report_code="R2")),
        ("没有指标来源的问题", json.dumps([{
            "kind": "report", "route": "#/?reportId=R1&customerId=1001",
        }])),
    ])

    @asynccontextmanager
    async def writer():
        yield db

    result = await _prior_conversation_context(
        writer,
        SimpleNamespace(id="session-1", report_code="R1", customer_id=1001),
    )

    assert result["indicator_code"] == "SYS_LUNG_SLEEP"
    assert result["user_messages"] == [
        {"indicator_code": "SYS_LUNG_SLEEP", "text": "我最近睡得比较晚"},
        {"indicator_code": "SYS_LUNG_SLEEP", "text": "呼吸睡眠怎么样？"},
    ]
    assert result["prior_follow_up_questions"] == [
        {"indicator_code": "SYS_LUNG_SLEEP", "text": "你每晚是否容易醒来？"},
    ]
    assert [column.name for column in db.statement.selected_columns] == [
        "question_text", "evidence_refs_json",
    ]
    assert SAAiConsultTurn.answer_text.name not in {
        column.name for column in db.statement.selected_columns
    }
    assert db.statement._limit_clause.value == 5


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "latest_evidence",
    [
        json.dumps([{"kind": "report", "route": "#/system/SYS_LUNG?reportId=R1&customerId=1001"}]),
        citations("SYS_LUNG_SLEEP", "SYS_LUNG_VC"),
    ],
)
async def test_recent_system_or_multi_indicator_answer_does_not_reuse_older_anchor(latest_evidence):
    from app.api.ai_consult import _prior_conversation_context

    db = MemoryDb([
        ("最近一轮不是唯一指标解读", latest_evidence),
        ("较早的指标问题", citation("SYS_LUNG_SLEEP")),
    ])

    @asynccontextmanager
    async def writer():
        yield db

    result = await _prior_conversation_context(
        writer,
        SimpleNamespace(id="session-1", report_code="R1", customer_id=1001),
    )

    assert result == {
        "indicator_code": None, "user_messages": [], "prior_follow_up_questions": [],
    }


def test_followups_are_read_only_from_the_same_report_customer_and_indicator():
    from app.services.ai_consult_followups import follow_up_questions_from_evidence

    evidence = json.dumps([
        {
            "kind": "report",
            "route": "#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP?reportId=R1&customerId=1001",
            "follow_up_questions": ["你每晚是否容易醒来？", "要不要停药？"],
        },
        {
            "kind": "report",
            "route": "#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP?reportId=R2&customerId=1001",
            "follow_up_questions": ["另一报告的问题？"],
        },
        {
            "kind": "report",
            "route": "#/system/SYS_LUNG/indicator/SYS_LUNG_VC?reportId=R1&customerId=1001",
            "follow_up_questions": ["另一指标的问题？"],
        },
        {
            "kind": "report",
            "route": "#/system/SYS_LUNG/indicator/SYS_LUNG_SLEEP?reportId=R1&customerId=2002",
            "follow_up_questions": ["另一个访问者的问题？"],
        },
    ])

    assert follow_up_questions_from_evidence(
        evidence, report_code="R1", customer_id=1001,
        indicator_code="SYS_LUNG_SLEEP",
    ) == ["你每晚是否容易醒来？"]
