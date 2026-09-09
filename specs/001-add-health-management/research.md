# Research — Health Management Module (健康管理)

Resolved design decisions for `specs/001-add-health-management`. Each entry: **Decision / Rationale / Alternatives considered**.

## R1. Image upload architecture → Backend proxy via `oss2`

- **Decision**: Browser uploads images to the new authenticated endpoint `POST /api/v1/products/upload-image` (multipart). The FastAPI backend reads the file, uploads it to Aliyun OSS bucket `nepstar` with the `oss2` Python SDK under a namespaced object key (e.g. `health/products/{uuid}.{ext}`), and returns the public URL. The client then includes that URL in the product create/update payload (`images: [{url, sort_order}]`).
- **Rationale**: The repo already carries `OSS_ACCESSKEY_ID`/`OSS_ACCESSKEY_KEY` in `backend/.env` (inert today — not declared in `Settings`), i.e. credentials live server-side. A backend proxy keeps keys off the browser, needs only the `oss2` dependency plus a `OSS_ENDPOINT`/`OSS_BUCKET` setting, and needs no STS/temporary-credential service. Failure mode is a single HTTP call the client can surface directly.
- **Alternatives considered**: Browser direct-to-OSS via `ali-oss` + backend STS — adds a frontend SDK, a second STS endpoint, and a temporary-credential security surface for no v1 benefit; rejected as more complex (Constitution III approval obtained for `oss2`).
- **Open environment fact**: bucket name fixed `nepstar`; endpoint region + public-read URL base must be provided via `.env` (`OSS_ENDPOINT`, `OSS_BUCKET=nepstar`). Images must be public-read for list/detail display (spec SC-003) — if the bucket is private, a CDN/signed URL strategy is required (flagged; default assumption = public-read bucket as the user described "上传图片到…oss, bucket 名称是 nepstar").

## R2. Product rich-text (图文) detail → wangEditor

- **Decision**: Add `@wangeditor/editor` + `@wangeditor/editor-for-vue`; product form embeds the editor; content stored as an HTML string in a `detail_html` (MEDIUMTEXT/LONGTEXT) column.
- **Rationale**: wangEditor has a maintained Vue 3 wrapper, small footprint, built-in image handling, and strong Chinese-language ecosystem/docs, matching the Chinese-language admin. Rich text is an agreed requirement (spec Clarification: 图文详情), so a textarea downgrade was not acceptable.
- **Alternatives considered**: `@vueup/vue-quill` (heavier, weaker zh docs); no-dependency raw-HTML textarea (poor UX, error-prone); plain-text downgrade (drops an agreed requirement). User approved wangEditor 2026-09-09.

## R3. Indicator storage → single self-referencing table `sa_indicator` (two levels enforced)

- **Decision**: One table `sa_indicator` with `parent_id` (`NULL` ⇒ level-1; referencing a level-1 row ⇒ level-2). Level-2 cannot have children (service rejects). Code uniqueness is one global unique key across both levels. The plan→indicator junction stores the node `id`; the association **granularity is derived** from whether that node's `parent_id` is NULL (L1) or not (L2) — no separate granularity column.
- **Rationale**: Mirrors the repo's `sa_organization` self-ref tree pattern; one `ind_code` unique constraint enforces spec FR-103 across L1+L2; strict-precise association (spec FR-303) is naturally "store exactly the node the admin ticked"; rendering groups L2 under L1 by `parent_id`.
- **Alternatives considered**: Two tables (`sa_indicator_category` + `sa_indicator_item`) — more joins, duplicate code-uniqueness enforcement across tables, same 2-level result; rejected for simplicity.

## R4. AuthN/Z on new endpoints → `Depends(get_current_user)` (menu-gated UI)

- **Decision**: Every new endpoint depends on `get_current_user` (JWT + active user). No `check_permission` per-action enforcement in v1. Visibility is governed by the existing role→menu tree: the four new `sa_menu` rows are seeded and, because `seed_admin_role` re-grants **all** menus to admin on every startup, admin sees the module immediately; other roles are granted menus per existing RBAC conventions.
- **Rationale**: Matches the `roles`/`users`/`devices` routers (which use only `get_current_user`); avoids building per-action checks the rest of the codebase doesn't consistently apply. Menu-row seeding is idempotent and placed **before** `seed_admin_role` in the startup block so the auto-grant includes it.
- **Alternatives considered**: `check_permission` on each method (admin bypass + `sa_role_menu.actions`) — the repo's own limitation (method-level, not path-scoped) makes it low-value here; deferred unless a role-granularity requirement appears.

## R5. Referential integrity → app-level guards (no DB FKs)

- **Decision**: Follow repo convention (no FK constraints). Deletion guards live in services: refuse delete of an L1 indicator that has L2 children or is referenced by a plan; refuse delete of a referenced product; plan delete removes its own junction rows first (cascade by code), then the plan. Duplicate association prevention via unique keys (`uk_plan_product`, `uk_plan_indicator`) surfaced as business errors (`409`) — mirrors `delete_role` guards and the `SARoleMenu` delete-then-insert flush pattern.
- **Rationale**: Consistent with every existing `sa_*` table; MySQL 5.6 target without FK support burden.
- **Alternatives considered**: Real FK constraints / cascade — inconsistent with codebase and DB; rejected.

## R6. Indicator/product/plan menu placement & ids → new top-level "健康管理" + guarded inserts

- **Decision**: New top-level menu row 健康管理 (`route_path=/health`) with 3 children: 指标管理 `/health/indicators`, 商品管理 `/health/products`, 方案管理 `/health/plans`; `name_zh/en/es`, icons, `sort_order` after existing top-levels. Seeded idempotently (INSERT…SELECT WHERE NOT EXISTS by `route_path`) in `seed-sa.sql` **and** via `health_seed.seed_health_menus(db)` invoked at startup before `seed_admin_role`. Explicit `id` values chosen to not collide with existing seed ids.
- **Rationale**: Matches how `sa_menu` drives the sidebar (`SidebarMenu` renders `authStore.menus` by `route_path`, tri-lingual name). Startup helper + re-grant gives deterministic dev/test and live behavior without manual SQL.
- **Alternatives considered**: Manual SQL only — not idempotent across environments; editing `sa_menu` by hand — menu CRUD API was intentionally removed (menus edited via DB), but a code-level seed mirrors the existing `seed_root_org`/`seed_admin_role` startup pattern.

## R7. Testing strategy → existing harness + FE jsdom wiring

- **Decision**: Backend: unit tests for the three services (`AsyncMock` on `db.execute`, per `tests/unit/test_user_service.py` pattern) covering code uniqueness, tree build, guards, association replace/dedup; API tests for happy/error envelopes via in-process ASGI client (live RDS, per existing `tests/api/*` pattern) marked clearly as requiring seeded admin. Frontend: enable `vitest` with jsdom via a `test` block in `vite.config.ts` (deps already installed); component-test the pure logic (dialog forms validation, image uploader list order/remove, plan strict indicator checkbox mapping) with `@vue/test-utils`.
- **Rationale**: Constitution I mandates red-green; repo already mandates backend tests (pytest configured, `testpaths`), FE tooling is present but unwired — a config-only change is the minimal enabler. TDD tasks will each name the failing test first.
- **Alternatives considered**: Skipping FE tests (constitution violation); introducing a hermetic test DB (out of scope — existing suite already targets live RDS).

## R8. PII / data sensitivity → none

- **Decision**: New tables hold catalog content only (names, codes, image URLs, HTML detail); no customer/personal data, so no `pii` masking or new data-protection handling.
- **Rationale**: Spec assumption; existing `pii` masking is untouched.
