# Implementation Plan: Health Management Module (健康管理)

**Branch**: `001-add-health-management` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-add-health-management/spec.md`

**Note**: This plan is filled in by the `/speckit-plan` command and covers Phases 0–1 (research, data model, contracts, quickstart). Tasks are generated later by `/speckit-tasks`.

## Summary

Add a **Health Management (健康管理)** module to the existing `nepstarAdmin` admin (FastAPI backend + Vue 3 frontend, trilingual UI, MySQL schema `nepstar`). The module has three management sub-features behind a new top-level "健康管理" menu:

1. **指标管理** — two-level health indicator catalog. Level-1 (category) and level-2 (item) indicators, each with a **globally unique indicator code**; tree UI; delete guards (L1 with children, or any node referenced by a plan).
2. **商品管理** — product catalog with name, text description, **rich-text (图文) detail**, **cover + multiple images**. Images upload through the backend to **Aliyun OSS bucket `nepstar`** (`oss2` proxy; returns public URLs). Delete guarded when referenced by a plan.
3. **方案管理** — health plans linking **multiple products** (ordered) and a set of indicators at **level-1 or level-2 granularity** (strict precise association — picking an L1 does not include its children). Delete guarded only by confirm; plan deletion cascades its own associations.

Confirmed scope decisions (spec Clarifications): catalog is **global/unified** (no org scoping); product **excludes** price/stock/规格/category; names/descriptions are **Chinese-only** in v1; **no** customer-facing consumption or report-indicator auto-recommendation in v1.

Confirmed architecture decisions (user-approved during planning, Constitution III): product images upload via **backend proxy using `oss2`**; product rich-text detail uses **wangEditor** (frontend dependency).

## Technical Context

**Language/Version**: Python 3.11+ (FastAPI, SQLAlchemy 2.0 async + aiomysql, Pydantic v2); TypeScript + Vue 3.4 / Element Plus 2.7 / vue-router 4 / Pinia 2 / vue-i18n 9 (zh-CN/en/es).

**Primary Dependencies**:
- Backend: existing stack; **+ `oss2`** (new, for Aliyun OSS uploads).
- Frontend: existing stack; **+ `@wangeditor/editor` and `@wangeditor/editor-for-vue`** (new, for 图文详情 rich text). Test deps (vitest/@vue/test-utils/jsdom) already installed but unwired — add a `test` block to `vite.config.ts`.

**Storage**: MySQL (Aliyun RDS) — all writable tables live in schema `nepstar` (`NEPSTAR_SCHEMA`), prefixed `sa_`, `BIGINT` autoincrement PK `id`, `created_at/updated_at DATETIME`, `status TINYINT`, utf8mb4, **no FK constraints** (integrity enforced in service layer). Product images live on Aliyun OSS bucket `nepstar` (public-read URLs persisted in DB).

**Testing**:
- Backend: `pytest` (config in `backend/pyproject.toml`, `asyncio_mode=auto`, `testpaths=["tests"]`). Unit tests mock `db.execute` via `AsyncMock`; API tests use in-process `httpx.AsyncClient(ASGITransport)` + overridden `get_db` and hit the **live RDS** — new tests must follow the existing pattern and state which kind they are. Commands (from `backend/`): `.venv/Scripts/python.exe -m pytest`, `--cov=app`, `.venv/Scripts/ruff.exe check .`.
- Frontend: `vitest` + `@vue/test-utils` (devDeps present, no tests yet). Add `test: { environment: 'jsdom' }` to `vite.config.ts`. Commands (from `frontend/`): `npm test`, `npm run lint`.

**Target Platform**: Linux server (uvicorn) admin SPA; modern browsers.

**Project Type**: Full-stack web application (existing `nepstarAdmin` monorepo: `backend/` + `frontend/`) — new module follows existing conventions; no new top-level projects.

**Performance Goals**: Catalog is small (indicators/products/plans, hundreds of rows). Level-1/2 indicator tree loads and keyword search completes in <1 s (spec SC-005); plan detail renders instantly; image thumbnails sized to keep list views light.

**Constraints**:
- MySQL 5.6+ compatible DDL (see `schema-sa.sql` conventions); no DB FK constraints → service-layer referential guards.
- Auth: existing JWT `get_current_user` on every new endpoint (matches `roles`/`users`/`devices` routers); UI gating via `sa_menu` + admin startup re-grant. No per-org scoping (global catalog).
- Content is single-language (Chinese) in v1; backend/frontend UI copy remains trilingual.
- Concurrency: last-write-wins on updates; unique keys (`uk_*`) protect duplicate associations/codes; duplicate insert errors surfaced as business errors.
- Secrets stay server-side: OSS AccessKeys read from `config.py` `Settings` via `.env` only.

**Scale/Scope**: 3 sub-modules; ~6 new `nepstar` tables + 3 routers; a new top-level menu + 3 sub-menus; upload endpoint; wangEditor field. v1 admin-only management, no external consumer.

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Status | Notes |
|---|---|---|
| I. TDD (non-negotiable) | ✅ Pass | Plan mandates red-green per requirement. Backend test harness exists; FE harness is a config-only addition (jsdom) using already-installed devDeps — no runtime change. Each service/endpoint/component task pairs with tests. |
| II. Scope Discipline | ✅ Pass | Only requested functionality. Product excludes e-commerce fields; no org scoping; no report auto-recommendation; no multilingual content (spec FR-003/FR-004 + Clarifications). |
| III. Architecture Change Approval | ✅ Pass | Two new dependencies approved by user 2026-09-09 during planning: backend `oss2` (image upload proxy); frontend wangEditor (rich text). New DB tables/menus follow the repo's established migration+seed pattern. |
| IV. Clarify First | ✅ Pass | Spec clarifications recorded under `## Clarifications`; 5 decisions resolved interactively (3 at specify, 2 at clarify); 2 architecture choices approved at plan time. No open unknowns. |

Re-check after Phase 1 design: ✅ no unjustified violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-add-health-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
├── checklists/          # requirements quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
nepstarAdmin/backend/
├── sql/
│   ├── schema-sa.sql                  # [edit] append DDL for 6 new sa_* tables (doc/bootstrap)
│   └── seed-sa.sql                    # [edit] append idempotent INSERTs for 4 health menus
├── alembic/
│   └── versions/
│       └── 003_add_health_module.py   # [new] migration creating the 6 tables (mirror DDL)
├── app/
│   ├── main.py                        # [edit] import+include 3 routers; startup: seed_health_menus before seed_admin_role
│   ├── config.py                      # [edit] add OSS_BUCKET/OSS_ENDPOINT/OSS_ACCESSKEY_ID/OSS_ACCESSKEY_KEY fields
│   ├── models/new/
│   │   ├── sa_indicator.py            # [new] SAIndicator (L1+L2 self-ref parent_id)
│   │   ├── sa_product.py              # [new] SAProduct + SAProductImage
│   │   └── sa_plan.py                 # [new] SAPlan + SAPlanProduct + SAPlanIndicator (junctions)
│   ├── schemas/
│   │   ├── indicator.py               # [new] create/update/response (nested tree node)
│   │   ├── product.py                 # [new] create/update/response + image schema
│   │   └── plan.py                    # [new] create/update/detail response
│   ├── services/
│   │   ├── health_seed.py             # [new] seed_health_menus(db) idempotent
│   │   ├── indicator_service.py       # [new]
│   │   ├── product_service.py         # [new]
│   │   ├── plan_service.py            # [new]
│   │   └── oss_service.py             # [new] put_object(upload) -> public url
│   └── api/
│       ├── indicators.py              # [new] APIRouter(prefix="/indicators")
│       ├── products.py                # [new] APIRouter(prefix="/products") incl. /upload-image
│       └── plans.py                   # [new] APIRouter(prefix="/plans")
└── tests/
    ├── unit/test_indicator_service.py # [new]
    ├── unit/test_product_service.py   # [new]
    ├── unit/test_plan_service.py      # [new]
    └── api/test_health_indicators.py  # [new] (+ products, plans — API/integration, live DB)

nepstarAdmin/frontend/
├── vite.config.ts                      # [edit] add test block { environment: 'jsdom' }
├── package.json                        # [edit] + @wangeditor/editor, @wangeditor/editor-for-vue
├── src/
│   ├── router/index.ts                 # [edit] 3 health routes (lazy import, requiresAuth)
│   ├── api/health.ts                   # [new] typed calls via '@/api/client'
│   ├── i18n/zh-CN.json / en.json / es.json   # [edit] add top-level "health" + "menu" block entries
│   ├── components/SidebarMenu.vue      # (no change — menu auto-renders from sa_menu rows)
│   └── views/health/
│       ├── IndicatorList.vue           # [new] L1/L2 tree table + inline add/edit dialog
│       ├── ProductList.vue             # [new] list (cover thumb + name), search, paging
│       ├── ProductEditDialog.vue       # [new] form: name/desc + ImageUploader + wangEditor 图文详情
│       ├── ProductImageUploader.vue    # [new] el-upload → POST /products/upload-image; preview/order/remove
│       ├── PlanList.vue                # [new] list (counts), search, paging
│       └── PlanEditDialog.vue          # [new] name/desc + product multi-pick(ordered) + indicator strict tree pick
└── src/__tests__ or colocated *.spec.ts # [new] component tests (jsdom) for dialogs/uploader
```

**Structure Decision**: Extend the existing two-project `nepstarAdmin` layout (backend + frontend) in place — no new top-level project, no microservice split. Backend mirrors the `roles` CRUD + `device` patterns (router in `app/api/`, schemas in `app/schemas/`, service in `app/services/`, ORM in `app/models/new/`, mounted under `/api/v1`, `ApiResponse` envelope). Frontend mirrors the system-module list pages (toolbar + `el-table` + `el-popconfirm` delete + `el-pagination`) and the device separate-`*EditDialog` pattern (props `visible/row`, emits `saved`) so components are unit-testable with `@vue/test-utils`. Tables/menus follow the repo's `schema-sa.sql` + alembic + `seed-sa.sql` conventions.

## Complexity Tracking

> No Constitution violations to justify — table intentionally empty. The two new dependencies (`oss2`, wangEditor) were each user-approved; the alternative (client-side STS direct upload, plain-textarea detail) was rejected because it either broadened the key-handling surface or dropped an agreed requirement.
