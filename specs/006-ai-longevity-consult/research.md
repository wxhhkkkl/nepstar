# Research: AI 长寿咨询实施决策

## R1. 公开报告与匿名聊天隔离

**Decision**：用户确认任何人均可通过报告链接查看报告，并可在明确同意后匿名咨询。报告号和客户号仅用于核对公开报告是否有效。创建聊天时服务端生成独立、不可猜测的至少 256 位随机秘密，摘要存 `nepstar`，明文仅在当前标签页 `sessionStorage` 保存。每次历史读取、提问、反馈和删除都验证凭证摘要及绑定报告；新标签页仅凭同一链接可以创建自己的聊天，但无法读取旧聊天。

**Rationale**：现有 `report_view.py` 只验证 `report_code + customer_id` 与原始记录是否匹配，没有报告用户登录；这是用户明确选择的公开报告方式。任何人都可复制这两个定位值，因此它们不能用来区分不同访问者的聊天。匿名凭证只证明持有这段聊天的秘密，不证明是报告本人。`sessionStorage` 按标签页隔离并可在刷新后保留；新页若保留 `opener` 可能复制初始存储，浏览器恢复标签页也可能保留会话，因此实现时要避免带 `opener` 的新页复制凭证，并在产品文案中写“关闭后不提供找回”，不承诺关闭瞬间服务端数据已删除。[MDN：sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)

**Alternatives considered**：只凭公开 URL 查聊天会串人；将 URL 哈希成 token 仍让所有访问者共享同一秘密；复用管理端 JWT 要求报告访客登录，违背用户确认的业务流程。跨标签页或跨设备同步历史需要可核验身份，首版不提供。

## R2. 数据库写入位置

**Decision**：所有咨询新表、迁移和写事务只在 `nepstar`；新增专用 async engine/session，启动时解析并验证 `NEPSTAR_DATABASE_URL` 的数据库名和连接目标。用于读取 `platform`、`kj_fastplus` 与 MongoDB 的连接不在咨询代码路径执行 DML/DDL。

**Rationale**：现有 `database.py` 的通用 `get_db` 连接 `DATABASE_URL`，而 `NEPSTAR_DATABASE_URL` 当前主要提供表 schema；跨 schema ORM 访问不等于写连接受限。专用会话可在代码和权限层证明边界。

**Alternatives considered**：继续复用通用会话但手写 schema 前缀，仍可能把事务写到错误库；把会话存 MongoDB 与红线直接冲突。

## R3. 报告与历史证据

**Decision**：复用现有报告源读取，咨询专用历史查询增加“当前报告日期及以前”上界；只取同客户同 target_id 的有效记录，最多六次。报告证据带来源类型、报告号、检测日期、指标编码与可导航的路由。

**Rationale**：当前 `fetch_recent_indicator_trend` 明确会纳入当前报告之后的记录，适合最新趋势展示，却不符合旧报告咨询的时间语境。不能直接复用它的结果。

**Alternatives considered**：以当前趋势直接提问会发生“未来数据泄漏”；全部历史送模型浪费上下文并增加误引风险。

## R4. 模型与传输

**Decision**：首版在现有 FastAPI 进程内封装模型适配器，后端以 allowlist 控制取数能力；报告端以 `fetch` 消费逐步输出。候选服务商 DeepSeek 的 Chat Completions API 支持 SSE 流与 function tool calls；模型名、域名和凭据由服务端受保护配置提供，不写进前端。具体服务商启用以数据处理评估为前提。

**Rationale**：已有 Python 服务可做鉴权、取数、模型调用和 SSE，不需要新建常驻 Agent 服务。服务端代模型执行工具请求，并校验参数及来源。官方文档：[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)、[Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)。

**Alternatives considered**：浏览器直连模型会暴露密钥和健康数据控制边界；单独新服务增加部署及鉴权复杂度；自由联网搜索不在首版需求内。

## R5. 管理权限与密钥

**Decision**：新增咨询菜单权限的显式路径/动作校验；配置发布与规则发布分别授权。模型密钥由服务端环境或密钥服务保管，后台只展示“已配置/未配置”和非敏感模型信息。发布事件只记操作人、时间、版本、变更摘要。

**Rationale**：现有 `check_permission` 实现只查用户是否拥有任一菜单的对应动作，没有把当前路由映射到具体菜单；直接复用不能保证 AI 配置发布权限。秘钥放在前端或可回显表单会扩大泄漏面。

**Alternatives considered**：把整个管理端都交给“已登录即可”会过宽；在 `sa_ai_consult_settings` 存可读明文密钥不合适。

## R6. 幂等、停用与留存

**Decision**：每轮问题有客户端幂等键及数据库唯一约束；每次模型生成有单独 generation id 和状态。完成轮次按匿名会话所在业务日计额度，并设全局成本与并发上限；失败尝试的模型用量仍记录。删除先封禁会话访问及生成，再异步清理正文；服务端默认最近活动后最多保留 30 天，关闭标签页后失去凭证也无法再取回。

**Rationale**：断网重试与晚到流必须可靠区分，否则会重复记账或恢复已删除内容。用户故事要求停止、重试、刷新和私人历史不串线。

**Alternatives considered**：仅前端去重无法覆盖刷新和并发请求；只在数据库删行后取消模型请求存在晚到写回窗口。

## R7. 待确认的上线集成项

用户已确定公开链接匿名咨询及“当前标签页刷新可恢复，关闭后不提供找回”的产品选择。2026-10-08 用户明确批准：沿用现有 FastAPI 增加流式 AI 接口，只在 `nepstar` 新增匿名聊天相关表，并按阶段实施；真实模型调用先保持关闭。该批准仅覆盖架构，不等于允许向候选模型发送真实报告。真实模型上线前仍需确认获准服务商及健康数据处理条件、生产密钥来源、聊天存储加密和备份到期策略。未完成这些条件时仅用本地替身开发，真实服务保持关闭。
