# Implementation Plan: AI 长寿咨询

**Branch**: `006-ai-longevity-consult` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)
**Input**: 基于当前报告的真实文字咨询，包含报告端、既有 FastAPI 服务、管理后台；现有 [UI 原型](ui/README.md)作为交互参考。

**2026-10-12 实施基线（覆盖以下早期同意弹层设计）**：真实页面已实现，可用时直接展示输入框；bootstrap 不返回告知/同意状态，新会话 `consent_id` 通过 008 改为可空。不自动记录同意，兼容接口最新明确撤回仍阻断新生成与发布。后台运行概览已增加日/月 token 双图和独立授权的完整问答详情。生产告知/授权与其他真实环境验收见 [发布收尾清单](release-readiness.md)，未取得证据不标完成。

## Summary

在 `reportFront/` 将图片入口接入 Vue 3 咨询路由；在 `nepstarAdmin/backend/` 的既有 FastAPI 进程增加匿名聊天凭证、报告证据组装、受控模型调用、流式问答与会话隔离；在 `nepstarAdmin/frontend/` 增加咨询配置和运行概览。用户确认报告链接公开，任何访问者均可在同意后匿名咨询；`reportId/userId` 定位报告，服务端随机凭证仅保护各标签页的聊天。咨询业务数据只写入 `nepstar`，报告源、`platform` 与 `kj_fastplus` 只读。

## Technical Context

**Language/Version**: Python 3.11+；报告端 Vue 3 + JavaScript；管理端沿用 Vue 3 + TypeScript。

**Primary Dependencies**: 既有 FastAPI、SQLAlchemy asyncio、Motor、Vue Router、Vitest、pytest；模型请求拟用受控 HTTP 客户端，具体新增依赖在实施前审批。

**Storage**: 新会话、同意、规则、配置、反馈和用量仅在 `nepstar` MySQL；外部 MySQL 与 MongoDB 仅 `SELECT/find`。

**Testing**: 后端 pytest、报告端 Vitest/Playwright、管理端 Vitest；模型和外部数据源均用替身，先确认失败再实现。

**Target Platform**: 当前移动浏览器报告页、现有 FastAPI 服务、现有管理后台。

**Project Type**: 三端 Web 功能，复用现有单体服务。

**Performance Goals**: 20 个并发试点用户；发送 1 秒内有可见反馈，正常网络 10 秒内首段、45 秒内完成，超过 60 秒可停止/重试；均为待验证目标。

**Constraints**: 报告前端无 TypeScript；320–430 px 无横向溢出；模型不拿数据库凭据；外部数据源零写入；访问者未同意或服务商评估未完成时不得向模型发送健康信息；匿名额度另配总成本与并发保护。

**Scale/Scope**: 一份公开报告可对应多个互不相通的匿名标签页会话；最多六次同指标历史；首版文字咨询、反馈、额度和两页管理界面，不做语音、图片、联网搜索或独立知识库。

## Constitution Check

*规划前检查；设计后按同一边界复核。*

- [x] 目标全部位于 `/Users/leelee/Desktop/体检报告/nepstar`。
- [x] 用户已将当前报告端迁至 `reportFront/`；本计划仅面向该目录，不编辑旧版或参考设计目录。
- [x] 报告端继续使用 Vue 3 + JavaScript；管理端沿用既有 TypeScript。
- [x] 设计阶段未实施新表或模型通信；架构批准已于 2026-10-08 取得，真实模型启用仍受数据处理条件约束。
- [x] 任务阶段将逐条安排红→绿测试，覆盖授权、来源、流式状态、永久留存、额度与移动端状态。
- [x] 所有新建、更新、删除与迁移仅允许在 `nepstar`；任何外部读会话不提交事务性写入。

**实施门槛（2026-10-09 最新规则覆盖旧设计）**：公开链接不需要登录；每次进入/刷新开始全新空白咨询，用户不能查看此前咨询。聊天随机凭证仅保护绑定报告/客户号的本次会话，不是独立 guest 账号；完整问题与回答在 `nepstar` 永久保存、不自动清理，30 天仅限制凭证有效期。2026-10-08 用户批准在现有 FastAPI 中增加流式 AI 接口，并仅在 `nepstar` 新增聊天相关表；真实模型调用先关闭。真实健康信息外发前仍需确认模型服务商的数据处理条件、密钥托管和告知文本。服务商条件未落实时仅可用本地假数据开发。直接运行 FastAPI 的部署门槛与回退见 [deployment.md](deployment.md)。

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

1. **公开报告与报告绑定会话**：后端核对报告号、客户号对应关系和就绪状态，允许公开报告的访问者在同意后新建咨询。创建至少 256 位随机秘密，仅保存摘要于 `nepstar`，标签页 `sessionStorage` 保留凭证明文；会话 ID 只在本页面内存。读取当前轮次、提问和反馈都验证凭证与报告绑定关系；每次进入/刷新均重新开始空白咨询，旧列表/详情/用户删除接口关闭。新标签页/设备不能读取原聊天；记录当前告知版本与同意结果。
2. **报告证据**：服务端从当前报告按需抽取真实指标、检测日期、已维护的解释和已发布方案。历史按同客户同指标且 `inspect_date ≤ 当前报告检测时间` 读取最多六个有效点；无记录、日期冲突和资料缺失直接标出。仅把问题相关、去身份化的摘要交给模型。
3. **受控问答**：后端管理可调用的只读能力；模型参数和工具参数按白名单验证。使用结构化证据 ID，模型只能引用本次服务端检索的 ID；数值与日期从证据对象渲染，并在展示前校验回答内容。紧急症状和处方类请求走服务端优先规则，生成后的内容再做风险校验；不把未校验的部分答案直接作为已完成答复。
4. **流式与持久化**：`POST` 创建或复用同一个问答轮次，响应事件流包含接收、进度、内容、依据、完成或错误。请求幂等键与数据库唯一约束防重复提问；每次生成有独立代号。取消、重试、重新进入或切换报告后，旧代号不能在新会话/尝试中回写或拼接；记录仍永久保存。只有成功完成的轮次扣会话日额度；实际模型用量按尝试记录，另设总体成本与并发上限。
5. **报告端**：咨询路由、骨架屏及欢迎/对话/错误状态已实现，无强制同意弹层或历史会话界面。随机凭证只存 `sessionStorage`，会话 ID 只留页面内存；每次进入/刷新空白咨询。当前轮次可断线核对，返回报告/依据保留阅读位置；真机性能按用户要求留到上线前。
6. **管理端**：增加“AI 咨询配置”与“运行概览”两个入口。前者维护开关、服务显示信息、额度及版本化回答规则；凭据只由服务端环境/密钥服务注入，页面不读取明文。后者展示去身份化汇总及失败原因。新接口按新菜单路径和动作做精确权限校验，发布变更留下不含聊天正文的审计记录。
7. **永久留存与运行恢复**：问题、回答和必要关联信息永久保存在 `nepstar`，不自动清理、不提供用户删除；旧清理入口在获取连接前拒绝。凭证 30 天到期不影响数据留存。仅恢复运行超时的 generation 状态，不删除已完成记录；备份/恢复和最小权限在部署前验收，正文不得进入通用日志。

## Delivery Order & Verification

| 顺序 | 交付 | 完成证据 |
| --- | --- | --- |
| 1 | 公开报告定位、匿名聊天凭证、只读报告证据及独立 `nepstar` 写会话 | 新标签页拿同一链接看不到旧聊天；无/伪造凭证不能读聊天；非 `nepstar` 零写入 |
| 2 | 同意、会话/轮次、幂等、永久保存与额度 | 重复请求只存一条问题；每次进入空白且不能查旧咨询；失败不扣成功额度；到期/回退不删除记录 |
| 3 | 模型适配、来源验证、安全与逐步输出 | 数值/日期与实际报告一致；停止及晚到流不复活；代表性健康场景审查 |
| 4 | 报告端真实页面与方案入口 | 320–430 px、软键盘、返回位置、断网重试、79/80/81 分边界 |
| 5 | 管理配置与运行概览 | 权限、版本发布、服务关闭、匿名汇总与敏感数据隔离 |
| 6 | 试点验证与上线门槛 | 对照 spec 的 SC-001 至 SC-010；服务商评估、匿名聊天隔离和备份留存已确认 |

## Post-Design Constitution Re-check

- [x] 设计仍限三个既有应用和本 feature 的文档。
- [x] 公开报告可凭 `reportId`/`userId` 定位；聊天必须另持随机秘密，模型不直接访问数据库。
- [x] 数据模型、接口和迁移对象均限定 `nepstar` 写入。
- [x] 新表与流式通信已获明确批准；模型服务商和真实健康数据外发仍为独立上线门槛。

## Complexity Tracking

| 变更 | 必要原因 | 不采用的简化方案 |
| --- | --- | --- |
| 独立 `nepstar` 写会话 | 当前 `get_db` 绑定 `DATABASE_URL`，可能指向旧库；用户禁止向其他库写入 | 用通用会话写聊天无法证明落库范围 |
| 独立匿名聊天凭证 | 报告号与客户号可从公开链接复制，只能定位报告，不能保护聊天 | 仅用报告参数查聊天会泄露其他访问者的对话 |
| 会话与生成轮次分离 | 需支持重试、停止、晚到流、真实模型用量 | 单条消息状态难以区分多次生成尝试 |
| 规则版本与发布审计 | 管理端需追溯回答使用的规则，防事后改写 | 仅覆盖当前 prompt 无法解释旧答案 |
