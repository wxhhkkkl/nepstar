# Data Model: V2 报告前端框架迁移

本阶段的数据模型只用于项目内模拟数据，不对应数据库表，也不发起远程请求。首页和详情页必须读取同一个报告对象。

## ReportSnapshot（报告快照）

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | string | yes | 本地演示报告唯一标识 |
| `serialNumber` | string | yes | 当前报告编号 |
| `reportDate` | string | yes | `YYYY.MM.DD` 展示格式 |
| `score` | number | yes | 0–100；当前值为 68 |
| `warningThreshold` | number | yes | 当前为 70；`score < threshold` 时警示 |
| `profileGender` | string | yes | 当前为 `female`，用于专项模块互斥展示 |
| `peerPercent` | number | yes | 当前超过同龄人比例 38 |
| `actualAge` | number | yes | 当前为 42 |
| `biologicalAge` | number | yes | 当前为 44.2 |
| `healthyLifeExpectancy` | number | yes | 当前为 84.6 |
| `focusSystemIds` | string[] | yes | 当前为 `endocrine` 与 `bone` |
| `summary` | string | yes | 报告级结论 |
| `systemOrder` | string[] | yes | 业务展示顺序，只包含当前可见系统 ID |
| `systems` | SystemModule[] | yes | 当前报告系统集合 |
| `assets` | ReportAssets | yes | AI 与长图固定资源 |

### Derived values

- `isWarning = score < warningThreshold`
- `ageDifference = biologicalAge - actualAge`
- `visibleSystems = systems.filter(system matches profileGender)`
- 首页展示流由 `systemOrder` 和每个系统的 `recommendation` 派生。

## SystemModule（身体系统）

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | string | yes | 在报告内唯一；用作详情路由参数 |
| `name` | string | yes | 用户可见名称 |
| `score` | number/null | yes | 0–100；不适用系统可为 `null` |
| `status` | string | yes | 如“重点关注”“表现良好” |
| `summary` | string | yes | 首页与详情共享 |
| `tone` | string | yes | 映射既有视觉色调类名 |
| `icon` | string | yes | 映射既有 SVG 图标 |
| `applicableGenders` | string[] | yes | 当前用户性别是否显示并参与报告 |
| `visualization` | Visualization | yes | 首页和详情图表数据 |
| `tags` | string[] | yes | 首页摘要标签 |
| `indicators` | Indicator[] | yes | 评分构成 |
| `direct` | DirectMeasurement[] | yes | 直接采集结果，可为空 |
| `interpretation` | string | yes | 详情结论 |
| `actions` | string[] | yes | 健康建议 |
| `recommendation` | Recommendation/null | yes | 仅内分泌和骨骼非空 |

### Validation

- 当前女性报告可见系统必须恰好为：`endocrine`、`lung`、`bone`、`cardio`、`digest`、`female`、`immune`。
- `id` 不得重复。
- 有分数时必须位于 0–100。
- `indicators[].score`、图表主值与首页/详情显示必须来自同一对象。
- 仅适用于男性的系统不得进入当前女性首页展示流。

## Visualization（图表）

所有图表共享：

| Field | Type | Required | Rules |
|---|---|---:|---|
| `type` | string | yes | 七种支持类型之一 |
| `key` | string | yes | 报告内唯一 |
| `title` | string | yes | 详情图表标题 |
| `unit` | string | yes | 当前均为“活力值”或明确测量单位 |
| `carryToDetail` | boolean | yes | 当前必须为 `true` |

支持类型及附加字段：

| Type | Additional fields |
|---|---|
| `line` | `series[]`, `period` |
| `radial-gauge` | `value`, `secondary?` |
| `horizontal-bars` | `categories[]`, `series[]` |
| `matrix` | `categories[]`, `series[]` |
| `radial-orbit` | `value?`, `categories[]`, `series[]` |
| `network` | `categories[]`, `series[]` |
| `vertical-bars` | `categories[]`, `series[]` |

当 `categories` 存在时，其长度必须等于 `series` 长度。数值型活力值必须位于 0–100。

## Indicator（评分指标）

| Field | Type | Required | Rules |
|---|---|---:|---|
| `name` | string | yes | 指标名 |
| `score` | number | yes | 0–100 |
| `weight` | number | yes | 0–100；同一系统权重合计应为 100 |

## DirectMeasurement（直接采集）

| Field | Type | Required | Rules |
|---|---|---:|---|
| `name` | string | yes | 测量项名称 |
| `value` | string | yes | 保留单位的展示值 |

为空数组时，详情页必须隐藏直接采集区，不保留空白占位。

## Recommendation（健康推荐）

| Field | Type | Required | Rules |
|---|---|---:|---|
| `issue` | string | yes | 与具体低分问题对应 |
| `title` | string | yes | 允许包含一个受控换行 |
| `context` | string | yes | 推荐原因和管理方向 |
| `tags` | string[] | yes | 两个简短管理标签 |
| `image` | string | yes | 项目内公开资源路径 |
| `imageAlt` | string | yes | 可访问替代文本 |
| `actionLabel` | string | yes | 详情入口文案 |
| `actionHint` | string | yes | 次级行动说明 |

### Required associations

- `endocrine` → 松果体分泌 48 → 睡眠健康管理方案。
- `bone` → 骨质疏松 48 → 钙流失健康管理方案。
- 其余五个可见系统 → `recommendation=null`。

## ReportAssets（报告资源）

| Field | Type | Required | Rules |
|---|---|---:|---|
| `aiConsultImage` | string | yes | 当前 AI 咨询静态设计图 |
| `aiDoctorAvatar` | string | yes | 悬浮入口头像 |
| `downloadImage` | string | yes | 当前 V2 手机长图 |

## View State（非持久页面状态）

| State | Owner | Transition |
|---|---|---|
| `displayScore` | `ScoreOverview` | 0 → 68；减少动态效果时直接为 68 |
| `isWarning` | computed | 总分低于 70 时为 true |
| `saveFeedback` | `SaveReportButton` | idle → saved → idle（约 1.8 秒） |
| `revealedSystemIds` | `SystemAtlas` | 系统进入视口后加入；只播放一次 |
| `homeScrollY` | scroll composable / sessionStorage | 进入详情前写入，首页重新挂载后读取 |
| `selectedSystem` | `SystemDetail` 路由视图 | 根据路由参数 `systemId` 查找；未知值进入回退状态 |

## State Transitions

```text
首页载入
  → 计算警示状态
  → 分数动画到 68（或直接到 68）
  → 卡片进入视口后显示

点击系统
  → 保存 scrollY
  → 路由导航到 /#/system/<systemId>
  → 从共享数据查找系统
  → 找到：渲染详情；未找到：渲染回退

返回首页
  → 读取并恢复 scrollY

点击保存
  → 触发静态长图下载
  → 显示“已保存”反馈
  → 反馈自动复位
```
