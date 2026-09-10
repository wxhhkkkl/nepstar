# Contract — Products (商品管理)

Router prefix: `/api/v1/products`. Images upload to OSS bucket `nepstar` via the backend (R1); the client stores returned URLs in the product payload.

## GET /api/v1/products — list (paginated)

Query: `page=1`, `page_size=10`, `keyword` (matches name/description). Response data:

```json
{ "records": [
    { "id": 1, "name": "复合维生素", "description": "...", "cover_url": "https://.../a.jpg",
      "status": 1, "sort_order": 1, "created_at": "...", "updated_at": null }
  ], "total": 1, "page": 1, "page_size": 10 }
```

## GET /api/v1/products/{id} — detail

Data adds full content + ordered images:

```json
{ "id": 1, "name": "...", "description": "...", "detail_html": "<p>…</p>",
  "cover_url": "https://.../0.jpg", "status": 1, "sort_order": 1,
  "images": [ { "id": 10, "url": "https://.../0.jpg", "sort_order": 0 },
              { "id": 11, "url": "https://.../1.jpg", "sort_order": 1 } ],
  "created_at": "...", "updated_at": null }
```

## POST /api/v1/products/upload-image — upload one image to OSS

Request: `multipart/form-data`, field `file` (image MIME). Constraints: image type only; per-file ≤ configured max (default 10 MB); per-product count ≤ configured max (default 10) enforced on save. Errors → `400`: `product.upload_invalid_type` / `product.upload_too_large` / `product.upload_failed`.

Response data:

```json
{ "url": "https://nepstar.<endpoint>/health/products/<uuid>.jpg" }
```

Client must not persist anything until product save; on product save/replace the set `images:[{url, sort_order}]` is what persists.

## POST /api/v1/products — create

Body:

```json
{ "name": "复合维生素", "description": "…", "detail_html": "<p>…</p>",
  "status": 1, "sort_order": 1,
  "images": [ { "url": "https://.../0.jpg", "sort_order": 0 },
              { "url": "https://.../1.jpg", "sort_order": 1 } ] }
```

- `images` required, ≥ 1 entry (spec FR-204); cover_url = image with min `sort_order`.
- Errors (400): `product.image_required` if empty; `product.too_many_images` if the count exceeds the configured max (`settings.PRODUCT_MAX_IMAGE_COUNT`, default 10) — enforced **server-side**, not only by the FE uploader.
- Response data = created product (list-shape + images).

## PUT /api/v1/products/{id} — update

Body = any subset; if `images` present, the set is **replaced** (delete-then-insert, cover recomputed). Validation as create.

## DELETE /api/v1/products/{id}

Guards → `409` `product.in_use` when referenced by any plan; otherwise success `ApiResponse()`.

## Error keys

`product.upload_invalid_type` · `product.upload_too_large` · `product.upload_failed` · `product.image_required` · `product.in_use` · `product.not_found`
