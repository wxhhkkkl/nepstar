"""报告展示请求的结构化日志（FR-039、SC-015）。

只记录排查所需的最小字段：报告编号、结果状态、耗时，以及未命中的 targetId。
**绝不记录报告内容、客户姓名或联系方式**——日志字段是白名单，不随调用方传入而扩张。

对外把"报告不存在"与"无权访问"合并，但内部 outcome 必须区分，
否则无法排查（FR-019）。

outcome 取值：
    ok / not_found / access_denied / not_ready / system_not_found / unavailable
"""

from typing import Any

import structlog

logger = structlog.get_logger("report_view")

# 允许写进日志的字段白名单；新增字段需同步更新 tests/unit/test_report_logging.py
ALLOWED_FIELDS = frozenset(
    {"event", "log_level", "report_code", "outcome", "duration_ms", "missing_target_ids"}
)


def log_report_request(
    *,
    report_code: str,
    outcome: str,
    duration_ms: int,
    missing_target_ids: list[int] | None = None,
) -> None:
    """记录一次报告展示请求。"""
    fields: dict[str, Any] = {
        "report_code": report_code,
        "outcome": outcome,
        "duration_ms": duration_ms,
    }
    if missing_target_ids:
        fields["missing_target_ids"] = [int(t) for t in missing_target_ids]
    logger.info("report_view", **fields)
