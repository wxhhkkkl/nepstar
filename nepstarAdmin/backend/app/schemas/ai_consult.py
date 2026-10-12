"""匿名咨询入口的请求结构。"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator


class GuestContextCreate(BaseModel):
    report_code: str = Field(min_length=1, max_length=64)
    customer_id: int = Field(gt=0)


class ConsentCreate(BaseModel):
    report_code: str = Field(min_length=1, max_length=64)
    notice_version: str = Field(min_length=1, max_length=40)
    provider_code: str = Field(min_length=1, max_length=50)
    accepted: StrictBool


class ConsultSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report_code: str = Field(min_length=1, max_length=64)
    source: Literal["home", "plan", "indicator"]
    plan_id: int | None = Field(default=None, gt=0, strict=True)
    indicator_code: str | None = Field(default=None, min_length=2, max_length=64, pattern=r"^[A-Z][A-Z0-9_]+$")

    @model_validator(mode="after")
    def validate_source_context(self):
        if self.source == "home" and (self.plan_id is not None or self.indicator_code is not None):
            raise ValueError("Home sessions cannot include an indicator context")
        if self.source == "indicator" and (self.plan_id is not None or self.indicator_code is None):
            raise ValueError("Indicator sessions require only an indicator code")
        if self.source == "plan" and (self.plan_id is None or self.indicator_code is None):
            raise ValueError("Plan sessions require a plan ID and indicator code")
        return self


class ConsultTurnCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=500)


class ConsultFeedbackUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    helpful: StrictBool
    reason: Literal["inaccurate", "unclear", "unresolved"] | None = None

    @model_validator(mode="after")
    def reason_requires_negative_feedback(self):
        if self.helpful and self.reason is not None:
            raise ValueError("A reason is only accepted for unhelpful feedback")
        return self


class ConsultStopRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generation_id: int = Field(gt=0)


class ConsultRetryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generation_id: int = Field(gt=0)
