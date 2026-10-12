"""Consultation quotas use fake DB results; no real database or provider call."""

from types import SimpleNamespace

import pytest

from app.services.ai_consult_turns import TurnStart
from app.services.ai_consult_usage import ConsultLimitReached, reserve_generation_capacity


class FakeUsageDb:
    def __init__(self, counts):
        self.counts = iter(counts)
        self.queries = []
        self.generation = SimpleNamespace(budget_tokens=0, model_code=None)

    async def scalar(self, statement):
        self.queries.append(str(statement))
        return next(self.counts)

    async def execute(self, statement):
        self.queries.append(str(statement))
        return SimpleNamespace(scalar_one_or_none=lambda: self.generation)


def config(**changes):
    values = dict(
        enabled=True,
        daily_success_limit=20,
        per_minute_limit=5,
        global_daily_token_limit=100000,
        max_concurrent_generations=2,
        max_question_chars=500,
    )
    values.update(changes)
    return SimpleNamespace(**values)


START = TurnStart(12, 34, 1, False, "running")


@pytest.mark.asyncio
async def test_new_generation_reserves_budget_in_nepstar_only():
    db = FakeUsageDb([3, 1, 1, 4500])
    await reserve_generation_capacity(
        db, config(), guest_id=7, start=START,
        question="这项结果如何？", token_budget=16384, model_code="fake-model",
    )
    assert db.generation.budget_tokens == 16384
    assert db.generation.model_code == "fake-model"
    assert len(db.queries) == 5
    assert all("nepstar.sa_ai_consult_" in query for query in db.queries)
    assert all("platform." not in query and "kj_fastplus." not in query for query in db.queries)


@pytest.mark.asyncio
@pytest.mark.parametrize("counts,code", [
    ([20], "consult.daily_limit"),
    ([0, 5], "consult.rate_limited"),
    ([0, 0, 2], "consult.capacity_busy"),
    ([0, 0, 0, 90000], "consult.global_budget_exhausted"),
])
async def test_limits_reject_without_reserving(counts, code):
    db = FakeUsageDb(counts)
    with pytest.raises(ConsultLimitReached) as exc:
        await reserve_generation_capacity(
            db, config(), guest_id=7, start=START,
            question="这项结果如何？", token_budget=16384, model_code="fake-model",
        )
    assert exc.value.code == code
    assert db.generation.budget_tokens == 0


@pytest.mark.asyncio
async def test_disabled_or_replayed_generation_never_queries_usage():
    db = FakeUsageDb([])
    await reserve_generation_capacity(
        db, config(), guest_id=7,
        start=TurnStart(12, 34, 1, True, "completed"),
        question="重复问题", token_budget=16384, model_code="fake-model",
    )
    assert db.queries == []
    with pytest.raises(ConsultLimitReached) as exc:
        await reserve_generation_capacity(
            db, config(enabled=False), guest_id=7, start=START,
            question="新问题", token_budget=16384, model_code="fake-model",
        )
    assert exc.value.code == "consult.disabled"


@pytest.mark.asyncio
async def test_maintenance_blocks_generation_without_reserving_budget():
    db = FakeUsageDb([])
    with pytest.raises(ConsultLimitReached) as exc:
        await reserve_generation_capacity(
            db, config(maintenance_text="服务维护中。"), guest_id=7, start=START,
            question="这项结果如何？", token_budget=16384, model_code="fake-model",
        )
    assert exc.value.code == "consult.maintenance"
    assert db.queries == []
    assert db.generation.budget_tokens == 0


@pytest.mark.asyncio
async def test_configured_question_length_is_checked_before_any_usage_query():
    db = FakeUsageDb([])
    with pytest.raises(ConsultLimitReached) as exc:
        await reserve_generation_capacity(
            db, config(max_question_chars=20), guest_id=7, start=START,
            question="问" * 21, token_budget=16384, model_code="fake-model",
        )
    assert exc.value.code == "consult.question_too_long"
    assert db.queries == []
    assert db.generation.budget_tokens == 0
