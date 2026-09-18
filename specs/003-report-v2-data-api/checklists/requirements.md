# Specification Quality Checklist: 报告展示数据接口（Report View API）

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-18
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### 澄清历史（三轮，共 15 问）

**第一轮（specify，3 问）**：数据来源→读取真实报告结果；交付范围→后端接口 + V2 前端接入；访问凭证→报告编号 + 客户标识 + 归属校验。

**第二轮（clarify，5 问）**：读取策略→实时只读；维护方式→复用指标管理模块；图表职责→后端出类别与系列；历史趋势→本期支持；就绪判定→看主记录状态与报告时间。

**第三轮（clarify，5 问）**：枚举防护→不存在与无权访问对外统一；权重来源→以旧库字典为准；数据源故障→返回"暂不可用"；性能目标→P95 ≤ 3 秒；日志审计→结构化日志即可。

**第四轮（clarify，5 问）**：直接采集→报告级单值固定归属；报告文案→指标管理模块维护；趋势次数→固定 6 次；展示配置→本期固定值；回退边界→本期即移除模拟数据。

### 数据源核查修正（2026-09-18）

规划阶段核查 `oldbackend`（旧 Java 报告后端）与真实数据后，**推翻了前四轮一直沿用的数据源假设**：

| 项 | 原判断 | 核查后 |
|---|---|---|
| 报告本体 | MySQL 按版本拆分的宽表 | **MongoDB `receive_report.reportV2Info`** |
| 指标标识 | 不透明字符串代码（`A3087` 一类） | **数字 `targetId`** |
| 名称与权重 | 报告内 / 映射登记 | MySQL `inspect_target`（`proportion`） |
| 直接采集值 | `inspect_base` 的报告级单列 | **报告文档的 `spo2hReportInfo` / `ecgReportInfo`** |
| 性别专项 | 后端自行推断归属 | **数据天然按性别分好**（生殖系统 3143 的二级分支） |
| 映射形态 | `sa_indicator_legacy_code` 关联表 | **`sa_indicator.target_id` 单列 + 唯一约束** |

修正已同步到 spec（6 条修正条目）、research.md（R1–R4 重写）、data-model.md（存储实体重写）、plan.md（技术上下文、文件清单、风险）、contracts（`indicator-legacy-code.md` 更名为 `indicator-target-id.md`）、quickstart.md。

### 结构校验

FR-001~043 连续无缺号；SC-001~018 连续无缺号；Clarifications 保留原有 15 条问答记录并追加 6 条修正条目（不删改历史记录，避免掩盖判断过程）；5 个用户故事按 P1/P1/P2/P2/P3 排列。

### 口径确认（2026-09-18）

| 项 | 结论 |
|---|---|
| V2 的 8 个系统 | 从旧 10 个一级中选取；营养状态/有害物质/皮肤系统不展示。每份报告展示 7 个（性别两项二选一）。 |
| 系统得分来源 | 6 个取报告文档 `firstTarget[]` 的得分；女性/男性功能取生殖系统下对应二级分支的得分；**不由所展示的指标重新加权得出**。 |
| 指标层级 | 真实数据是三层结构，V2 设计稿列的指标位于**第三层**，中间二级层不展示。 |
| 指标挑选 | **照设计稿逐项映射**——在指标管理里逐个登记 `targetId`，未登记的不展示。 |
| ~~女性功能 5 vs 3 偏差~~ | **作废**。V2 的 5 个指标是三级指标（3154/3224/3159/3160/3162），真实数据中全部存在。原判断是把三级误读成二级。 |

已同步到 spec（FR-027/044、SC-019/020、Assumptions、2 条确认条目）、plan（Summary、宪章 IV、风险项、实施顺序）、data-model（§2.4/2.5、迁移）。

### 分析后澄清（2026-09-18，针对 /speckit-analyze 的发现）

| 分析项 | 问题 | 结论 |
|---|---|---|
| U1 (CRITICAL) | 健康预期寿命无数据源 | **确认旧系统两处数据源都没有该字段**（`platform` 库无相关列，`oldbackend` 无代码引用）。改为按公式派生：`86.8 − (生理年龄 − 实际年龄)`，基准值从设计稿 mock 反推，以配置项实现（FR-045） |
| U2 (HIGH) | `weighted` 字段无来源 | 指标树内的项全部参与加权，不参与加权的只有树外的直接采集值 → **删除该字段**（FR-037 修订） |
| A1 (MEDIUM) | "需要趋势展示的系统"未指明 | 明确为**仅心血管**，其余系统趋势为空（FR-034 修订） |
| A2 (MEDIUM) | "结构口径一致"判定不明 | 明确为**同一 collection 即同源**，结构漂移由字段存在性容错兜住（FR-035 修订） |
| U3 (MEDIUM) | `focus_system_codes` 无 FR 依据 | 前端从未引用（只在 mock 里定义过一次）→ **删除** |

**第二轮分析后补充核查（2026-09-18）**

| 分析项 | 问题 | 结论 |
|---|---|---|
| U1 (CRITICAL) | `peerPercent` 来源未核实 | **已查实**：`inspect_base.ranking` 即百分位（`BaseUtilJob` 文案"你的得分好于全国 X% 的人"，取值 0–100 且与总分单调对应）。五份 V2 报告全部有值，按报告编号关联即可（FR-046） |
| 新增歧义 | `实际年龄`取档案年龄还是受检年龄（两者差 2–3 岁，前者有 0 值） | **取受检年龄**（`ddsReportInfo.inspectAge`），五份样本全部有效且与生理年龄同源配对（FR-046） |

**顺带验证**：报告文档与旧库主记录在总分、受检年龄、性别三项上五份样本逐条一致，两个数据源不打架。V2 报告的 `dept_id` 为 223181/222069 而非配置的 225721，印证"本环境无报告"是配置值问题而非数据缺失。

### 仍未解决的（属任务层，不在 spec 范围）

- **G1 (CRITICAL)**：tasks.md 中 FR-034/035/036 + SC-011（趋势序列）**零任务**——规格侧现已明确（仅心血管、6 次、同 collection），但 tasks.md 仍需补 3~4 条实现与测试任务。
- **G2 (HIGH)**：tasks.md 中 FR-039 + SC-015（结构化日志）**零任务**，同样需补。
- **I1 (MEDIUM)**：seed 任务 T039 属 US4/P2 但 US1/P1 的演示依赖它，建议提前到 Foundational。

### 待实施前解决

1. **MongoDB 凭据与白名单**：报告文档是阿里云副本集，需要客户端 IP 白名单。实测确认（2026-09-18）在配置白名单后连通，认证方式 SCRAM-SHA-256，主节点 `47.93.105.139:3717`。
2. **`targetId` 登记需逐项核对**：8 个系统下的指标清单要按设计稿逐个登记，登记错一个会把得分挂到错误指标且不报错。seed 脚本必须对照 `inspect_target` 名称核对，并作为验收项。
3. **V2 既有测试将失效**：`reportFront/report-v2` 现有单测/视觉基线断言依赖固定模拟值（总分 68、内分泌 58、骨骼 54 等），移除模拟数据后必须同步改写。

### 未提问项（低影响，已按合理默认处理）

- 报告内容多语言：已显式列入 Out of Scope。依据是健康管理模块既有的"v1 仅中文"结论与 V2 前端现状。
- 并发压力目标：SC-013 的取样不含并发压力（20 份报告串行请求），并发上限未设。

### 判定说明

- 本特性是接口特性，"技术无关"落在"不绑定语言、框架、库与具体 URL 形状"上：具体接口路径与响应字段形状在 `contracts/` 中定义。
- 响应体统一封装、错误编码取值属于后端既有规范，正文不复述，仅在 Assumptions 中声明以后端既有规范为准。
- 报告前端的视觉状态映射（分数颜色、光晕、色调、图标、图表类型与单位）显式排除在接口职责之外。
- 核查通过只读查询完成：旧库 MySQL 的 `information_schema` 与计数查询、MongoDB 的报告文档读取、`oldbackend` 源码阅读。**未写入任何数据**。
