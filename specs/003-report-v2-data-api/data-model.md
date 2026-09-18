# Phase 1 Data Model: 报告展示数据接口

**Feature**: `003-report-v2-data-api` | **Date**: 2026-09-18（按数据源核查结果修订）

本特性涉及三类数据：**项目内存储实体**（`nepstar` 库中扩展的表，供指标管理模块维护）、**报告数据源**（MongoDB 文档 + 旧库 MySQL 字典，只读）、**展示结构**（接口输出形状，不落库）。

---

## 1. 项目内存储实体

### 1.1 `sa_indicator`（扩展既有表）

一级、二级健康指标。本特性在既有结构上新增一个标识列与四个报告文案列。

| 列 | 类型 | 约束 | 说明 | 来源 |
| --- | --- | --- | --- | --- |
| `target_id` | `INT` | NULL, UNIQUE | 报告文档中对应的数字标识 | 新增 |
| `report_status_text` | `VARCHAR(50)` | NULL | 状态描述，如"重点关注" | 新增 |
| `report_summary` | `VARCHAR(255)` | NULL | 系统摘要 | 新增 |
| `report_interpretation` | `VARCHAR(500)` | NULL | 结论解读 | 新增 |
| `report_actions` | `TEXT` | NULL | 行动建议，JSON 字符串数组 | 新增 |

既有列（`id`、`parent_id`、`ind_code`、`ind_name`、`description`、`sort_order`、`status`）保持不变。

**Validation rules**

- `target_id` 在启用记录间必须唯一，由数据库唯一约束落实 FR-032；冲突时返回明确错误而非 500（SC-012）。
- `target_id` 只对"该指标参与报告展示"的记录填写；未登记即不参与组装（FR-028、US4 场景 5）。
- 四个文案列对二级指标无意义；二级指标的说明复用既有 `description`（FR-041）。
- 四个文案列全部为空时，报告对应字段返回空，页面隐藏该区块。
- `report_actions` 为空串或非法 JSON 时按空数组处理，不得让接口失败。

> **为何不建关联表**：初版计划为"指标 × 报告版本 × 旧库代码"建独立表。核查后确认标识就是数字 `targetId` 且与指标一一对应，一个带唯一约束的列即可，无需关联表（research R3）。

### 1.2 旧库 MySQL（只读，不建模、不修改）

`platform.inspect_target` 提供报告文档中没有的名称与权重：

| 列 | 用途 |
| --- | --- |
| `target_id` | 与报告文档的 `targetId` 对应 |
| `inspect_name` | 系统 / 指标名称 |
| `parent_id` / `inspect_level` | 层级 |
| `proportion` | **权重**（FR-008、FR-037 的唯一来源） |
| `sort` | 同级排序 |
| `sex` | 适用性别 |

一级 10 个系统的权重依次为 30 / 20 / 15 / 8 / 5 / 5 / 5 / 5 / 5 / 2。报告文档自身**没有**权重字段，后端也不另行维护权重。

---

## 2. 报告数据源（MongoDB，只读）

**库 / 集合**: `receive_report.reportV2Info`，`_id` 即报告编号。

### 2.1 文档顶层结构

```text
ReportV2Info
├── _id               报告编号，如 KH503LS0005865V220721182530852
├── _class            com.kangjia.modules.report.entity.v2.ReportV2Info
├── sex               0=女 / 1=男
├── uId               用户标识
├── robotSn           设备序列号
├── agentId           经销商标识
├── reportDate        形如 "20220721182722"
├── detectionCode     通常为空
├── userInfo          { userId, userName, sex, age, weight, height, [salesmanCode], mobile }
├── ddsReportInfo     { inspectAge, totalScore, totalScored, totalAge, firstTarget[], psTargets[], fastScore[] }
├── ecgReportInfo     { heartRate, heartStatus, heartLines, heartOfflines }
├── spo2hReportInfo   { heartRate, bloodoxygenRate, microcirculation }
└── skinReportInfo    { … }   本特性不使用
```

### 2.2 指标树

```text
firstTarget[]           一级系统
├── targetId            INT，唯一标识
├── score               INT
├── totalScored         DOUBLE
├── inspectAge          INT | null
└── secondTarget[]     二级指标
    ├── targetId        INT
    ├── score           INT
    ├── totalScored     DOUBLE
    └── threeTarget[]  三级细分项
        ├── targetId    INT
        ├── score       INT
        ├── lastScore   INT      上一次的得分
        ├── abLevel     INT      异常等级
        └── offset      INT

fastScore[]             一级得分的扁平数组，与 firstTarget[].score 同序同值
```

**核查确定的事实**（4 份真实报告，含 KH503 与 KJ501 两种机型）:

- 一级系统恒为 **10 个**，顺序恒定：3087 循环系统 → 3095 消化系统 → 3108 呼吸系统 → 3115 内分泌 → 3127 骨骼系统 → 3135 免疫系统 → 3143 生殖系统 → 3163 营养状态 → 3195 有害物质 → 3244 皮肤系统。
- 同一 collection 装入多个机型的报告，以 `robotSn` 区分。
- **文档结构存在漂移**：`skinReportInfo` 在不同文档中字段数为 37 与 33 两种。本特性按字段存在性容错读取，不假定 schema 统一。

### 2.3 性别专项分支

生殖系统（`targetId` 3143）的二级指标按报告 `sex` 返回不同分支：

| `sex` | 3143 下的二级指标 |
| --- | --- |
| 0（女） | 3152 女性功能 / 3155 子宫附件 / 3161 乳腺 |
| 1（男） | 3144 男性功能 / 3148 前列腺 |

V2 的"女性功能""男性功能"两个系统即来源于此，后端不做二次分配（FR-012、research R8）。

### 2.4 V2 展示口径与旧一级的对应

| V2 系统 | 来源 |
| --- | --- |
| 消化系统 / 内分泌 / 骨骼 / 免疫力 | 旧一级 3095 / 3115 / 3127 / 3135，1:1 |
| 心血管 | 取自 3087 循环系统下的二级 3088 心血管 |
| 肺功能 | 取自 3108 呼吸系统下的二级 3109 肺功能 |
| 女性功能 / 男性功能 | 取自 3143 生殖系统的性别分支（见 2.3） |
| —（不展示） | 3163 营养状态 / 3195 有害物质 / 3244 皮肤系统 |

**该口径已确认**（2026-09-18）：V2 的 8 个系统从旧 10 个一级中选取，营养状态 / 有害物质 / 皮肤系统不展示；每份报告展示 7 个（女性功能与男性功能按性别二选一）。系统得分取报告文档中对应层级的得分——6 个取 `firstTarget[]` 的得分，性别两项取生殖系统下对应二级分支的得分，**不由所展示的指标重新加权得出**（FR-044、SC-020）。

### 2.5 指标位于三层结构中的第三层

`inspect_target` 是三层结构。V2 设计稿列出的指标对应**第三层**，中间的二级层不单独展示：

```text
3115 内分泌                     ← 旧一级，V2 的"内分泌"系统
└─ 3121 激素水平 (w=50)          ← 二级，不展示
   ├─ 3123 肾上腺分泌 (w=10)     ← 三级，V2 展示
   ├─ 3124 性腺分泌 (w=30)       ← 三级，V2 展示
   └─ 3125 松果体分泌 (w=20)     ← 三级，V2 展示
└─ 3116 胰岛功能 (w=50)
   └─ 3211 胰岛素 (w=50)         ← 三级，V2 展示
```

对照实例（已逐项核对，全部存在）：

| V2 系统 | 设计稿列出的指标 | 真实数据中的三级 `targetId` |
| --- | --- | --- |
| 骨骼 | 骨质疏松 / 骨质增生 / 颈椎钙化 / 腰椎钙化 | 3130 / 3132 / 3133 / 3134 |
| 免疫力 | 淋巴结 / 脾脏功能 / 免疫球蛋白 / 扁桃体免疫力 / 呼吸道免疫力 / 消化道免疫力 | 3137 / 3138 / 3139 / 3140 / 3141 / 3142 |
| 女性功能 | 黄体酮 / 内分泌失调指数 / 宫颈炎指数 / 阴道炎指数 / 乳腺增生风险 | 3154 / 3224 / 3159 / 3160 / 3162 |
| 男性功能 | 勃起功能 / 前列腺增生 / 前列腺钙化 / 前列腺炎症 | 3146 / 3149 / 3151 / 3150 |

**展示哪些指标由后台逐个登记 `targetId` 决定**，未登记的不展示（FR-044）。因此不存在"数据缺口"问题——设计稿的指标在真实数据中都有对应项。

---

## 3. 展示结构（接口输出，不落库）

### 3.1 报告首页数据

```text
ReportHomeData
├── report: { reportCode, serialNumber, reportDate, gender, totalScore,
│             warningThreshold, peerPercent, actualAge, biologicalAge,
│             healthyLifeExpectancy, summary }
├── systems: System[]
├── aiConsult: { enabled, title, entryType, entryUrl }
└── features: { saveReportEnabled }
```

### 3.2 身体系统 `System`

```text
System
├── systemCode        稳定标识（后台指标编码）
├── name              名称
├── score             number | null
├── statusText        状态描述（来自指标文案）
├── summary           系统摘要（来自指标文案）
├── sortOrder         展示顺序
├── applicable        是否适用当前报告性别
├── visualization     { categories[], series[] }   类别由二级指标派生
├── trend             { series[] }                 仅心血管；最多 6 点，升序；无历史时为空
├── indicators        Indicator[]
└── recommendation    Recommendation | null
```

### 3.3 二级指标 `Indicator`

```text
Indicator
├── indicatorCode     稳定标识（后台指标编码）
├── name
├── score             number | null
├── weight            number | null   取自 inspect_target.proportion
└── description       二级指标说明文案
```

### 3.4 系统详情数据

```text
ReportSystemDetail
├── reportCode
└── system: System 的完整形态，另加：
    ├── directMeasurements: { name, value, unit }[]   报告级单值，固定归属
    ├── interpretation                                 结论解读（指标文案）
    └── actions: string[]                              行动建议（指标文案）
```

`directMeasurements` 的来源是文档内的 `spo2hReportInfo`（血氧饱和度、微循环）与 `ecgReportInfo`（心率、心电状态），按固定归属挂到心血管与肺功能（FR-009、research R7）。

### 3.5 推荐 `Recommendation`

```text
Recommendation
├── triggerIndicatorCode   命中的二级指标编码
├── issue                  问题描述
├── planId / planName
├── title / description / tags[]
├── actionLabel / actionHint
└── products: { productId, name, imageUrl, imageAlt }[]
```

### 3.6 关系与不变量

- `System.systemCode` 与 `Indicator.indicatorCode` 在一份报告内唯一。
- 首页与详情返回的同一 `System`，其 `score`、`statusText`、`summary`、`visualization.categories`、`visualization.series`、`recommendation` 必须完全相同（FR-011、SC-002）。
- `visualization.categories` 与 `visualization.series` 长度必须相等，且 `series` 的每一项都能对应到该系统某个 `Indicator`（FR-022）。
- `System.score` 可由其 `indicators` 按 `weight` 加权解释（FR-008、SC-003）。指标树内的项全部参与加权，不参与加权的只有树外的直接采集值。
- `recommendation` 非空时，其 `triggerIndicatorCode` 必须出现在该系统 `indicators` 中（FR-015）。
- 不适用于报告性别的系统不出现在 `systems` 中（FR-012）。
- 顶层的每个 `System` 必须能追溯到报告文档中的某个 `targetId`，且该 `targetId` 已在后台登记。

---

## 4. 状态转换

### 4.1 报告展示请求的结果状态

```text
请求
 ├─ 报告文档不存在 ────────────────────────→ report.not_found
 ├─ 客户标识与该报告不匹配 ────────────────→ report.not_found（内部记 access_denied）
 ├─ 报告文档存在但主记录状态无效 / 生成时间未落定 → report.not_ready
 ├─ 系统标识不在该报告的映射结果中 ────────→ report.system_not_found
 ├─ 报告数据源或旧库超时、不可达 ──────────→ report.unavailable
 └─ 以上均不成立 ─────────────────────────→ 200 + 展示数据
```

对外可区分四种（前两项合并），内部可区分五种，真实原因写入结构化日志（FR-019、FR-039、SC-007）。

### 4.2 指标登记的变更传播

```text
指标管理模块改动 target_id 登记 / 文案
  → 无需发布，下一次报告请求即生效（FR-026、FR-041、SC-010、SC-016）
指标被停用
  → 其登记不再参与报告组装（FR-016）
指标被删除
  → 其登记随记录一并消失
```

### 4.3 性别标识异常

```text
报告 sex 缺失或不在 {0, 1} 内
  → 不猜测分支：返回明确错误状态，或降级为不展示性别专项系统
  → 不得套用另一性别的内容（Edge Cases）
```

---

## 5. 迁移

新增一个 Alembic revision（`revision = "004"`，`down_revision = "003"`），内容为向 `sa_indicator` 添加 `target_id`（含唯一约束）与四个文案列。不传 `schema=` 参数，沿用 003 的写法。

`downgrade()` 移除该唯一约束与五个列。

对应地新增 `backend/sql/` 下的幂等 seed 脚本，按已确认的口径登记 `targetId`：先建 8 个一级指标（对应 V2 的 8 个系统），再按设计稿的指标清单逐个登记其三级 `targetId`。不展示的旧一级（3163/3195/3244）不建指标记录。

**不需要**在旧库或 MongoDB 上做任何结构变更（FR-031、Scope Boundaries）。新增 MongoDB 只读连接属于已确认的架构变更，连接参数取自 `.env` 的 `MONGODB_URL`。
