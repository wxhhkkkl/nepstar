"""匿名咨询入口的请求结构。"""

from pydantic import BaseModel, Field


class GuestContextCreate(BaseModel):
    report_code: str = Field(min_length=1, max_length=64)
    customer_id: int = Field(gt=0)
