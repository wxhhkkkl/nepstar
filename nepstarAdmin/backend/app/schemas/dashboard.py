"""Pydantic schemas for dashboard."""

from pydantic import BaseModel


class DeviceSummaryResponse(BaseModel):
    total_devices: int = 0
    devices_by_org: list[dict] = []
    trend: list[dict] = []


class DetectionSummaryResponse(BaseModel):
    total_inspections: int = 0
    avg_score: float = 0.0
    trend: list[dict] = []
    top_devices: list[dict] = []
