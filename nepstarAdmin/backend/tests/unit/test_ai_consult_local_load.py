"""Local load harness guards, with no database or model calls."""

import asyncio
import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts.ai_consult_local_load import (
    CappedProvider, INDICATOR, TRIAL_LIMITS, TimeoutProvider, fault_passed, overlay_trial_limits,
    browser_summary, success_storage_passed, synthetic_fixtures, synthetic_home, validate_browser_options,
    validate_scenario, verify_fixture,
)


@pytest.mark.parametrize("samples", [0, 21, -1, True, 1.5, "20"])
def test_sample_cap_is_strict(samples):
    with pytest.raises(ValueError):
        synthetic_fixtures(samples)


def test_twenty_fixtures_are_distinct_and_synthetic():
    fixtures = synthetic_fixtures(20)
    assert len({item.report_code for item in fixtures}) == 20
    assert len({item.customer_id for item in fixtures}) == 20
    for item in fixtures:
        assert item.report_code.startswith("AI-CONSULT-TEST-")
        assert verify_fixture(fixtures, item.report_code, item.customer_id) == item
        assert synthetic_home(item)["systems"][0]["indicators"][0]["indicator_code"] == INDICATOR
    assert len({synthetic_home(item)["report"]["total_score"] for item in fixtures}) == 20


def test_acceptance_question_reaches_model_without_changing_safety_rules():
    from app.services.ai_consult_safety import assess_input
    from scripts.ai_consult_live_acceptance import QUESTION
    assert assess_input(QUESTION).may_call_model is True


@pytest.mark.parametrize("code,customer", [("REAL-REPORT", 900001), ("AI-CONSULT-TEST-LOAD-01", 1)])
def test_real_or_cross_fixture_scope_is_rejected(code, customer):
    with pytest.raises(ValueError):
        verify_fixture(synthetic_fixtures(1), code, customer)


def test_trial_limits_are_committed_overlays_not_policy_writes():
    from sqlalchemy import inspect
    from app.models.new.sa_ai_consult import SAAiConsultSettings
    row = SAAiConsultSettings(enabled=True, guest_create_limit_per_minute=10,
                             global_daily_token_limit=100000, max_concurrent_generations=1)
    overlay_trial_limits(row)
    for key, value in TRIAL_LIMITS.items():
        assert getattr(row, key) == value
        assert not inspect(row).attrs[key].history.has_changes()
    assert row.enabled is True


def test_provider_cap_counts_failures_and_parallel_calls_without_retries():
    async def scenario():
        entered = asyncio.Event()
        release = asyncio.Event()
        async def draft(**_kwargs):
            entered.set()
            await release.wait()
            raise RuntimeError("Synthetic failure")
        delegate = SimpleNamespace(draft=draft, available=True, provider_code="test",
                                   model_code="test", token_budget=1, requires_usage=True)
        provider = CappedProvider(delegate, 1)
        task = asyncio.create_task(provider.draft(question="synthetic", evidence={}))
        await entered.wait()
        with pytest.raises(ValueError):
            await provider.draft(question="synthetic", evidence={})
        release.set()
        with pytest.raises(RuntimeError):
            await task
        assert provider.calls == provider.peak == 1
        assert provider.model_calls == 1
        assert provider.active == 0
    asyncio.run(scenario())


def test_timeout_provider_never_calls_external_delegate_and_can_be_cancelled():
    async def scenario():
        async def forbidden(**_kwargs):
            raise AssertionError("No external model call allowed")
        delegate = SimpleNamespace(draft=forbidden, available=True, provider_code="test",
                                   model_code="test", token_budget=1, requires_usage=True)
        provider = TimeoutProvider(delegate, 1)
        task = asyncio.create_task(provider.draft(question="synthetic", evidence={}))
        await asyncio.sleep(0)
        assert provider.active == provider.calls == 1
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert provider.model_calls == 0 and provider.cancelled == 1 and provider.active == 0
    asyncio.run(scenario())


def test_fault_scenario_is_bounded_to_one_request():
    validate_scenario(1, "timeout")
    validate_scenario(1, "provider_timeout")
    with pytest.raises(ValueError):
        validate_scenario(20, "timeout")
    with pytest.raises(ValueError):
        validate_scenario(1, "unknown")


@pytest.mark.parametrize("scenario,url", [("timeout", "http://127.0.0.1:5173"),
    ("success", "https://remote.example"), ("success", "http://127.0.0.1:5173/?key=secret"),
    ("success", "http://127.0.0.1:5173/path"), ("success", "http://u:p@127.0.0.1:5173")])
def test_browser_run_rejects_external_or_mixed_fault_targets(scenario, url):
    with pytest.raises(ValueError):
        validate_browser_options(True, scenario, url)


def test_browser_results_cannot_leak_extra_fields_or_claim_physical_acceptance():
    value = {"status": "passed", "samples": 1, "question_requests": 1, "browser_completed_count": 1,
             "proxy_question_in_flight_peak": 1, "external_requests_blocked": 0, "proxy_requests_blocked": 0,
             "current_turn_reads": 0, "browser_version": "143.0.1.1", "release_accepted": False,
             "local_streaming_proxy_measured": True, "mobile_emulation_measured": True,
             "physical_device_measured": False, "deployment_proxy_measured": False,
             "browser_latency_ms": {key: {"p50_ms": 100, "p95_ms": 100, "p99_ms": 100}
                                    for key in ("feedback_ms", "accepted_ms", "answer_ms", "completed_ms")}}
    assert browser_summary(json.dumps(value), 1) == value
    for change in [{"report_code": "private"}, {"physical_device_measured": True},
                   {"question_requests": 0}, {"browser_version": "private-log"}, {"release_accepted": True}]:
        with pytest.raises(ValueError):
            browser_summary(json.dumps({**value, **change}), 1)
    failed = {"status": "failed", "samples": 1, "question_requests": 0,
              "error_category": "browser_setup", "release_accepted": False}
    assert browser_summary(json.dumps(failed), 1) == failed
    with pytest.raises(ValueError):
        browser_summary(json.dumps({**failed, "browser_version": "secret"}), 1)


def test_success_requires_all_answers_saved_and_no_running_or_failed_attempts():
    result = {key: 20 for key in ("saved_question_count", "saved_attempt_count",
                                 "completed_attempt_count", "saved_answer_count")}
    result.update({key: 0 for key in ("running_attempt_count", "timeout_attempt_count",
                                    "unavailable_attempt_count")})
    assert success_storage_passed(result, 20, 20)
    assert not success_storage_passed(result, 20, 19)
    for key in result:
        assert not success_storage_passed({**result, key: result[key] + 1}, 20, 20)


@pytest.mark.parametrize("scenario", ["timeout", "provider_timeout"])
def test_fault_acceptance_requires_correct_terminal_storage_and_timing(scenario):
    code = "consult.timeout" if scenario == "timeout" else "consult.provider_unavailable"
    count_key = "timeout_attempt_count" if scenario == "timeout" else "unavailable_attempt_count"
    elapsed = 60000 if scenario == "timeout" else 20000
    result = {"outcomes": {code: 1}, "error_latency_ms": {code: {"p95_ms": elapsed + 30}},
              "saved_question_count": 1, "saved_attempt_count": 1, count_key: 1,
              "completed_attempt_count": 0, "running_attempt_count": 0, "saved_answer_count": 0,
              "unknown_usage_reserved_tokens": 16384}
    provider = SimpleNamespace(model_calls=0, calls=0 if scenario == "timeout" else 1,
                               cancelled=0 if scenario == "timeout" else 1, token_budget=16384)
    assert fault_passed(result, provider, 1, scenario)
    for field, value in [("saved_answer_count", 1), ("running_attempt_count", 1),
                         ("unknown_usage_reserved_tokens", 0), (count_key, 0)]:
        altered = {**result, field: value}
        assert not fault_passed(altered, provider, 1, scenario)
    result["error_latency_ms"][code]["p95_ms"] = elapsed - 1
    assert not fault_passed(result, provider, 1, scenario)


@pytest.mark.parametrize("flags", [[], ["--run"], ["--real-model"]])
def test_default_or_partial_opt_in_never_loads_application_configuration(flags):
    backend = Path(__file__).resolve().parents[2]
    completed = subprocess.run([sys.executable, "scripts/ai_consult_local_load.py", *flags],
                               cwd=backend, capture_output=True, text=True, timeout=10, check=True)
    result = json.loads(completed.stdout)
    assert result["status"] == "not_run"
    assert result["stage"] == "input"
    assert result["model_calls"] == 0
    assert result["remote_database_used"] is False
    assert result["real_report_sent"] is False
