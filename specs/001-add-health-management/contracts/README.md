# Health Module API Contracts

Feature: 健康管理 (specs/001-add-health-management). Backend FastAPI routers mounted under `/api/v1`. All endpoints require `Authorization: Bearer <JWT>` (`get_current_user`).

## Conventions (shared by all three resources)

- **Envelope** (from `app/schemas/response.py`): every response is
  `{"code": 200, "message": "success", "data": <T|null>, "timestamp": <ms>}`.
  Errors use `code` = HTTP-ish (e.g. 400/404/409/500) and `message` = an i18n dot-key (frontend renders `t('health.<key>')`, falling back to the raw key). A bare `ApiResponse()` (data null) means success for PUT/DELETE.
- **Pagination** (list endpoints): query `page` (default 1), `page_size` (default 10); response data =
  `{"records": [...], "total": <n>, "page": <p>, "page_size": <s>}`.
- **Search** (list endpoints): `keyword` contains-match on name/code/description.
- **Content language**: all name/description/code values are Chinese single-language v1. No lang columns.
- **Delete guards**: services raise `ValueError("<key>")`; routers return `code=409, message=<key>` (see per-resource).

## Resources

- [indicators.md](indicators.md) — 指标管理 (two-level indicator tree)
- [products.md](products.md) — 商品管理 (products + images + OSS upload)
- [plans.md](plans.md) — 方案管理 (plan ↔ products/indicators)
