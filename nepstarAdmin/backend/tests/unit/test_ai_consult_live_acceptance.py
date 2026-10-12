"""HTTP streaming acceptance tool contracts; no DB, application or model I/O."""

import asyncio
import json
from collections import Counter

import httpx
import pytest

from scripts.ai_consult_live_acceptance import (
    AcceptanceError, Fixture, StreamAudit, load_fixtures, main,
    run, sse_events, validate_target,
)


def fixture(index=1):
    return Fixture(f"AI-CONSULT-TEST-{index}", 900000 + index)


def event(name, seq, case, session="session-1", **fields):
    payload = {"session_id": session, "turn_id": case.customer_id,
               "generation_id": case.customer_id + 1, "seq": seq, **fields}
    return f"event: {name}\r\ndata: {json.dumps(payload, ensure_ascii=False)}\r\n\r\n".encode()


def evidence(case):
    return [{"kind": "report", "route": f"#/system/SYS_LUNG?reportId={case.report_code}&customerId={case.customer_id}"}]


class Chunks(httpx.AsyncByteStream):
    def __init__(self, chunks):
        self.chunks = chunks

    async def __aiter__(self):
        for chunk in self.chunks:
            yield chunk


@pytest.mark.parametrize("target,host", [
    ("http://remote.example.invalid", None),
    ("https://staging.example.invalid", "different.example.invalid"),
    ("http://127.0.0.1", None),
    ("http://user:secret@127.0.0.1:8000", None),
    ("http://127.0.0.1:8000/api", None),
    ("http://127.0.0.1:8000/?token=secret", None),
])
def test_target_requires_exact_explicit_origin(target, host):
    with pytest.raises(AcceptanceError):
        validate_target(target, host)


def test_loopback_and_named_https_staging_targets_are_supported():
    assert validate_target("http://127.0.0.1:8000/") == "http://127.0.0.1:8000"
    assert validate_target("https://staging.example.invalid", "staging.example.invalid") == "https://staging.example.invalid"


@pytest.mark.parametrize("items", [
    [{"report_code": "REAL-REPORT", "customer_id": 1}],
    [{"report_code": "AI-CONSULT-TEST-1", "customer_id": True}],
    [{"report_code": "AI-CONSULT-TEST-1", "customer_id": 1, "guest_token": "secret"}],
    [{"report_code": "AI-CONSULT-TEST-1", "customer_id": 1}] * 2,
    [{"report_code": f"AI-CONSULT-TEST-{i}", "customer_id": i + 1} for i in range(21)],
])
def test_fixture_manifest_rejects_real_duplicate_or_unbounded_samples(tmp_path, items):
    path = tmp_path / "fixtures.json"
    path.write_text(json.dumps(items))
    with pytest.raises(AcceptanceError):
        load_fixtures(path)


@pytest.mark.parametrize("options", [[], ["--run"], ["--run", "--confirm", "wrong"]])
def test_cli_never_opens_network_without_explicit_confirmation(tmp_path, monkeypatch, capsys, options):
    case = fixture()
    path = tmp_path / "fixtures.json"
    path.write_text(json.dumps([case.__dict__]))
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: pytest.fail("Network must remain unused"))
    code = main(["--base-url", "http://127.0.0.1:8000", "--fixtures", str(path), *options])
    output = capsys.readouterr()
    result = json.loads(output.out)
    assert result["question_requests"] == 0
    assert case.report_code not in output.out
    assert output.err == ""
    assert code == (2 if options else 0)


@pytest.mark.asyncio
async def test_sse_utf8_multiline_json_and_split_crlf_are_decoded_incrementally():
    content = 'event: delta\r\ndata: {\r\ndata: "text": "演示资料"\r\ndata: }\r\n\r\n'.encode()
    response = httpx.Response(200, stream=Chunks([bytes([byte]) for byte in content]))
    assert [item async for item in sse_events(response)] == [("delta", {"text": "演示资料"})]


@pytest.mark.asyncio
async def test_unterminated_large_line_is_rejected_before_unbounded_buffering():
    response = httpx.Response(200, stream=Chunks([b"x" * 140000]))
    with pytest.raises(AcceptanceError, match="response_too_large"):
        _ = [item async for item in sse_events(response)]


@pytest.mark.parametrize("change", ["session", "turn", "generation", "sequence", "report", "customer"])
def test_stream_audit_rejects_cross_conversation_or_cross_report_content(change):
    case = fixture()
    audit = StreamAudit(case, "session-1")
    accepted = {"session_id": "session-1", "turn_id": 1, "generation_id": 2, "seq": 1}
    audit.accept("accepted", accepted)
    payload = {**accepted, "seq": 2, "items": evidence(case)}
    if change == "report":
        payload["items"] = evidence(fixture(2))
    elif change == "customer":
        payload["items"] = evidence(Fixture(case.report_code, 999))
    else:
        key = {"session": "session_id", "turn": "turn_id", "generation": "generation_id", "sequence": "seq"}[change]
        payload[key] = "different" if change == "session" else 999
    with pytest.raises(AcceptanceError):
        audit.accept("evidence", payload)


def test_completed_answer_must_match_the_received_text_chunks():
    case = fixture()
    audit = StreamAudit(case, "session-1")
    base = {"session_id": "session-1", "turn_id": 1, "generation_id": 2}
    audit.accept("accepted", {**base, "seq": 1})
    audit.accept("delta", {**base, "seq": 2, "text": "已收到的正文"})
    audit.accept("evidence", {**base, "seq": 3, "items": evidence(case)})
    with pytest.raises(AcceptanceError, match="completion_text_mismatch"):
        audit.accept("completed", {**base, "seq": 4, "answer": "另一段正文"})


class SyntheticServer:
    def __init__(self, count, mode="success"):
        self.count, self.mode = count, mode
        self.calls = Counter()
        self.guests = {}
        self.barrier = asyncio.Event()
        self.questions = 0

    async def __call__(self, request):
        path = request.url.path
        self.calls[path.rsplit("/", 1)[-1]] += 1
        if path.endswith("guest-contexts"):
            data = json.loads(await request.aread())
            case = Fixture(**data)
            token = f"synthetic-token-{case.customer_id}-" + "a" * 43
            self.guests[f"Bearer {token}"] = case
            data = {"guest_token": token}
        elif path.endswith("bootstrap"):
            if self.mode == "setup_rejection":
                return httpx.Response(503, json={"code": 503, "message": "secret-model-key"})
            data = {"service_status": "available"}
        elif path.endswith("consents"):
            data = {}
        elif path.endswith("sessions"):
            case = self.guests[request.headers["Authorization"]]
            data = {"id": f"session-{case.customer_id}"}
        elif path.endswith("turns"):
            self.questions += 1
            if self.questions == self.count:
                self.barrier.set()
            if self.mode == "rate_limit":
                return httpx.Response(429, json={"code": 429, "message": "consult.rate_limited"})
            case = self.guests[request.headers["Authorization"]]
            session = f"session-{case.customer_id}"
            owner = self

            class Answer(httpx.AsyncByteStream):
                async def __aiter__(self):
                    await owner.barrier.wait()
                    yield event("accepted", 1, case, session)
                    if owner.mode == "incomplete":
                        return
                    if owner.mode == "client_timeout":
                        await asyncio.Event().wait()
                    await asyncio.sleep(0.01)
                    if owner.mode == "server_timeout":
                        yield event("error", 2, case, session, code="consult.timeout")
                        return
                    yield event("delta", 2, case, session, text="虚构演示资料")
                    await asyncio.sleep(0.03)
                    ref_case = fixture(999) if owner.mode == "cross_report" else case
                    yield event("evidence", 3, case, session, items=evidence(ref_case))
                    yield event("completed", 4, case, session, answer="虚构演示资料")

            return httpx.Response(200, headers={"Content-Type": "text/event-stream"}, stream=Answer())
        else:
            pytest.fail("Unexpected request: no retries/history/deletion are allowed")
        return httpx.Response(200, json={"code": 200, "data": data})


@pytest.mark.asyncio
async def test_twenty_http_streams_measure_first_chunk_before_completion_without_exposing_data(monkeypatch):
    from scripts import ai_consult_live_acceptance as acceptance
    records = []
    original_measure = acceptance.measure

    async def capture_measure(*args):
        measured = await original_measure(*args)
        records.append(measured)
        return measured

    monkeypatch.setattr(acceptance, "measure", capture_measure)
    server = SyntheticServer(20)
    async with httpx.AsyncClient(transport=httpx.MockTransport(server), base_url="http://synthetic") as client:
        result = await run(client, [fixture(i) for i in range(1, 21)])
    assert result["status"] == "passed"
    assert result["outcomes"] == {"completed": 20}
    assert result["client_in_flight_peak"] == 20
    # Compare each stream's events, not different samples' P95 and P50.
    assert len(records) == 20
    assert all(item["timings"]["accepted"] <= item["timings"]["delta"]
               < item["timings"]["completed"] for item in records)
    assert result["release_accepted"] is False
    assert result["mobile_visible_latency_measured"] is False
    assert server.calls["turns"] == 20
    assert server.calls["consents"] == 0
    summary = json.dumps(result)
    for value in ("synthetic-token", "AI-CONSULT-TEST", "虚构演示资料", "session-", "900001"):
        assert value not in summary


@pytest.mark.asyncio
async def test_any_setup_rejection_prevents_all_question_requests_and_masks_upstream_error():
    server = SyntheticServer(2, "setup_rejection")
    async with httpx.AsyncClient(transport=httpx.MockTransport(server), base_url="http://synthetic") as client:
        result = await run(client, [fixture(1), fixture(2)])
    assert result["status"] == "blocked"
    assert result["question_requests"] == server.questions == 0
    assert result["setup_errors"] == {"client.http_rejected": 2}
    assert "secret-model-key" not in json.dumps(result)


@pytest.mark.parametrize("mode,outcome", [
    ("rate_limit", "consult.rate_limited"),
    ("incomplete", "client.incomplete_stream"),
    ("client_timeout", "client.deadline_exceeded"),
    ("server_timeout", "consult.timeout"),
    ("cross_report", "client.cross_report_evidence"),
])
@pytest.mark.asyncio
async def test_rejections_timeouts_and_cross_report_content_are_reported_without_retry(mode, outcome):
    server = SyntheticServer(1, mode)
    async with httpx.AsyncClient(transport=httpx.MockTransport(server), base_url="http://synthetic") as client:
        result = await run(client, [fixture()], deadline_seconds=0.1)
    assert result["status"] == "failed"
    assert result["outcomes"] == {outcome: 1}
    assert server.questions == 1
    if mode == "server_timeout":
        assert result["timeout_latency_ms"]["p95_ms"] > 0
