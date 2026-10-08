# Tasks: 基于个人报告的 AI 长寿咨询

**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[报告端接口](contracts/access-and-consult.md)、[管理端接口](contracts/admin.md)、[quickstart.md](quickstart.md)

**范围**: 当前报告端 `reportFront/`（Vue 3 + JavaScript）、后端 `nepstarAdmin/backend/`、管理端 `nepstarAdmin/frontend/`。不编辑旧报告目录。所有新写入仅限 `nepstar`；`platform`、`kj_fastplus`、MongoDB 和其他库只读。

**TDD 规则**: 各故事的测试任务先写并运行，确认红灯后才执行对应实现任务；实现后运行绿灯和相关回归。测试里的匿名 guest、假模型、假报告不得向真实服务发送健康数据。

**当前状态**: T001 已完成；用户已确认公开链接匿名咨询和当前标签页刷新恢复，并在 2026-10-08 批准现有 FastAPI 流式接口与仅 `nepstar` 新表的架构。真实模型先保持关闭，服务商的数据处理条件未落实前不得外发健康数据。

## Phase 1: Setup（公开入口与架构边界）

**Goal**: 核对公开报告的现有定位逻辑，把匿名凭证、模型处理范围和测试替身落实成可执行契约。

- [x] T001 在 `reportFront/tests/unit/report-client-params.spec.js` 与 `specs/006-ai-longevity-consult/contracts/access-and-consult.md` 核对公开报告链接的 `reportId/userId` 解析、报告归属校验和匿名聊天建立流程；报告链接可新建 guest，但不能凭链接读取已有聊天。
- [x] T002 在 `specs/006-ai-longevity-consult/research.md` 记录用户对现有 FastAPI 中新增流式通信与新 `nepstar` 表的架构确认；模型服务商、健康数据处理、密钥和告知版本仍是 T027/T064 的上线门槛，未确认前真实模型保持关闭。
- [ ] T003 [P] 在 `nepstarAdmin/backend/tests/ai_consult_fixtures.py` 增加隔离的公开报告只读源、两个 guest 凭证及模型替身 fixtures；咨询测试用 `--noconftest` 避免现有公共夹具导入旧库连接，禁止真实外部请求与真实数据库写入。
- [ ] T004 [P] 在 `reportFront/tests/fixtures/aiConsult.js` 增加两个匿名标签页、两份报告、同意/失效/生成失败的前端测试数据，不复用截图原型的演示答案作为生产数据。

**Checkpoint**: T001 已核实公开链接行为；T002 已记录新表与模型通信的架构批准。后续仍只用本地假数据测试，直到模型服务商条件另行确认。

---

## Phase 2: Foundational（所有故事的共同前置）

**Goal**: 建立只能写 `nepstar` 的业务通道、匿名访客结构和每次聊天请求都要验证的报告绑定范围。

- [x] T005 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_storage_boundary.py` 先写失败测试：`NEPSTAR_DATABASE_URL` 缺失、库名不是 `nepstar` 或把旧库会话用于咨询写入时一律拒绝。
- [x] T006 在 `nepstarAdmin/backend/app/database.py` 与 `nepstarAdmin/backend/app/config.py` 建立显式绑定 `nepstar` 的咨询写会话及启动校验，并使 T005 转绿；既有 `get_db` 保持报告只读用途。
- [x] T007 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_schema_boundary.py` 先写失败测试：迁移 SQL 不得触及 `nepstar.sa_ai_consult_*` 之外的对象；启动配置不允许静默使用默认旧库。
- [x] T008 在 `nepstarAdmin/backend/app/models/new/sa_ai_consult.py` 和 `nepstarAdmin/backend/alembic/versions/006_ai_consult.py` 建立 settings、rule_version、consent、session、turn、generation、admin_audit 表与唯一约束；离线编译 SQL 后核对只涉及 `nepstar`，使 T007 转绿。迁移文件已编写但尚未对任何数据库执行。
- [ ] T009 在 `nepstarAdmin/backend/tests/api/test_ai_consult_access.py` 先写失败测试：有效公开链接可为两个独立 guest 建立聊天；仅凭链接、伪造/过期/撤销/跨报告凭证不得读另一 guest 的聊天。
- [ ] T010 在 `nepstarAdmin/backend/app/security/ai_consult_access.py` 和 `nepstarAdmin/backend/app/schemas/ai_consult.py` 实现至少 256 位随机 guest 凭证、仅存摘要、绑定报告及每次聊天请求校验；使 T009 转绿，后台管理员 JWT 不可代替 guest 凭证。
- [x] T011 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_read_boundary.py` 先写失败测试：候选取数工具只接受固定名称和报告范围；MySQL 仅允许现有报告服务的固定 SELECT，禁止 DML/DDL、任意 SQL、URL 参数。MongoDB 仍通过既有固定 `find_one/find` 路径读取；真实模型尚未接入。
- [x] T012 在 `nepstarAdmin/backend/app/services/ai_consult_sources.py` 实现候选只读报告适配与工具白名单；只投影必要报告事实，旧展示页包含未来记录的趋势暂不传给 AI。读连接与 `nepstar` 咨询写连接分离，实际模型接入仍需 T021～T029。

**Checkpoint**: 用只读外部数据源账号、独立 `nepstar` 测试库验证 T005～T012；任何写库目标不明时不得进入真实数据开发。

---

## Phase 3: User Story 1 — 从当前报告开始咨询（P1，首个可演示增量）

**Goal**: 从公开报告进入对应匿名咨询欢迎页，在明确同意后才能外发必要数据；只浏览欢迎页不触发模型和扣额。

**Independent Test**: 从两份不同公开报告进入，核对报告日期、三个真实可问问题、同意状态和返回位置；同链接的新 guest 无法读取其他访客的聊天，未同意不外发健康数据。

### Tests（先红）

- [ ] T013 [P] [US1] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_bootstrap.py` 写失败契约测试，覆盖 `/guest-contexts`、`/bootstrap`、`/consents`、`/sessions` 的报告绑定、guest 隔离、拒绝同意及零模型调用。
- [ ] T014 [P] [US1] 在 `reportFront/tests/components/AiConsultWelcome.spec.js` 写失败组件/路由测试，覆盖欢迎、骨架屏、同意弹层、`sessionStorage` 刷新恢复、guest 失效后新建及返回原滚动位置。

### Implementation

- [ ] T015 [US1] 在 `nepstarAdmin/backend/app/api/ai_consult.py` 实现公开报告只读核对、`/guest-contexts` 建立与统一 guest 凭证依赖，按 `nepstarAdmin/backend/app/main.py` 注册路由；报告无效时不给 guest。
- [ ] T016 [US1] 在 `nepstarAdmin/backend/app/services/ai_consult_consent.py` 与 `nepstarAdmin/backend/app/api/ai_consult.py` 实现版本化告知、同意/撤回及“未同意零外发”。
- [ ] T017 [US1] 在 `nepstarAdmin/backend/app/services/ai_consult_sessions.py` 与 `nepstarAdmin/backend/app/api/ai_consult.py` 实现报告范围内 bootstrap、欢迎摘要及当前 guest 会话恢复；不因欢迎页加载调用模型。
- [ ] T018 [US1] 在 `reportFront/src/views/AiConsult.vue`、`reportFront/src/router/index.js` 和 `reportFront/src/api/aiConsultClient.js` 实现真实路由、状态骨架屏、同意流程、按报告隔离的 `sessionStorage` 凭证和失效后新建页，沿用已评审 `ui/` 视觉结构。
- [ ] T019 [US1] 在 `reportFront/src/components/AiConsultEntry.vue` 与 `reportFront/src/views/ReportHome.vue` 将首页静态图片链接改为咨询路由，并使用 `reportFront/src/composables/useScrollRestoration.js` 恢复返回时阅读位置。
- [ ] T020 [US1] 运行 `nepstarAdmin/backend/tests/api/test_ai_consult_bootstrap.py` 与 `reportFront/tests/components/AiConsultWelcome.spec.js`，把两报告、两个 guest、拒绝同意和公开链接的绿灯结果记录到 `specs/006-ai-longevity-consult/quickstart.md`。

**Checkpoint**: 当前公开报告欢迎页可独立演示；仅凭报告链接不能读取其他 guest 的聊天。

---

## Phase 4: User Story 2 — 有依据的报告解读（P1）

**Goal**: 按当前报告和实际指标回答问题，显示可回看的来源；旧报告比较只取其当时及以前的记录。

**Independent Test**: 对低分、正常分、缺失/冲突数据和旧报告提问，回答中的名称、分数、日期和归属均能与读取的证据对应；未来记录不进入旧报告回答。

### Tests（先红）

- [x] T021 [P] [US2] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_evidence.py` 先确认缺少模块时红灯，再覆盖当前报告指标索引、维护文案、缺项/分数冲突、去身份化和按需检索；候选层测试已转绿。
- [x] T022 [P] [US2] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_history.py` 写失败测试，覆盖同客户同指标、当前报告时间上界、最多六次、无效日期和无历史；纯替身回归已转绿。
- [x] T023 [P] [US2] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_answer.py` 补充候选 SSE 契约测试：已检索证据 ID 可回看，错误分数/日期、未知来源和危险文案只发错误事件；隔离测试已通过。
- [ ] T024 [P] [US2] 在 `reportFront/tests/components/AiConsultEvidence.spec.js` 写失败测试，覆盖依据展开、同份报告的系统/指标跳转和返回聊天位置。

### Implementation

- [x] T025 [US2] 在 `nepstarAdmin/backend/app/services/ai_consult_evidence.py` 组装按问题相关的报告事实、维护文案与路由证据；模型上下文不含报告号、客户号、设备字段或路由，分数冲突不选边，T021 转绿。当前日期明确标为“报告日期”，实际检测日期和历史证据的问答集成仍在 T028/T029 验证。
- [x] T026 [US2] 在 `nepstarAdmin/backend/app/services/ai_consult_sources.py` 实现历史查询的当前报告时间上界及至多六次有效点；最多扫描近期 60 份候选报告，数据不足时不补造。调用方须提供已核验报告的精确生成时间；尚未接到问答链路。现有展示页趋势口径未改，T022 已转绿。
- [ ] T027 [US2] 在 `nepstarAdmin/backend/app/services/ai_consult_provider.py` 封装获准模型的服务端调用与受限工具参数；凭据只从服务端配置读取，测试使用 fake provider。已建立默认拒绝外发的窄接口和服务层候选编排；真实提供方适配仍须完成数据处理评估与配置，不能勾选。
- [x] T028 [US2] 在 `nepstarAdmin/backend/app/services/ai_consult_answer.py` 实现候选回答的服务端证据 ID、报告数值/日期校验及无证据时的不确定性表述；数值和日期由证据渲染，模型草稿不能夹带数值、日期或未知引用。结果仅为 `provenance_validated`，`is_completed=False`，仍须 T035 健康安全审核与 T029 状态持久化后才可发布。
- [x] T029 [US2] 在 `nepstarAdmin/backend/app/api/ai_consult.py` 实现候选提问 SSE 的 accepted/status/delta/evidence/completed/error 事件；仅在 `nepstar` 事务中保存已审核的完成结果后发送回答，幂等键复用已有轮次，同会话禁止并行生成。T023 已通过。问答开关默认关闭、路由未挂载主应用，真实模型、额度、恢复与完整生命周期仍待后续任务。
- [ ] T030 [US2] 在 `reportFront/src/views/AiConsult.vue` 与 `reportFront/src/api/aiConsultClient.js` 渲染可信依据、报告跳转与基础回答，使 T024 转绿。
- [ ] T031 [US2] 在 `specs/006-ai-longevity-consult/quickstart.md` 记录 T021～T030 的独立验证：旧报告无未来记录、冲突资料不补造、引用值可回看。

**Checkpoint**: 可以回答报告事实和单项指标，并说明历史不足；AI 不能变更报告、客户或查询能力。

---

## Phase 5: User Story 3 — 必要追问和行动建议（P1）

**Goal**: 区分用户自述与报告结果，围绕问题做一至两个追问，并给适度行动建议和及时就医边界。

**Independent Test**: 以报告解释、生活习惯和症状问题验证多轮承接；紧急症状、诊断和处方请求不出现危险建议或商品先行推荐。

### Tests（先红）

- [x] T032 [P] [US3] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_safety.py` 先确认模块缺失时红灯，再覆盖急症优先、诊断/处方/停药拒绝、最多三个行动、生活信息来源标记及寿命承诺拦截；30 个本地用例已转绿。
- [ ] T033 [P] [US3] 在 `reportFront/tests/components/AiConsultConversation.spec.js` 写失败测试，覆盖追问、用户补充来源标签与清晰的未完成/专业帮助提示。

### Implementation

- [ ] T034 [US3] 在 `nepstarAdmin/backend/app/services/ai_consult_answer.py` 增加多轮上下文裁剪、事实来源标签、适量追问和行动建议输出规则，使 T032 转绿。
- [ ] T035 [US3] 在 `nepstarAdmin/backend/app/services/ai_consult_safety.py` 增加输入优先分流、生成后健康内容校验及危险片段流出前拦截，避免靠页尾提示补救。候选规则已接入默认关闭的 SSE，假模型契约测试确认危险文案无 `delta`/`completed`；真实提供方接入及更全面的健康边界审查仍未完成。
- [ ] T036 [US3] 在 `reportFront/src/views/AiConsult.vue` 渲染用户补充、追问、行动建议与求助提示，使 T033 转绿。
- [x] T037 [US3] 在 `specs/006-ai-longevity-consult/quickstart.md` 记录 30 个本地健康边界用例的结果和人工审核待办；临床专业审核本身仍未完成，不能据此上线。

**Checkpoint**: 多轮回答可独立验收，异常健康内容不会先于校验暴露给用户。

---

## Phase 6: User Story 4 — 手机端连续和可恢复沟通（P1）

**Goal**: 输入、渐进回答、停止、重试、当前标签页历史、删除与跨报告隔离在手机上可靠运行。

**Independent Test**: 在 320–430 px 及真机软键盘场景发送、断网、刷新、停止、删除、切换报告；无重复提问、额度误扣、晚到拼接或其他 guest 历史暴露。关闭标签页后仅凭链接不找回旧聊天。

### Tests（先红）

- [ ] T038 [P] [US4] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_lifecycle.py` 写失败测试，覆盖幂等键、同轮 retry、stop、delete、guest/报告范围、流中断和旧 generation 晚到丢弃。
- [ ] T039 [P] [US4] 在 `reportFront/tests/e2e/ai-consult-mobile.spec.js` 写失败端到端测试，覆盖 320/360/375/390/414/430 px、键盘模拟、刷新保留凭证、无 `opener` 的独立标签页无旧聊天、断网重试与跨报告切换。

### Implementation

- [ ] T040 [US4] 在 `nepstarAdmin/backend/app/services/ai_consult_sessions.py` 实现轮次唯一幂等键、attempt 状态机与 generation_epoch 比较；完成前后都防重复计账，使 T038 的并发断言转绿。
- [ ] T041 [US4] 在 `nepstarAdmin/backend/app/api/ai_consult.py` 完成历史分页、轮次读取、重试、停止、删除和失败恢复端点；删除即时撤销正文读取与后续写入。
- [ ] T042 [US4] 在 `reportFront/src/api/aiConsultClient.js` 实现 fetch 事件流、AbortController、幂等键与 generation_id 过滤，超时和错误保持原问题。
- [ ] T043 [US4] 在 `reportFront/src/views/AiConsult.vue` 实现输入、停止、重试、当前标签页会话列表/新建、删除、阅读较早内容时的新回复提示及各异常页；主动打开新标签页时禁止继承 `opener`。
- [ ] T044 [US4] 在 `nepstarAdmin/backend/app/services/ai_consult_retention.py` 实现 30 天过期、删除后 24 小时内在线正文清理和不含聊天正文的操作记录；用 `nepstarAdmin/backend/tests/unit/test_ai_consult_retention.py` 先确认红灯再转绿。
- [ ] T045 [US4] 运行 `reportFront/tests/e2e/ai-consult-mobile.spec.js`，并将 iOS/Android 真机软键盘、安全区和返回位置的结果记录在 `specs/006-ai-longevity-consult/quickstart.md`。

**Checkpoint**: 不同 guest 与不同报告的聊天隔离；分享报告链接可以看公开报告，但不能访问原访客的聊天。

---

## Phase 7: User Story 6 — 管理咨询服务的质量与用量（P1）

**Goal**: 管理人员按精确权限发布配置与规则、控制额度并查看不含私人聊天正文的运行概览。

**Independent Test**: 用不同权限管理员发布/回退规则、调整开关和额度，制造失败与额度耗尽，核对汇总和用户提示。

### Tests（先红）

- [ ] T046 [P] [US6] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_admin.py` 写失败测试，覆盖具体菜单路径/动作权限、规则版本、发布审计和密钥绝不回显。
- [ ] T047 [P] [US6] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_usage.py` 写失败测试，覆盖每 guest 每日成功问答、每分钟频率、全局成本/并发上限、失败不扣额、真实 token 用量和反馈汇总。
- [ ] T048 [P] [US6] 在 `nepstarAdmin/frontend/src/views/health/__tests__/AiConsultSettings.spec.ts` 写失败测试，覆盖服务开关、额度、规则发布权限、冲突保存和不显示密钥。
- [ ] T049 [P] [US6] 在 `nepstarAdmin/frontend/src/views/health/__tests__/AiConsultOverview.spec.ts` 写失败测试，覆盖完成率、耗时、失败原因和不显示私人正文。

### Implementation

- [ ] T050 [US6] 在 `nepstarAdmin/backend/app/security/ai_consult_admin_permission.py` 和 `nepstarAdmin/backend/app/services/health_seed.py` 增加两页菜单与精确动作校验，不能直接沿用“拥有任一菜单即可”的通用判断。
- [ ] T051 [US6] 在 `nepstarAdmin/backend/app/services/ai_consult_admin.py` 与 `nepstarAdmin/backend/app/api/ai_consult_admin.py` 实现配置、规则草稿/发布/回退、乐观锁和审计；密钥仅由服务端受保护配置提供。
- [ ] T052 [US6] 在 `nepstarAdmin/backend/app/services/ai_consult_usage.py` 与 `nepstarAdmin/backend/app/api/ai_consult.py` 实现每 guest 频率/成功额度、全局成本/并发保护、用量归集及完成回答的有用/无用反馈，使 T047 转绿。
- [ ] T053 [US6] 在 `nepstarAdmin/frontend/src/views/health/AiConsultSettings.vue`、`nepstarAdmin/frontend/src/api/aiConsult.ts` 和 `nepstarAdmin/frontend/src/router/index.ts` 实现配置和规则版本页面，使 T048 转绿。
- [ ] T054 [US6] 在 `nepstarAdmin/frontend/src/views/health/AiConsultOverview.vue` 与 `nepstarAdmin/frontend/src/api/aiConsult.ts` 实现按日汇总与失败原因页面，使 T049 转绿。
- [ ] T055 [US6] 在 `reportFront/src/views/AiConsult.vue` 渲染服务关闭、额度不足、维护、超时及反馈交互；运行 T046～T049 全套绿灯并记录到 `specs/006-ai-longevity-consult/quickstart.md`。

**Checkpoint**: 服务开关和额度生效，普通运营角色无法发布规则或查看实名对话。

---

## Phase 8: User Story 5 — 解释已有管理方案（P2）

**Goal**: 从有效方案进入咨询，解释真实指标与已发布资料，保持既有严格低于分数规则。

**Independent Test**: 79、80、81 分和方案下架分别进入；只对 79 分且满足其他条件的方案作当前推荐，旧入口仍可解释指标。

### Tests（先红）

- [ ] T056 [P] [US5] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_plan_context.py` 写失败测试，覆盖方案发布/关联状态、`score < trigger_score_below`、79/80/81 分及失效入口。
- [ ] T057 [P] [US5] 在 `reportFront/tests/components/RecommendationCard.spec.js` 增加失败测试，覆盖方案按钮携带当前报告与方案 ID、只预填不自动发送。

### Implementation

- [ ] T058 [US5] 在 `nepstarAdmin/backend/app/services/ai_consult_evidence.py` 实现有效方案再校验和已发布商品资料引用；普通报告提问不主动插入营销内容，使 T056 转绿。
- [ ] T059 [US5] 在 `reportFront/src/components/RecommendationCard.vue` 与 `reportFront/src/views/AiConsult.vue` 接入方案来源和默认问题，移除静态图片目标，使 T057 转绿。
- [ ] T060 [US5] 在 `specs/006-ai-longevity-consult/quickstart.md` 记录 79/80/81 分、下架方案及旧入口验证结果。

**Checkpoint**: 有方案咨询时解释依据；不符合资格时不谎称仍有当前推荐。

---

## Phase 9: Polish & Cross-Cutting Concerns

**Goal**: 以真实环境门槛和可复核数据收尾；这些任务不能用静态原型的通过结果代替。

- [ ] T061 在 `nepstarAdmin/backend/tests/integration/test_ai_consult_read_only.py` 用非 `nepstar` 只读账号与隔离测试库验证全链路，确认外部库 DML/DDL/回填/缓存回写次数均为 0。
- [ ] T062 [P] 在 `nepstarAdmin/backend/tests/fixtures/ai_consult_cases.json` 建立至少 40 个报告依据样本与 20 个健康边界样本，跑通引用值/日期及危险内容审核，并记录到 `specs/006-ai-longevity-consult/quickstart.md`。
- [ ] T063 在 `nepstarAdmin/backend/tests/api/test_ai_consult_perf.py` 验证 20 并发试点负载下的首段/完成与 60 秒超时路径，并将接口和移动端可见反馈的实测分位数记录到 `specs/006-ai-longevity-consult/quickstart.md`。
- [ ] T064 在 `specs/006-ai-longevity-consult/quickstart.md` 汇总 SC-001～SC-010 验收、服务商数据处理评估、匿名凭证隔离、备份到期策略及有条件启用/回退步骤；未满足时保持生产服务关闭。

## Dependencies & Execution Order

```text
Setup T001–T004
  └─ Foundation T005–T012
       └─ US1 T013–T020（匿名凭证、同意与欢迎页）
            └─ US2 T021–T031（报告证据与基础回答）
                 ├─ US3 T032–T037（追问与行动建议）
                 └─ US4 T038–T045（会话恢复与手机交互）
                      ├─ US6 T046–T055（配置、额度、运行概览）
                      └─ US5 T056–T060（方案来源；还依赖 US2）
                           └─ Polish T061–T064（须合并所有所选故事）
```

- T001 核对已确认的公开报告流程，T002 为新表/通信的架构确认门槛；可以先做纯假数据测试和 UI 开发，但不能用这些工作替代架构确认或服务商评估。
- 各故事可在依赖完成后独立运行本章的验收场景；US3、US4 在 US2 基础上分别验证，不要求先完成另一故事。US5 是 P2，可在 P1 验证后交付。
- 同一故事内先完成并运行红灯测试，再依模型→服务→接口→页面顺序实现，最后运行绿灯与相关回归。

## Parallel Opportunities

- T003 与 T004 分属后端/报告端测试 fixtures，可同时准备。
- US1 的 T013 与 T014、US2 的 T021～T024、US3 的 T032 与 T033、US4 的 T038 与 T039，分别位于互不冲突的测试文件，可并行写红灯测试。
- US6 的 T046～T049 分属后端 API、后端用量、管理端配置与管理端概览测试，可并行准备；实现时共用配置模型的任务仍按依赖串行。
- US5 的 T056 与 T057 可并行写测试；T058 与 T059 须依据确认的接口契约集成。

## Implementation Strategy

首个可演示增量为 Foundation + US1：访问者从公开报告进入匿名欢迎页，看见当前报告上下文，能确认告知并返回原位置；独立访客拿同一链接只能创建自己的聊天。US2 加入有依据的基础回答后才能对外展示真实 AI 解读。随后完成 US3 与 US4 的安全及恢复能力，再完成 US6 的运营开关、额度和权限，最后补 US5 方案入口。每个增量按上方独立测试过关；上线还须完成 T061～T064。

实现时每个逻辑单元提交一次；不把 `reportFront/test-results/` 等既有未跟踪产物纳入本功能提交。
