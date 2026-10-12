# Tasks: 基于个人报告的 AI 长寿咨询

**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[报告端接口](contracts/access-and-consult.md)、[管理端接口](contracts/admin.md)、[quickstart.md](quickstart.md)

**范围**: 当前报告端 `reportFront/`（Vue 3 + JavaScript）、后端 `nepstarAdmin/backend/`、管理端 `nepstarAdmin/frontend/`。不编辑旧报告目录。所有新写入仅限 `nepstar`；`platform`、`kj_fastplus`、MongoDB 和其他库只读。

**TDD 规则**: 各故事的测试任务先写并运行，确认红灯后才执行对应实现任务；实现后运行绿灯和相关回归。测试里的匿名 guest、假模型、假报告不得向真实服务发送健康数据。

**当前状态**: 用户已确认公开链接匿名咨询，并在 2026-10-08 批准现有 FastAPI 流式接口与仅 `nepstar` 新表的架构；2026-10-09 更新为每次重新进入创建新咨询、前台不展示历史、后台永久存储且不清理。真实模型先保持关闭，服务商的数据处理条件未落实前不得外发健康数据。

## Phase 1: Setup（公开入口与架构边界）

**Goal**: 核对公开报告的现有定位逻辑，把匿名凭证、模型处理范围和测试替身落实成可执行契约。

- [x] T001 在 `reportFront/tests/unit/report-client-params.spec.js` 与 `specs/006-ai-longevity-consult/contracts/access-and-consult.md` 核对公开报告链接的 `reportId/userId` 解析、报告归属校验和匿名聊天建立流程；每次咨询入口建立空白会话，报告链接不能读取已有聊天。
- [x] T002 在 `specs/006-ai-longevity-consult/research.md` 记录用户对现有 FastAPI 中新增流式通信与新 `nepstar` 表的架构确认；模型适配器与用户须知草案已完成，服务商 API 数据处理条款、正式告知发布和授权路径作为 T065 上线门槛，未确认前真实模型保持关闭。
- [x] T003 [P] 在 `nepstarAdmin/backend/tests/ai_consult_fixtures.py` 增加隔离的公开报告只读源、两个 guest 凭证及模型替身 fixtures；咨询测试用 `--noconftest` 避免现有公共夹具导入旧库连接，禁止真实外部请求与真实数据库写入。2026-10-10 增加合成报告 reader、双凭证工厂和 fake provider，并由独立单测确认无写接口/真实网络依赖。
- [x] T004 [P] 在 `reportFront/tests/fixtures/aiConsult.js` 增加两个匿名标签页、两份报告、同意/失效/生成失败的前端测试数据，不复用截图原型的演示答案作为生产数据。2026-10-10 增加隔离场景并接入移动端独立标签/跨报告用例；fixture 单测和 14 项 mock 移动浏览器测试通过。

**Checkpoint**: T001 已核实公开链接行为；T002 已记录新表与模型通信的架构批准。后续仍只用本地假数据测试，直到模型服务商条件另行确认。

---

## Phase 2: Foundational（所有故事的共同前置）

**Goal**: 建立只能写 `nepstar` 的业务通道、匿名访客结构和每次聊天请求都要验证的报告绑定范围。

- [x] T005 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_storage_boundary.py` 先写失败测试：`NEPSTAR_DATABASE_URL` 缺失、库名不是 `nepstar` 或把旧库会话用于咨询写入时一律拒绝。
- [x] T006 在 `nepstarAdmin/backend/app/database.py` 与 `nepstarAdmin/backend/app/config.py` 建立显式绑定 `nepstar` 的咨询写会话及启动校验，并使 T005 转绿；既有 `get_db` 保持报告只读用途。
- [x] T007 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_schema_boundary.py` 先写失败测试：迁移 SQL 不得触及 `nepstar.sa_ai_consult_*` 之外的对象；启动配置不允许静默使用默认旧库。
- [x] T008 在 `nepstarAdmin/backend/app/models/new/sa_ai_consult.py` 和 `nepstarAdmin/backend/alembic/versions/006_ai_consult.py` 建立 settings、rule_version、consent、session、turn、generation、admin_audit 表与唯一约束；离线编译 SQL 后核对只涉及 `nepstar`，使 T007 转绿。迁移文件已编写但尚未对任何数据库执行。
- [x] T009 在 `nepstarAdmin/backend/tests/api/test_ai_consult_access.py` 先写失败测试：有效公开链接可为两个独立 guest 建立聊天；仅凭链接、伪造/过期/撤销/跨报告凭证不得读另一 guest 的聊天。2026-10-10 access/session/answer 隔离 API 回归通过；跨 guest 单轮读取与错误报告请求均被拒绝，前台历史读取按产品决策统一返回 410。
- [x] T010 在 `nepstarAdmin/backend/app/security/ai_consult_access.py` 和 `nepstarAdmin/backend/app/schemas/ai_consult.py` 实现至少 256 位随机 guest 凭证、仅存摘要、绑定报告及每次聊天请求校验；使 T009 转绿，后台管理员 JWT 不可代替 guest 凭证。2026-10-10 凭证摘要、报告绑定、到期/撤销/伪造拒绝与路由验证通过隔离回归。
- [x] T011 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_read_boundary.py` 先写失败测试：候选取数工具只接受固定名称和报告范围；MySQL 仅允许现有报告服务的固定 SELECT，禁止 DML/DDL、任意 SQL、URL 参数。MongoDB 仍通过既有固定 `find_one/find` 路径读取；真实模型尚未接入。
- [x] T012 在 `nepstarAdmin/backend/app/services/ai_consult_sources.py` 实现候选只读报告适配与工具白名单；只投影必要报告事实，旧展示页包含未来记录的趋势暂不传给 AI。读连接与 `nepstar` 咨询写连接分离，实际模型接入仍需 T021～T029。

**Checkpoint**: 用只读外部数据源账号、独立 `nepstar` 测试库验证 T005～T012；任何写库目标不明时不得进入真实数据开发。

---

## Phase 3: User Story 1 — 从当前报告开始咨询（P1，首个可演示增量）

**Goal**: 从公开报告进入对应匿名咨询欢迎页，在明确同意后才能外发必要数据；只浏览欢迎页不触发模型和扣额。

**Independent Test**: 从两份不同公开报告进入，核对报告日期、三个真实可问问题、同意状态和返回位置；同链接的新 guest 无法读取其他访客的聊天，未同意不外发健康数据。

### Tests（先红）

- [x] T013 [P] [US1] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_bootstrap.py` 写失败契约测试，覆盖 `/guest-contexts`、`/bootstrap`、`/consents`、`/sessions` 的报告绑定、guest 隔离、拒绝同意及零模型调用。2026-10-10 隔离 FastAPI 回归覆盖有效/无效报告、双访客、同意/撤回、未同意不创建会话和跨访客/报告读取拒绝；不连接数据库或模型。
- [x] T014 [P] [US1] 在 `reportFront/tests/components/AiConsultWelcome.spec.js` 写失败组件/路由测试，覆盖欢迎、骨架屏、同意弹层、刷新后空白新咨询、guest 失效后重新建授权及返回原滚动位置。2026-10-10 component/client 单测及 14 项移动 mock E2E 通过，覆盖凭证刷新、空白重入和报告阅读位置恢复。

### Implementation

- [x] T015 [US1] 在 `nepstarAdmin/backend/app/api/ai_consult.py` 实现公开报告只读核对、`/guest-contexts` 建立与统一 guest 凭证依赖，按 `nepstarAdmin/backend/app/main.py` 注册路由；报告无效时不给 guest。候选接口与主应用注册代码已存在，仍待完整隔离契约验收，功能开关保持关闭。2026-10-10 通过无效报告不签发凭证及 main 路由注册核对。
- [x] T016 [US1] 在 `nepstarAdmin/backend/app/services/ai_consult_consent.py` 与 `nepstarAdmin/backend/app/api/ai_consult.py` 实现版本化告知、同意/撤回及“未同意零外发”。2026-10-10 当前告知版本绑定、拒绝/撤回后禁止会话或回答的隔离 API 测试通过。
- [x] T017 [US1] 在 `nepstarAdmin/backend/app/services/ai_consult_sessions.py` 与 `nepstarAdmin/backend/app/api/ai_consult.py` 实现报告范围内 bootstrap 与欢迎摘要；不提供历史读取；不因欢迎页加载调用模型。2026-10-10 bootstrap、首次空白会话和历史读取关闭测试通过；报告上下文只从绑定报告读取。
- [x] T018 [US1] 在 `reportFront/src/views/AiConsult.vue`、`reportFront/src/router/index.js` 和 `reportFront/src/api/aiConsultClient.js` 实现真实路由、状态骨架屏、同意流程、按报告隔离的 `sessionStorage` 访问凭证；会话 ID 仅留当前页面内存，沿用已评审 `ui/` 视觉结构。2026-10-10 组件/client 单测与移动 E2E 验证路由、同意、凭证范围和每次重入空白。
- [x] T019 [US1] 在 `reportFront/src/components/AiConsultEntry.vue` 与 `reportFront/src/views/ReportHome.vue` 将首页静态图片链接改为咨询路由，并使用 `reportFront/src/composables/useScrollRestoration.js` 恢复返回时阅读位置。代码已接入，且系统详情方案入口也已改为咨询路由并保存详情滚动位置；2026-10-10 mock 浏览器验证首页入口携带真实报告参数并能恢复返回滚动位置。
- [x] T020 [US1] 运行 `nepstarAdmin/backend/tests/api/test_ai_consult_bootstrap.py` 与 `reportFront/tests/components/AiConsultWelcome.spec.js`，把两报告、两个 guest、拒绝同意和公开链接的绿灯结果记录到 `specs/006-ai-longevity-consult/quickstart.md`。2026-10-10 相关隔离 API/报告端欢迎与凭证回归通过，结果见 quickstart；真实服务验收仍未完成。真机自测按用户确认记录在 T045。

**Checkpoint**: 当前公开报告欢迎页可独立演示；仅凭报告链接不能读取其他 guest 的聊天。

---

## Phase 4: User Story 2 — 有依据的报告解读（P1）

**Goal**: 按当前报告和实际指标回答问题，显示可回看的来源；旧报告比较只取其当时及以前的记录。

**Independent Test**: 对低分、正常分、缺失/冲突数据和旧报告提问，回答中的名称、分数、日期和归属均能与读取的证据对应；未来记录不进入旧报告回答。

### Tests（先红）

- [x] T021 [P] [US2] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_evidence.py` 先确认缺少模块时红灯，再覆盖当前报告指标索引、维护文案、缺项/分数冲突、去身份化和按需检索；候选层测试已转绿。
- [x] T022 [P] [US2] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_history.py` 写失败测试，覆盖同客户同指标、当前报告时间上界、最多六次、无效日期和无历史；纯替身回归已转绿。
- [x] T023 [P] [US2] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_answer.py` 补充候选 SSE 契约测试：已检索证据 ID 可回看，错误分数/日期、未知来源和危险文案只发错误事件；隔离测试已通过。
- [x] T024 [P] [US2] 在 `reportFront/tests/components/AiConsultEvidence.spec.js` 增加依据展开、同份报告系统/指标跳转与跨报告拒绝的组件测试；返回聊天位置由候选路由缓存与移动端用例覆盖，浏览器用例尚待可启动的环境执行。

### Implementation

- [x] T025 [US2] 在 `nepstarAdmin/backend/app/services/ai_consult_evidence.py` 组装按问题相关的报告事实、维护文案与路由证据；模型上下文不含报告号、客户号、设备字段或路由，分数冲突不选边，T021 转绿。当前日期明确标为“报告日期”，实际检测日期和历史证据的问答集成仍在 T028/T029 验证。
- [x] T026 [US2] 在 `nepstarAdmin/backend/app/services/ai_consult_sources.py` 实现历史查询的当前报告时间上界及至多六次有效点；最多扫描近期 60 份候选报告，数据不足时不补造。调用方须提供已核验报告的精确生成时间；尚未接到问答链路。现有展示页趋势口径未改，T022 已转绿。
- [x] T027 [US2] 在 `nepstarAdmin/backend/app/services/ai_consult_provider.py` 封装候选模型的服务端调用与受限工具参数；凭据只从服务端配置读取，自动化测试使用 fake provider。已实现默认关闭的 OpenAI Chat Completions 兼容适配器、HTTPS 精确主机白名单和响应结构限制；provider/model 与同意配置不一致时失败关闭。2026-10-10 fake-client 合约覆盖身份/引用不出站、关闭代理和重定向、错误响应脱敏及配置失败关闭；provider/preflight/pipeline 隔离回归 91/91 通过，未联网、未读取/回显密钥。2026-10-10 将独立的《AI 长寿咨询用户须知（上线前草案）》写入 `specs/006-ai-longevity-consult/user-notice.md`。代码与文案草案交付完成；但草案尚未发布，DeepSeek API 数据处理用途、留存/删除、区域/分包商及公开报告访问者授权路径仍是独立上线门槛 T065，未核实前服务保持关闭、不发送真实报告数据。
- [x] T028 [US2] 在 `nepstarAdmin/backend/app/services/ai_consult_answer.py` 实现候选回答的服务端证据 ID、报告数值/日期校验及无证据时的不确定性表述；数值和日期由证据渲染，模型草稿不能夹带数值、日期或未知引用。结果仅为 `provenance_validated`，`is_completed=False`，仍须 T035 健康安全审核与 T029 状态持久化后才可发布。
- [x] T029 [US2] 在 `nepstarAdmin/backend/app/api/ai_consult.py` 实现候选提问 SSE 的 accepted/status/delta/evidence/completed/error 事件；仅在 `nepstar` 事务中保存已审核的完成结果后发送回答，幂等键复用已有轮次，同会话禁止并行生成。T023 已通过。路由现已挂载主应用，但问答开关默认关闭；真实模型服务商审核、额度、恢复与完整生命周期仍待后续任务。
- [x] T030 [US2] 在 `reportFront/src/views/AiConsult.vue` 与 `reportFront/src/api/aiConsultClient.js` 实现候选聊天输入、SSE 基础回答和可信依据跳转；只在服务状态可用且当前告知已同意后启用。页面返回使用缓存恢复对话与点击位置，组件/客户端定向测试通过。生产 bootstrap 仍固定不可用，AI 服务尚未开放。
- [x] T031 [US2] 在 `specs/006-ai-longevity-consult/quickstart.md` 记录 T021～T030 的独立验证：旧报告无未来记录、冲突资料不补造、引用值可回看。2026-10-10 后端定向隔离回归 60/60、报告端依据组件 3/3 通过；真实报告核验仍是 SC-002 上线前门槛。

**Checkpoint**: 可以回答报告事实和单项指标，并说明历史不足；AI 不能变更报告、客户或查询能力。

---

## Phase 5: User Story 3 — 必要追问和行动建议（P1）

**Goal**: 区分用户自述与报告结果，围绕问题做一至两个追问，并给适度行动建议和及时就医边界。

**Independent Test**: 以报告解释、生活习惯和症状问题验证多轮承接；紧急症状、诊断和处方请求不出现危险建议或商品先行推荐。

### Tests（先红）

- [x] T032 [P] [US3] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_safety.py` 先确认模块缺失时红灯，再覆盖急症优先、诊断/处方/停药拒绝、最多三个行动、生活信息来源标记及寿命承诺拦截；30 个本地用例已转绿。
- [x] T033 [P] [US3] 在 `reportFront/tests/components/AiConsultConversation.spec.js` 写组件回归测试，覆盖追问、用户补充来源标签与清晰的未完成/专业帮助提示。

### Implementation

- [x] T034 [US3] 在 `nepstarAdmin/backend/app/services/ai_consult_answer.py` 增加多轮上下文裁剪、事实来源标签、适量追问和行动建议输出规则，使 T032 转绿；后端问答/证据/上下文/追问/API 定向隔离回归通过。
- [x] T035 [US3] 在 `nepstarAdmin/backend/app/services/ai_consult_safety.py` 增加输入优先分流、生成后健康内容校验及危险片段流出前拦截，避免靠页尾提示补救。假模型 SSE 契约验证危险候选只产生错误事件、不发送 `delta/evidence/completed`；关键词规则仍非临床审核，真实提供方/临床专业评审与上线准入验收仍未完成。
- [x] T036 [US3] 在 `reportFront/src/views/AiConsult.vue` 渲染用户补充、追问、行动建议与求助提示，使 T033 转绿。
- [x] T037 [US3] 在 `specs/006-ai-longevity-consult/quickstart.md` 记录 30 个本地健康边界用例的结果和人工审核待办；临床专业审核本身仍未完成，不能据此上线。

**Checkpoint**: 多轮回答可独立验收，异常健康内容不会先于校验暴露给用户。

进度（2026-10-09）：匿名会话追问锚点仅从最近一轮完成回答的服务端引用解析唯一指标，并核对报告号与访客 ID；最近回答没有唯一指标时不沿用更早锚点，当前报告目录仍须重新确认指标。新增有限多轮上下文：仅查询最近 5 条已完成轮次的用户问题和引用、绝不查询 AI 回答正文；当前指标匹配后最多送入 2 条同指标用户输入、每条不超过 160 字，并过滤联系方式、长数字、报告编号、URL及控制字符。显式指标和系统/全局问题优先于旧指标锚点；提示明确将其标记为“你补充的情况”、不是报告检测值，并最多追问两项；服务端拒绝回答正文包含问句。模型追问现在是独立字段，最多两条，校验去重、隐私和高风险表达；只绑定唯一指标的已核验报告引用，沿用既有引用 JSON 保存，不新增数据库表/字段。后端只从同报告/访客/指标的近期引用恢复先前追问，并仅在服务端与用户已问问题、新追问候选做去重，不把旧追问发送给模型；报告端只在最新回答显示且过滤已问问题，刷新后从服务端证据恢复。报告端为用户消息标注“你的问题与补充”，并区分后台维护行动建议；急症提示引导及时求助，诊断/处方边界明确建议联系医生或药师，未完成回答不会显示为已核实答案。追问闭环、失败/未完成状态和专业求助组件回归通过；后端隔离测试 152/152、问答/证据/上下文/追问/API 定向回归 68/68、报告端会话组件 27/27 通过；测试均用 mock，不连接或写入数据库。结构化行动建议仅在明确询问时读取当前指标 `report_actions`，最多三条、经过隐私和健康安全审核，以独立引用保存且不送入模型提示词。T034/T035 的代码级实现和定向验收已完成；规则为关键词型保守候选过滤，临床专业审核、真实提供方验收和上线条件仍未完成。

---

## Phase 6: User Story 4 — 手机端连续和可恢复沟通（P1）

**Goal**: 输入、渐进回答、停止、重试、本次咨询断线处理与跨报告隔离在手机上可靠运行；每次重新进入均新建空白咨询。

**Independent Test**: 在 320–430 px 及真机软键盘场景发送、断网重试、停止、切换报告和重新进入；无重复提问、额度误扣、晚到拼接或历史泄露，后台存储不被清理。

### Tests（先红）

- [x] T038 [P] [US4] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_turns.py`、`nepstarAdmin/backend/tests/api/test_ai_consult_sessions.py` 与 `nepstarAdmin/backend/tests/api/test_ai_consult_answer.py` 覆盖幂等键、同轮 retry、stop、delete、guest/报告范围、流中断和旧 generation 晚到丢弃。定向隔离回归 52/52 通过；另有只接受空白本地 `nepstar` 实例的实库并发测试入口，但未运行，跨进程验收仍待完成。
- [x] T039 [P] [US4] 在 `reportFront/tests/e2e/ai-consult-mobile.spec.js` 覆盖 320/360/375/390/414/430 px、窄视口键盘模拟、刷新/重新进入空白、独立标签页与跨报告隔离、当前会话断网重试及横向溢出；本地 mock Chromium E2E 11/11 通过。仍需真实手机软键盘、安全区与真实网络波动验收，不将模拟测试等同于完整验收。

### Implementation

- [x] T040 [US4] 在 `nepstarAdmin/backend/app/services/ai_consult_turns.py` 实现轮次唯一幂等键、attempt 状态机与 generation_epoch 比较；完成前后都防重复计账，使 T038 的并发断言转绿。重复创建请求回放原 attempt，不重复调用模型；重复重试回放直接后继 attempt；停止/完成/超时通过行锁和 epoch 阻断晚到写入。补充测试确认重放不再次预留额度、完成后重复 finalize 不重复结算、用量缺项时保留完整预算预留。隔离定向回归 55/55 通过；真实 MySQL 行锁、事务隔离和跨进程竞争测试入口已添加但未运行，仍待试点验收。
- [x] T041 [US4] 在 `nepstarAdmin/backend/app/api/ai_consult.py` 实现本次会话创建、轮次问答/反馈/停止/重试与断线状态核验；最近会话列表、完整会话详情和用户删除端点返回 410。轮次读取仅允许当前最新活动会话；完整问题与回答永久保留在 `nepstar`，不设清理任务。
- [x] T042 [US4] 在 `reportFront/src/api/aiConsultClient.js` 实现 fetch 事件流、AbortController、幂等键与 generation_id 过滤，超时和错误保持原问题。SSE 客户端区分同轮旧 generation（丢弃）与其他 turn（拒绝），验证 session/turn/generation/seq，处理调用方取消和 65 秒超时，并保留稳定幂等键及请求问题。定向组件/客户端测试 58/58、mock API 的移动浏览器回归 12/12 通过；无真实 API/模型请求。
- [x] T043 [US4] 在 `reportFront/src/views/AiConsult.vue` 完成输入、当前页面内追问、停止、重试、异常状态与位置恢复；离开后重新进入时清空消息并不恢复会话 ID；移除历史列表、切换、删除和刷新恢复入口。断线状态核验只针对当前页面内存中的会话，失败时保留当前问题供原位重试。
- [x] T044 [US4] 用户将聊天留存规则改为永久保存：后端不清理问题/回答，不提供用户删除；`ai_consult_retention.py` 保留兼容入口但在获取数据库连接前明确失败。纯内存测试验证批次/调度/CLI 均无数据库读取或写入，3/3 通过；未连接数据库或运行迁移。
- [x] T045 [US4] 运行 `reportFront/tests/e2e/ai-consult-mobile.spec.js` 并记录移动端验收。2026-10-10 Playwright Chromium + mock API 14/14 通过，覆盖 320–430px、窄视口、断流恢复、独立标签页、阅读位置和每次重入空白；用户于 2026-10-10 确认已自行在手机上完成实测并要求按通过标记。本地未独立取得机型、系统版本和逐项实测记录，故真机结果依据用户确认，不伪称由本地复测。

**Checkpoint**: 不同 guest 与不同报告的聊天隔离；分享报告链接可以看公开报告，但不能访问原访客的聊天。

---

## Phase 7: User Story 6 — 管理咨询服务的质量与用量（P1）

**Goal**: 管理人员按精确权限发布配置与规则、控制额度并查看运行概览。2026-10-10 新增需求允许后台逐会话查看完整问答，正文需独立 `conversation` 权限及访问审计；普通 `view` 仍不包含正文，报告端仍无历史。

**Independent Test**: 用不同权限管理员发布/回退规则、调整开关和额度，制造失败与额度耗尽，核对汇总和用户提示。

### Tests（先红）

- [x] T046 [P] [US6] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_admin.py` 写失败测试，覆盖具体菜单路径/动作权限、规则版本、发布审计和密钥绝不回显。新增 HTTP 请求经实际 JWT、路由依赖和 SQLite 内存 SQL 的 31 项回归，覆盖错误菜单/动作、停用与锁定账号、停用角色/菜单、管理员绕过、公开报告凭证不可访问管理接口、撤权立即生效、防自助提权、草稿/发布/审计、保存冲突和保护关闭开关；修复真实路由匹配的前缀差异和权限空格/重复项不一致。相关后端 112/112、管理端 25/25 通过。SQLite 仅为本地内存，不能替代真实 MySQL 事务/行锁或生产 RBAC 验收。
- [x] T047 [P] [US6] 在 `nepstarAdmin/backend/tests/unit/test_ai_consult_usage.py` 写失败测试，覆盖每 guest 每日成功问答、每分钟频率、全局成本/并发上限、失败不扣额、真实 token 用量和反馈汇总。当前已覆盖额度拒绝与预留、失败不记成功次数、服务商用量及概览中的反馈计数；2026-10-10 使用隔离单元/API 回归 89/89 通过，真实 MySQL 并发与用量验收仍按 T063/T064 保留。
- [x] T048 [P] [US6] 在 `nepstarAdmin/frontend/src/views/health/__tests__/AiConsultSettings.spec.ts` 写失败测试，覆盖服务开关、额度、规则发布权限、冲突保存和不显示密钥。组件 mock 测试覆盖无 `view` 不发请求、只读和 publish-only 权限、不回显密钥、候选设置强制 `enabled=false`、版本冲突提示及操作记录分页；新增六项额度联动保存、清空/越界/小数拒绝、服务端 422 字段错误和保留输入草稿，组件 18/18 通过。报告端跟随后台 1–500 字上限，越界问题不创建会话或请求生成。均为隔离测试，不代表真实数据库并发或上线验收通过。
- [x] T049 [P] [US6] 在 `nepstarAdmin/frontend/src/views/health/__tests__/AiConsultOverview.spec.ts` 覆盖完成率、耗时、失败原因、无样本状态和不显示私人正文；组件隔离测试已转绿。

### Implementation

- [x] T050 [US6] 在 `nepstarAdmin/backend/app/security/ai_consult_admin_permission.py` 和 `nepstarAdmin/backend/app/services/ai_consult_admin_menu.py` 增加 AI 咨询菜单与精确动作校验，不能直接沿用“拥有任一菜单即可”的通用判断。当前设置 API 按具体路由检查 `view/edit`，规则草稿创建检查 `edit`，发布/回退检查独立 `publish` 动作；菜单种子只为系统管理员合并对应动作。`/auth/me` 已按真实 `role_code` 契约返回有效角色权限，单独授权子菜单时包含侧栏父级；停用角色不参与 AI 授权。角色/用户管理 API 已限制为系统管理员，阻断普通账号自助授予 `publish`。后台角色弹窗支持 AI 的只读、编辑、发布组合。HTTP 回归修复 FastAPI 原始/完整路由模板兼容，仅规范化已知 AI 路由，未知路由仍先于管理员查询拒绝；`/auth/me` 动作现在去空格、忽略空项并去重。2026-10-10 隔离权限/RBAC 回归通过，真实 RBAC 数据联验仍待完成。
- [x] T051 [US6] 在 `nepstarAdmin/backend/app/api/ai_consult_admin.py` 与 `nepstarAdmin/backend/app/services/ai_consult_rules.py` 实现配置、规则草稿/发布/回退、乐观锁和审计；密钥仅由服务端受保护配置提供。当前候选支持规则元数据/正文读取、唯一版本草稿、摘要完整性校验、settings 行锁与 `row_version` 乐观锁、发布/回退审计；新增仅查看配置/规则变更的分页审计接口及白名单摘要，后台不展示聊天正文或原始审计 JSON。生成轮次固定实际规则版本，重试沿用原版本；模型只用管理员规则做次级表达风格指导。2026-10-10 假 session/API 事务与审计隔离回归通过；真实 MySQL 并发和部署验收仍待完善。设置仍强制 `enabled=false`，不接收或回显密钥。
- [x] T052 [US6] 在 `nepstarAdmin/backend/app/services/ai_consult_usage.py` 与 `nepstarAdmin/backend/app/api/ai_consult.py` 实现每 guest 频率/成功额度、全局成本/并发保护、用量归集及完成回答的有用/无用反馈，使 T047 转绿。候选已在配置行锁下检查四类额度，生成记录预留 token 并记录服务商实际用量；管理页可配置上限。三分钟超时生成可回收，已完成轮次的反馈接口和刷新恢复已实现。bootstrap 与 completed SSE 现在能返回按 UTC 当日成功回答计算的剩余次数，报告端会展示并在新回答完成后更新；2026-10-10 隔离额度/反馈测试通过，真实 MySQL 多进程验证仍未完成。
- [x] T053 [US6] 在 `nepstarAdmin/frontend/src/views/health/AiConsultSettings.vue`、`nepstarAdmin/frontend/src/api/aiConsult.ts` 和 `nepstarAdmin/frontend/src/router/index.ts` 实现配置和规则版本页面，使 T048 转绿。候选设置页现在显示运行时 provider/环境开关且不回显密钥；设置页已加入规则版本列表、只读正文查看、草稿创建、发布/回退确认及白名单管理操作记录，服务开关始终关闭。页面按同一菜单 ID 的 `view/edit/publish` 控制请求和操作可见性；AI 设置和概览路由也在加载页面前精确检查 `view`，无权限导向说明页。2026-10-10 设置/概览/角色权限组件 24/24 通过；真实数据库 RBAC 联验仍待完成。
- [x] T054 [US6] 在 `nepstarAdmin/frontend/src/views/health/AiConsultOverview.vue` 与 `nepstarAdmin/frontend/src/api/aiConsult.ts` 实现独立只读概览：UTC 当日新会话/提问轮次/生成尝试、已结束尝试完成率、首次可展示回答平均耗时、实际或预留 token 占用、失败分类及已存反馈计数；运行中和超时积压另列。接口只汇总 `nepstar` 咨询表，不查询正文；真实库性能与部署侧告警仍待验证。
- [x] T055 [US6] 在 `reportFront/src/views/AiConsult.vue` 渲染服务关闭、额度不足、维护、超时及反馈交互；超时后仅核对当前页面会话的轮次状态，完整会话不在刷新/重新进入时恢复。额度为 0、daily/global 限额拒绝现会禁用新提问；成功重试同步剩余额度。客户端保留服务器安全等待秒数，限流/并发繁忙有倒计时且等待期间禁用原位重试，等待结束沿用原问题和 UUID，不重复气泡。未完成且 `can_retry=false` 的状态保留查询入口，并在确认终态前禁止新问题，输入草稿仍可编辑。2026-10-10 报告端流式/对话/依据 60/60、限额与超时 mock 浏览器 10/10 通过。真实接口/数据库端到端、计费与真机验收仍待完成，不能据此开放生产服务。

**Checkpoint**: 服务开关和额度生效，普通运营角色无法发布规则或查看实名对话。

---

## Phase 8: User Story 5 — 解释已有管理方案（P2）

**Goal**: 从有效方案进入咨询，解释真实指标与已发布资料，保持既有严格低于分数规则。

**Independent Test**: 79、80、81 分和方案下架分别进入；只对 79 分且满足其他条件的方案作当前推荐，旧入口仍可解释指标。

### Tests（先红）

- [x] T056 [P] [US5] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_plan_context.py` 写失败测试，覆盖方案发布/关联状态、`score < trigger_score_below`、79/80/81 分及失效入口。
- [x] T057 [P] [US5] 在 `reportFront/tests/components/RecommendationCard.spec.js` 增加失败测试，覆盖方案按钮携带当前报告与方案 ID、只预填不自动发送。

### Implementation

- [x] T058 [US5] 在 `nepstarAdmin/backend/app/services/ai_consult_evidence.py` 实现当前方案与触发指标/阈值的复核及可追溯依据；方案失效时降级为指标解释；普通报告提问不主动插入营销内容，使 T056 转绿。
- [x] T059 [US5] 在 `reportFront/src/components/RecommendationCard.vue` 与 `reportFront/src/views/AiConsult.vue` 接入报告内方案来源和预填问题，不自动发送，并按当前 guest 会话上下文恢复，使 T057 转绿。
- [x] T060 [US5] 在 `specs/006-ai-longevity-consult/quickstart.md` 记录 79/80/81 分、下架方案及旧入口验证结果。

进度（2026-10-09）：已接入入口上下文、会话来源持久化、报告实时方案/阈值复核、失效后指标解读降级及依据引用；迁移 007 仅编写，未执行。方案只读查询已从会在导入时反射旧库的报告源模块隔离，增加启用/关联 SQL、默认阈值与多指标共用方案商品的纯内存测试。方案专项 18/18、含既有安全样本的隔离后端测试 81/81、报告端方案路由/预填/来源会话恢复及对话回归 26/26 通过。以上为代码级验收；`nepstar` 实库状态联动、迁移和真实模型仍未运行，不能视作上线验收。

**Checkpoint**: 有方案咨询时解释依据；不符合资格时不谎称仍有当前推荐。

---

## Phase 9: Polish & Cross-Cutting Concerns

**Goal**: 以真实环境门槛和可复核数据收尾；这些任务不能用静态原型的通过结果代替。

调度调整（2026-10-10，用户确认）：T063 剩余的线上代理、真机性能及网络故障实测移到上线前验收，现阶段暂缓，不作为当前本地功能开发的阻塞项。已有本机证据保留，T063 整体仍为未完成；正式上线前须补测并归档结果。此调整不是现在部署、操作线上服务或执行网络故障注入的授权。

2026-10-10 T063 已补充真实 HTTP/SSE 测量工具与 [执行说明](live-acceptance.md)。新增 `scripts/ai_consult_local_load.py` 完成本机真实 MySQL/DeepSeek 的 20 路虚构报告联调：20/20 completed，提供方请求在途峰值 20；P95 接收 403.50ms、已审核首段 1526.83ms、完成 1527.10ms，20 组问答永久落库，持久策略不变。另完整执行 60 秒取证等待故障，60051.30ms 返回 timeout 并落库为失败、无正文、无运行中记录，模型调用 0。不访问其他库、不发送真实报告、不部署。最新专项回归 59 passed、1 skipped。仍缺线上代理、真机可见反馈与部署网络故障验收，不能勾选全部验收。

2026-10-10 后续 T063：新增真实 Vue/本机流式代理浏览器联验入口，20 个独立移动端模拟窗口、20 次真实模型问答全部完成，问题/attempt/completed/答案各落库 20，配置不变。点击到 DOM 双帧可见反馈 P95 30.20ms、接收 747.50ms、已审核回答/完成 2973.90ms；[脱敏页面实测](evidence/local-browser-proxy-2026-10-10.json)已保存。无头模拟不等于物理手机屏幕/部署代理；不把局部成功改成生产验收完成。后端专项 71 passed、1 skipped，Node 护栏 5/5；T061 缺显式 staging 凭证仍跳过。

- [ ] T061 在 `nepstarAdmin/backend/tests/integration/test_ai_consult_read_only.py` 用非 `nepstar` 只读账号与隔离测试库验证全链路，确认外部库 DML/DDL/回填/缓存回写次数均为 0。代码侧已将 AI 报告归属核验与首页读取统一放入只读 SQL 白名单，纯内存测试覆盖 INSERT/UPDATE/DELETE/DDL、commit/flush/delete 均在触达底层 session 前拒绝；2026-10-10 重跑 `tests/unit/test_ai_consult_read_boundary.py` 5/5 通过。新增显式 opt-in 全路径只读验收入口：只接受独立传入的 staging MySQL/Mongo URL 和 `AI-CONSULT-TEST-*` 合成报告，不回退 `.env`；目标必须非 `nepstar`，子进程在导入带旧库反射副作用的报告模块前固定所有 DB/Mongo 指向显式 staging，SQL 发出前拦截非只读语句并核验 MySQL 仅 SELECT/USAGE 权限；同时在读取报告前核验 Mongo 身份只有目标库内置 `read` 角色，监听写类 command。测试随后调用真实 `verify_public_report` 与 `load_public_report_home`，成功输出固定脱敏命令计数摘要，不转发原始日志；缺失/重复摘要或任意写命令计数均拒绝通过。2026-10-10 本地护栏 5/5 通过，真实集成因未配置隔离凭证/合成报告而跳过。完整报告库命令计数和隔离环境运行仍未验收；未连接 `.env` 数据库，T061 不能标记完成。
- [x] T062 [P] 在 `nepstarAdmin/backend/tests/fixtures/ai_consult_cases.json` 建立至少 40 个报告依据样本与 20 个健康边界样本，跑通引用值/日期及危险内容审核，并记录到 `specs/006-ai-longevity-consult/quickstart.md`。现有 40 个合成报告依据场景与 22 个健康边界场景；2026-10-10 自动验收 63/63 通过，真实报告集、真实服务商输出和临床专业审核仍属独立上线门槛，合成测试不等于临床批准。
- [ ] T063 [上线前验收，现阶段暂缓] 在 `nepstarAdmin/backend/tests/api/test_ai_consult_perf.py` 验证 20 并发试点负载下的首段/完成与 60 秒超时路径，并将接口和移动端可见反馈的实测分位数记录到 `specs/006-ai-longevity-consult/quickstart.md`。内存 ASGI 成功/超时/混合及迟到拒绝回归通过。2026-10-10 本机真实 MySQL/DeepSeek/HTTP 20/20 成功并验证落库/配置不变，P50/P95/P99 见 [负载实测](evidence/local-load-2026-10-10.json)；实际 60 秒取证故障的失败终态、无正文/运行中记录和保守预留见 [超时实测](evidence/local-timeout-2026-10-10.json)。移动 mock 验证超时先查询本轮再原位重试。准入/最终落库不在准备 deadline 内；实际部署代理、真机端到端与部署网络故障验收按用户确认留到上线前，当前不执行，故不勾选完成。
- [x] T064 在 `specs/006-ai-longevity-consult/quickstart.md` 汇总 SC-001～SC-010 验收、服务商数据处理审批状态、报告绑定凭证隔离、永久留存/备份恢复要求及有条件启用/回退步骤；证据未齐时明确要求保持生产服务关闭。文档交付项完成；这不表示服务商批准、数据库权限、备份恢复、代理或真机验收已通过。咨询数据永久保留，不创建清理任务。

- [ ] T065 [Release Gate] 在线上开放真实健康报告咨询前，由负责人核验实际服务商开放平台 API 数据处理约定（输入训练用途、留存/删除、处理与存储区域、分包商），确认公开报告访问者的有效处理授权路径、权利请求流程与正式告知发布方案，并按最终方案验收外发边界。当前可选选择契约不强制勾选、不自动记录同意，不能继续沿用“无同意记录必定零外发”的旧验收条件，也不能视为已获生产处理授权。2026-10-10 已编写 [资料核对与询证草稿](provider-data-review.md)，未发送邮件；“海王星辰”和 `245743255@qq.com` 已补入 [用户须知](user-notice.md)，该子项完成。其余真实审批/发布证据未齐，T065 不勾选；T027 已完成状态和本机有限试用授权不变。

## 2026-10-10 运行概览改版（本地交付）

- [x] T066 [US6] 重设计概览为四卡（新会话、完成率、当日 token、当月 token）、小时/自然日双趋势及筛选分页会话表。移除提问轮次、生成尝试、首次可展示回答三卡。图表与元数据只取 `nepstar`，北京时间分桶、实际与未知预留分离、未来留空，历史月长度按自然月计算；不新增表/迁移。
- [x] T067 [US6] 新增后台单会话完整问答抽屉及分页详情 API；独立 `conversation` 权限、角色勾选授权、访问审计提交后才返回正文、响应禁止缓存、正文仅纯文本、依据仅安全标签；不返回模型密钥、凭证摘要或未审核片段；过期访客凭证不影响后台永久记录，报告端无历史的设计不变。
- [x] T068 [US6] 改版验证：后端隔离 API/权限/审计/只读保护等定向回归 183/183；管理端全量组件/路由测试 63/63，类型检查和临时目录生产构建通过。本机 MySQL 只读核验返回 24 小时/31 日趋势及 58 条会话总数，无模型请求或外部库写入；独立 Chrome 虚构数据验证双图、四卡、按需详情、纯文本防注入和 960px 布局通过。已按原命令重载本机隔离 8000 服务（AI 开启状态不变），未部署线上、未提交或覆盖已有 dist。同步维护设置页旧测试以匹配已移除的部署控制输入项，不改配置页行为。

以上新增需求覆盖旧 T049/T054“仅汇总”界面约束；其既有 UTC 兼容统计接口保留，新页面改用北京时间 `/dashboard` 与独立管理端 `/sessions` 接口。T061/T063/T065 上线门槛状态不因本次改版改变。

## 2026-10-12 本地功能收尾（完成）

- [x] T069 同步 spec/plan/data-model/API/页面验收的可选处理选择契约，不恢复强制弹层、不自动记录同意；补齐最新明确撤回对会话创建、发送、重试、轮次读取/反馈和生成最终发布的保护，失败终态提交后才返回 `access_changed`，保留可信 token/未知预留。
- [x] T070 补齐 008 迁移目标/可空性/拒绝有空关联时降级的离线测试；移除联调和本地 smoke 工具代替用户调用 `/consents` 的步骤。测试只构造迁移操作替身，未执行真实迁移或删除记录。
- [x] T071 补齐旧会话幂等重放、新提问、重试、反馈及生成结束前的最新会话检查，避免仅隐藏历史入口；维持锁顺序，不在配置锁后锁第二个 session。修复移动输入文字为 16px、placeholder 为 14px 浅色并保留左右 padding；旧会话、撤回、移动样式回归通过。真实 MySQL 重入/多进程窗口仍需实测。
- [x] T072 完成本地隔离回归：后端 674、报告端 156、管理端 63、移动 Chrome mock E2E 35、集成入口护栏 6、Node 代理护栏 5 项通过，管理端类型检查和两端临时生产构建通过。归档 [回归摘要](evidence/local-regression-2026-10-12.json) 与 [发布收尾清单](release-readiness.md)。本次未连接真实 DB/模型、未迁移/改配置/重启持久服务、未覆盖项目 dist、未提交推送或部署；T061/T063/T065 保持未完成。
- [x] T073 按用户要求新增后台紧急启停：独立 `PUT /admin/service-state`、编辑权限/确认/行版本/审计，暂停不依赖模型就绪，恢复重新检查运行配置；额度保存保持当前启停状态。数据库总开关默认关闭，环境开关未设置时委托后台、显式 false 仍为部署硬禁用。暂停审计栅栏拦截关闭后很快恢复的旧生成，终态保留 token/未知预留，前台保留当次对话并禁用新提问/重试。后端 694、管理端 68、报告端 158、移动 Chrome mock 36 项及管理端合成 Chrome/类型检查/两端临时构建通过，[验证摘要](evidence/service-control-2026-10-12.json) 已归档。无新增表/迁移、真实 DB/模型调用、配置更改、持久服务重启或部署；当前线上 API 需部署新后端后才能生效，旧显式禁用配置需负责人处理，T061/T063/T065 不变。
- [x] T074 按用户授权调整并重启本机隔离后端，使本地后台无需上线即可启停咨询。启动允许数据库总开关关闭、采用后台额度输入边界（包括已保存的每日 20 次），保留密钥/模型/DeepSeek 主机/告知/已发布规则与只写本机 nepstar 的保护；启动不修改 AI 设置。后端回归 707/707，两端本地代理与新路由通过；先观察到关闭状态，再观察到后台 `service.resume` 审计、行版本 8→9 和健康状态开启，详见 [验证摘要](evidence/local-service-control-2026-10-12.json)。未修改 `.env`、执行迁移、调用模型、部署线上或提交推送，生产验收门槛不变。

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

当前可演示链路为：访问者从公开报告进入空白咨询页，看见当前报告上下文和有效方案，服务可用时直接发送，返回原位置；独立访客拿同一链接只能创建自己的聊天。US2 提供有依据的基础回答，US3/US4 提供健康边界与当次断线核对，US6 提供运营开关、额度、权限与完整问答运营后台，US5 提供方案来源。各故事本地回归已完成；真实环境放行仍须完成 T061、T063、T065 及发布收尾清单中的真实验证。

实现时每个逻辑单元提交一次；不把 `reportFront/test-results/` 等既有未跟踪产物纳入本功能提交。
