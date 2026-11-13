# Implementation Plan: 检测报告推送、回调与主动拉取

**Branch**: `008-report-push-and-callback` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-report-push-and-callback/spec.md`

## Summary

在现有管理后台内新增三条报告外发通道，并共用一套海王签名与投递能力：

1. 检测报告列表行内“再次推送”（人工，同步等待 ≤5 秒）。
2. 设备检测完成回调接口（无签名，先应答后异步投递，`reportId` 幂等）。
3. 客户按时间范围主动拉取（GET + 海王签名，`code=0` 口径，`data` 为 JSON 字符串）。

新增独立“推送记录”页面与菜单，承载人工/自动/跳过的全部投递结果与失败重发。报告本体继续从旧库 `inspect_base` 与 MongoDB `reportV2Info` 只读获取，不复制、不改写。

## Technical Context

**Language/Version**: Python 3.11+（当前虚拟环境 3.12）；Vue 3 + TypeScript（`nepstarAdmin/frontend`，既有后台前端基线）
**Primary Dependencies**: FastAPI、SQLAlchemy 2 async + aiomysql、Pydantic Settings、httpx、motor、structlog；Vue 3、Element Plus、Axios、Vue Router、vue-i18n、Vitest
**Storage**: MySQL `nepstar` schema 新增 `sa_report_push_log`；旧库 `inspect_base`/`ne` 只读；MongoDB `receive_report.reportV2Info` 只读
**Testing**: pytest + pytest-asyncio（ASGI transport）、Vitest + Vue Test Utils；curl/脚本验证签名拉取
**Target Platform**: Linux 服务器（Uvicorn + systemd + nginx），管理后台 Web
**Project Type**: Web application（后端 API + 管理前端）
**Performance Goals**: 人工推送 5 秒内返回结果；回调应答 <500ms；拉取接口 P95 <3 秒（沿用报告展示接口预算）；推送记录列表 P95 <1 秒
**Constraints**: 不修改旧库表结构；不新增外部依赖；客户地址/凭据/字段映射只放部署配置；拉取最多 31 天、单页上限 100
**Scale/Scope**: 报告数据源约 84 万文档、只读；推送记录按报告数增长；单实例后台，无独立消息队列

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] All target files are inside the canonical repository root.
- [x] 报告展示前端 `reportFront/` 不在本次范围内，本计划不改动它。
- [x] `reportFront/` 的 Vue 3 + JavaScript 约束不适用于本次；本次只改 `nepstarAdmin/frontend`（既有 TypeScript 管理后台）。
- [x] 无框架/依赖变更；新增一张系统表与外发集成模块属于本功能明确请求，已在 spec 与澄清中确认。
- [x] TDD：每个新增行为先写失败测试（签名黄金用例、回调幂等、人工推送成功/失败、拉取鉴权与分页），再实现。
- [x] 范围纪律：不改 `KH503machine`、`KH503`、`oldbackend`、`reportFront`，不重构既有报告查询。

**Post-design re-check**: 设计只新增 API 模块、服务、工具、一张表和前端两个视图/路由/菜单，未引入新框架或存储引擎；通过。

## Project Structure

### Documentation (this feature)

```text
specs/008-report-push-and-callback/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── admin-report-push.md
│   ├── device-callback.md
│   ├── haixin-outbound-push.md
│   └── open-report-pull.md
└── tasks.md            # /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
nepstarAdmin/backend/
├── app/
│   ├── api/
│   │   ├── reports.py                  # 新增 POST /reports/{id}/push、推送记录查询/重发
│   │   └── report_push.py              # 新增设备回调 + 客户拉取（公开路由）
│   ├── models/new/
│   │   └── sa_report_push_log.py       # 新增推送记录表模型
│   ├── services/
│   │   ├── report_push_service.py      # 投递、回调编排、人工推送、记录查询
│   │   ├── report_pull_service.py      # 客户拉取查询（不套用户 RBAC）
│   │   └── report_push_menu.py         # 幂等登记“推送记录”菜单
│   ├── utils/
│   │   └── haixin_sign.py              # 签名生成与校验（MD5→SHA1，大写）
│   ├── schemas/
│   │   └── report_push.py              # 请求/响应模型
│   ├── config.py                       # 新增 HAIXIN_* 配置项
│   └── main.py                         # 注册路由、启动菜单种子、清理滞留 pending
├── alembic/versions/
│   └── 010_report_push_log.py          # 新表迁移
└── tests/
    ├── unit/test_haixin_sign.py          # 文档黄金用例
    ├── unit/test_report_push_delivery.py # 出站投递/字段映射/失败原因
    ├── unit/test_report_push_model.py    # 表结构/索引/状态值
    ├── unit/test_report_pull_service.py  # 日期边界/默认区间
    ├── unit/test_report_push_menu.py     # 菜单幂等/兜底
    ├── api/test_report_push.py           # 人工推送/记录/重发
    ├── api/test_report_callback.py       # 回调幂等/失败
    └── api/test_report_pull.py           # 签名/分页/范围/PII

nepstarAdmin/frontend/
├── src/
│   ├── api/reports.ts                  # 推送、记录、重发 API
│   ├── router/index.ts                 # /report/push-records
│   ├── views/report/
│   │   ├── ReportList.vue              # 行内“再次推送”
│   │   └── ReportPushLog.vue           # 新增推送记录页
│   └── i18n/{zh-CN,en,es}.json         # 新文案
└── tests/report-push.spec.ts           # 新增前端单测（API 参数与状态映射）
```

**Structure Decision**: 沿用既有“后端 API + 管理前端”双目录结构。外发集成放在独立服务/工具中，不污染现有报告只读查询；回调与拉取使用独立路由文件，避免与需要 JWT 的管理路由混挂。

## Phase 0 — Research

见 [research.md](research.md)。关键决策：外发 POST 表单 + 可配置字段映射；`asyncio.create_task` + 数据库状态（不引入队列）；`dedupe_key` 唯一索引保证自动推送幂等；拉取严格按海王签名与 `data` 字符串口径。

## Phase 1 — Design & Contracts

- 数据模型：[data-model.md](data-model.md)（`sa_report_push_log` 字段、索引、状态流转、配置项）
- 契约：
  - [contracts/admin-report-push.md](contracts/admin-report-push.md)
  - [contracts/device-callback.md](contracts/device-callback.md)
  - [contracts/open-report-pull.md](contracts/open-report-pull.md)
  - [contracts/haixin-outbound-push.md](contracts/haixin-outbound-push.md)
- 快速验证：[quickstart.md](quickstart.md)

## Complexity Tracking

| 项 | 为何需要 | 更简单的方案为何不够 |
|----|----------|----------------------|
| 后台 `asyncio.create_task` 投递 + 启动清扫 | 回调必须立即应答，客户接口可能慢；项目已有同类后台任务模式（AI 咨询恢复循环） | 回调内同步等待客户接口会让设备超时重试，放大流量与重复推送 |
| `dedupe_key` 唯一索引 | 并发回调/人工补发同时发生时，仅靠先查后写会产生重复投递 | 纯应用层判断在并发下不可靠；引入队列或锁服务超出本功能范围 |
| 可配置字段映射 | 海王推送契约尚未提供，联调时字段名可能变化 | 硬编码字段名会导致每次联调都改代码、回归测试失效 |
