# Contract — Plans (方案管理)

Router prefix: `/api/v1/plans`. A plan references products (ordered) and indicators at level-1 **or** level-2 granularity. Strict precise association: the set stored is exactly the nodes the admin ticked (an L1 node does not pull in its L2 children).

## GET /api/v1/plans — list (paginated)

Query: `page=1`, `page_size=10`, `keyword` (matches name/description). Each record includes association counts for the list badge:

```json
{ "records": [
    { "id": 1, "name": "体重管理方案", "description": "…", "status": 1,
      "sort_order": 1, "product_count": 2, "indicator_count": 3,
      "created_at": "...", "updated_at": null }
  ], "total": 1, "page": 1, "page_size": 10 }
```

## GET /api/v1/plans/{id} — detail (edit/display payload)

```json
{ "id": 1, "name": "体重管理方案", "description": "…", "status": 1, "sort_order": 1,
  "products": [
    { "product_id": 2, "name": "复合维生素", "cover_url": "https://.../a.jpg", "sort_order": 0 }
  ],
  "indicators": [
    { "indicator_id": 1, "level": 1, "code": "HT001", "name": "体重管理",
      "parent_id": null, "parent_name": null, "status": 1 },
    { "indicator_id": 4, "level": 2, "code": "HT0011", "name": "体脂率",
      "parent_id": 1, "parent_name": "体重管理", "status": 1 }
  ],
  "created_at": "...", "updated_at": null }
```

- `level` is **derived**: 1 when the referenced indicator has `parent_id == null`, else 2. No stored granularity column.
- The frontend edit dialog can reconstruct checked state from `indicators[]` (each entry is a checked node) rendered over the `/indicators/tree`.
- Indicators whose `status` is 0 (stopped) are still returned with `status:0` so the UI can show a 已停用 tag (spec edge case).

## POST /api/v1/plans — create

Body:

```json
{ "name": "体重管理方案", "description": "…", "status": 1, "sort_order": 1,
  "product_ids": [2, 7],
  "indicator_ids": [1, 4] }
```

- `product_ids` order = display order. May be empty (empty plan allowed, spec edge cases).
- `indicator_ids` may mix L1 and L2 ids arbitrarily (strict association). Empty allowed.
- Validations (service → 400): `plan.product_not_found` (any id unknown), `plan.indicator_not_found`, `plan.indicator_is_level2_parent` is N/A (no 3rd level). Duplicates in the arrays are deduped (spec FR-304).
- Response data = created plan (list-shape).

## PUT /api/v1/plans/{id} — update

Body = any subset of create fields; if `product_ids`/`indicator_ids` provided, associations are **replaced** delete-then-insert (mirrors `role_service.update_role` flush-before-insert pattern). Validations as create.

## DELETE /api/v1/plans/{id}

No external-reference guard (spec FR-306); requires confirm in UI. Service deletes the plan's own `sa_plan_product` + `sa_plan_indicator` rows first, then the plan. Success `ApiResponse()`.

## Error keys

`plan.product_not_found` · `plan.indicator_not_found` · `plan.not_found`
