# Tasks: V2 报告前端框架迁移

**Input**: `specs/002-migrate-v2-vue/` 下的规格、计划、研究、数据模型与契约  
**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/`  
**Canonical Target**: `reportFront/report-v2/`  
**Stack**: Vue 3 + JavaScript + Vue Router Hash + Vite；不使用 TypeScript、Pinia、Axios 或 UI 组件库

**Tests**: 项目宪章要求 TDD。每个故事的测试任务必须先完成并确认因缺少目标实现而失败，之后才可执行对应实现任务。

**Task format**: `[ID] [P?] [Story?] Description with exact path`

- **[P]**: 与同阶段其他标记任务操作不同文件，可并行执行。
- **[US1]/[US2]/[US3]**: 对应 `spec.md` 中的用户故事。
- 所有命令从 `/Users/leelee/Desktop/体检报告/nepstar/reportFront/report-v2` 执行，除非任务另有说明。
- 严禁修改 `reportFront/baogaoV2`、任何 V3 目录、`reportFront/长寿指数UI设计`、`KH503` 和管理后台。

## Phase 1: Setup（迁移准备）

**Purpose**: 在替换现有静态入口前保留可验证基线，并建立独立的现代 Vue 工具链。

- [x] T001 在替换任何入口文件前，用当前静态 V2 保存首页 390/1440 视口、七个系统详情和内分泌/骨骼推荐截图到 `reportFront/report-v2/tests/baseline/legacy/`，并在 `reportFront/report-v2/tests/baseline/README.md` 记录 URL、视口、源文件状态和复现方式
- [x] T002 创建 `reportFront/report-v2/.nvmrc` 与 `reportFront/report-v2/package.json`，固定 Node 24.12+，配置 Vue 3、Vue Router、Vite、Vitest、Vue Test Utils、jsdom、Playwright 及 `dev`、`build`、`preview`、`test`、`test:e2e` 脚本；使用现代 Node 生成 `reportFront/report-v2/package-lock.json`
- [x] T003 [P] 创建 `reportFront/report-v2/vite.config.js`、`reportFront/report-v2/playwright.config.js` 和 `reportFront/report-v2/tests/setup.js`，配置 Vue 插件、jsdom、测试别名、开发/预览服务和 Chromium 项目
- [x] T004 [P] 将现有五项固定报告资源复制到 `reportFront/report-v2/public/`，将原 `styles.css` 与 `overrides.css` 复制到 `reportFront/report-v2/src/styles/`；在迁移验收通过前保留原文件作为基线

**Checkpoint**: 迁移前视觉可复现，现代 Node/Vite/测试工具可独立运行，范围外项目未改变。

---

## Phase 2: Foundational（阻塞性基础）

**Purpose**: 建立首页和详情共用的只读模拟数据、排序规则与图表计算。所有用户故事依赖本阶段。

### Tests first（必须先失败）

- [x] T005 在 `reportFront/report-v2/tests/unit/report-data.spec.js` 编写模拟报告契约测试，覆盖总分 68、阈值 70、七个女性可见系统、唯一 ID、推荐关联、图表字段与零远程初始化，并确认测试因 `src/data/report.js` 尚未实现而失败
- [x] T006 [P] 在 `reportFront/report-v2/tests/unit/report-order.spec.js` 编写 `buildHomeFlow`、性别过滤、系统查找和未知 ID 返回 `null` 的测试，并确认红灯
- [x] T007 [P] 在 `reportFront/report-v2/tests/unit/chart-geometry.spec.js` 编写七类图表几何与边界值测试，并确认红灯

### Implementation

- [x] T008 根据现有 `reportFront/report-v2/data.js` 和 `specs/002-migrate-v2-vue/data-model.md` 创建只读共享数据模块 `reportFront/report-v2/src/data/report.js`，完整迁移报告元数据、七个可见系统、图表、指标、行动建议、两项推荐和资源路径
- [x] T009 实现 `reportFront/report-v2/src/utils/report.js` 中的 `getVisibleSystems`、`getSystemById`、`buildHomeFlow` 与警示派生函数，确保业务顺序来自数据流而不是 CSS `order`
- [x] T010 实现 `reportFront/report-v2/src/utils/chartGeometry.js`，为七类现有图表提供纯函数几何计算、数值钳制和缺失数据回退
- [x] T011 运行基础单元测试并使 T005–T007 全部转绿，将使用的 Node 版本和测试命令记录到 `reportFront/report-v2/tests/baseline/README.md`

**Checkpoint**: 首页与详情可从同一个对象读取完全一致的数据；基础测试全部通过。

---

## Phase 3: User Story 1 — 查看完整长寿指数报告（Priority: P1）🎯 MVP

**Goal**: Vue 首页完整还原 68 分警示、报告信息、七个系统、重点排序、两项紧邻推荐及现有视觉层级。

**Independent Test**: 打开 `/#/`，在 390 与 1440 像素宽度下核对 68 分警示、七个系统、内分泌/睡眠方案/骨骼/钙流失方案顺序、完整产品图和底部声明。

### Tests first（必须先失败）

- [x] T012 [P] [US1] 在 `reportFront/report-v2/tests/components/ScoreOverview.spec.js` 编写 68 分、低于 70 警示类、分数动画终态和 `prefers-reduced-motion` 立即显示测试，并确认红灯
- [x] T013 [P] [US1] 在 `reportFront/report-v2/tests/components/RecommendationCard.spec.js` 编写内分泌/骨骼文案、标签、图片 `alt`、图片完整展示类和无推荐不渲染测试，并确认红灯
- [x] T014 [US1] 在 `reportFront/report-v2/tests/e2e/report-home.spec.js` 编写首页壳层、七系统数量、重点展示流顺序、无隐藏卡片、警示状态和本地资源断言，并确认 Vue 首页尚未完成时测试失败

### Implementation

- [x] T015 [P] [US1] 实现 `reportFront/report-v2/src/composables/useScoreAnimation.js`，支持一次性 0→68 动画、重播基线行为、卸载清理和减少动态效果降级
- [x] T016 [P] [US1] 实现 `reportFront/report-v2/src/composables/useCardReveal.js`，支持卡片最多入场一次、`IntersectionObserver` 缺失回退和减少动态效果立即展示
- [x] T017 [US1] 实现 `reportFront/report-v2/src/components/ScoreOverview.vue`，还原总分、同龄对比、年龄数据和低于 70 分的警示视觉
- [x] T018 [P] [US1] 实现 `reportFront/report-v2/src/components/ReportProfile.vue`，还原报告编号、日期、用户摘要和报告级结论
- [x] T019 [US1] 实现 `reportFront/report-v2/src/components/RecommendationCard.vue`，共享内分泌与骨骼推荐卡结构，使用 `object-fit: contain` 和稳定容器完整展示产品图
- [x] T020 [US1] 实现 `reportFront/report-v2/src/components/SystemAtlas.vue`，按 `buildHomeFlow` 渲染七个现有系统图表与两项紧邻推荐，保留现有差异化 DOM 和 CSS 类名
- [x] T021 [US1] 实现 `reportFront/report-v2/src/views/ReportHome.vue`，组合首页全部业务区块、页脚声明和动画状态，不在组件中复制模拟数据
- [x] T022 [US1] 创建 `reportFront/report-v2/src/main.js`、`reportFront/report-v2/src/App.vue` 和 `reportFront/report-v2/src/router/index.js` 的首页路由，替换 `reportFront/report-v2/index.html` 为单一 Vue 挂载入口并按原顺序加载 `src/styles/styles.css`、`src/styles/overrides.css`
- [x] T023 [US1] 运行 `tests/unit/`、`tests/components/ScoreOverview.spec.js`、`tests/components/RecommendationCard.spec.js` 和 `tests/e2e/report-home.spec.js`，修正 `reportFront/report-v2/src/` 内实现直至全绿，并把首页基线差异记录到 `reportFront/report-v2/tests/baseline/README.md`

**Checkpoint**: `/#/` 已是可独立演示的 Vue 首页 MVP，业务数据、警示、顺序和产品图与迁移前一致。

---

## Phase 4: User Story 2 — 查看系统详情并返回原位置（Priority: P1）

**Goal**: 七个系统均通过 Vue Router 进入共享详情页，数据与首页一致，推荐准确，返回时恢复首页位置，并兼容旧链接。

**Independent Test**: 直接访问及从首页依次进入七个 `/#/system/:systemId` 路由，核对名称、分数、图表、指标和推荐；刷新详情、访问未知 ID、通过旧 URL 进入并返回首页。

### Tests first（必须先失败）

- [x] T024 [P] [US2] 在 `reportFront/report-v2/tests/components/SystemDetail.spec.js` 编写七系统数据映射、直接采集区条件显示、内分泌/骨骼专属推荐、其余系统无推荐和未知 ID 回退测试，并确认红灯
- [x] T025 [US2] 在 `reportFront/report-v2/tests/e2e/system-detail.spec.js` 编写首页到详情、七个 Hash 深链接刷新、未知路由、旧 `detail.html?id=` 跳转、键盘导航和返回滚动位置测试，并确认红灯

### Implementation

- [x] T026 [P] [US2] 实现 `reportFront/report-v2/src/components/DetailChart.vue`，以 Vue 模板和计算属性渲染七种详情图表，禁止使用不受控 `innerHTML`
- [x] T027 [P] [US2] 实现 `reportFront/report-v2/src/composables/useScrollRestoration.js`，用 V2 专用 `sessionStorage` 键保存有限非负滚动值，并在首页布局就绪后恢复
- [x] T028 [US2] 实现 `reportFront/report-v2/src/views/SystemDetail.vue`，按 `systemId` 路由参数读取共享对象，渲染系统概览、图表、指标、直接采集、解释、建议、匹配推荐及未知 ID 回退
- [x] T029 [US2] 扩展 `reportFront/report-v2/src/router/index.js`，加入 `/system/:systemId`、未匹配路由回退及所需滚动行为，使用 `createWebHashHistory`
- [x] T030 [US2] 更新 `reportFront/report-v2/src/components/SystemAtlas.vue`，用可键盘操作的 `RouterLink` 进入详情并在导航前调用滚动位置保存
- [x] T031 [US2] 创建 `reportFront/report-v2/public/detail.html` 兼容页，安全解析旧 `id` 查询参数并跳转到 `/#/system/<encoded-id>`；无 ID 时跳到 `/#/`
- [x] T032 [US2] 运行 `tests/components/SystemDetail.spec.js` 与 `tests/e2e/system-detail.spec.js`，逐个验证七个系统、Hash 刷新、旧链接和滚动恢复并修正 `reportFront/report-v2/src/` 与 `public/detail.html` 直至全绿

**Checkpoint**: 七个详情路由可独立访问，首页/详情数据一致率 100%，推荐与滚动行为正确，旧地址可用。

---

## Phase 5: User Story 3 — 使用报告辅助入口（Priority: P2）

**Goal**: Vue 首页继续提供固定 AI 咨询入口和保存报告长图功能，不接入真实 AI 或后台 API。

**Independent Test**: 在首页顶部、中部和底部点击 AI 入口与保存按钮，验证静态设计图可打开、长图可下载、反馈可见并能自动复位。

### Tests first（必须先失败）

- [x] T033 [US3] 在 `reportFront/report-v2/tests/components/AiConsultEntry.spec.js` 和 `reportFront/report-v2/tests/components/SaveReportButton.spec.js` 编写本地资源、44×44 可操作区、图片替代文本、下载属性、已保存反馈、重复点击和失败回退测试，并确认红灯
- [x] T034 [US3] 在 `reportFront/report-v2/tests/e2e/report-actions.spec.js` 编写 AI 悬浮入口滚动可见性、遮挡检测、静态设计图打开、长图下载及零 AI/后台请求测试，并确认红灯

### Implementation

- [x] T035 [P] [US3] 实现 `reportFront/report-v2/src/components/AiConsultEntry.vue`，保持固定安全区和可访问名称，打开 `public/AI长寿咨询聊天页设计稿.png` 并为资源失败提供可见回退
- [x] T036 [P] [US3] 实现 `reportFront/report-v2/src/components/SaveReportButton.vue`，下载 `public/长寿指数报告V2_手机长图.png`，提供约 1.8 秒反馈、重复点击保护与不可下载回退
- [x] T037 [US3] 更新 `reportFront/report-v2/src/views/ReportHome.vue`，接入 `AiConsultEntry` 和 `SaveReportButton`，保持页脚安全空间但不产生异常大段留白
- [x] T038 [US3] 运行 T033–T034 的组件与端到端测试，修正 `reportFront/report-v2/src/components/` 和 `src/views/ReportHome.vue` 直至全绿

**Checkpoint**: AI 静态入口与保存报告均可一次点击完成目标行为，有明确反馈且不产生远程业务请求。

---

## Phase 6: Polish & Cross-Cutting Validation（全局验收）

**Purpose**: 固化响应式、视觉、网络、构建和长图行为，并在全部测试保护下完成迁移清理。

### Tests first（必须在调整前失败或证明能捕获基线缺陷）

- [x] T039 [P] 在 `reportFront/report-v2/tests/e2e/responsive.spec.js` 编写 320/375/390/768/1440 视口的横向溢出、隐藏卡片、产品裁切、固定入口遮挡与 390 宽尾部留白不超过 140 CSS 像素的断言
- [x] T040 [P] 在 `reportFront/report-v2/tests/e2e/visual-regression.spec.js` 建立首页、七系统详情、两项推荐和减少动态效果终态的截图对照，使用 `tests/baseline/legacy/` 作为迁移参考并设置可解释的差异阈值
- [x] T041 [P] 在 `reportFront/report-v2/tests/e2e/network.spec.js` 记录首页和全部详情请求，允许本地文档、脚本、样式和图片，拒绝 `/api/` 及任何远程业务请求

### Implementation and verification

- [x] T042 根据 T039–T040 结果仅调整 `reportFront/report-v2/src/styles/styles.css` 与 `reportFront/report-v2/src/styles/overrides.css`，修复响应式溢出、产品图裁切、动画终态、固定入口安全区和底部异常留白，不进行视觉改版或类名重构
- [x] T043 更新 `reportFront/report-v2/render.mjs`，改用 Vue 页面现有选择器，等待路由、字体、图片和动画终态后生成完整首页长图，并断言重点模块可见及尾部留白合规
- [x] T044 在全部故事测试通过后，从 `reportFront/report-v2/index.html` 移除旧 `app.js`/`data.js` 引用，并清理未被 Vue 构建使用的 `reportFront/report-v2/app.js`、`reportFront/report-v2/data.js` 与根目录旧 `detail.html`；执行前确认 T001 基线可恢复
- [x] T045 [P] 更新 `reportFront/report-v2/README.md`，记录现代 Node 使用方式、Vue Router 路由表、旧 URL 兼容、模拟数据边界、测试命令、局域网启动方法和明确的范围外目录
- [x] T046 使用现代 Node 依次运行 `npm run test`、`npm run test:e2e`、`npm run build` 和 `npm run preview -- --host 0.0.0.0`，验证 `reportFront/report-v2/dist/index.html`、`dist/detail.html` 及全部中文图片资源存在且预览行为与开发服务一致，并将结果写入 `reportFront/report-v2/tests/baseline/README.md`
- [x] T047 从仓库根目录检查最终变更范围和未跟踪文件，确认仅修改 `reportFront/report-v2/`、`specs/002-migrate-v2-vue/` 及既有 Spec Kit 元数据，并在 `specs/002-migrate-v2-vue/quickstart.md` 补充最终验证过的命令与局域网访问方式

**Checkpoint**: 全量单元、组件、端到端、视觉、网络和生产构建验收通过；V2 完成 Vue 3 迁移，范围外目录无变更。

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 Setup
    ↓
Phase 2 Foundational（阻塞所有故事）
    ├──→ Phase 3 US1：首页 MVP
    ├──→ Phase 4 US2：详情核心可从直达路由开始
    └──→ Phase 5 US3：辅助组件可独立开始

Phase 3 + Phase 4 + Phase 5
    ↓
Phase 6 全局验收与清理
```

- **Phase 1 → Phase 2**: 必须先保存旧页面基线并建立测试环境。
- **Phase 2 → Stories**: 共享数据、排序和图表几何是所有故事的阻塞依赖。
- **US1**: 完成后可独立交付首页 MVP。
- **US2**: `SystemDetail.vue` 可在 Phase 2 后通过直达路由独立开发；T030 首页导航集成依赖 T020 与 T022。
- **US3**: 两个辅助组件可在 Phase 2 后独立开发；T037 首页集成依赖 T021。
- **Phase 6**: 依赖三个故事的目标实现完成；T044 清理必须最后进行，并依赖可恢复基线及全绿测试。

### Within each story

1. 先完成该故事全部测试任务并看到预期红灯。
2. 纯函数/composable 先于依赖它们的组件。
3. 小组件先于页面组合和路由集成。
4. 运行该故事完整测试集并转绿后才通过 checkpoint。
5. 不允许通过删除断言、扩大截图阈值或隐藏内容来获得绿灯。

### Requirement traceability

| Story/Phase | Requirements |
|---|---|
| US1 | FR-001–FR-006、FR-012–FR-015；SC-001–SC-004、SC-008 |
| US2 | FR-007–FR-009、FR-016–FR-017；SC-001、SC-005–SC-006、SC-008 |
| US3 | FR-010–FR-011、FR-016；SC-007–SC-008 |
| Cross-cutting | FR-012–FR-016；SC-001–SC-003、SC-008 |

## Parallel Opportunities

- Setup 中 T003 与 T004 可在 T001 完成后并行。
- Foundational 中 T006 与 T007 可在 T005 同阶段并行编写；实现按 T008 → T009/T010 收敛。
- US1 中 T012/T013、T015/T016/T018 可分别并行，T020–T022 按组合关系顺序完成。
- US2 中 T024、T026、T027 操作不同文件；T028–T031 需按详情、路由、首页集成和兼容入口依赖收敛。
- US3 中 T035 与 T036 可并行，随后由 T037 集成。
- 全局验收测试 T039–T041 可并行编写，T042–T044 必须依据测试结果顺序调整。

## Parallel Example: User Story 2

```text
Task T024: 编写 SystemDetail 组件契约测试
Task T026: 实现独立 DetailChart 组件
Task T027: 实现独立滚动恢复 composable

完成后汇合：
T028 SystemDetail 页面 → T029 路由 → T030 首页导航 → T031 旧地址兼容 → T032 验收
```

## Implementation Strategy

### MVP first

1. 完成 Phase 1 与 Phase 2。
2. 完成 US1，交付可独立查看的 Vue 首页 MVP。
3. 在 checkpoint 核对 68 分警示、七系统、重点顺序和两项完整产品图。
4. 再增加详情导航与辅助入口，避免一次替换全部页面后才发现视觉回归。

### Incremental delivery

1. **Foundation**: 工具链 + 共享模拟数据 + 纯函数。
2. **US1**: Vue 首页及首轮视觉对照。
3. **US2**: Vue Router 详情、滚动恢复和旧链接兼容。
4. **US3**: AI 静态入口和长图下载。
5. **Polish**: 五档响应式、网络、长图、生产构建和范围审计。

## Notes

- `[P]` 只表示文件级并行安全，不表示可忽略阶段依赖。
- `reportFront/` 当前可能尚未完整纳入 Git；替换或清理旧文件前必须确保 T001 基线可恢复。
- 迁移期间禁止顺便调整业务文案、分数、推荐内容或设计风格。
- 实施过程中发现需要后台 API、真实 AI、Pinia、Axios、TypeScript 或 UI 组件库时，应停止对应扩展并先取得用户批准。
- 建议每个阶段 checkpoint 后提交一个小而可回退的 Git 变更组。
