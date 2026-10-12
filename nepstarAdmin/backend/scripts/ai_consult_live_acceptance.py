"""Opt-in HTTP/SSE measurements using explicitly supplied synthetic reports.

No application imports, .env loading, configuration changes or direct DB access.
One new consultation per fixture, no retry, maximum 20 simultaneous questions.
Only aggregate timings/error categories leave this process. Server-side synthetic
consultation records are retained under the ordinary nepstar storage policy.
"""

from __future__ import annotations

import argparse
import asyncio
import codecs
import hashlib
import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from urllib.parse import parse_qs, quote, urlsplit
from uuid import uuid4

import httpx


CONFIRMATION = "SYNTHETIC_STAGING_ONLY"
QUESTION = "这是一份虚构的验收报告，呼吸睡眠这项指标的展示含义是什么？请只解释演示资料，不给健康建议，不必追问。"
INDICATOR = "SYS_LUNG_SLEEP_BREATHING"
API = "/api/v1/ai-consult"
MAX_EVENT_CHARS = 131072
MAX_RESPONSE_BYTES = 262144


class AcceptanceError(ValueError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Fixture:
    report_code: str
    customer_id: int


def validate_target(raw: str, staging_host: str | None = None) -> str:
    try:
        url = urlsplit(raw)
        port = url.port
    except ValueError:
        raise AcceptanceError("client.invalid_target") from None
    if (url.scheme not in {"http", "https"} or not url.hostname or url.username
            or url.password or url.query or url.fragment or url.path not in {"", "/"}):
        raise AcceptanceError("client.invalid_target")
    loopback = url.hostname in {"127.0.0.1", "::1", "localhost"}
    if loopback:
        if port is None:
            raise AcceptanceError("client.explicit_loopback_port_required")
    elif url.scheme != "https" or staging_host != url.hostname:
        raise AcceptanceError("client.exact_https_staging_host_required")
    return raw.rstrip("/")


def load_fixtures(path: Path) -> list[Fixture]:
    if path.stat().st_size > 32768:
        raise AcceptanceError("client.invalid_fixtures")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not 1 <= len(data) <= 20:
        raise AcceptanceError("client.invalid_fixtures")
    fixtures = []
    for item in data:
        if (not isinstance(item, dict) or set(item) != {"report_code", "customer_id"}
                or not isinstance(item["report_code"], str)
                or re.fullmatch(r"AI-CONSULT-TEST-[A-Z0-9-]{1,48}", item["report_code"]) is None
                or type(item["customer_id"]) is not int or item["customer_id"] <= 0):
            raise AcceptanceError("client.synthetic_fixtures_required")
        fixtures.append(Fixture(**item))
    if len({item.report_code for item in fixtures}) != len(fixtures):
        raise AcceptanceError("client.distinct_reports_required")
    return fixtures


def public_error(value) -> str:
    return value if isinstance(value, str) and re.fullmatch(r"consult\.[a-z_]{1,64}", value) else "client.http_rejected"


async def bounded_json(response: httpx.Response) -> dict:
    content = bytearray()
    async for chunk in response.aiter_bytes():
        content.extend(chunk)
        if len(content) > MAX_RESPONSE_BYTES:
            raise AcceptanceError("client.response_too_large")
    try:
        body = json.loads(content)
    except (ValueError, UnicodeError):
        raise AcceptanceError("client.invalid_json") from None
    if not isinstance(body, dict):
        raise AcceptanceError("client.invalid_json")
    if response.status_code != 200 or body.get("code") != 200:
        raise AcceptanceError(public_error(body.get("message")))
    if not isinstance(body.get("data"), dict):
        raise AcceptanceError("client.invalid_json")
    return body["data"]


async def json_request(client, method, path, **kwargs):
    async with client.stream(method, path, **kwargs) as response:
        return await bounded_json(response)


async def prepare(client, fixture):
    guest = await json_request(client, "POST", f"{API}/guest-contexts", json={
        "report_code": fixture.report_code, "customer_id": fixture.customer_id,
    })
    token = guest.get("guest_token")
    if not isinstance(token, str) or not 40 <= len(token) <= 256:
        raise AcceptanceError("client.invalid_guest_response")
    headers = {"Authorization": f"Bearer {token}"}
    params = {"report_code": fixture.report_code}
    bootstrap = await json_request(client, "GET", f"{API}/bootstrap", headers=headers, params=params)
    if bootstrap.get("service_status") != "available":
        raise AcceptanceError("client.service_unavailable")
    # Current report UI has no required consent step. An acceptance tool must
    # never fabricate a visitor's decision or record consent on their behalf.
    session = await json_request(client, "POST", f"{API}/sessions", headers=headers, json={
        **params, "source": "indicator", "indicator_code": INDICATOR,
    })
    session_id = session.get("id")
    if not isinstance(session_id, str) or not 1 <= len(session_id) <= 128:
        raise AcceptanceError("client.invalid_session_response")
    return fixture, headers, session_id


async def sse_events(response):
    """Decode fragmented UTF-8 and all SSE line endings with bounded raw input."""
    decoder = codecs.getincrementaldecoder("utf-8")()
    total_bytes = event_size = 0
    line, data, event = [], [], "message"
    previous_cr = False
    async for chunk in response.aiter_bytes():
        total_bytes += len(chunk)
        if total_bytes > MAX_RESPONSE_BYTES:
            raise AcceptanceError("client.response_too_large")
        try:
            decoded = decoder.decode(chunk)
        except UnicodeError:
            raise AcceptanceError("client.invalid_utf8") from None
        for char in decoded:
            if char == "\n" and previous_cr:
                previous_cr = False
                continue
            previous_cr = char == "\r"
            event_size += 1
            if event_size > MAX_EVENT_CHARS:
                raise AcceptanceError("client.response_too_large")
            if char not in {"\r", "\n"}:
                line.append(char)
                continue
            text = "".join(line)
            line = []
            if not text:
                if data:
                    try:
                        payload = json.loads("\n".join(data))
                    except ValueError:
                        raise AcceptanceError("client.invalid_sse_json") from None
                    yield event, payload
                event, data, event_size = "message", [], 0
            elif text.startswith("event:"):
                event = text[6:].removeprefix(" ")
            elif text.startswith("data:"):
                data.append(text[5:].removeprefix(" "))
    try:
        decoder.decode(b"", final=True)
    except UnicodeError:
        raise AcceptanceError("client.invalid_utf8") from None


class StreamAudit:
    """Validate this conversation without retaining its answer or evidence text."""
    def __init__(self, fixture, session_id):
        self.fixture, self.session_id = fixture, session_id
        self.seq = 0
        self.identity = None
        self.answer_digest = hashlib.sha256()
        self.saw_delta = self.saw_evidence = False
        self.terminal = None

    def accept(self, event, payload):
        if (self.terminal or not isinstance(payload, dict)
                or payload.get("session_id") != self.session_id
                or type(payload.get("seq")) is not int or payload["seq"] != self.seq + 1):
            raise AcceptanceError("client.invalid_stream_identity")
        identity = payload.get("turn_id"), payload.get("generation_id")
        if self.seq == 0:
            if event != "accepted" or any(type(value) is not int or value <= 0 for value in identity):
                raise AcceptanceError("client.invalid_stream_identity")
            self.identity = identity
        elif identity != self.identity:
            raise AcceptanceError("client.invalid_stream_identity")
        elif event == "accepted":
            raise AcceptanceError("client.duplicate_accepted")
        self.seq += 1
        if event == "delta":
            if not isinstance(payload.get("text"), str) or not payload["text"]:
                raise AcceptanceError("client.invalid_answer")
            self.answer_digest.update(payload["text"].encode("utf-8"))
            self.saw_delta = True
        elif event == "evidence":
            items = payload.get("items")
            if not isinstance(items, list) or not items:
                raise AcceptanceError("client.invalid_evidence")
            reports = [item for item in items if isinstance(item, dict) and item.get("kind") == "report"]
            if not reports:
                raise AcceptanceError("client.invalid_evidence")
            for item in reports:
                route = item.get("route")
                if not isinstance(route, str) or not route.startswith("#/"):
                    raise AcceptanceError("client.cross_report_evidence")
                params = parse_qs(route.partition("?")[2])
                if (params.get("reportId") != [self.fixture.report_code]
                        or params.get("customerId") != [str(self.fixture.customer_id)]):
                    raise AcceptanceError("client.cross_report_evidence")
            self.saw_evidence = True
        elif event == "completed":
            if (not self.saw_delta or not self.saw_evidence
                    or not isinstance(payload.get("answer"), str) or not payload["answer"]):
                raise AcceptanceError("client.invalid_completion")
            if hashlib.sha256(payload["answer"].encode("utf-8")).digest() != self.answer_digest.digest():
                raise AcceptanceError("client.completion_text_mismatch")
            self.terminal = "completed"
        elif event == "error":
            if self.saw_delta or self.saw_evidence:
                raise AcceptanceError("client.content_before_error")
            self.terminal = public_error(payload.get("code"))
        elif event not in {"accepted", "status"}:
            raise AcceptanceError("client.unknown_event")


async def measure(client, prepared, tracker, deadline_seconds):
    fixture, headers, session_id = prepared
    started = perf_counter()
    times = {}
    tracker["active"] += 1
    tracker["peak"] = max(tracker["peak"], tracker["active"])
    audit = StreamAudit(fixture, session_id)
    try:
        async with asyncio.timeout(deadline_seconds):
            async with client.stream("POST", f"{API}/sessions/{quote(session_id, safe='')}/turns",
                                     params={"report_code": fixture.report_code},
                                     headers={**headers, "Idempotency-Key": str(uuid4())},
                                     json={"question": QUESTION}) as response:
                if response.status_code != 200:
                    await bounded_json(response)
                    raise AcceptanceError("client.invalid_http_status")
                if not response.headers.get("content-type", "").lower().startswith("text/event-stream"):
                    raise AcceptanceError("client.expected_sse")
                async for event, payload in sse_events(response):
                    audit.accept(event, payload)
                    times.setdefault(event, round((perf_counter() - started) * 1000, 2))
                    if audit.terminal:
                        break
                if audit.terminal is None:
                    raise AcceptanceError("client.incomplete_stream")
                return {"outcome": audit.terminal, "timings": times}
    except TimeoutError:
        return {"outcome": "client.deadline_exceeded", "timings": times}
    except httpx.HTTPError:
        return {"outcome": "client.transport_error", "timings": times}
    except AcceptanceError as exc:
        return {"outcome": exc.code, "timings": times}
    finally:
        tracker["active"] -= 1


def percentiles(values):
    ordered = sorted(values)
    return {f"p{p}_ms": ordered[math.ceil(len(ordered) * p / 100) - 1] for p in (50, 95, 99)} if ordered else None


async def run(client, fixtures, deadline_seconds=65):
    async def bounded_prepare(fixture):
        async with asyncio.timeout(30):
            return await prepare(client, fixture)

    prepared = await asyncio.gather(*(bounded_prepare(fixture) for fixture in fixtures), return_exceptions=True)
    failures = [item for item in prepared if isinstance(item, BaseException)]
    if failures:
        return {"status": "blocked", "samples": len(fixtures), "question_requests": 0,
                "release_accepted": False,
                "setup_errors": dict(Counter(item.code if isinstance(item, AcceptanceError)
                                            else "client.setup_failed" for item in failures))}
    tracker = {"active": 0, "peak": 0}
    outcomes = await asyncio.gather(*(measure(client, item, tracker, deadline_seconds) for item in prepared))
    counts = dict(Counter(item["outcome"] for item in outcomes))
    completed = [item for item in outcomes if item["outcome"] == "completed"]
    latency = {event: percentiles([item["timings"][event] for item in completed
                                  if event in item["timings"]])
               for event in ("accepted", "delta", "completed")}
    return {
        "status": "passed" if len(completed) == len(fixtures) else "failed",
        "samples": len(fixtures), "question_requests": len(fixtures),
        "client_in_flight_peak": tracker["peak"], "outcomes": counts,
        "latency_ms": latency,
        "http_p95_targets_met": {event: bool(len(completed) == len(fixtures) and latency[event]
                                               and latency[event]["p95_ms"] <= limit)
                                 for event, limit in (("accepted", 1000), ("delta", 10000), ("completed", 45000))},
        "timeout_latency_ms": percentiles([item["timings"]["error"] for item in outcomes
                                           if item["outcome"] == "consult.timeout"]),
        "error_latency_ms": {code: percentiles([item["timings"]["error"] for item in outcomes
                                               if item["outcome"] == code and "error" in item["timings"]])
                             for code in counts if code != "completed"},
        "trial_target_sample_count_met": len(fixtures) == 20,
        "mobile_visible_latency_measured": False,
        "server_provider_concurrency_measured": False,
        "release_accepted": False,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="合成报告 HTTP/SSE 验收，默认仅验证输入；输出不含凭证或聊天内容")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--fixtures", required=True, type=Path)
    parser.add_argument("--staging-host")
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--confirm")
    args = parser.parse_args(argv)
    try:
        target = validate_target(args.base_url, args.staging_host)
        fixtures = load_fixtures(args.fixtures)
        if not args.run:
            result = {"status": "not_run", "samples": len(fixtures), "question_requests": 0}
        elif args.confirm != CONFIRMATION:
            raise AcceptanceError("client.explicit_synthetic_confirmation_required")
        else:
            async def execute():
                async with httpx.AsyncClient(base_url=target, timeout=httpx.Timeout(65, connect=5),
                                             trust_env=False, follow_redirects=False,
                                             limits=httpx.Limits(max_connections=20)) as client:
                    return await run(client, fixtures)
            result = asyncio.run(execute())
    except (OSError, ValueError, httpx.HTTPError) as exc:
        result = {"status": "blocked", "question_requests": 0,
                  "error": exc.code if isinstance(exc, AcceptanceError) else "client.input_or_transport_error"}
    result["release_accepted"] = False
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] in {"not_run", "passed"} else 2


if __name__ == "__main__":
    raise SystemExit(main())
