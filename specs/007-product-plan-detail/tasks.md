# Tasks: 产品方案详情页

**Branch**: `008-product-plan-detail`

**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[contracts/](contracts/)、[quickstart.md](quickstart.md)。唯一视觉基准为 [第三张设计稿](assets/design-03.png) 及 [selected-design.md](selected-design.md)。

**Stage**: 工程主体已实现，进入浏览器和整体验收；T039人工评审须真实证据，发布不在本轮范围。

## Format and Scope

任务统一为 `- [ ] T编号 [P可选] [US故事标签] 描述及具体路径`。`[P]`仅表示同阶段、不同文件的测试任务可并行；阶段门禁仍然生效，不自动启动子代理。

仓库根目录为 `/Users/leelee/Desktop/体检报告/nepstar`，下列路径均相对此根目录。实际维护应用为 `reportFront/src/` 与 `reportFront/tests/`，后端为 `nepstarAdmin/backend/`。沿用Vue 3 + JavaScript、现有FastAPI及依赖；不恢复已不存在的reportFront/report-v2，不修改旧版、V3、KH503或管理维护页面。

依 `.specify/memory/constitution.md` Principle I及任务模板，实施必须TDD：每批新增行为测试先运行并确认因缺少目标行为失败，记录Red，然后最小实现Green，再重构。导入外部数据库失败、环境错误或未执行不算Red。测试用FakeDB/AsyncMock及模拟接口，不写外部库、不调用真实模型。

## Phase 1: Setup

**Goal**: 固定目录和验收样例，沿用已有工程，不安装框架或初始化数据库。

- [x] T001 核对branch、feature.json及现行前端目录，在 `specs/007-product-plan-detail/validation.md` 建立实施证据记录，引用 `specs/007-product-plan-detail/selected-design.md`，预留每批Red/Green命令结果、截图、SC-002及SC-007状态；不写凭证或报告正文。
- [x] T002 在 `reportFront/tests/fixtures/planDetail.js` 和 `nepstarAdmin/backend/tests/fixtures/plan_detail.py` 建立明确标记为测试数据的方案样例：98<99、等于阈值、0/缺分、多有效关联及非当前推荐、overlay、0/1/多商品、空/恶意正文、坏图和AI维护；复用已有测试工具，无真实数据库或模型调用。

**Checkpoint**: 样例可在现有测试环境导入，不需要新增依赖、迁移、外部写入或改阈值。

## Phase 2: Foundational — Shared Read and Navigation Boundaries

**Goal**: 完成三个故事共用的严格关联、导航快照和咨询全局状态基础。完成后方可进入故事阶段。

### Red

- [x] T003 [P] 在 `nepstarAdmin/backend/tests/unit/test_report_plan_context.py` 新增轻量方案context失败测试：报告归属/ready、真实分支与父系统、完整有效集合、指定项优先/省略首项、代码歧义拒绝、98<99/等值不命中、0/缺分及overlay停用/解绑/改阈值；确认Red，记录到 `specs/007-product-plan-detail/validation.md`。
- [x] T004 [P] 在 `reportFront/tests/unit/plan-navigation.spec.js` 新增导航失败测试：reportId/userId别名归一、命名路由白名单、原AI上下文不可覆盖、30分钟/20条限制、跨身份/损坏/循环引用拒绝、storage不可用、无快照回同报告首页及内部标记剔除；确认Red。
- [x] T005 [P] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_service_control.py` 新增全局入口状态失败测试：deployment veto、维护、enabled/provider匹配及配置读取故障；断言只有读取，没有guest/consent/session/turn创建或provider调用；确认Red。

### Green

- [x] T006 在 `nepstarAdmin/backend/app/services/report_view_service.py` 实现轻量严格方案context读取，复用 `_load_document_and_meta`、`_load_registry` 及 `report_plan_source.fetch_plans_for_indicators`；返回完整有效关联与当前商品ID，沿用overlay和严格阈值，新增统一方案不可用业务异常，不读商品正文/图库；使T003通过。
- [x] T007 在 `reportFront/src/utils/planNavigation.js` 实现有界快照和统一命名路由构造，在 `reportFront/src/composables/useScrollRestoration.js` 补充同报告/客户/方案/指标校验和一次性恢复支持；原首页/系统机制保持兼容，快照不存聊天、草稿、token、正文或session；使T004通过。
- [x] T008 在 `nepstarAdmin/backend/app/services/ai_consult_control.py` 实现只读公开入口状态helper，组合现有deployment/settings/provider校验；不导入API模块或调用bootstrap，不查询用户配额、不创建guest；配置异常返回局部不可用，使T005通过。

**Checkpoint**: T003–T005都有有效Red证据且已Green；所有未知项仍按既有契约处理，没有扩张读取权限或新增数据存储。

## Phase 3: US1 — 打开与本次报告关联的方案 (P1, MVP)

**Goal**: 三个入口一次进入同一报告绑定详情，显示真实基础内容，深链可读，返回恢复来源位置。

**Independent Test**: 采用真实结构的空详细正文样例，从首页、系统及AI列表进入同一方案，核对报告/客户/方案/点击指标/分值/商品一致；刷新和新窗口仍可读取，分别返回原来源。AI来源仅恢复展开及阅读位置，聊天按原规则重新初始化。

### Red

- [x] T009 [P] [US1] 在 `nepstarAdmin/backend/tests/unit/test_report_plan_source.py` 及 `nepstarAdmin/backend/tests/unit/test_report_plan_api.py` 新增批量商品基础读取和详情GET失败测试：有效商品ID、status过滤、关联排序、cover/图库去重、参数422、业务404/409/503、外客户同响应、源超时不误报不存在及no-store；独立挂载router并覆写依赖，确认Red。
- [x] T010 [P] [US1] 在 `reportFront/tests/unit/plan-detail-client.spec.js` 及 `reportFront/tests/unit/report-adapter.spec.js` 新增请求与基础DTO适配失败测试：snake_case参数、plan_not_found错误、timeout/network、原始比例图、名称完整、0分与缺分、对应本地商品图映射；确认Red。
- [x] T011 [P] [US1] 在 `reportFront/tests/components/PlanDetail.spec.js` 新增页面失败测试：直接深链、缺参不请求默认报告、骨架/业务错误/重试、响应身份校验、切换方案清旧数据及迟到响应不覆盖、无产品和无图片状态；确认Red。
- [x] T012 [P] [US1] 在 `reportFront/tests/components/RecommendationCard.spec.js` 及 `reportFront/tests/components/AiConsultLifecycle.spec.js` 新增三入口和来源恢复失败测试：统一“查看方案”、保存点击指标、AI有消息/草稿时可取消离开、确认后清理会话、正常bootstrap后恢复plansExpanded/scrollY且不恢复消息；确认Red。

### Implementation

- [x] T013 [US1] 在 `nepstarAdmin/backend/app/services/report_plan_source.py` 新增有效商品ID的批量只读补全，读取名称/简介/封面/内部正文和有序图库；保持方案商品次序及overlay，不重新查远端关系，不作N+1；SQLAlchemy异常转换为既有来源不可用异常，使T009的源层断言通过。
- [x] T014 [US1] 在 `nepstarAdmin/backend/app/schemas/report_view.py` 定义公开DTO，在 `nepstarAdmin/backend/app/services/report_view_service.py` 组合基础方案/关联/商品/全局咨询状态，在 `nepstarAdmin/backend/app/api/report_view.py` 挂载契约GET及错误映射、no-store/no-referrer；只公开允许字段，不透传raw HTML，正文结构在US2补齐；使T009的API断言通过。
- [x] T015 [US1] 在 `reportFront/src/api/reportClient.js` 新增详情读取及PLAN_NOT_FOUND映射，在 `reportFront/src/data/reportAdapter.js` 新增基础详情适配；复用现有超时/身份解析/素材映射，在 `reportFront/src/components/ReportErrorState.vue` 只补方案不可用文案；使T010通过。
- [x] T016 [US1] 新增 `reportFront/src/views/PlanDetail.vue` 并在 `reportFront/src/router/index.js` 注册 `/plans/:planId`；显示第三张基础信息层级、真实指标/商品、骨架和局部空状态，监听完整身份及请求版本；快照不能作为正文缓存，恢复在真实内容就绪后执行；使T011通过。
- [x] T017 [US1] 修改 `reportFront/src/components/RecommendationCard.vue`，核对 `reportFront/src/views/ReportHome.vue` 与 `reportFront/src/views/SystemDetail.vue` 的入口参数，通过统一helper进入详情并保存有身份校验的来源位置；文案统一“查看方案”，不再指向系统概览或AI页；通过T012对应断言。
- [x] T018 [US1] 修改 `reportFront/src/views/AiConsult.vue` 的匹配方案入口、阅读快照提交及重新load后的恢复时机；离开确认取消不提交恢复标记，确认后仍结束/清理，返回仅恢复plansExpanded和scrollY；保留 `reportFront/src/App.vue` 现有KeepAlive范围，使T012通过。
- [x] T019 [US1] 运行T009–T012及受影响的 `reportFront/tests/unit/system-scroll-restoration.spec.js`、`reportFront/tests/components/ReportErrorState.spec.js`，在 `specs/007-product-plan-detail/validation.md` 记录US1 Green、三入口、深链和来源恢复结果；发现回归在本故事范围内修复。

**Checkpoint / MVP**: 方案基础读取与三个入口可独立演示。US2的完整正文阅读、US3的双操作尚未验收，不能以此宣布全功能完成或发布；不为未完成字段、内容或操作伪造成功状态。

## Phase 4: US2 — 舒适阅读方案与配套产品 (P1)

**Goal**: 完成第三张的舒展布局，提供真实多产品、独立展开、安全正文及多图阅读。

**Independent Test**: 使用一项/多项/无产品、空/恶意正文、缺图、长名称样例核对维护内容、顺序、独立展开与图片；清洗后无内容不出现空面板，正文不执行脚本，所有内容可自然滚动。

### Red

- [x] T020 [P] [US2] 在 `nepstarAdmin/backend/tests/unit/test_product_content.py` 及 `nepstarAdmin/backend/tests/unit/test_report_plan_source.py` 新增安全正文失败测试：段落/标题/列表/图、空标签/只含主动内容、事件属性、危险/混淆URL、畸形嵌套及100000字符/1000块或列表项/32层边界；检查真实截断标记，确认Red。
- [x] T021 [P] [US2] 在 `reportFront/tests/components/PlanProductDetails.spec.js` 与 `reportFront/tests/components/PlanDetail.spec.js` 新增产品阅读失败测试：独立展开、aria/键盘、清洗后空正文不显示入口、0/1/多图及失败占位、真实长名称、首个有图商品hero、截断提示、对应免责声明及reduced-motion；确认Red。

### Implementation

- [x] T022 [US2] 新增 `nepstarAdmin/backend/app/services/product_content.py`，使用HTMLParser生成契约规定的有限结构块，丢弃主动子树/属性并验证资源URL，限制长度/节点/深度且不抓取网络；不使用字符串黑名单配v-html，不生成商品摘要，使T020解析测试通过。
- [x] T023 [US2] 在 `nepstarAdmin/backend/app/services/report_view_service.py` 组装每件商品detail_blocks/detail_truncated，在 `nepstarAdmin/backend/app/schemas/report_view.py` 补齐有限块验证；统一处理封面/图库/正文图的安全URL，永不公开raw HTML或后台字段，使T020及API内容断言通过。
- [x] T024 [US2] 新增 `reportFront/src/components/PlanProductDetails.vue`，使用Vue文本插值和受控图片渲染安全块，实现商品各自展开、多图序号/切换、单图无切换、坏图占位、aria属性及200–320ms/reduced-motion反馈；没有清洗后正文不显示展开入口，使T021组件断言通过。
- [x] T025 [US2] 在 `reportFront/src/data/reportAdapter.js` 适配真实安全正文、truncated及多图；维持商品ID/排序和原有分数颜色语义，不根据商品配色、方案匹配或98分编异常解释；更新 `reportFront/tests/unit/report-adapter.spec.js` 对应行为断言并记录Red→Green。
- [x] T026 [US2] 在 `reportFront/src/views/PlanDetail.vue` 接入产品组件并完成第三张布局：完整hero、浅蓝关联、自然段说明、轻量产品行、居中免责声明、固定双操作dock与实际底部安全空间；正文15–16px、辅助≥13px、边距18–20px、主要留白约24–32px，允许320–414px和短屏自然滚动，不套用错误礼盒图。
- [x] T027 [US2] 运行T020–T021及 `reportFront/tests/unit/report-adapter.spec.js`、`nepstarAdmin/backend/tests/api/test_report_view.py` 的受影响断言，在 `specs/007-product-plan-detail/validation.md` 记录US2 Green及0/1/多商品、无正文/缺图/恶意正文结果；核对无v-html、无虚构产品字段。

**Checkpoint**: 页面满足第三张的内容和留白，商品正文及图片来源真实；无价格、剂量、疗程、营销承诺或空详情容器。

## Phase 5: US3 — 查看关联指标或继续咨询 (P2)

**Goal**: 两个指标入口同目标，AI主按钮承接正确方案，完整有效方案在后续取证仍能验证，所有返回不恢复历史聊天或自动提问。

**Independent Test**: 详情→指标→详情原位置→三种来源；详情→AI→详情原位置；核对同报告/客户/方案/指标、0自动turn。有效但非当前推荐卡方案可进入AI；停用/解绑后取证降级且不调用模型。

### Red

- [x] T028 [P] [US3] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_plan_context.py`、`nepstarAdmin/backend/tests/unit/test_ai_consult_plan_sources.py` 和 `nepstarAdmin/backend/tests/unit/test_ai_consult_evidence.py` 新增失败测试：非首页当前卡的完整有效方案、绑定身份及显式参数、仅允许窄plan_context、禁止读取图库/正文、catalog/detail/context分数一致、建会话后停用/解绑仍降级且0模型调用；确认Red。
- [x] T029 [P] [US3] 在 `reportFront/tests/components/PlanDetail.spec.js`、`reportFront/tests/components/IndicatorDetail.spec.js` 和 `reportFront/tests/components/AiConsultLifecycle.spec.js` 新增失败测试：两个指标操作同路由、其他关联项不改primary、fromPlan优先返回、方案展开/图片/scroll恢复、AI原入口不被覆盖、维护禁用、取消离开、正常进入0自动提问及浏览器返回；确认Red。

### Implementation

- [x] T030 [US3] 在 `nepstarAdmin/backend/app/services/ai_consult_sources.py` 增加显式plan_context窄读取分支，复用T006并经过ReadOnlyReportSession，校验绑定report/customer/plan/indicator后只返回所需名称/说明/指标/分数/阈值；在 `nepstarAdmin/backend/app/services/ai_consult_plan_context.py` 接入完整有效context验证，不增加任意工具、原SQL或商品正文访问。
- [x] T031 [US3] 修改 `nepstarAdmin/backend/app/api/ai_consult.py` 的bootstrap/create-session方案入口，通过T030严格context支持非当前推荐卡的有效方案；保留原失效链接的stale降级/entry_unavailable语义及原guest/consent/配额校验，不自动创建问题或调用模型。
- [x] T032 [US3] 修改 `nepstarAdmin/backend/app/services/ai_consult_evidence.py` 每次回答的方案取证，复用窄context重验真实系统/指标及catalog/detail/context分数、严格阈值，沿用_safe_plan_description/_add_plan_fact和plan_stale降级；不把商品正文、图片或URL文案传入模型，使T028通过。
- [x] T033 [US3] 在 `reportFront/src/views/PlanDetail.vue` 共用同一个primary指标computed route实现关联快捷入口及底部次按钮，其他关联项各去自己的指标；在 `reportFront/src/views/IndicatorDetail.vue` 优先解析合法fromPlan，在 `reportFront/src/router/index.js` 配合真实内容就绪后恢复，支持方案→指标→方案→来源，保护原primary和origin快照。
- [x] T034 [US3] 在 `reportFront/src/views/PlanDetail.vue` 实现蓝色“咨询 AI 长寿顾问”主操作及不可用说明，按契约传同报告/方案/指标/fromPlan/planNavKey；在 `reportFront/src/views/AiConsult.vue` 增加优先方案backTo，保留原离开守卫、结束/重载和零自动提问规则，使T029通过。
- [x] T035 [US3] 运行T028–T029、`nepstarAdmin/backend/tests/unit/test_ai_consult_service_control.py`、`nepstarAdmin/backend/tests/unit/test_local_ai_runtime.py` 及受影响AI组件回归，在 `specs/007-product-plan-detail/validation.md` 记录US3 Green、完整多层返回、失效取证及零自动调用证据。

**Checkpoint**: 三个故事均可按独立场景验证；停用/解绑、源故障和AI暂停不会被当作成功，不改变原始报告或远端配置。

## Phase 6: Cross-cutting Validation and Review

**Goal**: 验证整条路径及用户选定布局，明确工程检查与人工/性能验收的实际状态。

- [x] T036 依据 `specs/007-product-plan-detail/quickstart.md` 通过 `nepstarAdmin/backend/scripts/test_report_plan.py`（内存元数据、禁止SQL/socket连接）运行受影响的pytest/Vitest回归和 `reportFront/package.json` 中build命令，在 `specs/007-product-plan-detail/validation.md` 记录实际命令、版本及结果；不盲目运行会反射外部库的全套测试，不把未执行算通过。
- [ ] T037 （桌面视窗/键盘已完成，真机软键盘及OS偏好切换待人工）通过当前允许的浏览器工作流对照 `specs/007-product-plan-detail/assets/design-03.png`，在320/375/390/414px及667–896px窗口验收三入口、深链/新窗口、返回、长标题、键盘/aria、44px、减少动态效果、安全区/软键盘和滚动遮挡；将脱敏截图保存在 `specs/007-product-plan-detail/assets/validation/` 并写入 `specs/007-product-plan-detail/validation.md`，不绕过浏览器工具限制。
- [x] T038 按 `specs/007-product-plan-detail/quickstart.md` 测量正常网络只读详情正文/结果展示时间，记录样本量、数据规模、环境、时间范围及p95到 `specs/007-product-plan-detail/validation.md`，核对SC-007≤3s及始终有加载反馈；若环境不可达或样本不足则明确未验证，不改远端数据或宣称达标。
- [ ] T039 将SC-002五人可用性评审结果记录到 `specs/007-product-plan-detail/validation.md`，核验至少4人在10秒内定位名称/关联指标/产品；无真实样本保持此项未完成并注明需人工验收，不主动联系他人或用模拟用户替代。
- [x] T040 核对 `specs/007-product-plan-detail/spec.md` 的FR-001–017和SC-001–008逐项证据，更新 `specs/007-product-plan-detail/validation.md` 与 `specs/007-product-plan-detail/quickstart.md` 的实际状态；检查git diff仅涉及计划范围，外部写入/自动模型请求/虚构字段为0，无依赖、迁移、凭证或部署变更；未完成的人工/性能项继续明示，不把工程完成等同全部验收通过。

## Dependencies and Execution Order

```text
Setup T001–T002
  → Foundation Red T003/T004/T005
  → Foundation Green T006/T007/T008
  → US1 Red T009/T010/T011/T012 → T013–T019
  → US2 Red T020/T021 → T022–T027
  → US3 Red T028/T029 → T030–T035
  → T036–T040
```

US1为最小可独立演示阶段。US2、US3实际共享PlanDetail及service/adapter文件，因此按US1→US2→US3整合，不声称三个故事能无冲突同时修改。US2依赖US1基础DTO/view；US3依赖US1导航/接口及US2最终页面/阅读状态。每个故事都有独立验收样例；测试可Mock已完成的基础，不要求真实模型或外部写入。

| 实施任务 | 必要前置 |
| --- | --- |
| T006 / T007 / T008 | 分别有T003 / T004 / T005的有效Red证据。 |
| T013 / T014 | T009 Red；T014另需T006、T008、T013。 |
| T015 / T016 | 分别T010 / T011 Red；T016另需T007、T014、T015。 |
| T017 / T018 | T012 Red，且T016路由可用。 |
| T019 | T013–T018完成。 |
| T022 / T023 | T020 Red；T023另需T022及T014。 |
| T024 / T026 | T021 Red；T026另需T023–T025。 |
| T025 | 在该任务内部先补适配行为Red，再实现；不要先改adapter后补通过测试。 |
| T027 | T022–T026完成。 |
| T030–T032 | T028 Red；按source→API入口→每次证据顺序整合。 |
| T033 / T034 | T029 Red；T034另需T031可接受完整context。 |
| T035 | T030–T034完成。 |
| T036–T040 | 各故事Green；T040汇总真实验收状态，不能覆盖尚未完成的T039。 |

同一文件后续Red→Green必须保留前一阶段行为。界面几何/视觉以真实浏览器证据验收，DOM单测不能代替；同理单次加载不能代替p95。

## Parallel Examples

仅以下组内的测试文件不冲突，可在各自前置完成后并行准备和执行；共享validation记录最后顺序合并。并行机会是任务属性，不授权当前自动启动代理。

| 组 | 可并行项 | 前置 |
| --- | --- | --- |
| Foundation | T003后端关联、T004前端导航、T005后端全局状态 | T001–T002完成。 |
| US1 | T009后端源/API、T010客户端/adapter、T011详情组件、T012入口/AI生命周期 | Foundation完成。 |
| US2 | T020后端正文/源、T021产品/页面阅读 | US1完成。 |
| US3 | T028后端AI上下文/取证、T029前端嵌套返回 | US2完成。 |

US1示例：T009的 `tests/api/test_report_view.py` 与T011的 `tests/components/PlanDetail.spec.js` 可并行写Red；之后按T013→T014及T015→T016整合。US2示例：T020与T021可并行，解析和页面仍按各自Red后实施。US3示例：T028和T029可并行，T030–T034按依赖整合，不并发修改AiConsult或PlanDetail。

## Requirement Coverage

| Requirement | Tasks |
| --- | --- |
| FR-001 | T006、T013–T016、T023–T026 |
| FR-002 | T012、T017、T018 |
| FR-003 | T004、T007、T011、T018、T029、T033–T035 |
| FR-004 | T003、T006、T009、T014 |
| FR-005 | T003、T006、T010、T025、T028、T032 |
| FR-006 | T002、T009、T013、T021、T024 |
| FR-007 | T013–T015、T020、T022–T025、T040 |
| FR-008 | T020–T024、T027 |
| FR-009 | T009、T013、T021、T023–T026 |
| FR-010 | T005、T008、T028–T035 |
| FR-011 | T016、T025、T026、T037 |
| FR-012 | T021、T026、T037 |
| FR-013 | T026、T029、T037 |
| FR-014 | T021、T024、T037 |
| FR-015 | T009–T011、T014–T016、T021、T034 |
| FR-016 | T021、T026、T037 |
| FR-017 | T001–T003、T005、T006、T008、T009、T013、T028、T030–T032、T040 |
| SC-001 | T012、T017–T019、T037 |
| SC-002 | T039 |
| SC-003 | T002、T020–T027、T040 |
| SC-004 | T026、T037 |
| SC-005 | T021、T024、T037 |
| SC-006 | T004、T007、T012、T018、T029、T033–T035、T037 |
| SC-007 | T011、T016、T038 |
| SC-008 | T005、T009、T013、T028、T030–T032、T035、T040 |

## Implementation Strategy and Status

先完成Setup/Foundation及US1作为内部MVP，再增量完成US2、US3，最后做跨页面和视觉验收。每个逻辑单元保留Red/Green证据，并按仓库工作流提交；当前任务生成阶段不自动git提交、不部署、不实测模型。

当前38/40项完成；T037实机部分及T039人工评审未完成。共有40项：Setup 2、Foundation 6、US1 11、US2 8、US3 8、跨故事验收5。11项标记[P]，仅在上述四组各自前置满足后可并行。全部任务ID唯一、连续，故事任务均有US标签及具体文件路径。

本机无pwsh，前置检查通过等价本地步骤完成：解析feature.json、核对分支/目录及spec/plan，发现research、data-model、contracts、quickstart齐全；未安装工具或修改运行环境。可选前后置 `/speckit-git-commit` 已检查，项目git-config关闭自动提交，因此未执行。

一致性检查已完成；用户于2026-10-26批准全部修订及接口范围，进入 `/speckit.implement`。
