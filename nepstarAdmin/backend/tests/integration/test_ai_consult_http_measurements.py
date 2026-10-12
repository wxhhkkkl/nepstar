"""Actual loopback HTTP streams; synthetic server, no app/DB/model requests."""

import asyncio
import json
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from scripts.ai_consult_live_acceptance import Fixture, measure


@pytest.mark.asyncio
async def test_twenty_real_http_streams_measure_chunks_before_completion():
    active = peak = entered = 0
    ready = asyncio.Event()
    failures = []
    tasks = set()

    async def handle(reader, writer):
        nonlocal active, peak, entered
        tasks.add(asyncio.current_task())
        try:
            header = (await reader.readuntil(b"\r\n\r\n")).decode("ascii")
            length = next(int(line.split(":", 1)[1]) for line in header.split("\r\n")
                          if line.lower().startswith("content-length:"))
            question = json.loads(await reader.readexactly(length))
            assert "虚构" in question["question"]
            method, target, _version = header.split("\r\n", 1)[0].split(" ")
            url = urlsplit(target)
            code = parse_qs(url.query)["report_code"][0]
            index = int(code.rsplit("-", 1)[1])
            assert method == "POST" and 1 <= index <= 20
            assert url.path == f"/api/v1/ai-consult/sessions/session-{index}/turns"
            base = {"session_id": f"session-{index}", "turn_id": index,
                    "generation_id": index + 20}

            def event(name, seq, **fields):
                return f"event: {name}\ndata: {json.dumps({**base, 'seq': seq, **fields}, ensure_ascii=False)}\n\n".encode()

            active += 1
            entered += 1
            peak = max(peak, active)
            if entered == 20:
                ready.set()
            await asyncio.wait_for(ready.wait(), 2)
            writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n")
            writer.write(event("accepted", 1))
            await writer.drain()
            await asyncio.sleep(0.01)
            writer.write(event("delta", 2, text="演示资料"))
            await writer.drain()
            await asyncio.sleep(0.1)
            writer.write(event("evidence", 3, items=[{
                "kind": "report", "route": f"#/system/SYS_LUNG?reportId={code}&customerId={900000 + index}",
            }]))
            writer.write(event("completed", 4, answer="演示资料"))
            await writer.drain()
            active -= 1
        except Exception as exc:
            failures.append(type(exc).__name__)
        finally:
            writer.close()
            await writer.wait_closed()
            tasks.discard(asyncio.current_task())

    server = await asyncio.start_server(handle, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    try:
        async with server, httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}", trust_env=False) as client:
            tracker = {"active": 0, "peak": 0}
            records = await asyncio.gather(*(measure(
                client, (Fixture(f"AI-CONSULT-TEST-{i}", 900000 + i), {}, f"session-{i}"), tracker, 3,
            ) for i in range(1, 21)))
        assert failures == []
        assert tracker["peak"] == peak == 20
        assert all(item["outcome"] == "completed" for item in records)
        assert all(item["timings"]["delta"] + 50 < item["timings"]["completed"] for item in records)
    finally:
        server.close()
        await server.wait_closed()
        for task in list(tasks):
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
