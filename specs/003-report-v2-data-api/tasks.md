---
description: "Task list for 报告展示数据接口（Report View API）"
---

# Tasks: 报告展示数据接口（Report View API）

**Input**: Design documents from `specs/003-report-v2-data-api/`
**Prerequisites**: [plan.md](plan.md)（required）、[spec.md](spec.md)（required for user stories）、[research.md](research.md)、[data-model.md](data-model.md)、[contracts/](contracts/)、[quickstart.md](quickstart.md)

**Tests**: Tests are REQUIRED by the project constitution（Principle I: TDD — `.specify/memory/constitution.md`）。测试 MUST 先写并确认 **失败** 后再实现。

**Organization**: 按用户故事分组，每个故事可独立实现与测试。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1–US5）
- 每条任务包含确切文件路径

## Path Conventions

- 后端：`nepstarAdmin/backend/`（`app/`、`tests/`、`alembic/`、`sql/`）
- 后台管理前端：`nepstarAdmin/frontend/src/`
- 报告前端：`reportFront/report-v2/src/`
- **不修改**：`reportFront/baogaoV2`、任意 V3 目录、`reportFront/长寿指数UI设计`、`KH503`、`oldbackend`（后者仅作取值口径参考）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 依赖与环境准备

- [X] T001 在 `nepstarAdmin/backend/requirements.txt` 与 `nepstarAdmin/backend/pyproject.toml` 中添加 `motor>=3.4.0` 依赖并安装
- [X] T002 [P] 在 `nepstarAdmin/backend/app/config.py` 中添加 `MONGODB_URL` 配置项，以及报告展示的固定值（警示阈值 `70`、健康预期寿命基准值 `86.8`、AI 咨询入口配置、`save_report_enabled`）
- [X] T003 [P] 验证 `nepstarAdmin/backend/.env` 的 `MONGODB_URL` 可连通（阿里云副本集需客户端 IP 白名单），确认可读到 `receive_report.reportV2Info` 的文档

**Checkpoint**: 依赖与配置就绪

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有用户故事共用的数据结构、数据源接入与日志基础

**⚠️ CRITICAL**: 本阶段完成前，任何用户故事都不能开始

- [X] T004 新建 Alembic 迁移 `nepstarAdmin/backend/alembic/versions/004_report_view_api.py`：`sa_indicator` 增加 `target_id`（`INT NULL`，唯一约束）与四个文案列 `report_status_text` / `report_summary` / `report_interpretation` / `report_actions`
- [X] T005 [P] 在 `nepstarAdmin/backend/app/models/new/sa_indicator.py` 的 `SAIndicator` 上添加对应的五个属性
- [X] T006 [P] 新建 `nepstarAdmin/backend/app/mongo.py`：motor 异步客户端、只读库/集合常量、连接与关闭的生命周期函数
- [X] T007 [P] 在 `nepstarAdmin/backend/app/i18n/__init__.py` 的三个语言块中新增 `report.not_found` / `report.not_ready` / `report.system_not_found` / `report.unavailable`
- [X] T008 [P] 在 `nepstarAdmin/backend/app/schemas/indicator.py` 的 `IndicatorCreate` / `IndicatorUpdate` / `IndicatorNode` 中添加 `target_id` 字段
- [X] T009 在 `nepstarAdmin/backend/app/services/indicator_service.py` 中实现 `target_id` 的读写、`_node()` 输出与冲突预检（同 `target_id` 已属另一指标时抛 `indicator.target_id_conflict`；仅 `target_id` 非法时抛 `indicator.target_id_required`）
- [X] T010 [P] 编写 `nepstarAdmin/backend/tests/unit/test_report_source.py`（先失败）：用固定 JSON fixture 覆盖报告文档解析、三层遍历、缺失字段容错（`skinReportInfo` 字段数不一致一类）、数据源超时与连接失败的归并、报告摘要字段来源（受检年龄而非档案年龄、百分位字段转 int）
- [X] T011 实现 `nepstarAdmin/backend/app/services/report_source.py`：报告文档只读读取、`inspect_target` 字典读取（名称与 `proportion` 权重）、旧库主记录读取（状态、生成时间、排名字段）、超时设置与两类数据源异常的归并，使 T010 转绿
- [X] T012 [P] 新建 `nepstarAdmin/backend/app/schemas/report_view.py`：首页与详情接口的响应模型（snake_case，遵循既有 Pydantic 风格）
- [X] T013 [P] 编写 `nepstarAdmin/backend/tests/unit/test_report_logging.py`（先失败）：结构化日志辅助函数输出报告编号、结果状态与耗时，且不包含报告内容或客户联系方式（FR-039）
- [X] T014 实现 `nepstarAdmin/backend/app/utils/report_log.py` 中的结构化日志辅助函数，使 T013 转绿
- [X] T015 在 `nepstarAdmin/backend/app/api/main.py` 中注册 `report_view` 路由前缀到 `/api/v1`，并挂载 MongoDB 客户端的启动/关闭生命周期

**Checkpoint**: 数据结构、数据源、日志与路由骨架就绪 — 用户故事可以开始

---

## Phase 3: User Story 1 - 打开报告首页看到自己的真实报告 (Priority: P1) 🎯 MVP

**Goal**: 报告首页所需的全部数据由一次接口调用返回，内容来自真实报告文档，包含报告基础信息、总分与阈值、年龄类信息、健康预期寿命，以及按性别过滤并排好序的系统卡片，其中心血管带最近 6 次趋势序列。

**Independent Test**: 用一份真实报告请求首页接口，逐项核对报告编号、日期、年龄类指标、总分与系统得分；核对心血管的趋势序列与其余系统为空；再用另一性别的报告验证系统随性别变化。前端打开页面时不出现模拟数据。

### Tests for User Story 1（先写，确认失败）

- [X] T016 [P] [US1] 在 `nepstarAdmin/backend/tests/unit/test_report_source.py` 追加趋势查询单测（先失败）：只查心血管、最多 6 次、时间升序、只含同一 collection 的历史、不足 6 次不补零、无历史返回空
- [X] T017 [P] [US1] 在 `nepstarAdmin/backend/tests/unit/test_report_view_service.py` 编写服务层单测（先失败）：系统组装、V2 展示口径过滤（旧 10 个中取 8 个、每份报告恒 7 个）、性别分支选择、展示排序、系统得分取自报告文档对应层级、健康预期寿命派生（FR-045）、未命中 `targetId` 时记录日志
- [X] T018 [P] [US1] 在 `nepstarAdmin/backend/tests/api/test_report_view.py` 编写接口测试（先失败）：首页成功路径；四个错误路径的 `code`/`message`；`report.not_found` 对"报告不存在"与"客户不匹配"返回完全一致；心血管有趋势、其余系统趋势为空

### Implementation for User Story 1

- [X] T019 [US1] 在 `nepstarAdmin/backend/app/services/report_source.py` 中实现按客户查历史报告并在其中提取心血管得分的查询，使 T016 转绿
- [X] T020 [US1] 在 `nepstarAdmin/backend/app/services/report_view_service.py` 中实现首页组装：`targetId` 反向查找已登记指标、V2 系统口径过滤、性别分支选择、展示排序、图表类别与序列派生、趋势序列接线到心血管、报告摘要字段按 FR-046 取源、健康预期寿命派生、未命中 `targetId` 时写日志，使 T017/T018 转绿
- [X] T021 [US1] 在 `nepstarAdmin/backend/app/api/report_view.py` 中实现 `GET /api/v1/report-view/{report_code}/home`（无 JWT 依赖，含归属校验与四类错误映射）
- [X] T022 [P] [US1] 新建 `reportFront/report-v2/src/api/reportClient.js`：原生 `fetch` 封装、错误标识到页面状态的映射、超时处理
- [X] T023 [P] [US1] 新建 `reportFront/report-v2/src/data/reportAdapter.js`：接口 DTO → 组件 ViewModel 的纯函数适配
- [X] T024 [P] [US1] 新建 `reportFront/report-v2/src/components/ReportErrorState.vue`：四种错误状态与加载态
- [X] T025 [US1] 改造 `reportFront/report-v2/src/views/ReportHome.vue`：改为异步取数，接入加载态与错误态，去掉对静态数据的直接依赖
- [X] T026 [US1] 改写 `reportFront/report-v2/tests/unit/report-data.spec.js` 与 `report-order.spec.js` 为基于 fixture 的断言，并新建 `reportFront/report-v2/tests/unit/report-adapter.spec.js`（DTO→ViewModel 契约测试，含趋势为空与趋势有值的两种形态）
- [X] T027 [US1] 移除 `reportFront/report-v2/src/data/report.js` 中的业务值，使其仅作为空展示结构的起点（FR-043）

**Checkpoint**: 首页可用真实数据完整呈现（含趋势），且无模拟数据回退

---

## Phase 4: User Story 2 - 进入系统详情看到与首页完全一致的数据 (Priority: P1)

**Goal**: 系统二级详情返回与首页同源的系统得分、状态、摘要、图表，并额外提供构成得分的指标及其权重、不参与加权的直接采集值、结论解读与行动建议。

**Independent Test**: 对同一份报告逐个系统比对首页与详情返回的 `score` / `status_text` / `summary` / `visualization`，要求完全一致；再验证详情返回了该系统的指标与权重。

### Tests for User Story 2（先写，确认失败）

- [X] T028 [P] [US2] 在 `nepstarAdmin/backend/tests/unit/test_report_view_service.py` 追加详情组装单测（先失败）：指标列表与权重来源、得分可由加权解释、直接采集值固定归属、文案降级为空
- [X] T029 [P] [US2] 在 `nepstarAdmin/backend/tests/api/test_report_view.py` 追加接口测试（先失败）：详情端点成功路径、`report.system_not_found`、首页与详情同一系统的字段一致

### Implementation for User Story 2

- [X] T030 [US2] 在 `nepstarAdmin/backend/app/services/report_view_service.py` 中实现详情组装：指标列表与 `inspect_target.proportion` 权重、加权自洽、`spo2hReportInfo` / `ecgReportInfo` 到心血管与肺功能的固定归属、结论解读与行动建议，使 T028 转绿
- [X] T031 [US2] 在 `nepstarAdmin/backend/app/api/report_view.py` 中实现 `GET /api/v1/report-view/{report_code}/systems/{system_code}`，使 T029 转绿
- [X] T032 [US2] 改造 `reportFront/report-v2/src/views/SystemDetail.vue`：接入详情接口的异步取数与错误态
- [X] T033 [US2] 更新 `reportFront/report-v2/tests/components/SystemDetail.spec.js` 与 `reportFront/report-v2/tests/e2e/system-detail.spec.js`：改为基于 fixture 的断言与接口桩

**Checkpoint**: 首页与详情数据一致，两个视图都可独立验证

---

## Phase 5: User Story 3 - 低分系统展示匹配的健康管理方案与商品 (Priority: P2)

**Goal**: 得分偏低且后台配置了方案的指标，在首页卡片与详情页都返回同一方案及其商品。

**Independent Test**: 用一份低分报告，验证命中的系统在两处返回同一方案与同一商品集合，未命中的系统推荐字段为空。

### Tests for User Story 3（先写，确认失败）

- [X] T034 [P] [US3] 在 `nepstarAdmin/backend/tests/unit/test_report_view_service.py` 追加推荐单测（先失败）：按指标关联链匹配、多方案按优先级取唯一、同方案多商品按序、停用对象被过滤、未命中返回空
- [X] T035 [P] [US3] 在 `nepstarAdmin/backend/tests/api/test_report_view.py` 追加接口测试（先失败）：首页与详情返回的推荐完全一致

### Implementation for User Story 3

- [X] T036 [US3] 在 `nepstarAdmin/backend/app/services/report_view_service.py` 中实现推荐组装（报告指标 → 指标配置 → `sa_plan_indicator` → `sa_plan` → `sa_plan_product` → `sa_product`），首页与详情共用同一函数，使 T034/T035 转绿
- [X] T037 [US3] 验证并微调 `reportFront/report-v2/src/components/RecommendationCard.vue` 对接口推荐结构的渲染，确认无推荐时不渲染占位卡片

**Checkpoint**: 推荐在首页与详情一致

---

## Phase 6: User Story 4 - 在指标管理中维护 targetId 与报告文案 (Priority: P2)

**Goal**: 后台维护人员能在既有"健康管理 → 指标管理"里登记 `targetId`、维护报告文案、看到冲突提示；`targetId` 与文案变更后报告输出随之变化且无需发版。

**Independent Test**: 在指标管理里为一个二级指标登记 `targetId` 并填写摘要，重新请求报告，验证该指标出现且文案生效；再登记一个已被占用的 `targetId`，验证被拒绝。

### Tests for User Story 4（先写，确认失败）

- [X] T038 [P] [US4] 在 `nepstarAdmin/backend/tests/unit/test_indicator_service.py` 追加单测（先失败）：文案四字段读写、`report_actions` 的 JSON 解析与非法值降级、`target_id` 冲突判定
- [X] T039 [P] [US4] 在 `nepstarAdmin/backend/tests/api/test_health_indicators.py` 追加接口测试（先失败）：指标创建/修改/树上返回 `target_id` 与文案字段、重复登记返回冲突错误而非 500

### Implementation for User Story 4

- [X] T040 [P] [US4] 在 `nepstarAdmin/backend/app/i18n/__init__.py` 的三个语言块中新增 `indicator.target_id_required` / `indicator.target_id_conflict`
- [X] T041 [US4] 在 `nepstarAdmin/backend/app/schemas/indicator.py` 与 `app/services/indicator_service.py` 中实现四个文案字段的读写与 `report_actions` 的 JSON 序列化/容错，使 T038 转绿
- [X] T042 [US4] 在 `nepstarAdmin/backend/app/api/indicators.py` 中确认端点返回新字段并把冲突映射为对应错误码，使 T039 转绿
- [X] T043 [US4] 按 V2 设计稿逐项对照 `inspect_target.inspect_name` 核对，编写 `nepstarAdmin/backend/sql/seed-report-target-ids.sql`：建 8 个一级指标并逐个登记各系统下的三级 `targetId`（骨骼 4 项、免疫力 6 项、女性 5 项、男性 4 项等），不展示的旧一级不建记录
- [X] T044 [US4] 在 `nepstarAdmin/frontend/src/views/health/IndicatorList.vue` 中增加 `target_id` 与四个文案字段的编辑与展示（含冲突错误提示），并补充 `nepstarAdmin/frontend/src/views/health/__tests__/IndicatorList.spec.ts`

**Checkpoint**: 后台可自助维护映射与文案，改动即时生效

---

## Phase 7: User Story 5 - 报告页面从接口获取入口配置与功能开关 (Priority: P3)

**Goal**: AI 咨询入口与保存报告开关由接口给出固定值，前端不内置。

**Independent Test**: 请求首页接口，核对 `ai_consult` 与 `features` 与本期约定值一致，且后台不存在修改入口。

### Tests for User Story 5（先写，确认失败）

- [X] T045 [P] [US5] 在 `nepstarAdmin/backend/tests/api/test_report_view.py` 追加接口测试（先失败）：`ai_consult` 与 `features` 的固定值

### Implementation for User Story 5

- [X] T046 [US5] 在 `nepstarAdmin/backend/app/services/report_view_service.py` 中接入 `config.py` 的固定值并返回，使 T045 转绿
- [X] T047 [US5] 改造 `reportFront/report-v2/src/components/AiConsultEntry.vue` 与 `SaveReportButton.vue`：改用接口返回的配置与开关

**Checkpoint**: 入口与开关由接口驱动

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 跨故事的收尾与验收

- [X] T048 [P] 修正 `reportFront/report-v2/playwright.config.js` 中写死的 macOS Node 路径，使其在本机可运行
- [X] T049 [P] 全量跑 `pytest`、`ruff check .`、`npm run test`、`npm run build`，清理无引用代码
- [X] T050 按 `specs/003-report-v2-data-api/quickstart.md` 执行端到端验收路径（含性别分支、趋势序列、归属拒绝、数据源故障降级）
- [X] T051 [P] 新增 `nepstarAdmin/backend/tests/api/test_report_view_perf.py`：对 20 份不同报告串行请求首页与详情接口，记录耗时并断言 P95 ≤ 3 秒（SC-013）；按实测结果校准 `app/config.py` 中的数据源超时值
- [X] T052 更新 `docs/V2-首页报告后端接口.md`，使其与已实现的接口、字段与错误码一致（原文档是设计建议，多处与实现不符）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖
- **Foundational (Phase 2)**: 依赖 Setup — **阻塞所有用户故事**
- **User Stories (Phase 3+)**: 均依赖 Foundational
- **Polish (Phase 8)**: 依赖所需用户故事完成

### User Story Dependencies

- **US1 (P1)**: Foundational 后可开始
- **US2 (P1)**: Foundational 后可开始；与 US1 共用 `report_view_service.py`，串行实现更省事
- **US3 (P2)**: 依赖 US1 的组装骨架（推荐在 US1 之后）
- **US4 (P2)**: Foundational 后可开始
- **US5 (P3)**: 依赖 US1 的端点骨架

> **实务提示（重要）**：US1/US2 的**自动化测试**可以用 fixture 或直接 SQL 写入 `target_id` 来验证；但**人工演示与端到端验收**需要 **T043** 的 seed 脚本先跑过——否则报告里不会有任何系统。若以 MVP 演示为目标，建议执行顺序为 `T043 → US1 → US2`。

### Within Each User Story

- 测试 MUST 先写并确认失败（constitution Principle I）
- 模型 → 服务 → 端点 → 前端接入
- 一个故事完成后再进入下一个优先级

### Parallel Opportunities

- T002/T003 可并行
- T005–T008、T010、T012、T013 可并行（不同文件）
- T016/T017/T018 三组测试可并行编写
- T022/T023/T024 可并行（三个新前端文件）
- T034/T035、T038/T039、T040、T045 的测试可并行编写
- T048/T049/T051 可并行

---

## Parallel Example: User Story 1

```bash
# 先并行写三组测试，确认都失败：
Task: "T016 趋势查询单测 in nepstarAdmin/backend/tests/unit/test_report_source.py"
Task: "T017 服务层单测 in nepstarAdmin/backend/tests/unit/test_report_view_service.py"
Task: "T018 接口测试 in nepstarAdmin/backend/tests/api/test_report_view.py"

# 数据源层与组装层串行（同文件依赖），前端三个新文件并行：
Task: "T022 reportClient.js"
Task: "T023 reportAdapter.js"
Task: "T024 ReportErrorState.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational（CRITICAL）
3. **先跑 T043 的 seed 脚本**（否则页面无数据可选）
4. Phase 3 User Story 1
5. **STOP & VALIDATE**：用真实报告独立验证首页（含心血管趋势）
6. 可演示即交付

### Incremental Delivery

1. Setup + Foundational → 地基就绪
2. US1 → 首页跑通真实数据（MVP）
3. US2 → 详情与首页一致
4. US3 → 推荐上线
5. US4 → 后台可自助维护映射与文案
6. US5 → 入口与开关由接口驱动

---

## Notes

- [P] = 不同文件、无未完成依赖
- 测试必须先失败再实现，未确认红灯的测试视为无效（宪法 Principle I）
- 每完成一个逻辑单元提交一次
- 数据源只读：不得写入 MongoDB 或旧库，不得新增表/索引/视图
- 前端不得引入 Axios；使用原生 `fetch`
- 摘要字段来源以 FR-046 为准：实际年龄取受检年龄而非档案年龄，同龄人对比比例取旧库排名字段
