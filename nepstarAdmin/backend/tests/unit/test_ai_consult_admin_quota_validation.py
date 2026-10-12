"""Admin quota input contracts; no database or provider is accessed."""

import pytest
from pydantic import ValidationError

from app.schemas.ai_consult_admin import AiConsultSettingsUpdate


QUOTA_BOUNDS = [
    ("guest_create_limit_per_minute", 0, 1000),
    ("daily_success_limit", 0, 1000),
    ("per_minute_limit", 0, 60),
    ("global_daily_token_limit", 0, 100000000),
    ("max_concurrent_generations", 0, 100),
    ("max_question_chars", 1, 500),
]


@pytest.mark.parametrize("field,minimum,maximum", QUOTA_BOUNDS)
def test_quota_boundaries_accept_integers(field, minimum, maximum):
    for value in (minimum, maximum):
        request = AiConsultSettingsUpdate(expected_row_version=1, **{field: value})
        assert getattr(request, field) == value


@pytest.mark.parametrize("field,minimum,maximum", QUOTA_BOUNDS)
def test_empty_or_out_of_range_quotas_are_rejected(field, minimum, maximum):
    for value in (None, minimum - 1, maximum + 1):
        with pytest.raises(ValidationError):
            AiConsultSettingsUpdate(expected_row_version=1, **{field: value})


@pytest.mark.parametrize("value", [True, False, "20", 20.5])
@pytest.mark.parametrize("field,minimum,maximum", QUOTA_BOUNDS)
def test_quotas_cannot_silently_coerce_non_integer_json_values(value, field, minimum, maximum):
    with pytest.raises(ValidationError):
        AiConsultSettingsUpdate(expected_row_version=1, **{field: value})
