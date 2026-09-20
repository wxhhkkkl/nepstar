# Indicator Detail Contract

`GET /api/v1/report-view/{report_code}/indicators/{indicator_code}?customer_id={customer_id}`

No admin login token is required, matching existing report-view routes. `report_code + customer_id` are checked against the report owner; the response must not reveal whether a missing report exists for another customer.

## Success envelope

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "report_code": "KH503...",
    "system": { "system_code": "SYS_IMMUNE", "name": "免疫力" },
    "indicator": {
      "indicator_code": "SYS_IMMUNE_LYMPH",
      "name": "淋巴结",
      "score": 92,
      "last_score": 90,
      "score_change": 2,
      "abnormal_level": 1,
      "status_text": "正常",
      "description": "...",
      "interpretation": "...",
      "actions": ["..."],
      "trend": [
        { "report_code": "R1", "date": "2026-07-12", "score": 90 },
        { "report_code": "KH503...", "date": "2026-09-18", "score": 92 }
      ]
    }
  }
}
```

`score`, `last_score`, `score_change`, `abnormal_level`, `status_text`, `description`, and `interpretation` may be null. `actions` and `trend` default to empty arrays. No plan/product/AI fields in this endpoint.

## Business failures

- `404 report.not_found`: report missing or customer mismatch (same public response).
- `404 report.indicator_not_found`: indicator missing, disabled, unmapped, wrong parent branch, or absent from report.
- `409 report.not_ready`: report not ready.
- `503 report.unavailable`: source timeout/unavailable.

As with existing report-view endpoints, business failures use the common API envelope. Read operations only against all non-`nepstar` sources.

## Frontend route

`#/system/{systemCode}/indicator/{indicatorCode}?reportId={reportCode}&customerId={customerId}`

The route must work when opened directly. Top back navigation returns to the parent system and restores saved scroll when arriving from a click. No bottom return button.
