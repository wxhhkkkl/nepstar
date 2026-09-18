"""Pydantic schemas for the report view endpoints (报告展示数据接口).

字段形状见 specs/003-report-v2-data-api/contracts/report-view.md。
线上 JSON 一律 snake_case，与既有 ApiResponse 一致。
"""

from pydantic import BaseModel


class ReportSummaryOut(BaseModel):
    """报告摘要。来源见 FR-046。"""

    report_code: str
    serial_number: str | None = None
    report_date: str | None = None
    gender: str  # female / male
    total_score: int | None = None
    warning_threshold: int
    peer_percent: int | None = None  # 同龄人对比比例（旧库排名字段）
    actual_age: int | None = None  # 受检年龄，非客户档案年龄
    biological_age: float | None = None
    healthy_life_expectancy: float | None = None  # 派生，见 FR-045
    summary: str | None = None


class IndicatorOut(BaseModel):
    """二级/三级指标。权重取自旧库指标字典的 proportion。"""

    indicator_code: str
    name: str
    score: int | None = None
    weight: int | None = None
    description: str | None = None


class ProductOut(BaseModel):
    product_id: int
    name: str
    image_url: str | None = None
    image_alt: str | None = None


class RecommendationOut(BaseModel):
    trigger_indicator_code: str
    issue: str
    plan_id: int
    plan_name: str
    title: str
    description: str | None = None
    tags: list[str] = []
    action_label: str | None = None
    action_hint: str | None = None
    products: list[ProductOut] = []


class VisualizationOut(BaseModel):
    """图表数据。类别由二级指标名派生，与序列一一对应。"""

    categories: list[str] = []
    series: list[int] = []


class TrendOut(BaseModel):
    """趋势序列。仅心血管返回，最多 6 点、时间升序。"""

    series: list[int] = []


class SystemOut(BaseModel):
    system_code: str
    name: str
    score: int | None = None
    status_text: str | None = None
    summary: str | None = None
    sort_order: int
    applicable: bool = True
    visualization: VisualizationOut
    trend: TrendOut
    indicators: list[IndicatorOut] = []
    recommendation: RecommendationOut | None = None


class DirectMeasurementOut(BaseModel):
    """不参与加权的直接采集值，取自报告文档的报告级单值。"""

    name: str
    value: str
    unit: str | None = None


class SystemDetailOut(SystemOut):
    """系统详情 = 系统卡片 + 直接采集 + 结论解读与行动建议。"""

    direct_measurements: list[DirectMeasurementOut] = []
    interpretation: str | None = None
    actions: list[str] = []


class AiConsultOut(BaseModel):
    enabled: bool
    title: str
    entry_type: str
    entry_url: str


class FeaturesOut(BaseModel):
    save_report_enabled: bool


class ReportHomeOut(BaseModel):
    report: ReportSummaryOut
    systems: list[SystemOut]
    ai_consult: AiConsultOut
    features: FeaturesOut


class ReportSystemDetailOut(BaseModel):
    report_code: str
    system: SystemDetailOut
