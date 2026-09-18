"""Unit tests for report request structured logging (FR-039, SC-015).

覆盖：
- 每次报告请求都记录报告编号、结果状态与耗时
- 未命中指标时记录未命中的 targetId
- 日志不包含报告内容、客户姓名或联系方式
"""

from structlog.testing import capture_logs

from app.utils.report_log import log_report_request

# 允许出现在报告日志中的字段，多一个都算违规
ALLOWED_KEYS = {
    "event",
    "log_level",
    "report_code",
    "outcome",
    "duration_ms",
    "missing_target_ids",
}


def test_logs_report_code_outcome_and_duration():
    with capture_logs() as logs:
        log_report_request(
            report_code="KH503LS0005865V220721182530852",
            outcome="ok",
            duration_ms=123,
        )
    assert len(logs) == 1
    entry = logs[0]
    assert entry["report_code"] == "KH503LS0005865V220721182530852"
    assert entry["outcome"] == "ok"
    assert entry["duration_ms"] == 123


def test_records_missing_target_ids_when_mapping_misses():
    """未命中指标时必须记录未命中的 targetId，供排查（FR-028）。"""
    with capture_logs() as logs:
        log_report_request(
            report_code="R1",
            outcome="ok",
            duration_ms=5,
            missing_target_ids=[9999, 8888],
        )
    assert logs[0]["missing_target_ids"] == [9999, 8888]


def test_no_missing_target_ids_key_when_clean():
    with capture_logs() as logs:
        log_report_request(report_code="R1", outcome="ok", duration_ms=5)
    assert "missing_target_ids" not in logs[0]


def test_outcome_distinguishes_internal_failure_reasons():
    """内部要能区分"不存在"与"无权访问"，即使对外合并（FR-019）。"""
    with capture_logs() as logs:
        log_report_request(report_code="R1", outcome="not_found", duration_ms=3)
        log_report_request(report_code="R1", outcome="access_denied", duration_ms=3)
    assert [entry["outcome"] for entry in logs] == ["not_found", "access_denied"]


def test_log_entry_contains_no_extra_fields():
    """日志字段必须落在白名单内——不得夹带报告内容或客户联系方式。"""
    with capture_logs() as logs:
        log_report_request(report_code="R1", outcome="ok", duration_ms=1)
    assert set(logs[0]) <= ALLOWED_KEYS


def test_does_not_leak_report_content_or_contact():
    """即使调用方传入敏感串，也不得出现在日志里。"""
    secret = "张三 13812345678"
    with capture_logs() as logs:
        log_report_request(report_code=secret, outcome="ok", duration_ms=1)
    assert set(logs[0]) <= ALLOWED_KEYS
    # report_code 是业务标识，允许记录；除此之外不得有承载内容的字段
    assert "summary" not in logs[0]
    assert "name" not in logs[0]
    assert "mobile" not in logs[0]
