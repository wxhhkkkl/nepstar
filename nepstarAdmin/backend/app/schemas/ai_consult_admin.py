"""Admin-only AI consultation settings input; secrets are intentionally absent."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AiConsultSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_row_version: int = Field(ge=0)
    enabled: bool = True
    provider_code: Literal["openai_compatible"] = "openai_compatible"
    model_code: str = Field(default="", max_length=100)
    maintenance_text: str = Field(default="", max_length=500)
    notice_version: str = Field(default="", max_length=40, pattern=r"^[A-Za-z0-9._-]*$")
    notice_text: str = Field(default="", max_length=6000)
    data_scope_text: str = Field(default="", max_length=2000)
    guest_create_limit_per_minute: int = Field(default=0, ge=0, le=1000, strict=True)
    daily_success_limit: int = Field(default=0, ge=0, le=1000, strict=True)
    per_minute_limit: int = Field(default=0, ge=0, le=60, strict=True)
    global_daily_token_limit: int = Field(default=0, ge=0, le=100000000, strict=True)
    max_concurrent_generations: int = Field(default=0, ge=0, le=100, strict=True)
    max_question_chars: int = Field(default=500, ge=0, le=500, strict=True)


class AiConsultRuleDraftCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    content: str = Field(min_length=1, max_length=2000)


class AiConsultRuleActivation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_row_version: int = Field(ge=0)


class AiConsultServiceStateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_row_version: int = Field(ge=0, strict=True)
    enabled: bool = Field(strict=True)
