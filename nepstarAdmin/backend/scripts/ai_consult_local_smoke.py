"""Opt-in synthetic ASGI smoke test with real local storage, never a server.

--run --real-model makes at most one DeepSeek request with synthetic evidence.
Public process gates and persisted enabled remain false. Temporary test-only
policy overlays are restricted to the configured local fixture. No remote
database, application startup, report lookup, record deletion, or history API.
Synthetic questions/answers are deliberately retained in the local database.
"""

import argparse
import asyncio
import copy
import json
import os
import sys
from pathlib import Path
from time import perf_counter
from urllib.parse import urlsplit
from uuid import uuid4

try:
    from .ai_consult_preflight import evaluate, load_configuration
    from .local_ai_runtime import DEFAULT_LOCAL_URL, configure_database
except ImportError:
    from ai_consult_preflight import evaluate, load_configuration
    from local_ai_runtime import DEFAULT_LOCAL_URL, configure_database


BACKEND = Path(__file__).resolve().parents[1]
REPORT_CODE = "LOCAL-AI-DEMO"
CUSTOMER_ID = 1  # Fixture only; never a real customer.
INDICATOR_CODE = "SYS_LUNG_SLEEP_BREATHING"
QUESTION = "本地技术联调：这是一份虚构报告，呼吸睡眠这项指标的展示含义是什么？请只解释演示资料，不给健康建议，不必追问。"
HOME = {
    "report": {"report_code": REPORT_CODE, "report_date": "2026-10-10", "total_score": 82},
    "systems": [{"system_code": "SYS_LUNG", "name": "肺功能", "score": 84,
                 "indicators": [{"indicator_code": INDICATOR_CODE, "name": "呼吸睡眠", "score": 98}]}],
}


def assert_fixture_scope(report_code, customer_id):
    if report_code != REPORT_CODE or customer_id != CUSTOMER_ID:
        raise ValueError("Only the synthetic fixture is allowed")


async def synthetic_reader(_db, scope, tool, *, indicator_code=None):
    assert_fixture_scope(scope.report_code, scope.customer_id)
    if tool == "home":
        return {**HOME["report"], "systems": copy.deepcopy(HOME["systems"])}
    if tool != "indicator" or indicator_code != INDICATOR_CODE:
        raise ValueError("Only the synthetic indicator is allowed")
    return {
        "report_code": REPORT_CODE, "system": {"system_code": "SYS_LUNG"},
        "indicator": {"indicator_code": INDICATOR_CODE, "name": "呼吸睡眠", "score": 98,
                      "description": "这是虚构的展示资料，只用于软件联调，不是任何人的真实检测结果。"},
    }


def overlay_synthetic_policy(row):
    from sqlalchemy.orm.attributes import set_committed_value
    if row.enabled or row.notice_version != "local-consult-v1" or row.active_rule_version_id is None:
        raise ValueError("A disabled configured local fixture is required")
    # Test instance only: no dirty attribute, no UPDATE enabled, no database gate
    # change. The public running process continues to read persisted false.
    set_committed_value(row, "enabled", True)


def parse_events(response):
    if response.status_code != 200 or not response.headers.get("content-type", "").startswith("text/event-stream"):
        raise ValueError("Expected synthetic SSE response")
    records = []
    for block in response.text.strip().split("\n\n"):
        lines = block.splitlines()
        records.append((lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))))
    return records


def response_data(response):
    payload = response.json()
    if response.status_code != 200 or payload.get("code") != 200:
        raise ValueError("Synthetic API step was rejected")
    return payload["data"]


async def smoke(database, runtime, result):
    import httpx
    from fastapi import FastAPI
    from sqlalchemy import event, inspect, select
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from sqlalchemy.orm import Session
    from app.api import ai_consult as api
    from app.models.new.sa_ai_consult import SAAiConsultSettings, SAAiConsultTurn, SAAiConsultGeneration
    from app.services.ai_consult_pipeline import prepare_answer_candidate

    regular = database.get_ai_consult_sessionmaker()
    async with regular() as db:
        config = await db.get(SAAiConsultSettings, 1)
        if config is None or config.enabled:
            raise ValueError("Persisted AI must remain disabled")

    class SyntheticSession(Session):
        pass

    @event.listens_for(SyntheticSession, "loaded_as_persistent")
    def fixture_policy(_session, row):
        if isinstance(row, SAAiConsultSettings):
            overlay_synthetic_policy(row)

    @event.listens_for(SyntheticSession, "before_flush")
    def no_enable_write(session, *_args):
        for row in session.new.union(session.dirty):
            if isinstance(row, SAAiConsultSettings) and inspect(row).attrs.enabled.history.has_changes():
                raise ValueError("Smoke test cannot persist any activation change")

    writer = async_sessionmaker(bind=regular.kw["bind"], expire_on_commit=False,
                                sync_session_class=SyntheticSession)

    class NoReportDatabase:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *_args):
            return False
        async def execute(self, *_args, **_kwargs):
            raise ValueError("Smoke test must never query a real report source")

    class OneCallProvider:
        def __init__(self, delegate):
            self.delegate = delegate
            self.available = delegate.available
            self.provider_code, self.model_code = delegate.provider_code, delegate.model_code
            self.token_budget, self.requires_usage = delegate.token_budget, delegate.requires_usage
        async def draft(self, **kwargs):
            if result["model_calls"]:
                raise ValueError("Only one synthetic model call is allowed")
            result["model_calls"] += 1
            return await self.delegate.draft(**kwargs)

    provider = OneCallProvider(api.answer_provider)
    if not provider.available:
        raise ValueError("Configured provider is unavailable")

    async def verify(_db, report_code, customer_id):
        assert_fixture_scope(report_code, customer_id)
    async def home(_db, report_code, customer_id):
        assert_fixture_scope(report_code, customer_id)
        return copy.deepcopy(HOME)
    async def candidate(db, scope, question, **kwargs):
        return await prepare_answer_candidate(db, scope, question, reader=synthetic_reader, **kwargs)

    # These overrides live only in this non-listening test process.
    for flag in ("AI_CONSULT_GUEST_ENABLED", "AI_CONSULT_SESSIONS_ENABLED",
                 "AI_CONSULT_ANSWERS_ENABLED", "AI_CONSULT_OPERATIONS_READY"):
        setattr(runtime, flag, True)
    api.get_ai_consult_sessionmaker = lambda: writer
    api.async_session = NoReportDatabase
    api.verify_public_report, api.load_public_report_home = verify, home
    api.prepare_answer_candidate, api.answer_provider = candidate, provider
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://synthetic") as client:
        result["stage"] = "guest"
        guest = response_data(await client.post("/api/v1/ai-consult/guest-contexts",
                                               json={"report_code": REPORT_CODE, "customer_id": CUSTOMER_ID}))
        client.headers["Authorization"] = f"Bearer {guest['guest_token']}"
        params = {"report_code": REPORT_CODE}
        result["stage"] = "bootstrap"
        bootstrap = response_data(await client.get("/api/v1/ai-consult/bootstrap", params=params))
        if bootstrap.get("service_status") != "available":
            raise ValueError("Synthetic consultation service is unavailable")
        result["stage"] = "session"
        session = response_data(await client.post("/api/v1/ai-consult/sessions", json={
            "report_code": REPORT_CODE, "source": "indicator", "indicator_code": INDICATOR_CODE,
        }))
        path = f"/api/v1/ai-consult/sessions/{session['id']}/turns"
        request_id = str(uuid4())
        result["stage"] = "answer"
        response = await client.post(path, params=params, headers={"Idempotency-Key": request_id},
                                     json={"question": QUESTION})
        events = parse_events(response)
        if events[-1][0] != "completed":
            error = events[-1][1].get("code", "unknown")
            result["answer_error"] = error if isinstance(error, str) and error.startswith("consult.") else "unknown"
            raise ValueError("Synthetic answer failed review or generation")
        result["sse_event_types"] = [name for name, _payload in events]
        completed = events[-1][1]
        turn_id = completed["turn_id"]
        result["stage"] = "idempotency"
        replay = parse_events(await client.post(path, params=params, headers={"Idempotency-Key": request_id},
                                                 json={"question": QUESTION}))
        if replay[-1][0] != "completed" or replay[-1][1]["answer"] != completed["answer"] or result["model_calls"] != 1:
            raise ValueError("Idempotent replay failed")
        result["idempotent_replay_passed"] = True
        result["stage"] = "feedback"
        response_data(await client.put(f"{path}/{turn_id}/feedback", params=params, json={"helpful": True}))
        result["stage"] = "new_session_isolation"
        response_data(await client.post("/api/v1/ai-consult/sessions", json={"report_code": REPORT_CODE, "source": "home"}))
        old = await client.get(f"{path}/{turn_id}", params=params)
        history = await client.get("/api/v1/ai-consult/sessions", params=params)
        if old.status_code != 404 or history.status_code != 410:
            raise ValueError("Old consultation was exposed")
        result["history_hidden"] = True

    result["stage"] = "persistence"
    async with regular() as db:
        config = await db.get(SAAiConsultSettings, 1)
        turn = await db.get(SAAiConsultTurn, turn_id)
        generation = await db.scalar(select(SAAiConsultGeneration).where(SAAiConsultGeneration.turn_id == turn_id))
        if (config.enabled or turn.status != "completed" or turn.question_text != QUESTION
                or turn.answer_text != completed["answer"] or not turn.evidence_refs_json
                or turn.feedback_value != "helpful" or generation.status != "completed"
                or generation.prompt_tokens is None or generation.completion_tokens is None):
            raise ValueError("Synthetic record persistence failed")
        result.update({"status": "passed", "stage": "complete", "persisted_ai_enabled": False,
                       "question_answer_evidence_saved": True, "feedback_saved": True,
                       "prompt_tokens": generation.prompt_tokens, "completion_tokens": generation.completion_tokens,
                       "synthetic_record_retained": True})


def main():
    parser = argparse.ArgumentParser(description="仅用合成资料做本机 AI 端到端入库验收，不启动服务器")
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--real-model", action="store_true")
    args = parser.parse_args()
    result = {"status": "not_run", "real_report_sent": False, "remote_database_used": False, "model_calls": 0}
    if not args.run or not args.real_model:
        print(json.dumps(result))
        return 0
    os.chdir(BACKEND)
    sys.path.insert(0, str(BACKEND))
    started = perf_counter()
    try:
        config = load_configuration(".env")
        if (not evaluate(config, prepare_pilot=True)["offline_checks_passed"]
                or urlsplit(config["AI_CONSULT_PROVIDER_BASE_URL"]).hostname != "api.deepseek.com"):
            raise ValueError("Approved closed configuration required")
        database, runtime = configure_database(os.environ.get("AI_CONSULT_LOCAL_RUNTIME_URL", DEFAULT_LOCAL_URL))
        async def run():
            try:
                async with asyncio.timeout(60):
                    await smoke(database, runtime, result)
            finally:
                await database.get_ai_consult_sessionmaker().kw["bind"].dispose()
        asyncio.run(run())
    except Exception as exc:
        result.update({"status": "failed", "error_category": type(exc).__name__})
    result["elapsed_seconds"] = round(perf_counter() - started, 2)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] == "passed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
