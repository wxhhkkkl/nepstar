# 指标管理扩展契约

**Router prefix**: `/indicators`（既有路由，本特性在其上扩展）
**访问控制**: 后台 JWT（既有 `get_current_user`），沿用现有机权限控制（FR-033）。

本特性**不新建**独立的管理模块或菜单（FR-025）。`targetId` 登记与报告文案维护都挂在既有的"健康管理 → 指标管理"上，复用其既有的增删改查接口。

---

## 背景：为什么是 `targetId`

报告文档（MongoDB `receive_report.reportV2Info`）中的系统与指标以**数字标识**出现，例如 `3087`（循环系统）、`3115`（内分泌）。该数字与旧库指标字典 `inspect_target.target_id` 以及后台 `sa_indicator` 一一对应。

报告文档内**没有名称、没有权重、没有字符串编码**。因此：

- 名称与权重由 `inspect_target` 提供；
- 报告与后台指标之间只需一个 `targetId` 对应关系，不需要编码转换层。

---

## 既有接口的字段扩展

### POST /api/v1/indicators — 新建指标

**Body** 在既有字段上新增（全部可选）：

```json
{
  "parent_id": null,
  "code": "SYS_ENDOCRINE",
  "name": "内分泌",
  "description": "松果体、胰岛素、肾上腺和性腺相关的内分泌节律状态。",
  "sort_order": 1,
  "status": 1,
  "target_id": 3115,
  "report_status_text": "重点关注",
  "report_summary": "松果体节律偏弱，睡眠管理需优先改善",
  "report_interpretation": "松果体分泌是本次内分泌维度的主要影响项。",
  "report_actions": ["固定起床与入睡时间", "睡前 1 小时减少强光与电子屏幕"]
}
```

`report_actions` 是字符串数组；后端以 JSON 文本存入 `sa_indicator.report_actions`。
`target_id` 为整数，对应报告文档中的数字标识。

### PUT /api/v1/indicators/{id} — 修改指标

同字段，全部可选。改动在**不需要发布新版本**的情况下影响下一次报告请求（FR-026、FR-041）。

### GET /api/v1/indicators/tree — 指标树

返回节点在既有字段上增加：

```json
{
  "id": 1,
  "parent_id": null,
  "code": "SYS_ENDOCRINE",
  "name": "内分泌",
  "description": "…",
  "status": 1,
  "sort_order": 1,
  "target_id": 3115,
  "report_status_text": "重点关注",
  "report_summary": "…",
  "report_interpretation": "…",
  "report_actions": ["…"],
  "children": []
}
```

---

## 冲突校验

`sa_indicator.target_id` 上建**唯一约束**（FR-032）。指标维护人员在表单中登记一个已被其他指标占用的 `target_id` 时：

| code | message | 场景 |
| --- | --- | --- |
| 400 | `indicator.target_id_required` | 提交了非空但非法的 `target_id`（非整数或 ≤ 0） |
| 409 | `indicator.target_id_conflict` | 该 `target_id` 已被**另一个**指标登记（FR-032、SC-012） |

`indicator.target_id_conflict` 由唯一约束触发；服务层需在写入前预检或捕获 `IntegrityError`，返回 409 而不是 500。修改指标自身时，同一个 `target_id` 不算冲突（需按 `id != 当前指标` 判断）。

**不校验 `target_id` 是否在报告文档或 `inspect_target` 中真实存在**——报告数据源是外部系统，后台不应因外部系统暂时不可达而阻塞配置维护。未命中的 `target_id` 在组装时按 FR-028 跳过并记录日志。

---

## 报告展示接口侧的读取语义

- 组装报告时，按报告文档中实际出现的 `targetId` 反向查找已登记的指标（FR-025）。
- 只有 `status=1` 的指标参与组装（FR-016）；被停用指标的登记保留但不生效。
- 报告文档中的某个 `targetId` 未登记到任何指标、或已登记的指标被停用时，跳过该项并保留其余数据（FR-028），同时按 FR-039 记录未命中的 `targetId`。
- 名称取自指标记录；若指标记录未维护名称则回退到 `inspect_target.inspect_name`。
- 权重一律取自 `inspect_target.proportion`，**不读**指标记录（FR-037）。

## Error keys（后端 i18n 新增）

- `indicator.target_id_required`
- `indicator.target_id_conflict`

两个 key 需加入 `app/i18n/__init__.py` 的三个语言块，与既有 `indicator.*` key 并列。
