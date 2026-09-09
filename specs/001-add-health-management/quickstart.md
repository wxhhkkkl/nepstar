# Quickstart — Health Management Module

Dev commands, prerequisites, and how to verify the feature while implementing. **Run commands from the directory stated** (pytest `testpaths` and ruff are cwd-sensitive).

## Repo layout (relevant dirs)

```text
nepstarAdmin/backend/    FastAPI app  (app/, sql/, alembic/, tests/)
nepstarAdmin/frontend/   Vue 3 app     (src/, vite.config.ts)
```

## Prerequisites / environment

- `backend/.env` must contain (values never committed):
  `OSS_ACCESSKEY_ID`, `OSS_ACCESSKEY_KEY`, and the new `OSS_ENDPOINT` (region endpoint, e.g. `oss-cn-hangzhou.aliyuncs.com`) and `OSS_BUCKET=nepstar`. Bucket must be **public-read** for URLs to render in list/detail (spec SC-003).
- New backend dep: `oss2` (add to `pyproject.toml` + `requirements.txt`, then `pip install`).
- New frontend deps: `@wangeditor/editor`, `@wangeditor/editor-for-vue` (`npm install`).
- Schema/db: run the new alembic migration (`003_add_health_module`) to create the 6 tables on `nepstar`; the startup seed `seed_health_menus` inserts the 4 menu rows and the existing `seed_admin_role` re-grant makes them visible to `admin` on next boot. `schema-sa.sql`/`seed-sa.sql` updated in the same commit for fresh bootstrap/doc.

## Backend

```bash
cd nepstarAdmin/backend
# unit + api tests (existing harness; api/integration tests hit the live RDS and need the seeded admin + new tables)
.venv/Scripts/python.exe -m pytest
# coverage of app code
.venv/Scripts/python.exe -m pytest --cov=app
# lint
.venv/Scripts/ruff.exe check .
```

TDD note (Constitution I): write the failing test first (red), implement, then confirm green. Service unit tests mock `db.execute` (`tests/unit/test_user_service.py` is the reference); API tests reuse the in-process ASGI client + `admin_headers` fixture from `tests/conftest.py`.

## Frontend

```bash
cd nepstarAdmin/frontend
npm install              # after adding wangEditor deps
npm test                 # vitest run (jsdom wired via vite.config.ts test block)
npm run lint             # eslint
npm run format           # prettier
```

`npm run dev` serves the app (Vite, http://localhost:5173) proxying `/api/v1` to the backend at http://localhost:8000 (see `src/api/client.ts`).

## Manual smoke flow

1. Start backend, log in as `admin`. Sidebar shows **健康管理 ▸ 指标管理/商品管理/方案管理**.
2. 指标管理: add L1 "体重管理" code `HT001`; add L2 "体脂率" code `HT0011`; confirm a duplicate `HT001` is rejected; confirm L1 with children cannot be deleted.
3. 商品管理: new product with 1+ uploaded images (→ OSS `nepstar`), a wangEditor 图文详情; verify cover + order; verify `.exe`/oversized upload rejected; verify delete guard after it's referenced.
4. 方案管理: new plan linking 2 products + indicator `HT001` (level 1) and `HT0011` (level 2); verify detail shows exactly those (strict — HT001's other children absent); dedup on re-tick; delete plan with confirm.
5. Confirm indicator/product referenced by a plan cannot be deleted; plan list shows product/indicator counts; a stopped referenced item shows 已停用.

## Acceptance targets (spec Success Criteria)

SC-001…SC-007 map to the smoke flow above: code uniqueness always enforced (SC-002), every saved product has ≥1 viewable image (SC-003), plan detail matches saved associations with no dupes/order intact (SC-004), indicator tree load+search <1 s (SC-005), the three delete guards always fire (SC-006), and concurrent edits leave no dup rows (SC-007, unique keys).
