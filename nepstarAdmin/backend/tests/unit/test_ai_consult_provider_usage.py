"""Provider usage must be measured before any answer can be published."""

import json

import pytest

from app.services import ai_consult_provider as provider_module
from app.services.ai_consult_provider import OpenAICompatibleDraftProvider, ProviderUnavailable


class FakeStream:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def aiter_bytes(self):
        yield json.dumps(self.payload).encode("utf-8")


class FakeClient:
    def __init__(self, payload, requests, *, status_code=200):
        self.payload = payload
        self.requests = requests
        self.status_code = status_code

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    def stream(self, method, url, **kwargs):
        self.requests.append((method, url, kwargs["json"], kwargs.get("headers", {})))
        return FakeStream(self.payload, self.status_code)


def adapter():
    return OpenAICompatibleDraftProvider(
        base_url="https://example.com/v1", api_key="test-key",
        model_code="fake-model", allowed_hosts={"example.com"},
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("base_url", ["https://api.deepseek.com", "https://api.deepseek.com/"])
async def test_deepseek_root_address_and_non_thinking_json_request(monkeypatch, base_url):
    requests = []
    payload = {
        "choices": [{"message": {"content": json.dumps({
            "summary": "报告结果表现稳定。", "evidence_ids": ["ev1"],
            "follow_up_questions": [],
        })}}],
        "usage": {"prompt_tokens": 20, "completion_tokens": 10},
    }
    monkeypatch.setattr(provider_module.httpx, "AsyncClient",
                        lambda **_kwargs: FakeClient(payload, requests))
    provider = OpenAICompatibleDraftProvider(
        base_url=base_url, api_key="test-key", model_code="deepseek-flash",
        allowed_hosts={"api.deepseek.com"},
    )
    await provider.draft(question="这项结果如何？", evidence={"facts": []})
    assert requests[0][1] == "https://api.deepseek.com/chat/completions"
    assert requests[0][2]["thinking"] == {"type": "disabled"}
    assert requests[0][2]["response_format"] == {"type": "json_object"}
    assert requests[0][2]["stream"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("question", ["这项结果如何？", "问" * 600])
async def test_provider_returns_actual_usage_and_limits_output(monkeypatch, question):
    requests = []
    payload = {
        "choices": [{"message": {"content": json.dumps({
            "summary": "报告结果表现稳定。", "evidence_ids": ["ev1"],
            "follow_up_questions": [],
        })}}],
        "usage": {"prompt_tokens": 315, "completion_tokens": 42},
    }
    monkeypatch.setattr(
        provider_module.httpx, "AsyncClient",
        lambda **_kwargs: FakeClient(payload, requests),
    )
    result = await adapter().draft(question=question, evidence={"facts": []})
    assert result["_usage"] == {"prompt_tokens": 315, "completion_tokens": 42}
    assert requests[0][0:2] == ("POST", "https://example.com/v1/chat/completions")
    assert requests[0][2]["max_tokens"] == 1024
    assert "thinking" not in requests[0][2]
    assert json.loads(requests[0][2]["messages"][1]["content"])["question"] == question


@pytest.mark.asyncio
async def test_provider_preserves_source_label_for_prior_user_supplement(monkeypatch):
    requests = []
    payload = {
        "choices": [{"message": {"content": json.dumps({
            "summary": "可以结合你提到的情况理解。", "evidence_ids": ["ev1"],
            "follow_up_questions": [],
        })}}],
        "usage": {"prompt_tokens": 20, "completion_tokens": 10},
    }
    monkeypatch.setattr(
        provider_module.httpx, "AsyncClient",
        lambda **_kwargs: FakeClient(payload, requests),
    )

    await adapter().draft(
        question="我可以怎么调整？",
        evidence={"facts": [], "user_context": [{
            "source_type": "user_supplement", "text": "我最近每天睡得比较晚",
        }], "previous_follow_up_questions": ["你每晚是否容易醒来？"]},
    )

    user_payload = json.loads(requests[0][2]["messages"][1]["content"])
    assert user_payload["evidence"]["user_context"] == [{
        "source_type": "user_supplement", "text": "我最近每天睡得比较晚",
    }]
    assert "previous_follow_up_questions" not in user_payload["evidence"]
    assert "不得把它说成报告结果" in requests[0][2]["messages"][0]["content"]


@pytest.mark.asyncio
async def test_provider_rejects_private_prior_user_context_before_network_call(monkeypatch):
    requests = []
    monkeypatch.setattr(
        provider_module.httpx, "AsyncClient",
        lambda **_kwargs: FakeClient({}, requests),
    )
    with pytest.raises(ProviderUnavailable):
        await adapter().draft(
            question="这个情况如何？",
            evidence={"facts": [], "user_context": [{
                "source_type": "user_supplement", "text": "联系电话13800001111",
            }]},
        )
    assert requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize("usage", [None, {"prompt_tokens": -1, "completion_tokens": 1},
                                          {"prompt_tokens": 16384, "completion_tokens": 1}])
async def test_missing_or_over_budget_usage_is_not_a_publishable_draft(monkeypatch, usage):
    payload = {
        "choices": [{"message": {"content": json.dumps({
            "summary": "报告结果表现稳定。", "evidence_ids": ["ev1"],
            "follow_up_questions": [],
        })}}],
    }
    if usage is not None:
        payload["usage"] = usage
    monkeypatch.setattr(
        provider_module.httpx, "AsyncClient",
        lambda **_kwargs: FakeClient(payload, []),
    )
    with pytest.raises(ProviderUnavailable):
        await adapter().draft(question="这项结果如何？", evidence={"facts": []})


@pytest.mark.asyncio
async def test_outbound_request_omits_report_identity_and_disables_redirects_and_proxies(monkeypatch):
    requests = []
    client_options = []
    payload = {
        "choices": [{"message": {"content": json.dumps({
            "summary": "报告结果表现稳定。", "evidence_ids": ["ev1"],
            "follow_up_questions": [],
        })}}],
        "usage": {"prompt_tokens": 20, "completion_tokens": 10},
    }

    def fake_client(**kwargs):
        client_options.append(kwargs)
        return FakeClient(payload, requests)

    monkeypatch.setattr(provider_module.httpx, "AsyncClient", fake_client)
    provider = OpenAICompatibleDraftProvider(
        base_url="https://example.com/v1", api_key="api-key-sentinel",
        model_code="fake-model", allowed_hosts={"example.com"},
    )
    await provider.draft(
        question="这项结果如何？",
        evidence={"facts": [{
            "id": "ev1", "kind": "indicator", "score": 82,
            "report_code": "report-identity-sentinel",
            "customer_id": "customer-identity-sentinel",
            "route": "/private/report/path-sentinel",
        }]},
    )

    method, url, body, headers = requests[0]
    serialized_body = json.dumps(body, ensure_ascii=False)
    assert method == "POST"
    assert url == "https://example.com/v1/chat/completions"
    assert headers == {"Authorization": "Bearer api-key-sentinel"}
    assert "api-key-sentinel" not in url + serialized_body
    assert all(value not in serialized_body for value in (
        "report-identity-sentinel", "customer-identity-sentinel", "path-sentinel",
    ))
    assert body["messages"][1]["content"].find('"score":82') >= 0
    assert client_options[0]["follow_redirects"] is False
    assert client_options[0]["trust_env"] is False


@pytest.mark.asyncio
async def test_upstream_error_body_is_not_reflected_to_caller(monkeypatch):
    requests = []
    monkeypatch.setattr(
        provider_module.httpx, "AsyncClient",
        lambda **_kwargs: FakeClient(
            {"private": "question-and-key-sentinel"}, requests, status_code=502,
        ),
    )

    with pytest.raises(ProviderUnavailable) as error:
        await adapter().draft(
            question="question-and-key-sentinel", evidence={"facts": []},
        )

    assert str(error.value) == "AI consult provider request failed"
    assert "question-and-key-sentinel" not in str(error.value)


def test_provider_builder_fails_closed_for_disabled_or_invalid_configuration():
    from types import SimpleNamespace

    disabled = provider_module.build_default_provider(SimpleNamespace(
        AI_CONSULT_PROVIDER="disabled",
    ))
    invalid = provider_module.build_default_provider(SimpleNamespace(
        AI_CONSULT_PROVIDER="openai_compatible",
        AI_CONSULT_PROVIDER_ALLOWED_HOSTS="allowed.example",
        AI_CONSULT_PROVIDER_BASE_URL="https://other.example/v1",
        AI_CONSULT_PROVIDER_API_KEY="fake-key",
        AI_CONSULT_PROVIDER_MODEL="fake-model",
        AI_CONSULT_PROVIDER_TIMEOUT_SECONDS=20,
    ))

    assert isinstance(disabled, provider_module.DisabledDraftProvider)
    assert isinstance(invalid, provider_module.DisabledDraftProvider)
    assert disabled.available is invalid.available is False
