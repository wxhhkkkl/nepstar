# Implementation Plan: AI 长寿咨询

**Branch**: `006-ai-longevity-consult` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)
**Input**: 基于当前报告的真实文字咨询，包含报告端、既有 FastAPI 服务、管理后台；现有 [UI 原型](ui/README.md)作为交互参考。

## Summary

在 `reportFront/` 将图片入口接入 Vue 3 咨询路由；在 `nepstarAdmin/backend/` 的既有 FastAPI 进程增加授权、报告证据组装、受控模型调用、流式问答与私人会话；在 `nepstarAdmin/frontend/` 增加咨询配置和运行概览。咨询业务数据只写入 `nepstar`，报告源、`platform` 与 `kj_fastplus` 只读。初次上线前必须接通可核验的报告用户身份，不接受单独的 `reportId` 与 `userId` 作为私人聊天授权。

## Technical Context

**Language/Version**: Python 3.11+；报告端 Vue 3 + JavaScript；管理端沿用 Vue 3 + TypeScript。

**Primary Dependencies**: 既有 FastAPI、SQLAlchemy asyncio、Motor、Vue Router、Vitest、pytest；模型请求拟用受控 HTTP 客户端，具体新增依赖在实施前审批。

**Storage**: 新会话、同意、规则、配置、反馈和用量仅在 `nepstar` MySQL；外部 MySQL 与 MongoDB 仅 `SELECT/find`。

**Testing**: 后端 pytest、报告端 Vitest/Playwright、管理端 Vitest；模型和外部数据源均用替身，先确认失败再实现。

**Target Platform**: 当前移动浏览器报告页、现有 FastAPI 服务、现有管理后台。

**Project Type**: 三端 Web 功能，复用现有单体服务。

**Performance Goals**: 20 个并发试点用户；发送 1 秒内有可见反馈，正常网络 10 秒内首段、45 秒内完成，超过 60 秒可停止/重试；均为待验证目标。

**Constraints**: 报告前端无 TypeScript；320–430 px 无横向溢出；模型不拿数据库凭据；外部数据源零写入；未通过真实身份校验、隐私告知或服务商评估时不得向模型发送健康信息。
**Scale/Scope**: 一份报告对应多段私人会话；最多六次同指标历史；首版文字咨询、反馈、额度和两页管理界面，不做语音、图片、联网搜索或独立知识库。

## Constitution Check

*规划前检查；设计后按同一边界复核。*

- [x] 目标全部位于 `/Users/leelee/Desktop/体检报告/nepstar`。
- [x] 用户已将当前报告端迁至 `reportFront/`；本计划仅面向该目录，不编辑旧版或参考设计目录。
- [x] 报告端继续使用 Vue 3 + JavaScript；管理端沿用既有 TypeScript。
- [x] 本阶段仅设计，不实施新表、模型服务通信或框架变更；这些架构变更见“实施前批准项”。
- [x] 任务阶段将逐条安排红→绿测试，覆盖授权、来源、流式状态、删除、额度与移动端状态。
- [x] 所有新建、更新、删除与迁移仅允许在 `nepstar`；任何外部读会话不提交事务性写入。

**实施前批准项**：需确认可信报告访问凭证由哪个已登录入口签发及其交付方式；批准在现有 FastAPI 进程引入模型通信/流式响应与 `nepstar` 新表；确认模型服务商的数据处理条件、密钥托管和健康信息告知文本。凭证无法接通时，报告端只能显示“需从已验证入口进入”，不能启用个人问答。上述事项不阻碍本规划及本地替身测试。

## Project Structure

### Documentation

```text
specs/006-ai-longevity-consult/
├── spec.md
├── product-design.md
├── ui/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   ├── access-and-consult.md
│   └── admin.md
└── quickstart.md
```

### Source Code Targets

```text
reportFront/src/{router,views,components,api,composables}/
reportFront/tests/                 # 对应新增交互/状态测试
nepstarAdmin/backend/app/{api,services,schemas,models/new,security}/
nepstarAdmin/backend/alembic/versions/  # 迁移限定 nepstar schema
nepstarAdmin/backend/tests/{api,unit}/
nepstarAdmin/frontend/src/{router,api,views/health}/
nepstarAdmin/frontend/src/views/health/__tests__/
```

**Structure Decision**: 在现有三个应用中扩展；不新建独立 Agent 服务。报告读取复用 `report_source`/`report_view_service` 的只读能力，咨询写入走一个显式绑定 `NEPSTAR_DATABASE_URL` 且启动时验证库名为 `nepstar` 的独立会话。不能让绑定旧库 `DATABASE_URL` 的通用 `get_db` 承担咨询写入。

## Implementation Design

1. **身份与同意**：可信上游在完成用户身份校验后提供短时、单次可兑换的报告访问声明；后端校验签发者、签名、主体、报告和客户范围、到期及撤销，并再次核对只读报告归属。兑换后所有会话与证据请求携带短时授权；授权只在内存保存，不进入可分享 URL。首用记录告知版本、服务商和同意结果。
2. **报告证据**：服务端从当前报告按需抽取真实指标、检测日期、已维护的解释和已发布方案。历史按同客户同指标且 `inspect_date ≤ 当前报告检测时间` 读取最多六个有效点；无记录、日期冲突和资料缺失直接标出。仅把问题相关、去身份化的摘要交给模型。
3. **受控问答**：后端管理可调用的只读能力；模型参数和工具参数按白名单验证。使用结构化证据 ID，模型只能引用本次服务端检索的 ID；数值与日期从证据对象渲染，并在展示前校验回答内容。紧急症状和处方类请求走服务端优先规则，生成后的内容再做风险校验；不把未校验的部分答案直接作为已完成答复。
4. **流式与持久化**：`POST` 创建或复用同一个问答轮次，响应事件流包含接收、进度、内容、依据、完成或错误。请求幂等键与数据库唯一约束防重复提问；每次生成有独立代号。取消、删除、重试或切换报告使旧代号失效，迟到内容不能回写或拼接。只有成功完成的轮次扣用户日额度；实际模型用量按尝试记录。
5. **报告端**：复用已评审 UI 原型，增加咨询路由、骨架屏、同意弹层、欢迎/对话/历史/错误状态。使用现有报告参数定位数据，但请求授权与私人会话使用单独凭证。返回报告/指标依据保留各自滚动位置；软键盘与安全区做真机验收。
6. **管理端**：增加“AI 咨询配置”与“运行概览”两个入口。前者维护开关、服务显示信息、额度及版本化回答规则；凭据只由服务端环境/密钥服务注入，页面不读取明文。后者展示去身份化汇总及失败原因。新接口按新菜单路径和动作做精确权限校验，发布变更留下不含聊天正文的审计记录。
7. **留存与清理**：默认 30 天；删除时即时撤销可访问性并阻断生成，后台清理在线正文；备份到期策略上线前确认，私聊不进入通用请求日志。管理端不能按姓名批量浏览私人对话。

## Delivery Order & Verification

| 顺序 | 交付 | 完成证据 |
| --- | --- | --- |
| 1 | 可信入口凭证、只读报告证据及独立 `nepstar` 写会话 | 越权、过期、串报告和只读账号测试；非 `nepstar` 零写入 |
| 2 | 同意、会话/轮次、幂等、删除与额度 | 重复请求只存一条问题；删除后不可恢复；失败不扣用户额度 |
| 3 | 模型适配、来源验证、安全与逐步输出 | 数值/日期与实际报告一致；停止及晚到流不复活；代表性健康场景审查 |
| 4 | 报告端真实页面与方案入口 | 320–430 px、软键盘、返回位置、断网重试、79/80/81 分边界 |
| 5 | 管理配置与运行概览 | 权限、版本发布、服务关闭、匿名汇总与敏感数据隔离 |
| 6 | 试点验证与上线门槛 | 对照 spec 的 SC-001 至 SC-010；服务商评估、凭证签发和备份留存已确认 |

## Post-Design Constitution Re-check

- [x] 设计仍限三个既有应用和本 feature 的文档。
- [x] 未以 `reportId`/`userId` 代替授权，未让模型直接访问数据库。
- [x] 数据模型、接口和迁移对象均限定 `nepstar` 写入。
- [x] 新表、通信、依赖和可信入口对接仍作为实施前明确批准项；本计划没有执行它们。

## Complexity Tracking

| 变更 | 必要原因 | 不采用的简化方案 |
| --- | --- | --- |
| 独立 `nepstar` 写会话 | 当前 `get_db` 绑定 `DATABASE_URL`，可能指向旧库；用户禁止向其他库写入 | 用通用会话写聊天无法证明落库范围 |
| 可信访问声明 | 报告号与客户号可从链接复制，不能证明私人会话归属 | 裸链接/签个本地 token 仍无法验证首次访问者身份 |
| 会话与生成轮次分离 | 需支持重试、停止、晚到流、真实模型用量 | 单条消息状态难以区分多次生成尝试 |
| 规则版本与发布审计 | 管理端需追溯回答使用的规则，防事后改写 | 仅覆盖当前 prompt 无法解释旧答案 |
