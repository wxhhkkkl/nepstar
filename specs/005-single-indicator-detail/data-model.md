# Data Model: 单指标详情

本期不新增表，也不变更现有数据库结构。

## Existing entities

| Entity | Source | Fields used | Access |
| --- | --- | --- | --- |
| Report metadata | `platform.inspect_base` | `report_code`, `customer_id`, `status`, `report_date`, `inspect_date` | SELECT only |
| Original indicator node | MongoDB `receive_report.reportV2Info` | `_id`, `ddsReportInfo.firstTarget`, nested `targetId`, `score`, `abLevel`, `lastScore` | find only |
| Indicator registry | `nepstar.sa_indicator` | `id`, `parent_id`, `ind_code`, `ind_name`, `target_id`, `status`, `description`, `report_status_text`, `report_interpretation`, `report_actions` | read for report; write only via admin |

## Derived view: IndicatorDetail

- Identity: `report_code`, `system_code`, `indicator_code`, `name`.
- Current result: nullable `score`, raw nullable `abnormal_level`, nullable `last_score`, nullable `score_change`, nullable configured `status_text`.
- Copy: nullable `description`, nullable `interpretation`, array `actions`.
- Trend: ordered `{report_code, date, score}` list of at most six real points, including current report when score valid.
- Parent context: `{system_code, name}`.

## Validation and state

1. Validate report exists, belongs to `customer_id`, and is ready.
2. Validate configured indicator is enabled, has a `target_id`, and has an enabled parent system.
3. Validate parent system node and indicator node are in the same report branch; no name matching.
4. On failure, return explicit report/indicator error without fallback to another report or node.
5. History points must belong to the same customer and be no later than the current report; missing nodes/invalid scores are skipped.
