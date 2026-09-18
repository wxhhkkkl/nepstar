# Contracts: 报告展示数据接口

**Feature**: `003-report-v2-data-api`

本目录定义本特性对外暴露的接口契约。约定与 `specs/001-add-health-management/contracts/` 保持一致。

## 共享约定

- **响应封装**: 所有接口返回 `{ code, message, data, timestamp }`。成功为 `code=200`、`message="success"`；业务失败为 HTTP 200 + 非 200 的 `code`（见各接口错误表）。数据在 `data` 中。
- **错误消息**: `message` 是后端 i18n 的点号 key（如 `report.not_found`），由前端按当前语言翻译。后端不返回译好句子。
- **命名**: 线上 JSON 一律 snake_case，与后端既有 `ApiResponse` 一致；本目录中的示例沿用 snake_case。
- **内容语言**: 报告文案为中文单一语言，本阶段不按 `Accept-Language` 输出多语言（见 spec 的 Out of Scope）。
- **时区/日期**: 日期以 ISO 字符串返回，由报告前端负责格式化。

## 数据源

报告内容取自 **MongoDB**（`receive_report.reportV2Info`），是后端本特性新增的只读数据源；指标名称与权重取自 **MySQL** 的 `inspect_target`。两者的关联键是数字 `targetId`。详见 [data-model.md](../data-model.md)。

## 接口清单

| 文件 | 内容 |
| --- | --- |
| [report-view.md](report-view.md) | 报告首页聚合接口、系统二级详情接口（面向报告查看者，不要求后台登录） |
| [indicator-target-id.md](indicator-target-id.md) | 指标管理模块的扩展：`targetId` 登记与报告文案维护（面向后台登录用户） |

## 两组接口的访问控制差异

| | 报告展示接口 | 指标管理扩展接口 |
| --- | --- | --- |
| 使用者 | 持有报告链接的报告查看者 | 已登录的后台用户 |
| 凭证 | `report_code` + `customer_id` + 归属校验 | 后台 JWT（既有 `get_current_user`） |
| 依据 | FR-021：两组访问控制相互独立 | FR-033：沿用既有登录与权限控制 |

报告展示接口**不得**复用后台 JWT，也不得挂载 `check_permission`。

## 新增 i18n key 汇总

| key | 所属接口 |
| --- | --- |
| `report.not_found` | 报告展示（对外合并"报告不存在"与"无权访问"） |
| `report.not_ready` | 报告展示 |
| `report.system_not_found` | 报告展示 |
| `report.unavailable` | 报告展示 |
| `indicator.target_id_required` | 指标管理扩展 |
| `indicator.target_id_conflict` | 指标管理扩展 |

六个 key 均需加入 `app/i18n/__init__.py` 的 `zh-CN` / `en` / `es` 三个语言块。
