# Contract — Indicators (指标管理)

Router prefix: `/api/v1/indicators`. Full 2-level tree returned in one call (catalog is small; spec SC-005). Unpaged tree endpoint; no pagination needed for the tree view.

## GET /api/v1/indicators/tree

Query: `keyword` (optional, matches `ind_code` or `ind_name`), `status` (optional int filter).

Response `data` = flat list of level-1 nodes in `sort_order`/`id` order, each embedding `children`:

```json
[
  {
    "id": 1, "parent_id": null, "code": "HT001", "name": "体重管理",
    "description": "", "status": 1, "sort_order": 1,
    "children": [
      { "id": 4, "parent_id": 1, "code": "HT0011", "name": "体脂率",
        "description": "", "status": 1, "sort_order": 1, "children": [] }
    ]
  }
]
```

Field aliases (wire → model): `code`→`ind_code`, `name`→`ind_name`. Only 2 levels; `children` always `[]` for L2.

## POST /api/v1/indicators — create (level-1 or level-2)

Body:

```json
{ "parent_id": null, "code": "HT002", "name": "营养管理",
  "description": "", "status": 1, "sort_order": 1 }
```

- `parent_id` null → creates level-1; a level-1 `id` → creates level-2 under it.
- Errors (service → 400 unless noted): `parent_id` not found, or `parent_id` is itself a level-2 (no 3rd level) → `indicator.parent_must_be_level1`; duplicate `code` → `indicator.code_exists` (409 if from unique-key race).
- Response `data` = created node `{id, parent_id, code, name, description, status, sort_order}`.

## PUT /api/v1/indicators/{id} — update

Body = any subset of create fields (`parent_id` omitted/null keeps level). Same validations as create; code change still must be unique.

## DELETE /api/v1/indicators/{id}

Success: `ApiResponse()` (code 200). Guards → `409`:
- has level-2 children → `indicator.has_children`
- referenced by any plan (`sa_plan_indicator`) → `indicator.in_use`

## Error keys (backend i18n + frontend `health`/`indicator` block)

`indicator.code_exists` · `indicator.parent_must_be_level1` · `indicator.has_children` · `indicator.in_use` · `indicator.not_found`
