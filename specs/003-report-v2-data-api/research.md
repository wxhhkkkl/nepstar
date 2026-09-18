# Phase 0 Research: 报告展示数据接口

**Feature**: `003-report-v2-data-api` | **Date**: 2026-09-18（2026-09-18 按数据源核查结果修订）

本文件记录规划阶段的技术决策。结论基于对后端代码、`oldbackend`（旧 Java 报告后端）、旧系统 MySQL `platform` 库与报告 MongoDB 的只读核查。

> **修订说明**：本文件初版把报告数据源判断为 MySQL 的按版本拆分宽表（`inspect_dds3/4/5/6_score`、`inspect_dds_score_report_tmpx`）。后续核查 `oldbackend` 与 MongoDB 后确认该判断错误——KH503 报告本体是 MongoDB 文档，宽表属于另一条旧版报告链路。R1–R4 已重写，R9 保留但补充了正确的趋势来源。**保留的错误判断痕迹仅在 R10 的备选方案中说明，不再作为设计依据。**

---

## R1. 报告数据源

**Decision**: 报告本体从 MongoDB 读取，指标名称与权重从旧系统 MySQL 读取，两者以数字 `targetId` 关联。

**Rationale**: 核查确认（4 份真实报告 + `oldbackend` 代码）：

- 报告文档在 MongoDB `receive_report` 库的 `reportV2Info` collection，`_id` 即报告编号。同库另有 `reportInfo`（旧版结构）、`algorithmicRequestBean`（设备上传的原始算法请求）、`tb_receive_report`（空）。
- 文档顶层结构固定：`sex`（0=女 / 1=男）、`robotSn`、`reportDate`、`uId`、`agentId`、`detectionCode`、`userInfo`、`ddsReportInfo`、`ecgReportInfo`、`spo2hReportInfo`、`skinReportInfo`。
- `ddsReportInfo.firstTarget[]` 是报告的一级系统树，含 `targetId` / `score` / `inspectAge` / `secondTarget[]`；二级再含 `threeTarget[]`（`score` / `lastScore` / `abLevel`）。`fastScore[]` 是一级得分的扁平数组，与 `firstTarget[].score` 同序同值。
- **文档内没有名称、没有权重、没有字符串编码，只有数字 `targetId`。** 名称与权重在 MySQL `inspect_target`（`inspect_name` / `proportion`），一级 10 项的权重为 30/20/15/8/5/5/5/5/5/2。
- 报告生成逻辑不在 `oldbackend`：设备 POST 到 `robot.jiankangzhan.com/RE/V2/receive/v1`，由独立服务 `analysisreport-ysc.jiankangzhan.com` 生成并写入 MongoDB；`oldbackend` 只读。

**Alternatives considered**:

- 只读 MySQL 宽表（初版判断）：已证伪。那些宽表属于旧版血管/血流动力学报告链路，KH503 报告不写它们。
- 复制报告数据到 `nepstar` 库再读：被用户否决（实时只读，不同步不缓存）。
- 新建报告结果表并用种子数据填充：被用户否决（要求真实数据）。

**已确认的连通性**（2026-09-18 实测）: 阿里云副本集 `mgset-6041593`，主节点 `47.93.105.139:3717`，SCRAM-SHA-256 认证通过，需在阿里云控制台为该实例配置客户端 IP 白名单。

**驱动版本受限（实测发现）**: 服务端为 **MongoDB 4.2.25**（线协议 8），而 **pymongo 4.9+ 要求 MongoDB 4.4+**（线协议 9），装了会直接抛 `ConfigurationError: Server ... reports wire version 8, but this version of PyMongo requires at least 9`。因此：

- 驱动锁定为 `motor>=3.5.2,<3.6`（对应 pymongo 4.8.0）。实测该组合可正常连接与异步读取。
- **不得升级到 motor 3.6+**，除非报告库升级到 MongoDB 4.4。这写进了 `requirements.txt` 与 `pyproject.toml` 的注释。

**连接串必须做 RFC 3986 转义（实测发现）**: `.env` 中 `MONGODB_URL` 的密码含 `@` 且未转义，pymongo/motor 会抛 `InvalidURI: Username and password must be escaped according to RFC 3986`。转义后连接正常。这是 `.env` 侧的配置问题，需在 .env 中修正（或在 `app/mongo.py` 中容错归一化）。

---

## R2. MongoDB 访问方式

**Decision**: 使用异步驱动 `motor`（与现有 SQLAlchemy async 体系一致），只读连接，服务封装在独立的模块中。

**Rationale**: 后端现有全部数据访问都是 async（`AsyncSession`、`aiomysql`）。引入同步的 `pymongo` 会在 async 路由里阻塞事件循环。`motor` 是 MongoDB 官方的 async 驱动，与 `pymongo` 同源 API。

连接参数取自 `.env` 的 `MONGODB_URL`（已配置）。**后端目前没有任何 MongoDB 依赖或连接代码，新增属于架构变更**，已获用户确认（spec 的 Architecture Decision）。

驱动以只读方式使用：本特性不写、不建索引、不改文档。

**Alternatives considered**:

- `pymongo` 同步驱动：被否决，会在 async 请求处理中阻塞。
- 手写线协议（本次核查时用过）：仅用于验证，不用于生产实现。
- 复用现有 MySQL 连接：不可行，数据就在 Mongo。

---

## R3. 指标标识与映射形态

**Decision**: 直接用数字 `targetId`，在 `sa_indicator` 上新增一个 `target_id` 列承载；**不建**原计划的 `sa_indicator_legacy_code` 表。

**Rationale**: 核查推翻了初版的假设。报告文档里的标识就是数字 `targetId`，与 MySQL `inspect_target.target_id` 以及后台 `sa_indicator` 一一对应，不存在另一套"前缀 + 编码"的体系（`A3087` 只是前缀 + 数字，且该前缀体系属于另一条已被排除的链路）。

一对一关系意味着一个可空列加唯一约束即可，不需要关联表：

- 唯一性：`target_id` 上建唯一约束，落实 FR-032（同一 `targetId` 不得登记到多个指标）。
- 一级与二级指标都可登记，列语义相同。

**Alternatives considered**:

- 保留 `sa_indicator_legacy_code` 关联表：被否决，一对一关系用关联表是过度设计（Constitution II）。
- 用 JSON 列存多个 `targetId`：被否决，破坏唯一性约束。

---

## R4. 报告文案的存储位置

**Decision**: 在 `sa_indicator` 上新增四个文案列，只对一级指标有意义。

**Rationale**: FR-003 与 FR-010 要求的状态描述、摘要、结论解读、行动建议都是"身体系统"级文案，对应 `sa_indicator` 的一级记录；二级指标的说明复用既有 `description` 列。四个列分别是 `report_status_text`、`report_summary`、`report_interpretation`、`report_actions`。

`report_actions` 承载多条行动建议（FR-010 返回列表），用 `sa.Text` 存 JSON 数组。这是全库唯一使用 JSON 文本的列，理由是该字段天然是列表且不需要被检索。

**Alternatives considered**:

- 新建 `sa_indicator_report_text` 子表：被否决，字段固定为四个且与指标一一对应，子表只增加连接成本。
- 复用 `description`：被否决，后台说明与面向用户的文案是两种内容。
- 取旧库文案目录（`inspect_result6` / `inspect_disease6` / `inspect_guide` 等）：被用户否决（文案由后台维护）。

---

## R5. 前端取数方式

**Decision**: 使用浏览器原生 `fetch`，在 `src/api/` 下自建轻量请求模块。

**Rationale**: FR-030 要求前端接入接口，而宪法与 002 的架构决策明确禁止引入 Axios。原生 `fetch` 零依赖即可满足需求；报告页面只有两个 GET 请求，不需要拦截器、重试或取消令牌等 Axios 能力。

**Alternatives considered**:

- 引入 Axios：被否决，违反既有架构约束，且需要用户按 Constitution III 重新批准。
- UI 库配套请求层：被否决，引入 UI 库超出当前需求。

---

## R6. 前端数据层与既有测试的处置

**Decision**: 保留 `src/utils/report.js` 的选择器函数不动，把 `src/data/report.js` 从"业务数据模块"改为"接口 DTO → 页面 ViewModel 的适配层"，测试改为喂入 fixture 报告对象。

**Rationale**: `getVisibleSystems` / `getSystemById` / `buildHomeFlow` / `isWarningScore` 已经是接收 `report` 参数的纯函数，与数据来源无关。组件也都通过 `:report` prop 接收数据（`ReportHome.vue` 的四个子组件均如此），因此改动集中在两个视图的数据获取与一个适配层。

既有测试 `tests/unit/report-data.spec.js` 与 `report-order.spec.js` 直接 `import { reportSnapshot } from '@/data/report.js'` 并断言固定业务值。FR-043 要求移除模拟业务数据后，这些断言必须改为对 fixture 的断言——测的是**选择器与适配器的行为**，不是某一份具体报告的内容。

**Alternatives considered**:

- 无请求时回退到模拟数据：被用户明确否决。
- 让组件直接消费接口 DTO：被否决，会改动七个组件与两套图表渲染，且与 FR-030 冲突。

---

## R7. 直接采集单值的系统归属

**Decision**: 在服务层用一张固定的常量归属表，把报告文档中的报告级单值映射到系统标识。

**Rationale**: FR-009 要求这些值不参与加权、按固定归属挂载。核查确认值在报告文档内：

- `spo2hReportInfo` = `{heartRate, bloodoxygenRate, microcirculation}` —— 血氧饱和度与微循环
- `ecgReportInfo` = `{heartRate, heartStatus, heartLines, heartOfflines}` —— 心率与心电状态

对应关系：微循环 / 心电状态 → 心血管系统；血氧饱和度 → 肺功能系统。归属关系是产品设计的一部分，用代码常量表达即可。

**修正说明**: 初版把该来源指向 `inspect_base.microcirculation` / `bloodoxygen_rate` / `heart_rate`，并观察到这些列填充率极低（约 2.3%，`heart_rate` 为 0）。真实原因正是它们不在 MySQL 而在报告文档内。

**Alternatives considered**:

- 走指标登记：被否决，这些是报告级单值而非指标得分。
- 不实现：被用户否决。

---

## R8. 性别专项系统的处理

**Decision**: 不自行推断性别归属，直接采用报告数据中生殖系统下的二级分支。

**Rationale**: 核查证实数据已按性别切好。生殖系统（`targetId` 3143）在不同报告中的二级指标不同：

| 报告 `sex` | 3143 下的二级指标 |
| --- | --- |
| 0（女） | 3152 女性功能 / 3155 子宫附件 / 3161 乳腺 |
| 1（男） | 3144 男性功能 / 3148 前列腺 |

两条独立证据确认 `sex` 语义：`oldbackend` 的 `AzyReportDataServiceImpl` 中 `if (sex == 1) "先生" else "女士"`，以及上述数据分布。

因此 V2 的"女性功能""男性功能"两个系统直接来源于 3143 的性别分支，后端只需按 `sex` 取对应分支，不做二次分配。

**Alternatives considered**:

- 后端按 `sex` 自行把二级指标分配到两个系统：被否决，数据已经分好，自行推断会与数据不一致。

---

## R9. 趋势序列的查询方式

**Decision**: 按客户 + 系统，在报告文档集合中向过去取最近 6 份报告，逐份解析该系统得分。

**Rationale**: FR-034/035 要求固定 6 次、口径一致、不足时不补零。

报告文档内自带一步历史：`threeTarget[]` 的 `lastScore` 是上一次的值。但 V2 要的是 6 点序列，`lastScore` 不够，需要跨报告取值。

查询以客户为主键向前取报告列表，再对最多 6 份报告各取一次该系统得分。实现上应批量取得，避免 6 次单独查询把接口拖出 SC-013 的 3 秒预算。

**实现约束（实测发现）**: 报告集合有 **84 万文档，但只索引了 `_id` 与 `robotSn`**——没有 `uId` 索引。初版按 `uId` + `reportDate` 排序查，实测直接 `NetworkTimeout`（全表扫描）。

改为两步走，两段都走索引：

1. 旧库 `inspect_base` 按 `customer_id` 取报告编号（该列有索引，客户报告数已验证可达 872 份）
2. Mongo 按 `_id` 的 `$in` 回查文档（主键索引）

实测：单份报告首页 0.19–0.30 秒，详情 0.04–0.09 秒，远在 3 秒预算内。

**Alternatives considered**:

- 给 `reportV2Info.uId` 建索引：被否决，报告数据源只读，不得建索引（FR-031、Scope Boundaries）。
- 只用 `lastScore`：被否决，只提供 2 个点，不满足"近 6 次"。
- 全量拉取该客户历史再截断：被否决，客户报告数无上限。

---

## R10. 数据源访问的超时与降级

**Decision**: 对 MongoDB 查询与 MySQL 查询分别设置超时，超时或连接失败统一抛出可识别的异常，由服务层转为 `report.unavailable`。

**Rationale**: FR-038 要求超时返回独立的"报告暂不可用"，且超时值必须落在 SC-013 的 3 秒预算内。本特性同时访问两个数据源，任一不可用都要归并到同一错误出口，避免基础设施故障被误报成"报告不存在"。

**被排除的备选**: 初版曾计划按"报告版本"路由到不同的 MySQL 明细表。核查证明该路径不承载 KH503 报告，已放弃；但**若将来要支持旧版血管类报告，那条链路仍需单独设计**，不在本特性范围内。

**Alternatives considered**:

- 依赖全局请求超时：被否决，无法区分故障来源。
- 配置重试：被否决，会把尾延迟推高，与本特性 3 秒目标冲突。
