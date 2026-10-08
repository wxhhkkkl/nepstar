"""匿名咨询入口的请求结构。"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool


class GuestContextCreate(BaseModel):
    report_code: str = Field(min_length=1, max_length=64)
    customer_id: int = Field(gt=0)


class ConsentCreate(BaseModel):
    report_code: str = Field(min_length=1, max_length=64)
    notice_version: str = Field(min_length=1, max_length=40)
    provider_code: str = Field(min_length=1, max_length=50)
    accepted: StrictBool


class ConsultSessionCreate(BaseModel):
    # 方案入口的发布/阈值核对还未实现；本阶段只接受首页来源。
    model_config = ConfigDict(extra="forbid")

    report_code: str = Field(min_length=1, max_length=64)
    source: Literal["home"]
