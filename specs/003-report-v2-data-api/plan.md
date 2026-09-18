# Implementation Plan: 报告展示数据接口（Report View API）

**Branch**: `003-report-v2-data-api` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-report-v2-data-api/spec.md`

**Note**: 本文件为 `/speckit-plan` 输出，覆盖 Phase 0 研究与 Phase 1 设计。任务拆分由 `/speckit-tasks` 另行生成。

## Summary

为 `reportFront/report-v2` 提供两个由 nepstarAdmin 后端给出的报告展示聚合接口：报告首页数据与系统二级详情。后端一次返回已经过归属校验、系统映射、排序、指标匹配与推荐组装的数据，报告前端不再拼装多个后台配置接口。

**数据源在核查后被修正。** 初版计划按 MySQL 读取报告明细，核查 `oldbackend` 与真实数据后确认：KH503 报告本体是 **MongoDB 文档**（`receive_report.reportV2Info`），文档内只有数字 `targetId` 与得分，没有名称与权重；名称与权重在旧系统 MySQL 的 `inspect_target`（`proportion` 列）。两者以 `targetId` 关联。这意味着原先设计的"旧库代码 → 指标编码"映射层与 `sa_indicator_legacy_code` 表**不再需要**——标识就是数字 `targetId`，在 `sa_indicator` 上加一个带唯一约束的列即可。

报告文案（状态、摘要、解读、行动建议）仍由既有的"健康管理 → 指标管理"维护，登记变更不需要发版。`reportFront/report-v2` 同步接入：新增基于原生 `fetch` 的请求层与一个 DTO→ViewModel 适配层，页面组件结构不变；前端**不再保留模拟业务数据回退**。

**Confirmed scope decisions（spec Clarifications，15 问 + 6 条核查修正 + 2 条口径确认）**：展示口径**照 V2 设计稿逐项映射到真实数据**——8 个系统从旧 10 个一级中选取（营养状态/有害物质/皮肤系统不展示），系统得分取报告文档中对应层级的得分（6 个取一级，女性/男性功能取生殖系统下的二级分支），展示的指标位于三层结构中的第三层，由指标管理逐个登记 `targetId` 决定；数据取自真实报告记录；交付含前端接入；访问凭证为报告编号 + 客户标识 + 归属校验；实时只读不缓存；`targetId` 与文案由既有指标管理模块维护；图表类别与系列由后端出、类型与单位留在前端；趋势序列本期支持、固定 6 次、口径一致；就绪以报告文档与主记录判定；"不存在"与"无权访问"对外合并；权重以旧库字典为准；数据源故障返回独立的"暂不可用"；接口 P95 ≤ 3 秒；仅结构化日志、不做访问审计；展示配置本期为固定值；前端本期即移除模拟数据回退。

**Confirmed architecture decisions（用户已批准，Constitution III）**：①新增面向报告展示的聚合接口；②**新增到报告文档 MongoDB 的只读连接**（`.env` 已配置 `MONGODB_URL`）；③在指标记录上扩展 `targetId` 登记与报告文案，并据此扩展指标管理模块的既有接口与页面；④报告前端移除模拟数据回退。不新建独立的映射管理模块或菜单。

## Technical Context

**Language/Version**: 后端 Python 3.11+（FastAPI + SQLAlchemy 2.0 async）；前端 JavaScript（Vue 3 单文件组件，禁止 TypeScript）

**Primary Dependencies**:
- 后端既有：FastAPI、SQLAlchemy[asyncio]、aiomysql、pydantic v2、pydantic-settings、alembic、structlog；测试用 pytest、pytest-asyncio、httpx、pytest-cov；静态检查 ruff（line-length 100）
- 后端**新增**：`motor>=3.4.0` —— MongoDB 官方异步驱动，与现有 async 数据访问体系一致（research R2）。同步的 `pymongo` 会在 async 路由里阻塞事件循环，故不采用
- 前端（既有）：Vue 3、Vue Router、Vite、`@vitejs/plugin-vue`；测试用 Vitest、Vue Test Utils、jsdom、Playwright
- 前端取数使用**浏览器原生 `fetch`**，不引入 Axios（既有架构约束，research R5）

**Storage**:
- **MongoDB（新增，只读）**：`receive_report` 库的 `reportV2Info` collection。阿里云副本集 `mgset-6041593`，主节点 `47.93.105.139:3717`，线协议 8（MongoDB 4.2），SCRAM-SHA-256。连接串取自 `.env` 的 `MONGODB_URL`。需在阿里云控制台配置客户端 IP 白名单（已实测确认）
- **MySQL `platform`（既有，只读）**：`inspect_target` 提供名称与权重，`inspect_base` 提供报告主记录与状态
- **MySQL `nepstar`（既有，读写）**：`sa_indicator` 扩展 `target_id` 与四个文案列

**Testing**:
- 后端：`.venv/Scripts/python.exe -m pytest tests/unit -q`（服务层，AsyncMock，不连库）、`.venv/Scripts/python.exe -m pytest tests/api -q`（接口测试，连真实数据源，使用 `tests/api/health_helpers.py::make_client()`）、`--cov=app`、`.venv/Scripts/ruff.exe check .`
- 前端：`npm run test`（Vitest）、`npm run test:e2e`（Playwright）、`npm run build`

**Target Platform**: 后端 Linux/Windows 服务器 + Uvicorn；前端现代手机、平板与桌面浏览器

**Project Type**: Web 应用（后端聚合接口 + 前端单页应用），前后端位于同一仓库的两个既有目录

**Performance Goals**: 首页与系统详情接口各自 P95 ≤ 3 秒（SC-013，测量基准为 20 份不同报告的串行请求，不含并发压力）

**Constraints**:
- 两个数据源的访问都必须设超时，且超时值落在 3 秒预算内（FR-038、SC-013）
- 报告展示接口不得复用后台 JWT（FR-021）
- 趋势序列最多 6 点、口径一致、不足时不补零（FR-034/035）
- 报告前端不保留模拟业务数据回退（FR-043）
- MongoDB 与旧库均只读（FR-024、FR-031）
- 报告文档存在结构漂移（同一 collection 内字段数不一致），必须按字段存在性容错读取

**Scale/Scope**: 2 个对外接口 + 1 个指标管理扩展接口；1 处表结构扩展（1 个标识列 + 4 个文案列）；1 个新增依赖（motor）；6 个新 i18n key × 3 种语言；报告文档集合装入多机型报告；前端 2 个视图接入、1 个新请求层、1 个新适配层、1 个新错误态组件

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Status | Notes |
| --- | --- | --- |
| I. TDD (NON-NEGOTIABLE) | ✅ | 每个 FR 先落失败测试：服务层用 AsyncMock 单测覆盖映射/排序/推荐/降级/性别分支，数据源层用单测覆盖超时归并与字段容错，接口层用 `make_client()` 覆盖四个错误路径；前端先写"适配层把给定 DTO 转成组件所需结构"的失败测试，再实现适配层。既有 `tests/unit/report-data.spec.js` 等依赖固定模拟值的断言必须先改成 fixture 断言（红灯），再移除模拟数据。 |
| II. Scope Discipline | ✅ | 只做 spec 列出的两个展示接口 + 指标管理扩展。仅新增 `motor` 一个依赖，且是已批准架构变更的必要组成。未做趋势独立接口、审计表、限流、多语言（均在 Out of Scope）。初版设计的 `sa_indicator_legacy_code` 关联表在核查后**删除**——一对一关系用一个带唯一约束的列即可。 |
| III. Architecture Change Approval | ✅ | 四项架构变更均已获用户确认：新增聚合接口、**新增 MongoDB 只读连接**、在指标记录上扩展 `targetId` 登记与文案并改造指标管理模块、报告前端移除模拟数据回退。见 Summary 的 Confirmed architecture decisions。 |
| IV. Clarify First, Don't Guess | ✅ | 三轮澄清共 15 问全部回填。规划阶段的数据源误判在核查后**主动纠正并记录**（research.md 修订说明、spec 的 6 条修正条目），未沿用错误假设。展示口径与"女性功能指标数"两项在核查后由用户确认（spec 的 2 条确认条目），确认前未开始实现；其中"5 vs 3 偏差"经核对证明是把三级指标误读成二级，已作废。 |
| V. Canonical Frontend Baseline and Technology | ⚠️ | 前端只改 `reportFront/report-v2`，不改 `baogaoV2` / 任意 V3 / `长寿指数UI设计` / `KH503`，使用 Vue 3 + JavaScript。**但宪章第 92 行写的规范根目录是 `/Users/leelee/Desktop/体检报告/nepstar`，当前工作副本在 `D:\workspace\nepstar`** ——同一仓库（`github.com/wxhhkkkl/nepstar`）在不同机器上的路径。计划按当前工作副本执行；该路径差异需要一次宪章修订，见 Complexity Tracking。 |

**Gate result**: PASS。唯一一项 ⚠️ 是宪章中写死的绝对路径与当前机器不一致，属文档陈旧而非设计违规，不阻塞；已登记为待修订项。

### Post-Design Gate

- [x] 设计文件只描述本特性范围内的接口、表与前端改动。
- [x] 报告展示接口与后台管理接口的访问控制相互独立（无 JWT 依赖）。
- [x] 新增依赖仅 `motor` 一个，且为已批准架构变更的必要组成；前端不引入任何依赖。
- [x] MongoDB 与旧库均保持只读，所有写入只落在 `nepstar` 库。
- [x] 前端组件展示结构不变，改动集中在请求层与适配层。
- [x] 六个新 i18n key 已按三语言块要求列出，并有 contract 记录。
- [x] 性能目标、错误标识、降级路径、字段容错均可映射到 spec 中的可验证要求。

## Project Structure

### Documentation (this feature)

```text
specs/003-report-v2-data-api/
├── plan.md                    # 本文件
├── research.md                # Phase 0 输出（2026-09-18 修订）
├── data-model.md              # Phase 1 输出（2026-09-18 修订）
├── quickstart.md              # Phase 1 输出
├── contracts/
│   ├── README.md              # 共享约定与两组接口的访问控制差异
│   ├── report-view.md         # 两个报告展示接口
│   └── indicator-target-id.md    # 指标管理模块扩展
├── checklists/
│   └── requirements.md
└── tasks.md                   # 由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
nepstarAdmin/backend/
├── requirements.txt                              # [edit] 新增 motor
├── pyproject.toml                                # [edit] 新增 motor>=3.4.0
├── alembic/versions/
│   └── 004_report_view_api.py                    # [new] sa_indicator 加 target_id（唯一）+ 4 个文案列
├── sql/
│   └── seed-report-target-ids.sql                # [new] 登记 10 个旧一级系统的 targetId
├── app/
│   ├── config.py                                 # [edit] MONGODB_URL 配置项 + 报告固定值（警示阈值、AI 入口、功能开关）
│   ├── mongo.py                                  # [new] motor 客户端与生命周期管理
│   ├── utils/report_log.py                       # [new] 报告请求的结构化日志辅助（FR-039）
│   ├── i18n/__init__.py                          # [edit] 新增 6 个 key × 3 语言块
│   ├── models/new/
│   │   └── sa_indicator.py                       # [edit] 增加 target_id 与 4 个报告文案列
│   ├── schemas/
│   │   ├── indicator.py                          # [edit] target_id 与文案字段的入参出参
│   │   └── report_view.py                        # [new] 报告展示接口的响应模型
│   ├── services/
│   │   ├── indicator_service.py                  # [edit] target_id 读写与冲突预检、文案读写
│   │   ├── report_source.py                      # [new] 报告文档只读访问 + inspect_target 字典读取 + 超时归并
│   │   └── report_view_service.py                # [new] 映射、组装、排序、推荐、性别分支、降级与错误区分
│   ├── api/
│   │   ├── indicators.py                         # [edit] 指标接口增加 target_id 与文案字段
│   │   ├── report_view.py                        # [new] 两个展示接口，无 JWT 依赖
│   │   └── main.py                               # [edit] 注册 report_view 路由 + MongoDB 生命周期
└── tests/
    ├── unit/
    │   ├── test_report_view_service.py           # [new]
    │   ├── test_report_source.py                 # [new] 文档解析、字段容错、超时归并、趋势查询
    │   ├── test_report_logging.py                # [new] 结构化日志辅助（FR-039）
    │   └── test_indicator_service.py             # [edit] 补 target_id 与文案用例
    └── api/
        ├── test_report_view.py                   # [new]
        ├── test_report_view_perf.py              # [new] 20 份报告的 P95 测量（SC-013）
        └── test_health_indicators.py             # [edit] 补 target_id 与文案字段用例

nepstarAdmin/frontend/
└── src/views/health/
    ├── IndicatorList.vue                         # [edit] 指标管理表单与列表增加 target_id 与四个文案字段
    └── __tests__/IndicatorList.spec.ts           # [edit] 覆盖新字段与冲突提示

reportFront/report-v2/
├── playwright.config.js                          # [edit] webServer.command 里写死的 macOS Node 路径
├── src/
│   ├── api/
│   │   └── reportClient.js                       # [new] 原生 fetch 封装，含错误标识映射
│   ├── data/
│   │   ├── report.js                             # [edit] 移除业务值，保留为空的展示结构起点
│   │   └── reportAdapter.js                      # [new] 接口 DTO → 组件 ViewModel
│   ├── views/
│   │   ├── ReportHome.vue                        # [edit] 改为异步取数，加载/错误态
│   │   └── SystemDetail.vue                      # [edit] 同上
│   ├── components/
│   │   └── ReportErrorState.vue                  # [new] 四种错误状态与加载态
│   └── utils/
│       └── report.js                             # [不动] 选择器函数已是接收 report 的纯函数
└── tests/
    ├── unit/
    │   ├── report-data.spec.js                   # [edit] 断言改为基于 fixture，测适配层而非固定值
    │   └── report-adapter.spec.js                # [new] DTO→ViewModel 的契约测试
    └── e2e/
        └── report-home.spec.js                   # [edit] 补错误态与零模拟数据断言
```

**Structure Decision**: 在既有结构中就地扩展，不新建工程或目录。后端沿用 `api/` → `services/` → `schemas/` → `models/new/` 的既有分层。数据源访问独立成 `report_source.py`（MongoDB 文档 + MySQL 字典 + 超时归并），与 `report_view_service.py` 的组装职责分开，使组装逻辑可以用 AsyncMock 单测而不触碰真实数据源。`mongo.py` 单独承载 motor 客户端，避免把连接生命周期塞进 `database.py` 的既有 MySQL 职责。前端沿用既有 `api`/`data`/`views`/`components` 划分，**不动** `src/utils/report.js` 的四个纯函数。

## Phase 0: Research Decisions

研究结果见 [research.md](research.md)。关键决策：

1. **数据源**（R1）：报告本体在 MongoDB `receive_report.reportV2Info`，名称与权重在 MySQL `inspect_target`，以数字 `targetId` 关联。
2. **MongoDB 访问**（R2）：使用 `motor` 异步驱动，只读，连接参数取自 `.env`。
3. **标识形态**（R3）：直接用数字 `targetId`，在 `sa_indicator` 上加一个带唯一约束的列；**不建**原计划的关联表。
4. **文案存储**（R4）：`sa_indicator` 加 4 列，`report_actions` 用 JSON 文本承载列表。
5. **前端取数**（R5）：原生 `fetch`，不引入 Axios。
6. **前端数据层**（R6）：`src/utils/report.js` 不动，`src/data/report.js` 改为适配层，测试改喂 fixture。
7. **直接采集归属**（R7）：取自文档的 `spo2hReportInfo` / `ecgReportInfo`，服务层固定常量表。
8. **性别专项**（R8）：直接采用生殖系统 3143 的性别分支，不自行推断。
9. **趋势查询**（R9）：按客户向前取 6 份报告文档，批量取值。
10. **超时与降级**（R10）：两个数据源分别设超时，归并到 `report.unavailable`。

## Phase 1: Design and Contracts

### Data Design

[data-model.md](data-model.md) 定义了三类数据。存储实体是 `sa_indicator` 的 `target_id`（唯一约束是 FR-032 的落点）与四个文案列；数据源是 MongoDB 文档结构（含 10 个固定一级系统、性别分支、结构漂移）与 MySQL 字典；展示结构是接口输出的 `ReportHomeData` / `ReportSystemDetail`，含它们之间必须成立的不变量（首页与详情同源一致、类别与序列等长、系统得分可由加权指标解释、顶层系统可追溯到已登记的 `targetId`）。

### Interface Contracts

- [contracts/README.md](contracts/README.md)：响应封装、错误 key 约定、**两组接口访问控制相互独立**的说明。
- [contracts/report-view.md](contracts/report-view.md)：首页与系统详情接口的路径、参数、响应结构、错误表与约束；明确 `report.not_found` 对外合并"不存在"与"无权访问"。
- [contracts/indicator-target-id.md](contracts/indicator-target-id.md)：指标管理模块的字段扩展与 `targetId` 登记接口。

### Implementation Sequence

1. **后端红灯**：先写 `tests/unit/test_report_view_service.py` 与 `tests/api/test_report_view.py`，把四个错误路径、性别分支、排序、推荐一致性、降级与趋势约束变成失败测试。
2. **数据源接入**：`config.py` 的 `MONGODB_URL`、`mongo.py`、`report_source.py`；用单测覆盖文档解析、字段容错读取与超时归并，**不依赖真实 MongoDB**。
3. **存储与登记**：revision `004`、`indicator_service` 的 `target_id` 与文案读写、冲突用例；随后按 V2 设计稿逐项核对 `inspect_target` 的名称，写出 `sql/seed-report-target-ids.sql`（8 个一级指标 + 各系统下的三级 `targetId`）。
4. **组装服务**：`report_view_service.py` 完成映射、性别分支、排序、推荐组装、直接采集归属与错误区分，使第 1 步的红灯转绿。
5. **接线路由**：`api/report_view.py` 挂到 `/api/v1`，补 i18n 六个 key 与固定值配置；在 `main.py` 挂载 MongoDB 生命周期。
6. **前端红灯**：把 `tests/unit/report-data.spec.js` / `report-order.spec.js` 的固定值断言改为 fixture 断言，并新增 `report-adapter.spec.js`，此时应失败。
7. **前端接入**：`reportClient.js` + `reportAdapter.js`，两个视图改为异步取数与加载/错误态，移除 `src/data/report.js` 的业务值。
8. **回归验收**：Vitest、Playwright、`npm run build` 全绿；后端 `pytest` 与 `ruff` 全绿；按 quickstart 的端到端路径人工核对。

## Testing Strategy

### TDD Order

1. 服务层单测先失败（AsyncMock，不连库），再实现 `report_view_service`。
2. 数据源层单测先失败（文档解析、字段容错、超时归并），再实现 `report_source`——用固定 JSON fixture，不连真实 MongoDB。
3. 接口测试先失败（`make_client()`），再接线路由与 i18n key。
4. 前端适配层测试先失败，再实现 `reportAdapter`；随后才移除模拟数据。
5. 端到端与视觉回归最后作为门禁。

### Test Responsibilities

- **Unit（数据源层）**：报告文档解析、缺失字段容错、`firstTarget` 层级遍历、性别分支选择、超时与连接失败归并、`inspect_target` 字典读取。
- **Unit（服务层）**：`targetId` 命中与未命中跳过、V2 展示口径过滤（10 个中取 8 个）、排序、推荐唯一性与优先级、直接采集固定归属、加权解释自洽、趋势口径一致与不足 6 次不补零、四种错误区分。
- **API（后端）**：四个错误路径的 `code`/`message`；`report.not_found` 对"不存在"与"客户不匹配"返回完全一致；性别分支；首页与详情同一系统字段一致；登记接口的冲突返回明确错误而非 500。
- **Unit（前端）**：DTO→ViewModel 适配、类别与序列等长、缺失文案降级为空、趋势为空时的处理。
- **Component（前端）**：`ReportErrorState` 对四种错误的呈现；加载态不闪现有内容的假象。
- **E2E（前端）**：接口成功路径；接口失败时展示错误态且**不出现演示数据**；两视图间往返数据一致。

## Risk Controls

- **展示口径已确认，但登记工作量大且需逐项核对**：8 个系统下的指标清单要按设计稿逐个登记 `targetId`（骨骼 4 项、免疫力 6 项、女性 5 项、男性 4 项等）。登记错一个 `targetId` 会把该得分挂到错误指标上且不报错。seed 脚本必须逐项对照 `inspect_target` 的名称核对，并作为验收项（SC-009、SC-020）。
- **MongoDB 连接依赖外部配置**：需阿里云白名单（已实测确认可通）。本环境若无有效凭据，只能验证错误路径与指标管理路径。
- **报告文档结构漂移**：同一 collection 内已观察到字段数不一致（皮肤段 37 vs 33）。必须按字段存在性容错读取，禁止假定 schema 统一。
- **两个数据源的超时耦合**：MongoDB 与 MySQL 各自超时都必须落在 3 秒预算内，否则超时本身会成为尾延迟主因（SC-013）。
- **既有前端测试将失效**：`tests/unit/report-data.spec.js`、`report-order.spec.js` 以及组件与视觉基线测试都断言固定业务值（68 / 58 / 54 等）。移除模拟数据前必须先改成 fixture 断言，否则会出现大面积红灯掩盖真实失败。
- **Playwright 配置在非 macOS 机器上不可用**：`playwright.config.js` 的 `webServer.command` 写死了 `/Users/leelee/.cache/codex-runtimes/...`。需一并修正，否则 `npm run test:e2e` 无法运行。
- **新增依赖的影响面**：`motor` 会连带安装 `pymongo`。需确认与现有 Python 3.11 环境兼容，且不影响既有 MySQL 连接池配置。
- **数据源只读边界**：任何为提升性能而考虑给 MongoDB 加索引或给旧库加视图的想法都超出范围，需用户按 Constitution III 另行批准。

## Complexity Tracking

无可通过简化规避的复杂度。四点需要说明：

1. **为何新增一个依赖（motor）**：报告数据在 MongoDB，而现有数据访问全为 async。同步驱动会在 async 路由中阻塞事件循环。这是已批准架构变更的必要组成，不可回避。
2. **为何删除初版设计的关联表**：初版假设标识是不透明的字符串编码且一指标可对应多版本代码，故设计了 `sa_indicator_legacy_code`。核查证实标识就是数字 `targetId` 且与指标一一对应，关联表属过度设计，按 Constitution II 删除，改为 `sa_indicator` 上一个带唯一约束的列。
3. **为何 `report_actions` 使用 JSON 文本**：该字段天然是列表且不需要被检索，子表方案只增加连接成本。见 research R4。这是全库唯一使用 JSON 文本的列。
4. **宪章路径待修订**：宪章第 92 行将规范仓库根写为 `/Users/leelee/Desktop/体检报告/nepstar`，当前工作副本位于 `D:\workspace\nepstar`（同一仓库 `github.com/wxhhkkkl/nepstar`）。本计划按当前工作副本执行；该绝对路径建议在后续宪章修订中改为相对仓库根的表述。本项为文档陈旧，不影响设计合规。
