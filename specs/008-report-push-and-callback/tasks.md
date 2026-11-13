---
description: "Task list for 检测报告推送、回调与主动拉取"
---

# Tasks: 检测报告推送、回调与主动拉取

**Input**: Design documents from `/specs/008-report-push-and-callback/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: REQUIRED by the project constitution (Principle I: TDD). Write each test first, run it, confirm it FAILS, then implement.

**Organization**: Tasks are grouped by user story so each can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependency)
- **[Story]**: US1 / US2 / US3 / US4 from [spec.md](spec.md)
- All paths are relative to the canonical repository root.

## Path Conventions

- Backend: `nepstarAdmin/backend/`
- Admin frontend: `nepstarAdmin/frontend/`
- Out of scope: `reportFront/`, `KH503machine/`, `KH503/`, `oldbackend/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add configuration, persistence, schemas, and router skeleton.

- [X] T001 Add `HAIXIN_*` settings to `nepstarAdmin/backend/app/config.py` exactly as listed in [data-model.md](data-model.md) §3 (push URL/key/secret/enabled/method/timeout/field map, sign tolerance, pull day/page limits)
- [X] T002 Create the `sa_report_push_log` ORM model in `nepstarAdmin/backend/app/models/new/sa_report_push_log.py` with the fields, `uk_push_dedupe` unique key, and secondary indexes from [data-model.md](data-model.md) §2
- [X] T003 Create Alembic revision `010_report_push_log` in `nepstarAdmin/backend/alembic/versions/010_report_push_log.py` (`down_revision = "009"`, nepstar target assertion like 006, table + indexes, reversible downgrade)
- [X] T004 [P] Add Pydantic request/response models in `nepstarAdmin/backend/app/schemas/report_push.py` (callback payload with passthrough fields, push record item, push response, pull query/record)
- [X] T005 Create `nepstarAdmin/backend/app/api/report_push.py` with an empty `router` and register it in `nepstarAdmin/backend/app/main.py` under `/api/v1` (public routes, no JWT dependency)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Signature, outbound delivery, persistence, lookup, and startup hooks shared by all stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Signature

- [X] T006 [P] Write failing unit tests in `nepstarAdmin/backend/tests/unit/test_haixin_sign.py`: document golden case (`F7EB…` → `5F36…`), ASCII ordering, empty/`None`/`sign` exclusion, byte-param exclusion, constant-time compare behavior
- [X] T007 Implement `nepstarAdmin/backend/app/utils/haixin_sign.py` (`build_sign`, `verify_sign`, timestamp tolerance helper) until T006 passes

### Outbound delivery

- [X] T008 [P] Write failing unit tests in `nepstarAdmin/backend/tests/unit/test_report_push_delivery.py` with a mocked `httpx` client: form encoding, default field names, `HAIXIN_PUSH_FIELD_MAP` override, success when `code` is `"0"`/`0`, failure mapping for config-missing/disabled/timeout/network/rejected/bad-response, response summary truncation, and captured logs containing no secret/PII
- [X] T009 Implement `build_push_params` + `deliver_report` in `nepstarAdmin/backend/app/services/report_push_service.py` until T008 passes; emit structured logs with `report_code`/trigger/result/duration/failure_reason and never secret or PII
- [X] T010 Implement `fetch_report_for_push` and `assert_report_in_user_scope` in `nepstarAdmin/backend/app/services/report_push_service.py` (join `inspect_base`/`ne`, `dept_id` filter, reuse `report_service._build_report_url`, reuse `get_user_authorized_orgs` + `SADeviceOrg`, admin bypass)
- [X] T011 Implement push-record persistence in `nepstarAdmin/backend/app/services/report_push_service.py`: create manual/auto, `dedupe_key` conflict handling (`pending`/`success`/`skipped` → duplicate; `failed` records already have NULL `dedupe_key`), on failure clear `dedupe_key` in the same transaction, `skipped` write, `finished_at`/failure reason updates
- [X] T012 [P] Write failing structural test `nepstarAdmin/backend/tests/unit/test_report_push_model.py` asserting columns, unique index, allowed status values, and `dedupe_key` nullable behavior
- [X] T013 Implement startup maintenance in `nepstarAdmin/backend/app/main.py` + `report_push_service.py`: mark `pending` records older than 5 minutes as `failed`/`delivery.interrupted`; keep task references on `app.state` and cancel on shutdown

### Menu

- [X] T014 Implement `nepstarAdmin/backend/app/services/report_push_menu.py` and call it in `app/main.py` startup before `seed_admin_role`: idempotently insert `/report/push-records` as a sibling of `/report/list` (`name_zh/en/es`, icon `tickets`, `sort_order + 1`); if `/report/list` is absent, create a top-level “推送记录” menu instead of skipping

**Checkpoint**: Signature, delivery, persistence, lookup, menu, and startup hooks are ready.

---

## Phase 3: User Story 1 — 后台人工再次推送 (Priority: P1) 🎯 MVP

**Goal**: 报告列表行内“再次推送”，同步等待客户接口并即时反馈，留存推送记录。

**Independent Test**: 在 `/report/list` 对一条有效报告点击“再次推送”；mock 客户接口收到一次表单请求；页面显示成功或可读失败原因；推送记录新增一条 `manual`。

### Tests for User Story 1

- [X] T015 [P] [US1] Write failing API tests in `nepstarAdmin/backend/tests/api/test_report_push.py`: auth required; success creates `manual/success` record; delivery failure returns `code=200` + `data.status=failed`; 404/403/409 preconditions; 5-second timeout path; response contains no secret/PII

### Implementation for User Story 1

- [X] T016 [US1] Implement `POST /api/v1/reports/{report_id}/push` in `nepstarAdmin/backend/app/api/reports.py` (`check_permission`, scope check, synchronous delivery, envelope per [contracts/admin-report-push.md](contracts/admin-report-push.md)) until T015 passes
- [X] T017 [P] [US1] Add `pushReport(reportId)` to `nepstarAdmin/frontend/src/api/reports.ts`
- [X] T018 [US1] Add the “再次推送” row action with per-row loading and success/failure `ElMessage` in `nepstarAdmin/frontend/src/views/report/ReportList.vue`; widen the action column as needed
- [X] T019 [P] [US1] Add `report.push*` keys to `nepstarAdmin/frontend/src/i18n/zh-CN.json`, `en.json`, and `es.json`
- [X] T020 [P] [US1] Add Vitest coverage in `nepstarAdmin/frontend/tests/report-push.spec.ts` for `pushReport` URL/method and error mapping
- [ ] T021 [US1] Run §4.2–4.3 of `specs/008-report-push-and-callback/quickstart.md` with the local mock partner; confirm success and timeout feedback

**Checkpoint**: US1 is independently usable and leaves traceable `manual` records.

---

## Phase 4: User Story 2 — 设备回调自动推送 (Priority: P1)

**Goal**: 设备回调立即应答，后台异步定位报告并向客户推送；同一 `reportId` 不重复投递。

**Independent Test**: 向 `/report-callback/device` POST 一次合法载荷，<500ms 返回 `accepted`；重复提交同一载荷不再投递；mock 客户接口只收到一次请求；报告不存在时推送记录为 `failed`。

### Tests for User Story 2

- [X] T022 [P] [US2] Write failing API tests in `nepstarAdmin/backend/tests/api/test_report_callback.py`: valid payload accepted quickly, duplicate payload no new delivery, missing `reportId`/`deviceId` → `callback.invalid`, unknown report → `failed/report.not_found`, invalid status → `failed/report.invalid`, existing `success` → no new record, manual success then callback → `skipped`, existing `failed` → a new record is created while the old one is retained, failed attempts reaching `HAIXIN_AUTO_MAX_FAILED_ATTEMPTS` → duplicate with no new record, data source unavailable → `failed/report.unavailable`, stale `pending` → `failed/delivery.interrupted`, 10s/20s/30s lookup retries with a fake clock
- [X] T023 [US2] Write failing test in `nepstarAdmin/backend/tests/api/test_report_callback.py` for callback payload ignoring extra fields and never exposing `appCustomerInfo` in records/logs (same file as T022; run sequentially)

### Implementation for User Story 2

- [X] T024 [US2] Implement `handle_device_callback` + `_deliver_auto` in `nepstarAdmin/backend/app/services/report_push_service.py`: reject new attempts once `HAIXIN_AUTO_MAX_FAILED_ATTEMPTS` is reached, lookup retries, `skipped` check, async delivery, failure reasons and `dedupe_key` cleanup, no PII persistence
- [X] T025 [US2] Implement `POST /api/v1/report-callback/device` in `nepstarAdmin/backend/app/api/report_push.py` (no auth dependency, validate identifiers, create record, respond immediately) until T022/T023/T024 pass
- [X] T026 [US2] Schedule and track callback tasks in `nepstarAdmin/backend/app/main.py` (`app.state` set + shutdown cancel); ensure task exceptions cannot break the event loop
- [ ] T027 [US2] Run §4.1 of `specs/008-report-push-and-callback/quickstart.md` against the mock partner; confirm fast ACK, single delivery, duplicate replay produces no second request

**Checkpoint**: US2 delivers automatically and is idempotent under replayed callbacks.

---

## Phase 5: User Story 3 — 客户主动拉取 (Priority: P2)

**Goal**: 客户以海王签名按时间范围拉取有效报告，获得 `code="0"` 与 JSON 字符串 `data`。

**Independent Test**: 用正确签名请求 7 天范围，翻页取回全部有效报告且字段完整（含完整姓名/手机号）；篡改参数或过期时间戳返回 `"401"`；超过 31 天返回 `"400"`。

### Tests for User Story 3

- [X] T028 [P] [US3] Write failing tests in `nepstarAdmin/backend/tests/api/test_report_pull.py`: golden signature accepted, bad appKey/sign/timestamp/version → `"401"`, old and new appKeys both accepted during rotation (via `HAIXIN_APP_KEYS`), removed appKey → `"401"`, invalid/over-31-day range → `"400"`, `data` is a JSON string, full `name`/`mobile`, `status=1` only, pagination no duplicates/loss, data source unavailable → `"503"`, no stack/internal ids, captured logs contain no secret/response body/PII
- [X] T029 [P] [US3] Write failing unit test for `report_pull_service` date-boundary handling (GMT+8 inclusive, only-one-date defaults) in `nepstarAdmin/backend/tests/unit/test_report_pull_service.py`

### Implementation for User Story 3

- [X] T030 [US3] Implement `nepstarAdmin/backend/app/services/report_pull_service.py`: default/max range, page size cap, `dept_id` + `status=1` + `inspect_date` query, descending order, full PII row mapping, `report_url`
- [X] T031 [US3] Implement `GET /api/v1/open/reports` in `nepstarAdmin/backend/app/api/report_push.py`: resolve secret from the merged `HAIXIN_APP_KEYS` + primary map, verify signature/timestamp/version, string-code envelope, `json.dumps(..., ensure_ascii=False)` data, no report data on failure; log appKey/result/duration/failure reason without secret, response body, or PII
- [ ] T032 [US3] Run §4.4 of `specs/008-report-push-and-callback/quickstart.md`; confirm success, tamper rejection, and pagination

**Checkpoint**: US3 is independently usable by the partner with its own credentials.

---

## Phase 6: User Story 4 — 推送记录查看与补发 (Priority: P2)

**Goal**: 独立“推送记录”页面，按条件筛选并重发失败记录。

**Independent Test**: 制造一条成功和一条失败记录，在 `/report/push-records` 按“失败”筛选并重发；新增一条 `manual` 记录，原记录保留；非授权账号被拒绝。

### Tests for User Story 4

- [X] T033 [US4] Write failing API tests in `nepstarAdmin/backend/tests/api/test_report_push.py`: list filters (`status`, `trigger_type`, `sn`, date range), pagination, data-scope filtering, repush creates a new manual record and preserves the original, repush of invalid report → 409 (same file as T015; run sequentially)
- [X] T034 [P] [US4] Write failing test for menu seeding idempotency in `nepstarAdmin/backend/tests/unit/test_report_push_menu.py` (creates once, sibling of `/report/list`, top-level fallback when `/report/list` is absent, admin grant occurs via `seed_admin_role`)

### Implementation for User Story 4

- [X] T035 [US4] Implement `GET /api/v1/reports/push-records` and `POST /api/v1/reports/push-records/{log_id}/repush` in `nepstarAdmin/backend/app/api/reports.py` until T033 passes; list query MUST join `inspect_base` → `sa_device_org` and apply `get_user_authorized_orgs`/admin bypass so records outside the user’s data scope are never returned
- [X] T036 [US4] Add `getPushRecords(params)` and `repushRecord(logId)` to `nepstarAdmin/frontend/src/api/reports.ts` (same file as T017; run after it)
- [X] T037 [US4] Create `nepstarAdmin/frontend/src/views/report/ReportPushLog.vue`: date range/status/trigger/SN filters, table (report, SN, trigger, time, status, reason), expandable failure reason, pager, row “重发”
- [X] T038 [US4] Add route `/report/push-records` with `permission: { menuPath: '/report/push-records', action: 'view' }` in `nepstarAdmin/frontend/src/router/index.ts`
- [X] T039 [US4] Add `report.pushLog*` keys to `nepstarAdmin/frontend/src/i18n/zh-CN.json`, `en.json`, and `es.json` (same files as T019; run after it)
- [X] T040 [US4] Extend `nepstarAdmin/frontend/tests/report-push.spec.ts` with filter-param mapping and repush call assertions (same file as T020; run after it)
- [ ] T041 [US4] Run §4.5 of `specs/008-report-push-and-callback/quickstart.md`; verify menu appears, filters work, repush creates a new record, unauthorized access is blocked

**Checkpoint**: All four stories work independently and together.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T042 [P] Add deployment notes for callback source restriction and rate limiting to `nepstarAdmin/backend/DEPLOY.md` (nginx `allow`/`deny`, frequency limit, HTTPS-only for pull)
- [X] T043 [P] Review `nepstarAdmin/backend/app/services/report_push_service.py` and `app/api/report_push.py` logs for PII/secret leakage (`appCustomerInfo`, full `name`/`mobile`, `HAIXIN_APP_SECRET`, sign strings) and confirm push records store only `response_summary` ≤500 chars
- [ ] T044 Run `EXPLAIN` for the pull range query defined in `specs/008-report-push-and-callback/contracts/open-report-pull.md` against the real read-only source; record whether an index is needed and tighten the max range if P95 exceeds 3 seconds
- [ ] T045 Run full regression in `nepstarAdmin/backend` (`pytest -q`, `ruff check app tests`) and `nepstarAdmin/frontend` (`npm run test`, `npm run build`); confirm `nepstarAdmin/backend/tests/api/test_reports.py` and `test_report_view.py` stay green
- [ ] T046 Execute §4 of `specs/008-report-push-and-callback/quickstart.md` end-to-end (callback → auto push → manual repush → signed pull → push records) and update that file if any step differs
- [ ] T047 Add a callback→delivery timing assertion using the fake clock and structured `duration` log in `nepstarAdmin/backend/tests/api/test_report_callback.py`; record the measured result in `specs/008-report-push-and-callback/quickstart.md` and confirm the SC-002 target (99% ≤1 minute)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: starts immediately; T002 → T003; T004/T005 can run alongside T001–T003.
- **Foundational (Phase 2)**: depends on Setup; blocks all stories.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on Foundational + US1 delivery path (T009/T011).
- **US3 (Phase 5)**: depends only on Foundational signature/config; independent of US1/US2.
- **US4 (Phase 6)**: depends on Foundational records + US1/US2 producing records; can seed records in tests.
- **Polish (Phase 7)**: after desired stories.

### Within Each Story

1. Write tests, run them, confirm FAIL.
2. Implement service/model.
3. Implement endpoint/UI.
4. Run story-specific tests.
5. Perform the independent check.

### Parallel Opportunities

- T004/T005 in Setup; T006/T008/T012 in Foundational.
- T015 tests while T016 implementation is pending (tests first).
- Frontend T017/T019/T020 can proceed in parallel with backend T016 (different files).
- T028/T029 tests in parallel; T034 can run in parallel with other US4 work.
- Same-file pairs MUST run sequentially: T022/T023, T015/T033, T017/T036, T019/T039, T020/T040.

## Parallel Example: US1

```bash
# Backend test first (RED), then backend endpoint
Task: "Write manual push tests in tests/api/test_report_push.py"
Task: "Implement POST /reports/{report_id}/push in app/api/reports.py"

# Frontend pieces in parallel
Task: "Add pushReport to src/api/reports.ts"
Task: "Add i18n keys to zh-CN/en/es"
Task: "Add Vitest API test"
```

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2.
2. Phase 3 (US1) → validate with mock partner.
3. Deploy/demo the manual re-push button.

### Incremental Delivery

1. US1: manual re-push (MVP).
2. US2: automatic callback push.
3. US3: partner pull.
4. US4: push records page and repush.
5. Polish and deployment notes.

### Notes

- Every task path is inside the canonical root and in scope.
- `HAIXIN_PUSH_ENABLED=false` by default; integration tests must monkeypatch or set it explicitly.
- Do not run the default `alembic upgrade head`; apply migration `010` only through a reviewed nepstar-only runner or DBA-executed SQL.
- Commit after each logical task group (constitution workflow).

---

## Implementation Status (2026-11-13)

- 已完成：T001–T020、T022–T026、T028–T031、T033–T040、T042–T043。
- 自动化验证：新增后端测试 39 项通过（`tests/unit/test_haixin_sign.py` 等 5 个 + `tests/api/test_report_{push,callback,pull}.py`）；前端 Vitest 73 项通过；`npm run build`（vue-tsc + vite）通过；本次新增/修改文件 `ruff check` 通过。
- 未完成（需要真实数据源、运行中的服务或浏览器联调）：
  - T021 / T027 / T032 / T041 / T046：quickstart 的人工/端到端验证。
  - T044：真实旧库 `EXPLAIN`。
  - T045：后端全量 `pytest` 在本机因旧库 `inspect_base`/`ne` 不可达出现 25 个既有环境失败（非本次改动引入）；`tests/api/test_reports.py`、`test_report_view.py` 未能在本机执行。
  - T047：回调→投递耗时断言（需要可控制的异步时钟与数据库夹具）。

---

## Production Deployment (2026-11-13)

- 已完成生产部署与迁移 010；服务器地址、备份路径与连接细节不纳入仓库，保留在私有运维记录。
