---

description: "Task list for Health Management Module (001-add-health-management)"
---

# Tasks: Health Management Module (健康管理)

**Input**: Design documents from `/specs/001-add-health-management/`
**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required for user stories), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/README.md), [quickstart.md](quickstart.md)

**Tests**: Tests are REQUIRED by the project constitution (Principle I: TDD — see `.specify/memory/constitution.md`). Tests MUST be written first and confirmed to FAIL before implementation. Backend tests run from `nepstarAdmin/backend/`; frontend tests run from `nepstarAdmin/frontend/`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Backend code under `nepstarAdmin/backend/`; frontend code under `nepstarAdmin/frontend/`.

**Security note**: `.env` holds live credentials — never print or commit values. New `OSS_*` Settings fields are read from `.env` only.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1=指标管理, US2=商品管理, US3=方案管理)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency and configuration additions the whole feature needs. All are independent.

- [x] T001 [P] Add `oss2` to backend dependencies in `nepstarAdmin/backend/pyproject.toml` (dependencies list) and `nepstarAdmin/backend/requirements.txt`, then install into the venv (from `nepstarAdmin/backend/`)
- [x] T002 [P] Add frontend dependencies `@wangeditor/editor` and `@wangeditor/editor-for-vue` to `nepstarAdmin/frontend/package.json` (`dependencies`), then run `npm install` (from `nepstarAdmin/frontend/`)
- [x] T003 [P] Add OSS settings fields to the `Settings` class in `nepstarAdmin/backend/app/config.py`: `OSS_BUCKET: str = "nepstar"`, `OSS_ENDPOINT: str = ""`, `OSS_ACCESSKEY_ID: str = ""`, `OSS_ACCESSKEY_KEY: str = ""` (values come from `.env`, never hardcoded)
- [x] T004 [P] Add a vitest `test` block to `nepstarAdmin/frontend/vite.config.ts` with `environment: 'jsdom'` so frontend component tests can run (deps already installed; no runtime change)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema + menu seeding that MUST be complete before ANY user story (all API tests hit the live `nepstar` DB; FE pages need the menus).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Add CREATE TABLE statements for `sa_indicator`, `sa_product`, `sa_product_image`, `sa_plan`, `sa_plan_product`, `sa_plan_indicator` (columns, indexes, unique keys exactly per `data-model.md`) appended to `nepstarAdmin/backend/sql/schema-sa.sql`, matching existing MySQL 5.6+ style (`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, `BIGINT` AI PK, `DATETIME`, `status TINYINT`, `COMMENT`)
- [x] T006 Create alembic migration `nepstarAdmin/backend/alembic/versions/003_add_health_module.py` creating the same 6 tables (mirror `001_add_sa_device_config.py` style: `sa.BigInteger()`, `sa.Table` in schema `nepstar`, `mysql_engine="InnoDB"`, `mysql_charset="utf8mb4"`, `comment=`)
- [x] T007 Apply the migration: from `nepstarAdmin/backend/` run `alembic upgrade head`, then confirm the 6 tables exist in the `nepstar` schema (report any DDL/migration errors and fix)
- [x] T008 Append idempotent menu INSERTs (`INSERT … SELECT … WHERE NOT EXISTS` by `route_path`) for the 4 health menus (top-level 健康管理 `/health` + children 指标管理 `/health/indicators`, 商品管理 `/health/products`, 方案管理 `/health/plans`, with `name_zh/name_en/name_es`, `icon`, `sort_order`; ids that don't collide with existing seed ids) to `nepstarAdmin/backend/sql/seed-sa.sql`
- [x] T009 [P] Create `nepstarAdmin/backend/app/services/health_seed.py` with `async def seed_health_menus(db: AsyncSession)` that idempotently inserts the 4 menus (guard by `route_path`)
- [x] T010 Wire startup: import `seed_health_menus` and call it in the `@app.on_event("startup")` block of `nepstarAdmin/backend/app/main.py` **immediately before** `seed_admin_role(db)` so the existing admin re-grant picks the new menus up
- [x] T011 Verify foundation: run `.venv/Scripts/python.exe -m pytest --collect-only -q` from `nepstarAdmin/backend/` (no errors), confirm the app boots and `GET /api/v1/auth/me` (admin) returns the 4 new menus under a 健康管理 parent

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - 维护两级健康指标 / 指标管理 (Priority: P1) 🎯 MVP

**Goal**: Admin manages a 2-level indicator tree (L1 category / L2 item), each node with a **globally unique code**; supports create/edit/enable-disable/sort; delete guarded (L1 with children, or any node referenced by a plan). Backend `GET/POST/PUT/DELETE /api/v1/indicators` (contracts/indicators.md); FE page 指标管理.

**Independent Test**: Login → 指标管理: create L1 + L2, duplicate code rejected, edit/disable, delete guards fire, tree + search load <1 s. No product/plan module needed.

### Tests for User Story 1 (REQUIRED — write first, confirm FAIL before implementation)

- [x] T012 [P] [US1] Write failing unit tests `nepstarAdmin/backend/tests/unit/test_indicator_service.py` (mock `db.execute` with `AsyncMock`, mirror `tests/unit/test_user_service.py`): create L1/L2, reject parent-not-found / parent-is-L2 (depth ≤2), duplicate `ind_code`, delete guard for L1-with-children and node-in-plan, tree ordering
- [x] T013 [P] [US1] Write failing API contract tests `nepstarAdmin/backend/tests/api/test_health_indicators.py` (reuse `tests/conftest.py` ASGI client + `admin_headers`): tree shape, create L1/L2, duplicate code → error envelope, delete guards → `code=409`, auth required

### Implementation for User Story 1

- [x] T014 [P] [US1] Create `SAIndicator` ORM model in `nepstarAdmin/backend/app/models/new/sa_indicator.py` per `data-model.md` (`parent_id`, `ind_code` unique, `ind_name`, `description`, `sort_order`, `status`, timestamps; `__table_args__ = {"schema": NEPSTAR_SCHEMA}`)
- [x] T015 [P] [US1] Create indicator schemas in `nepstarAdmin/backend/app/schemas/indicator.py` (create/update/response; response node carries `children: list`)
- [x] T016 [US1] Implement `indicator_service` in `nepstarAdmin/backend/app/services/indicator_service.py` (tree get filtered by `keyword`/`status`, create/update/delete with guards raising `ValueError("indicator.*")`, delete-then-flush, duplicate pre-check) — depends T014
- [x] T017 [US1] Implement `nepstarAdmin/backend/app/api/indicators.py` (`APIRouter(prefix="/indicators")`, `Depends(get_db)` + `Depends(get_current_user)`, `ApiResponse` envelope, `ValueError`→`409`) and register it in `nepstarAdmin/backend/app/main.py` (`include_router`, `/api/v1`) — depends T016
- [x] T018 [US1] Add `indicator.*` error-message keys to the backend i18n catalog(s) under `nepstarAdmin/backend/app/i18n/` that `get_message(key, lang)` loads (mirror how `role.*` keys are stored), for the keys listed in `contracts/indicators.md`
- [x] T019 [US1] Create `nepstarAdmin/frontend/src/api/health.ts` with typed indicator functions (`getTree`, `create`, `update`, `remove` via `@/api/client`)
- [x] T020 [US1] Add the `health` top-level i18n block with indicator keys (labels, page title, `indicator.*` error copy) to `nepstarAdmin/frontend/src/i18n/zh-CN.json`, `en.json`, `es.json`
- [x] T021 [P] [US1] Write failing frontend component test `nepstarAdmin/frontend/src/views/health/__tests__/IndicatorList.spec.ts` (mount `IndicatorList.vue` with Element Plus, stub `api/health`; verify tree rows render, L1-with-children cannot be deleted, create dialog emits expected payload)
- [x] T022 [US1] Implement `IndicatorList.vue` in `nepstarAdmin/frontend/src/views/health/IndicatorList.vue` (L1/L2 `el-table`/tree rows, code+name search, inline add/edit `el-dialog` for L1 & L2, enable/disable toggle, delete `el-popconfirm`, error copy via i18n) — depends T019, T020
- [x] T023 [US1] Register the route `{ path: '/health/indicators', name: 'HealthIndicators', component: () => import('@/views/health/IndicatorList.vue'), meta: { requiresAuth: true } }` in `nepstarAdmin/frontend/src/router/index.ts`
- [x] T024 [US1] Make US1 tests green: run the new backend unit + API tests and the FE `IndicatorList` test from the correct dirs; fix until passing

**Checkpoint**: US1 functional & independently verified. Commit: `feat(health): indicators CRUD + 2-level tree (backend + FE)`.

---

## Phase 4: User Story 2 - 配置商品并上传图片 / 商品管理 (Priority: P1)

**Goal**: Admin manages products with text description, **wangEditor 图文详情**, **cover + multiple images** uploaded to Aliyun OSS bucket `nepstar` through the backend (`oss2` proxy, R1). Backend `GET/POST/PUT/DELETE /api/v1/products` + `POST /api/v1/products/upload-image` (contracts/products.md); FE 商品管理 list + edit dialog + image uploader.

**Independent Test**: Login → 商品管理: create product with 1+ uploaded images (→OSS `nepstar`) + rich detail, cover = first, reorder/remove images, `.exe`/oversize upload rejected, delete guard when referenced by a plan. Indicators not required.

### Tests for User Story 2 (REQUIRED — write first, confirm FAIL before implementation)

- [x] T025 [P] [US2] Write failing unit tests `nepstarAdmin/backend/tests/unit/test_product_service.py` (mock `db.execute`): create requires ≥1 image, cover = min `sort_order`, image-set replace on update, delete guard `product.in_use`, detail_html passthrough, upload size/type validation logic
- [x] T026 [P] [US2] Write failing unit tests `nepstarAdmin/backend/tests/unit/test_oss_service.py` (mock `oss2`): `put_object` builds `health/products/{uuid}.{ext}` key on bucket `nepstar`, returns public URL, propagates failures
- [x] T027 [P] [US2] Write failing API contract tests `nepstarAdmin/backend/tests/api/test_health_products.py` (ASGI client; **monkeypatch/override the OSS upload dependency** so tests need no live OSS): list/detail/create/update/delete guards + upload endpoint success and invalid-type error envelopes
- [x] T028 [P] [US2] Write failing FE component test `nepstarAdmin/frontend/src/views/health/__tests__/ProductImageUploader.spec.ts` (stub upload API): preview order, remove, sort_order emission, invalid type/size rejected

### Implementation for User Story 2

- [x] T029 [P] [US2] Create `SAProduct` + `SAProductImage` ORM models in `nepstarAdmin/backend/app/models/new/sa_product.py` per `data-model.md` (product holds `cover_url`, `detail_html` LONGTEXT; image holds `image_url`, `sort_order`, index `idx_product`)
- [x] T030 [P] [US2] Create product schemas in `nepstarAdmin/backend/app/schemas/product.py` (create/update with `images: list[{url, sort_order}]`, detail response)
- [x] T031 [P] [US2] Implement `oss_service` in `nepstarAdmin/backend/app/services/oss_service.py` (`oss2` client from `Settings` OSS_* fields; `upload_image(file_bytes, ext) -> public url`; key namespace `health/products/`; never log credentials)
- [x] T032 [US2] Implement `product_service` in `nepstarAdmin/backend/app/services/product_service.py` (paged list w/ keyword, create/update requiring ≥1 image and replacing the image set delete-then-insert with cover recompute, delete guard) — depends T029, T031
- [x] T033 [US2] Implement `nepstarAdmin/backend/app/api/products.py` (`APIRouter(prefix="/products")`: list/detail/create/update/delete + `POST /upload-image` reading `UploadFile`, validating MIME/size, calling `oss_service`) and register in `nepstarAdmin/backend/app/main.py`
- [x] T034 [US2] Add `product.*` backend i18n keys under `nepstarAdmin/backend/app/i18n/` per `contracts/products.md`
- [x] T035 [US2] Extend `nepstarAdmin/frontend/src/api/health.ts` with product functions incl. `uploadImage(file)` (multipart `FormData` to `/products/upload-image`)
- [x] T036 [US2] Add `health.product.*` keys to `nepstarAdmin/frontend/src/i18n/zh-CN.json`, `en.json`, `es.json`
- [x] T037 [US2] Implement `ProductList.vue` in `nepstarAdmin/frontend/src/views/health/ProductList.vue` (search + paged `el-table` with cover thumbnail + name + status, delete `el-popconfirm`, open edit dialog)
- [x] T038 [US2] Implement `ProductImageUploader.vue` in `nepstarAdmin/frontend/src/views/health/ProductImageUploader.vue` (`el-upload` to `uploadImage` with `accept=image/*`, per-file/per-count limits, thumbnails preview, reorder + remove emitting ordered `images`)
- [x] T039 [US2] Implement `ProductEditDialog.vue` in `nepstarAdmin/frontend/src/views/health/ProductEditDialog.vue` (props `visible/row`, emits `saved`; form = name/description + `ProductImageUploader` + wangEditor `detail_html`; validation ≥1 image; save create/update) — depends T037, T038, T035
- [x] T040 [US2] Register route `/health/products` → `ProductList.vue` in `nepstarAdmin/frontend/src/router/index.ts`
- [x] T041 [US2] Make US2 tests green (backend unit + API with OSS stubbed, FE uploader test); run FE lint; fix until passing

**Checkpoint**: US2 functional & independently verified. Commit: `feat(health): products CRUD + OSS image upload + rich detail`.

---

## Phase 5: User Story 3 - 配置健康方案并关联商品与指标 / 方案管理 (Priority: P2)

**Goal**: Admin manages health plans linking **multiple products** (ordered) and indicators at **L1 or L2 granularity, strict precise** (ticking an L1 does not include its children); dedup; plan status independent of associations; delete cascades own junctions. Backend `GET/POST/PUT/DELETE /api/v1/plans` (contracts/plans.md); FE 方案管理 page + edit dialog.

**Independent Test**: Login → 方案管理 (indicators + ≥1 product pre-seeded): create plan picking 2 products + L1 `HT001` and L2 `HT0011`, detail shows exactly those (no auto-included siblings), re-tick dedups, delete removes associations; list shows counts. Depends on catalog data existing (can be seeded via US1/US2 flows).

### Tests for User Story 3 (REQUIRED — write first, confirm FAIL before implementation)

- [x] T042 [P] [US3] Write failing unit tests `nepstarAdmin/backend/tests/unit/test_plan_service.py` (mock `db.execute`): create stores ordered `product_ids` + mixed L1/L2 `indicator_ids`, update replaces associations delete-then-insert, dedup duplicates, unknown product/indicator → `plan.*` errors, empty associations allowed, delete removes own junctions first, detail derives `level` from `parent_id` (L1 doesn’t include children)
- [x] T043 [P] [US3] Write failing API contract tests `nepstarAdmin/backend/tests/api/test_health_plans.py` (ASGI client + `admin_headers`): list with `product_count`/`indicator_count`, detail grouping/derived level, create/update/delete
- [x] T044 [US3] Write failing FE component test `nepstarAdmin/frontend/src/views/health/__tests__/PlanEditDialog.spec.ts` (stub `api/health`, render indicator tree from fixture): strict checkbox mapping (L1 check does NOT check its L2 children), dedup on repeat selection, product order preserved, save emits expected `product_ids`/`indicator_ids`

### Implementation for User Story 3

- [x] T045 [P] [US3] Create `SAPlan`, `SAPlanProduct`, `SAPlanIndicator` ORM models in `nepstarAdmin/backend/app/models/new/sa_plan.py` per `data-model.md` (junctions with `uk_plan_product (plan_id, product_id)` and `uk_plan_indicator (plan_id, indicator_id)`)
- [x] T046 [P] [US3] Create plan schemas in `nepstarAdmin/backend/app/schemas/plan.py` (create/update with `product_ids`, `indicator_ids`; list item with counts; detail with `products[]` + `indicators[]` incl. derived `level`, `parent_name`, `status`)
- [x] T047 [US3] Implement `plan_service` in `nepstarAdmin/backend/app/services/plan_service.py` (paged list w/ counts, detail assembly grouping indicators under L1, create/update replace-junctions delete-then-insert with flush + dedup + existence checks, delete cascading own junctions) — depends T045, and reads `sa_product`/`sa_indicator` for detail
- [x] T048 [US3] Implement `nepstarAdmin/backend/app/api/plans.py` (`APIRouter(prefix="/plans")`) and register in `nepstarAdmin/backend/app/main.py`
- [x] T049 [US3] Add `plan.*` backend i18n keys under `nepstarAdmin/backend/app/i18n/` per `contracts/plans.md`
- [x] T050 [US3] Extend `nepstarAdmin/frontend/src/api/health.ts` with plan functions (`list`, `detail`, `create`, `update`, `remove`)
- [x] T051 [US3] Add `health.plan.*` keys to `nepstarAdmin/frontend/src/i18n/zh-CN.json`, `en.json`, `es.json`
- [x] T052 [US3] Implement `PlanList.vue` in `nepstarAdmin/frontend/src/views/health/PlanList.vue` (search + paged `el-table` with product/indicator counts, status toggle, delete `el-popconfirm` with confirm, open edit dialog)
- [x] T053 [US3] Implement `PlanEditDialog.vue` in `nepstarAdmin/frontend/src/views/health/PlanEditDialog.vue` (props `visible/row`, emits `saved`; product multi-select from `/products` list keeping selection order; indicator picker rendered from `/indicators/tree` with **strict node checkboxes** — selecting an L1 node checks only that node; disabled/stopped items shown with 已停用 tag and unselectable per spec edge cases) — depends T052, T050, T051
- [x] T054 [US3] Register route `/health/plans` → `PlanList.vue` in `nepstarAdmin/frontend/src/router/index.ts`
- [x] T055 [US3] Make US3 tests green (backend unit + API, FE `PlanEditDialog` test); fix until passing

**Checkpoint**: US3 functional & independently verified. Commit: `feat(health): plans CRUD + product/indicator associations`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-module quality, validation against spec Success Criteria (SC-001…SC-007), and cleanup. Depends on US1–US3 complete.

- [x] T056 [P] Run lint/format clean: `.venv/Scripts/ruff.exe check .` (and `ruff format --check`) from `nepstarAdmin/backend/`; `npm run lint` and `npm run format` from `nepstarAdmin/frontend/`; fix violations
- [x] T057 [P] Run the full suites and make them green: `.venv/Scripts/python.exe -m pytest` from `nepstarAdmin/backend/` and `npm test` from `nepstarAdmin/frontend/`; fix regressions  
  - *结果*：健康模块用例全绿（后端 38、前端 15）；全套件仍存在 36 个**既有**失败（customers/devices/reports/dashboard/pii 等，与健康模块无关，已用无 DB 的 test_pii 证实）。
- [x] T058 Execute the manual smoke flow in `quickstart.md` end-to-end against the dev environment (configure `.env` `OSS_ENDPOINT`/`OSS_BUCKET=nepstar` first), verifying spec SC-001…SC-007 (incl. indicator-tree search <1 s, delete guards, plan detail matches saved associations); record results
  - *运行期冒烟（uvicorn + 真实 HTTP + 线上 nepstar，2026-09-10）*：13/13 PASS —— 菜单(/auth/me)、编码去重、树检索 16ms(<1s)、L1 含子删除拦截、封面=首图、无图拒绝、**严格关联**(勾 L1+其 L2 精确 2 条)、方案计数、被引用商品/指标删除拦截、方案删除级联；数据已清理。
  - *OSS 实测（2026-09-10，bucket `nepstar`，北京区）*：服务层上传 PASS、`POST /products/upload-image` PASS、上传结果公网可读 **SC-003 PASS**（200/内容一致）、非图片被拒 PASS；测试对象已从 bucket 删除（0 残留）。
  - ⚠️ *配置注意*：`.env` 的 `OSS_ENDPOINT` 应写 **不含 bucket 前缀**的 `oss-cn-beijing.aliyuncs.com`；写入 `nepstar.oss-cn-beijing.aliyuncs.com` 会被 oss2 拼成 `nepstar.nepstar....` 导致 `InvalidBucketName`。
- [x] T059 [P] Cross-cutting UI: confirm sidebar shows 健康管理 + 3 children in zh/en/es (labels come from `sa_menu`), breadcrumb/page titles render, empty-catalog states and stopped-item 已停用 tag behave per spec Edge Cases
- [x] T060 [P] Verify no regressions to tenant/PII code: run existing full backend test suite (`tests/`) and confirm `pii` masking paths unchanged; confirm `.env` (incl. OSS_*) never staged (`git check-ignore`)
- [x] T061 [P] Update the requirements quality checklist `specs/001-add-health-management/checklists/requirements.md` status and mark each US checklist in this file `[x]` as completed; finalize
- [ ] T062 Final commit of polish: `feat(health): module polish — lint/test green, smoke validated (SC-001..007)`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (T001–T004 parallel)
- **Foundational (Phase 2)**: Depends on Setup (config fields T003; migration T006 applies with `oss2`? no — T007 depends only on T005/T006). BLOCKS all user stories (tables + menus)
- **User Stories (Phase 3+)**:
  - **US1 (T012–T024)**: Depends on Foundational (esp. T007 migration for its API tests)
  - **US2 (T025–T041)**: Depends on Foundational + Setup (oss2, OSS config). Does NOT depend on US1 (only reads its own tables; product API tests don’t touch indicators)
  - **US3 (T042–T055)**: Depends on Foundational; **reads `sa_product` + `sa_indicator`** for validation/detail, so its API tests need those tables present (they are, from T007) — can run before US1/US2 FE exist as long as catalog rows are created via API fixtures
- **Polish (Phase 6)**: Depends on US1–US3 complete

### User Story Dependencies

- **US1 (P1)**: Standalone (indicators don’t reference products/plans)
- **US2 (P1)**: Standalone (products don’t reference indicators/plans; delete-guard code references `sa_plan_product` which exists from T007 even before US3 logic)
- **US3 (P2)**: Reads products + indicators (US1/US2 tables + APIs). Implement after US1 & US2 for cleanest manual validation

### Within Each User Story

- Tests MUST be written and confirmed FAIL before implementation (constitution Principle I)
- Models → schemas/services → routers/endpoints → FE api → FE page/dialog → route → green
- Backend main.py `include_router` registration is sequential per story (same file): T017 → T033 → T048 in order, never parallel
- `api/health.ts`, `router/index.ts`, and each of the 3 i18n JSONs are edited across stories — run stories in US1→US2→US3 order or merge carefully; the [P] tags above are safe **within** a story only for the marked items

### Parallel Opportunities

- All Setup tasks T001–T004 in parallel
- Foundational T005/T006 (files differ) then T007; T008/T009 parallel; T010 after T009
- Within US1: T012+T013 (tests) parallel; T014+T015 parallel; T016→T017 chain
- Within US2: T025+T026+T027+T028 (tests) parallel; T029+T030+T031 parallel; T032→T033 chain
- Within US3: T042+T043 (tests) parallel, T044 after fixtures understood; T045+T046 parallel; T047→T048 chain
- US1/US2/US3 can run in parallel **after** Foundational if different people own each, merging the shared `api/health.ts`/`router/index.ts`/i18n files deliberately
- Polish tasks T056–T061 are largely [P]

---

## Parallel Example: User Story 2

```bash
# Launch all tests for US2 together (fail first):
Task: "unit tests test_product_service.py (nepstarAdmin/backend/tests/unit/)"
Task: "unit tests test_oss_service.py (nepstarAdmin/backend/tests/unit/)"
Task: "API contract tests test_health_products.py (nepstarAdmin/backend/tests/api/)"
Task: "FE test ProductImageUploader.spec.ts (nepstarAdmin/frontend/src/views/health/__tests__/)"

# Launch all models/schemas/services for US2 together:
Task: "models sa_product.py (nepstarAdmin/backend/app/models/new/)"
Task: "schemas product.py (nepstarAdmin/backend/app/schemas/)"
Task: "oss_service.py (nepstarAdmin/backend/app/services/)"

# Then implement sequentially:
Task: "product_service.py → api/products.py → register in main.py"
Task: "api/health.ts → ProductList.vue → ProductImageUploader.vue → ProductEditDialog.vue → router"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational — blocks everything)
2. Complete Phase 3 (US1 指标管理)
3. **STOP and VALIDATE** via US1 Independent Test + quickstart indicator flow
4. Deploy/demo if ready (indicators catalog alone is shippable value)

### Incremental Delivery

1. Setup + Foundational → tables + menus ready
2. US1 (indicators) → test independently → commit → demo (MVP)
3. US2 (products + OSS upload) → test independently → commit
4. US3 (plans) → test independently → commit
5. Phase 6 polish → full suite green + smoke SC-001…SC-007 → final commit

### Parallel Team Strategy

1. Team does Setup + Foundational together
2. After Foundational: A→US1, B→US2, C→US3 (US3 staffed knowing US1/US2 schemas from T007); merge shared `api/health.ts`, `router/index.ts`, i18n files at story boundaries
3. Stories integrate & are validated independently; then Phase 6

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to a spec user story (US1/US2/US3) for traceability
- Verify tests FAIL before implementing (red), then make green (constitution Principle I)
- Backend tests that are API/integration style hit the live `nepstar` RDS (existing convention) — never point them at prod data you can’t write to; use unique codes/names per run
- OSS upload API/unit tests must stub `oss2`/the upload dependency — no live OSS calls in tests
- Commit after each story/logical group (see checkpoints); do not commit `.env`
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file parallel conflicts (see Within Each User Story), cross-story hidden dependencies

---

## Post-Implementation Fixes

- [x] T063 [US2] **Fix**: wangEditor 图文详情插入的图片改为经后端上传 OSS（原先默认 base64 内嵌，`detail_html` 会膨胀且不入 `nepstar`。新增 `nepstarAdmin/frontend/src/views/health/richTextImageUpload.ts`（`customUploadImage` → `uploadProductImage` → `insertFn(url)`），在 `nepstarAdmin/frontend/src/views/health/ProductEditDialog.vue` 配置 `MENU_CONF.uploadImage.customUpload` 且 `base64LimitSize: 0`、工具栏 `excludeKeys: ['group-video']`；测试 `nepstarAdmin/frontend/src/views/health/__tests__/richTextImageUpload.spec.ts`（3 例）。
