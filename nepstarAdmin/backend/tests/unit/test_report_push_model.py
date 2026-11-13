"""推送记录表结构与索引约束。"""

from sqlalchemy import UniqueConstraint

from app.models.new.sa_report_push_log import SAReportPushLog


def test_columns_and_nullability():
    columns = {column.name: column for column in SAReportPushLog.__table__.columns}
    assert {
        "id",
        "report_id",
        "report_code",
        "device_sn",
        "trigger_type",
        "operator_id",
        "status",
        "dedupe_key",
        "failure_reason",
        "response_summary",
        "created_at",
        "finished_at",
    } <= set(columns)
    assert columns["report_code"].nullable is False
    assert columns["trigger_type"].nullable is False
    assert columns["status"].nullable is False
    # 失败后置 NULL，允许同一报告新建尝试
    assert columns["dedupe_key"].nullable is True


def test_unique_and_secondary_indexes():
    constraints = {
        constraint.name
        for constraint in SAReportPushLog.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert "uk_push_dedupe" in constraints
    indexes = {index.name for index in SAReportPushLog.__table__.indexes}
    assert {
        "idx_push_report_code",
        "idx_push_created",
        "idx_push_status_created",
        "idx_push_device",
    } <= indexes
