"""Shared fixtures are synthetic, report-scoped and isolated from real services."""

import pytest

from tests.ai_consult_fixtures import FakeDraftProvider, FakePublicReportSource, make_guest_pair


@pytest.mark.asyncio
async def test_shared_report_source_is_read_only_and_returns_isolated_copies():
    source = FakePublicReportSource()
    report = await source.load_home("R1", 1001)
    assert report["report"]["total_score"] == 82
    report["systems"].clear()

    assert (await source.load_home("R1", 1001))["systems"]
    assert await source.load_home("R1", 2002) is None
    assert source.reads == [("R1", 1001), ("R1", 1001), ("R1", 2002)]
    assert not hasattr(source, "write")
    assert not hasattr(source, "commit")


def test_shared_guest_pair_uses_distinct_random_credentials_and_stores_only_digests():
    (first_token, first_guest), (second_token, second_guest) = make_guest_pair()

    assert first_token != second_token
    assert first_guest.report_code == second_guest.report_code == "R1"
    assert first_guest.customer_id == second_guest.customer_id == 1001
    assert first_guest.token_digest != second_guest.token_digest
    assert first_token not in vars(first_guest).values()
    assert second_token not in vars(second_guest).values()


@pytest.mark.asyncio
async def test_fake_provider_returns_deterministic_candidate_without_network():
    provider = FakeDraftProvider()
    result = await provider.draft(question="如何理解？", evidence={"facts": [{"id": "ev1"}]})

    assert result["evidence_ids"] == ["ev1"]
    assert provider.calls == [("如何理解？", {"facts": [{"id": "ev1"}]})]
