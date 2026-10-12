"""Bounded local MySQL/model HTTP load run with in-memory synthetic reports.

The temporary server never loads real reports or starts the ordinary app. All
consultation records remain in loopback nepstar. Trial quotas are process-only
SQLAlchemy overlays; persisted browser policy is not edited. Maximum 20 model
calls, no retries. Real calls require --run --real-model; the explicit single
fault scenarios use a waiting fake report source/provider, never a model call.
"""

import argparse
import asyncio
import copy
import json
import logging
import math
import os
import shutil
import socket
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit

try:
    from .ai_consult_live_acceptance import Fixture, INDICATOR, QUESTION, run
    from .ai_consult_preflight import FLAGS, evaluate, load_configuration
    from .local_ai_runtime import DEFAULT_LOCAL_URL, configure_database, local_write_url
except ImportError:
    from ai_consult_live_acceptance import Fixture, INDICATOR, QUESTION, run
    from ai_consult_preflight import FLAGS, evaluate, load_configuration
    from local_ai_runtime import DEFAULT_LOCAL_URL, configure_database, local_write_url


BACKEND = Path(__file__).resolve().parents[1]
FRONTEND = BACKEND.parent.parent / "reportFront"
PROTECTED = (
    "enabled", "provider_code", "model_code", "notice_version", "notice_text",
    "data_scope_text", "data_scope_hash", "active_rule_version_id", "maintenance_text",
    "guest_create_limit_per_minute", "daily_success_limit", "per_minute_limit",
    "global_daily_token_limit", "max_concurrent_generations", "max_question_chars",
)
TRIAL_LIMITS = {"guest_create_limit_per_minute": 100,
                "global_daily_token_limit": 1000000, "max_concurrent_generations": 20}


def synthetic_fixtures(samples):
    if type(samples) is not int or not 1 <= samples <= 20:
        raise ValueError("One to twenty synthetic samples required")
    return [Fixture(f"AI-CONSULT-TEST-LOAD-{i:02}", 900000 + i) for i in range(1, samples + 1)]


def synthetic_home(fixture):
    score = 70 + int(fixture.report_code.rsplit("-", 1)[1])
    return {"report": {"report_code": fixture.report_code, "report_date": "2026-10-10", "total_score": score},
            "systems": [{"system_code": "SYS_LUNG", "name": "肺功能", "score": score,
                         "indicators": [{"indicator_code": INDICATOR, "name": "呼吸睡眠", "score": score}]}]}


def verify_fixture(fixtures, code, customer):
    match = next((item for item in fixtures if item.report_code == code and item.customer_id == customer), None)
    if match is None:
        raise ValueError("Synthetic fixture scope mismatch")
    return match


def overlay_trial_limits(row):
    from sqlalchemy.orm.attributes import set_committed_value
    for key, value in TRIAL_LIMITS.items():
        set_committed_value(row, key, value)


class CappedProvider:
    """One bounded process only; never retry or exceed its explicit call cap."""
    def __init__(self, delegate, cap):
        synthetic_fixtures(cap)
        self.delegate, self.cap = delegate, cap
        for key in ("available", "provider_code", "model_code", "token_budget", "requires_usage"):
            setattr(self, key, getattr(delegate, key))
        self.active = self.peak = self.calls = self.model_calls = self.cancelled = 0

    async def invoke(self, **kwargs):
        self.model_calls += 1
        return await self.delegate.draft(**kwargs)

    async def draft(self, **kwargs):
        if self.calls >= self.cap:
            raise ValueError("Synthetic model request cap reached")
        self.calls += 1
        self.active += 1
        self.peak = max(self.peak, self.active)
        try:
            return await self.invoke(**kwargs)
        except asyncio.CancelledError:
            self.cancelled += 1
            raise
        finally:
            self.active -= 1


class TimeoutProvider(CappedProvider):
    """Synthetic slow-provider fault, never contacts the external model."""
    async def invoke(self, **_kwargs):
        await asyncio.Future()


def validate_scenario(samples, scenario):
    synthetic_fixtures(samples)
    if scenario not in {"success", "timeout", "provider_timeout"} or (scenario != "success" and samples != 1):
        raise ValueError("Fault scenarios require exactly one synthetic sample")


def fault_passed(result, provider, source_cancelled, scenario):
    code = "consult.timeout" if scenario == "timeout" else "consult.provider_unavailable"
    duration = 60000 if scenario == "timeout" else 20000
    latency = result.get("error_latency_ms", {}).get(code) or {}
    failed = result["timeout_attempt_count"] if scenario == "timeout" else result["unavailable_attempt_count"]
    return bool(
        result.get("outcomes") == {code: 1}
        and duration <= latency.get("p95_ms", 0) < duration + 5000
        and result["saved_question_count"] == result["saved_attempt_count"] == failed == 1
        and result["completed_attempt_count"] == result["running_attempt_count"] == result["saved_answer_count"] == 0
        and provider.model_calls == 0
        and (source_cancelled == 1 and provider.calls == 0 if scenario == "timeout" else provider.cancelled == 1)
        and result["unknown_usage_reserved_tokens"] == provider.token_budget
    )


def success_storage_passed(result, samples, calls):
    return bool(calls == samples and all(result[key] == samples for key in (
        "saved_question_count", "saved_attempt_count", "completed_attempt_count", "saved_answer_count",
    )) and all(result[key] == 0 for key in (
        "running_attempt_count", "timeout_attempt_count", "unavailable_attempt_count",
    )))


def validate_browser_options(browser, scenario, frontend_url):
    if not browser:
        return
    parsed = urlsplit(frontend_url)
    if (scenario != "success" or parsed.scheme != "http" or parsed.hostname != "127.0.0.1"
            or not parsed.port or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in {"", "/"}):
        raise ValueError("Browser trial requires an explicit loopback frontend and success scenario")


def browser_summary(raw, samples):
    """Only fixed aggregate fields may cross from the browser subprocess."""
    value = json.loads(raw)
    counts = {"samples", "question_requests", "browser_completed_count", "proxy_question_in_flight_peak",
              "external_requests_blocked", "proxy_requests_blocked", "current_turn_reads"}
    booleans = {"local_streaming_proxy_measured", "mobile_emulation_measured", "physical_device_measured",
                "deployment_proxy_measured", "release_accepted"}
    allowed = counts | booleans | {"status", "error_category", "browser_version", "browser_latency_ms"}
    if (not isinstance(value, dict) or set(value) - allowed or value.get("status") not in {"passed", "failed"}
            or any(type(value[key]) is not int or not 0 <= value[key] <= samples for key in counts if key in value)
            or any(type(value[key]) is not bool for key in booleans if key in value)
            or value.get("release_accepted") is not False or value.get("samples") != samples):
        raise ValueError("Invalid browser aggregate result")
    if value.get("status") == "failed":
        if (set(value) != {"status", "error_category", "samples", "question_requests", "release_accepted"}
                or value.get("error_category") not in {"browser_setup", "browser_questions", "browser_validation", "browser_input"}):
            raise ValueError("Unknown browser error category")
        return value
    metrics = value.get("browser_latency_ms", {})
    if (set(value) != allowed - {"error_category"}
            or value["question_requests"] != samples or value["browser_completed_count"] != samples
            or value["external_requests_blocked"] or value["proxy_requests_blocked"] or value["current_turn_reads"]
            or value["physical_device_measured"] or value["deployment_proxy_measured"]
            or not value["local_streaming_proxy_measured"] or not value["mobile_emulation_measured"]
            or not isinstance(value["browser_version"], str) or len(value["browser_version"]) > 40
            or any(char not in "0123456789." for char in value["browser_version"])
            or not isinstance(metrics, dict) or set(metrics) != {"feedback_ms", "accepted_ms", "answer_ms", "completed_ms"}):
        raise ValueError("Incomplete browser acceptance result")
    for times in metrics.values():
        if (not isinstance(times, dict) or set(times) != {"p50_ms", "p95_ms", "p99_ms"}
                or any(type(item) not in {float, int} or not math.isfinite(item) or not 0 <= item <= 90000
                       for item in times.values())
                or not times["p50_ms"] <= times["p95_ms"] <= times["p99_ms"]):
            raise ValueError("Invalid browser timing")
    return value


async def run_browser_trial(backend_url, frontend_url, fixtures):
    executable = shutil.which("node")
    if not executable:
        raise ValueError("Node runtime is required for browser measurements")
    process = await asyncio.create_subprocess_exec(
        executable, str(FRONTEND / "scripts/ai-consult-browser-trial.mjs"),
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        cwd=FRONTEND,
        env={key: os.environ[key] for key in ("PATH", "TMPDIR", "LANG", "LC_ALL", "PLAYWRIGHT_BROWSERS_PATH")
             if key in os.environ},
    )
    payload = {"backend_url": backend_url, "frontend_url": frontend_url,
               "fixtures": [vars(item) for item in fixtures], "question": QUESTION, "indicator": INDICATOR}
    try:
        async with asyncio.timeout(85):
            stdout, _stderr = await process.communicate(json.dumps(payload).encode())
        if len(stdout) > 16384:
            raise ValueError("Browser summary exceeded limit")
        summary = browser_summary(stdout, len(fixtures))
        if process.returncode and summary["status"] == "passed":
            raise ValueError("Browser process did not complete cleanly")
        return summary
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()


async def measure_local(database, runtime, samples, result, *, scenario="success", browser=False,
                        frontend_url="http://127.0.0.1:5173"):
    import httpx
    import uvicorn
    from fastapi import FastAPI
    from sqlalchemy import event, func, inspect, select
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from sqlalchemy.orm import Session
    from app.api import ai_consult as api
    from app.models.new.sa_ai_consult import (
        SAAiConsultGeneration, SAAiConsultRuleVersion, SAAiConsultSession,
        SAAiConsultSettings, SAAiConsultTurn,
    )
    from app.services.ai_consult_pipeline import prepare_answer_candidate
    from app.services.ai_consult_provider import provider_matches_configuration
    try:
        from .local_ai_policy import validate_browser_policy
    except ImportError:
        from local_ai_policy import validate_browser_policy

    result["stage"] = "local_policy"
    regular = database.get_ai_consult_sessionmaker()
    fixtures = synthetic_fixtures(samples)
    async with regular() as db:
        config = await db.get(SAAiConsultSettings, 1)
        rule = await db.get(SAAiConsultRuleVersion, config.active_rule_version_id) if config else None
        validate_browser_policy(config, rule, runtime.AI_CONSULT_PROVIDER_MODEL.strip())
        if not provider_matches_configuration(api.answer_provider, config.provider_code, config.model_code):
            raise ValueError("Local model configuration mismatch")
        baseline = {key: getattr(config, key) for key in PROTECTED}
        active = await db.scalar(select(func.count(SAAiConsultGeneration.id)).where(
            SAAiConsultGeneration.status == "running"))
        if active:
            raise ValueError("Local consultations are already running")

    class TrialSession(Session):
        pass

    @event.listens_for(TrialSession, "loaded_as_persistent")
    def overlay(_session, row):
        if isinstance(row, SAAiConsultSettings):
            if any(getattr(row, key) != baseline[key] for key in PROTECTED):
                raise ValueError("Local policy changed during trial")
            overlay_trial_limits(row)

    @event.listens_for(TrialSession, "before_flush")
    def preserve_policy(session, *_args):
        for row in session.new.union(session.dirty):
            if isinstance(row, SAAiConsultSettings) and any(
                inspect(row).attrs[key].history.has_changes() for key in PROTECTED
            ):
                raise ValueError("Trial must not persist a policy change")

    writer = async_sessionmaker(bind=regular.kw["bind"], expire_on_commit=False, sync_session_class=TrialSession)

    class NoReportDatabase:
        async def __aenter__(self): return self
        async def __aexit__(self, *_args): return False
        async def execute(self, *_args, **_kwargs):
            raise ValueError("No real report query is allowed")

    provider = (TimeoutProvider if scenario == "provider_timeout" else CappedProvider)(api.answer_provider, samples)
    if scenario == "timeout" and api.CANDIDATE_PREPARATION_TIMEOUT_SECONDS != 60.0:
        raise ValueError("The ordinary sixty second deadline must remain unchanged")

    async def verify(_db, code, customer):
        verify_fixture(fixtures, code, customer)

    async def home(_db, code, customer):
        return synthetic_home(verify_fixture(fixtures, code, customer))

    source_cancelled = 0

    async def reader(_db, scope, tool, *, indicator_code=None):
        nonlocal source_cancelled
        data = synthetic_home(verify_fixture(fixtures, scope.report_code, scope.customer_id))
        if scenario == "timeout":
            # Stall evidence preparation, not the model's separate 20s boundary.
            try:
                await asyncio.Future()
            except asyncio.CancelledError:
                source_cancelled += 1
                raise
        if tool == "home":
            return {**data["report"], "systems": copy.deepcopy(data["systems"])}
        if tool == "indicator" and indicator_code == INDICATOR:
            return {"report_code": scope.report_code, "system": {"system_code": "SYS_LUNG"},
                    "indicator": {**data["systems"][0]["indicators"][0],
                                  "description": "完全虚构的软件验收资料，没有对应真实个人或健康检测。"}}
        raise ValueError("Only synthetic report facts may be read")

    async def candidate(db, scope, question, **kwargs):
        return await prepare_answer_candidate(db, scope, question, reader=reader, **kwargs)

    for flag in FLAGS:
        setattr(runtime, flag, True)
    api.get_ai_consult_sessionmaker = lambda: writer
    api.async_session = NoReportDatabase
    api.verify_public_report, api.load_public_report_home = verify, home
    api.prepare_answer_candidate, api.answer_provider = candidate, provider
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    sock.listen(128)
    server = uvicorn.Server(uvicorn.Config(app, log_config=None, log_level="critical", access_log=False,
                                         timeout_graceful_shutdown=5))
    task = asyncio.create_task(server.serve(sockets=[sock]))
    # MySQL DATETIME columns store whole seconds in this schema.
    started = datetime.now(UTC).replace(tzinfo=None, microsecond=0)
    try:
        async with asyncio.timeout(5):
            while not server.started:
                if task.done():
                    raise ValueError("Synthetic local HTTP startup failed")
                await asyncio.sleep(0.01)
        result["stage"] = "http_load"
        backend_url = f"http://127.0.0.1:{sock.getsockname()[1]}"
        if browser:
            result["stage"] = "browser_load"
            result.update(await run_browser_trial(backend_url, frontend_url, fixtures))
        else:
            async with httpx.AsyncClient(base_url=backend_url, trust_env=False,
                                         follow_redirects=False, timeout=httpx.Timeout(65, connect=5),
                                         limits=httpx.Limits(max_connections=20)) as client:
                result.update(await run(client, fixtures))
    finally:
        result["model_calls"] = provider.model_calls
        result["provider_invocations"] = provider.calls
        result["provider_cancelled_count"] = provider.cancelled
        result["source_cancelled_count"] = source_cancelled
        result["server_provider_in_flight_peak"] = provider.peak
        server.should_exit = True
        try:
            await asyncio.wait_for(task, 10)
        finally:
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            sock.close()

    result["model_calls"] = provider.model_calls
    result["server_provider_in_flight_peak"] = provider.peak
    result["server_provider_concurrency_measured"] = True
    result["stage"] = "persistence"
    async with regular() as db:
        config = await db.get(SAAiConsultSettings, 1)
        result["persisted_policy_unchanged"] = all(getattr(config, key) == baseline[key] for key in PROTECTED)
        scope = (SAAiConsultSession.report_code.in_([item.report_code for item in fixtures]),
                 SAAiConsultSession.created_at >= started)
        questions = select(SAAiConsultTurn).join(SAAiConsultSession).where(*scope).subquery()
        attempts = (select(SAAiConsultGeneration)
                    .join(SAAiConsultTurn, SAAiConsultGeneration.turn_id == SAAiConsultTurn.id)
                    .join(SAAiConsultSession, SAAiConsultTurn.session_id == SAAiConsultSession.id)
                    .where(*scope).subquery())
        result["saved_question_count"] = await db.scalar(select(func.count()).select_from(questions))
        result["saved_attempt_count"] = await db.scalar(select(func.count()).select_from(attempts))
        result["completed_attempt_count"] = await db.scalar(select(func.count()).select_from(attempts).where(
            attempts.c.status == "completed"))
        result["timeout_attempt_count"] = await db.scalar(select(func.count()).select_from(attempts).where(
            attempts.c.status == "failed", attempts.c.error_category == "timeout"))
        result["unavailable_attempt_count"] = await db.scalar(select(func.count()).select_from(attempts).where(
            attempts.c.status == "failed", attempts.c.error_category == "provider_unavailable"))
        result["running_attempt_count"] = await db.scalar(select(func.count()).select_from(attempts).where(
            attempts.c.status == "running"))
        result["saved_answer_count"] = await db.scalar(select(func.count()).select_from(questions).where(
            questions.c.answer_text.is_not(None), questions.c.answer_text != ""))
        result["prompt_tokens"] = int(await db.scalar(select(func.coalesce(func.sum(attempts.c.prompt_tokens), 0))))
        result["completion_tokens"] = int(await db.scalar(select(func.coalesce(func.sum(attempts.c.completion_tokens), 0))))
        result["unknown_usage_reserved_tokens"] = int(await db.scalar(select(
            func.coalesce(func.sum(attempts.c.budget_tokens), 0)).where(
                attempts.c.prompt_tokens.is_(None), attempts.c.completion_tokens.is_(None))))
    if scenario != "success":
        result["timeout_guard_passed"] = fault_passed(result, provider, source_cancelled, scenario)
        if result["timeout_guard_passed"]:
            result["status"] = "passed"
    if not result["persisted_policy_unchanged"] or (result["status"] == "passed" and (
        result["saved_question_count"] != samples or result["saved_attempt_count"] != samples
        or provider.calls != (0 if scenario == "timeout" else samples)
        or (scenario == "success" and not success_storage_passed(result, samples, provider.calls))
    )):
        raise ValueError("Synthetic storage validation failed")
    result["stage"] = "complete"


def main():
    parser = argparse.ArgumentParser(description="本机 MySQL/模型 HTTP 联验，仅使用内存合成报告，最多 20 次模型调用")
    parser.add_argument("--samples", type=int, default=20)
    parser.add_argument("--scenario", choices=("success", "timeout", "provider_timeout"), default="success")
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--real-model", action="store_true")
    parser.add_argument("--browser", action="store_true")
    parser.add_argument("--frontend-url", default="http://127.0.0.1:5173")
    args = parser.parse_args()
    result = {"status": "not_run", "stage": "input", "real_report_sent": False,
              "remote_database_used": False, "deployment_proxy_measured": False,
              "model_calls": 0, "release_accepted": False, "scenario": args.scenario,
              "provider_fault_injected": args.scenario == "provider_timeout",
              "source_fault_injected": args.scenario == "timeout"}
    database = None
    try:
        validate_scenario(args.samples, args.scenario)
        validate_browser_options(args.browser, args.scenario, args.frontend_url)
        if args.run and (args.real_model or args.scenario != "success"):
            result["stage"] = "offline_configuration"
            os.chdir(BACKEND)
            sys.path.insert(0, str(BACKEND))
            config = load_configuration(".env")
            if (not evaluate(config, prepare_pilot=True)["offline_checks_passed"]
                    or urlsplit(config["AI_CONSULT_PROVIDER_BASE_URL"]).hostname != "api.deepseek.com"):
                raise ValueError("Existing local provider configuration required")
            raw_url = os.environ.get("AI_CONSULT_LOCAL_RUNTIME_URL", DEFAULT_LOCAL_URL)
            local_write_url(raw_url)
            # Pin all unused report-source settings before importing the app.
            from app.config import settings
            settings.DATABASE_URL = "mysql+aiomysql://disabled:disabled@127.0.0.1:1/nepstar"
            settings.CONFIG_DATABASE_URL = ""
            settings.MONGODB_URL = ""
            database, runtime = configure_database(raw_url)
            logging.disable(logging.CRITICAL)

            async def execute():
                try:
                    async with asyncio.timeout(100):
                        await measure_local(database, runtime, args.samples, result, scenario=args.scenario,
                                            browser=args.browser, frontend_url=args.frontend_url)
                finally:
                    await database.get_ai_consult_sessionmaker().kw["bind"].dispose()

            asyncio.run(execute())
    except Exception as exc:
        result.update({"status": "failed", "error_category": type(exc).__name__})
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] in {"not_run", "passed"} else 2


if __name__ == "__main__":
    raise SystemExit(main())
