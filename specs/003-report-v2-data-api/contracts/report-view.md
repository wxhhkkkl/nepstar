# 报告展示接口契约

**Router prefix**: `/report-view`（挂载于 `/api/v1`）
**访问控制**: 无 JWT。以 `report_code` + `customer_id` 鉴权并校验归属（FR-029、FR-021）。

这两个接口**不挂载** `get_current_user` 或 `check_permission`。

---

## GET /api/v1/report-view/{report_code}/home — 报告首页聚合数据

一次返回报告首页所需的全部数据（FR-001）。前端不再拼装多个后台配置接口。

**Path**

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `report_code` | string | 报告业务编号 |

**Query**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `customer_id` | integer | 是 | 报告归属客户，用于归属校验 |

**Response `data`**

```json
{
  "report": {
    "report_code": "LS-20260803-0286",
    "serial_number": "LS—20260803—0286",
    "report_date": "2026-08-03",
    "gender": "female",
    "total_score": 68,
    "warning_threshold": 70,
    "peer_percent": 38,
    "actual_age": 42,
    "biological_age": 44.2,
    "healthy_life_expectancy": 84.6,
    "summary": "内分泌与骨骼是本次长寿指数的主要影响项。"
  },
  "systems": [
    {
      "system_code": "SYS_ENDOCRINE",
      "name": "内分泌",
      "score": 58,
      "status_text": "重点关注",
      "summary": "松果体节律偏弱，睡眠管理需优先改善",
      "sort_order": 1,
      "applicable": true,
      "visualization": { "categories": ["胰岛素", "肾上腺", "性腺", "松果体"], "series": [68, 60, 64, 48] },
      "trend": { "series": [62, 60, 61, 59, 57, 58] },
      "indicators": [
        { "indicator_code": "SYS_ENDOCRINE_PINEAL", "name": "松果体分泌", "score": 48, "weight": 25, "description": "松果体分泌与睡眠节律相关。" }
      ],
      "recommendation": {
        "trigger_indicator_code": "SYS_ENDOCRINE_PINEAL",
        "issue": "松果体分泌 · 活力值 48",
        "plan_id": 1,
        "plan_name": "松果体睡眠健康管理方案",
        "title": "睡眠健康管理方案",
        "description": "针对松果体节律偏弱，帮助建立稳定的睡眠节律与晚间恢复习惯。",
        "tags": ["睡眠节律管理", "晚间恢复支持"],
        "action_label": "查看松果体改善建议",
        "action_hint": "从睡眠节律开始管理",
        "products": [
          { "product_id": 1, "name": "睡眠健康管理礼盒", "image_url": "https://…/sleep.png", "image_alt": "睡眠健康管理礼盒" }
        ]
      }
    }
  ],
  "ai_consult": { "enabled": true, "title": "AI 长寿咨询", "entry_type": "route", "entry_url": "/ai-consult" },
  "features": { "save_report_enabled": false }
}
```

**Errors**

| HTTP | code | message | 场景 |
| --- | --- | --- | --- |
| 200 | 404 | `report.not_found` | 报告不存在，或客户标识与该报告不匹配（对外合并） |
| 200 | 409 | `report.not_ready` | 主记录状态无效或报告生成时间未落定 |
| 200 | 503 | `report.unavailable` | 报告数据源或旧库超时、不可达 |

**约束**

- `systems` 只包含适用于报告性别的一级系统（FR-012）。
- `systems` 已按 `sort_order` 排好；前端不得重排（FR-013、FR-014）。
- 不返回图表类型与单位，它们由前端按 `system_code` 固定维护（FR-004）。
- `trend.series` 仅对**心血管**返回；最多 6 项、时间升序、只含同 collection 的历史；其余系统为空数组（FR-034~036）。
- 未维护文案的系统，`status_text` / `summary` 为 `null`（FR-041 降级路径）。
- `ai_consult` 与 `features` 本阶段为固定值（FR-020）。
- `actual_age` 取报告文档的**受检年龄**，不是客户档案年龄（档案年龄存在 0 值）。`peer_percent` 取旧库报告主记录的排名字段。字段来源详见 FR-046。

---

## GET /api/v1/report-view/{report_code}/systems/{system_code} — 系统二级详情

**Path**

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `report_code` | string | 报告业务编号 |
| `system_code` | string | 一级系统标识 |

**Query**: 同首页接口（`customer_id` 必填）。

**Response `data`**

```json
{
  "report_code": "LS-20260803-0286",
  "system": {
    "system_code": "SYS_BONE",
    "name": "骨骼",
    "score": 54,
    "status_text": "重点关注",
    "summary": "骨质疏松风险突出，钙流失管理需优先安排",
    "sort_order": 3,
    "applicable": true,
    "visualization": { "categories": ["骨质疏松", "骨质增生", "颈椎钙化", "腰椎钙化"], "series": [48, 60, 57, 55] },
    "trend": { "series": [] },
    "indicators": [
      { "indicator_code": "SYS_BONE_OSTEOPOROSIS", "name": "骨质疏松", "score": 48, "weight": 25, "description": "骨量流失与骨质疏松风险。" }
    ],
    "direct_measurements": [],
    "interpretation": "骨质疏松是本次骨骼维度的主要影响项。",
    "actions": ["在专业建议下评估钙与维生素 D 摄入", "每周安排 2–3 次适度负重或抗阻训练"],
    "recommendation": { "…": "同首页接口的推荐结构" }
  }
}
```

**Errors**

| HTTP | code | message | 场景 |
| --- | --- | --- | --- |
| 200 | 404 | `report.not_found` | 报告不存在，或客户标识不匹配 |
| 200 | 409 | `report.not_ready` | 报告尚未就绪 |
| 200 | 404 | `report.system_not_found` | 系统标识不属于该报告 |
| 200 | 503 | `report.unavailable` | 报告数据源或旧库超时、不可达 |

**约束**

- `system` 的 `score`、`status_text`、`summary`、`visualization`、`recommendation` 必须与首页接口返回的同一系统完全一致（FR-011、SC-002）。
- `direct_measurements` 取自报告文档中的报告级单值（`spo2hReportInfo` 的血氧饱和度与微循环、`ecgReportInfo` 的心率与心电状态），按固定归属挂载到心血管与肺功能，**不参与加权**（FR-009）。字段缺失时返回空数组。
- 系统不适用于报告性别时按 `report.system_not_found` 处理，**不得**回退到第一个系统。
- `actions` 为空数组时前端隐藏该区块。

---

## Error keys（后端 i18n 新增）

以下 key 需同时加入 `app/i18n/__init__.py` 的 `zh-CN` / `en` / `es` 三个语言块：

- `report.not_found`
- `report.not_ready`
- `report.system_not_found`
- `report.unavailable`

**注意**: `report.not_found` 在对外层面同时代表"报告不存在"与"无权访问"。两者的真实原因只写入结构化日志（FR-039），不得通过 `message` 或 `code` 对外区分（FR-019、SC-007）。
