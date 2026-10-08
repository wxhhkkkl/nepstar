# Research: AI 长寿咨询实施决策

## R1. 真实访问授权

**Decision**：个人问答与历史读取必须由已验证的用户入口提供短时、限定报告范围的签名声明或同等可信凭证。API 校验签名/受众/有效期/撤销并再次只读核对报告归属；缺少凭证时拒绝访问私人内容和外部模型调用。

**Rationale**：现有 `report_view.py` 只验证 `report_code + customer_id` 与原始记录是否匹配，当前报告路由没有报告用户登录。任何获得分享 URL 的人都可复制这两个定位值；后台管理员 JWT 也不是报告用户身份。

**Alternatives considered**：仅凭 URL、将 URL 哈希成 token、复用管理端 JWT，均无法证明报告查看者是授权主体。上游签发机制的具体接口是实施前集成项，不在本地假造用户身份；无集成时保持关闭。

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

**Decision**：每轮问题有客户端幂等键及数据库唯一约束；每次模型生成有单独 generation id 和状态。完成轮次按用户所在业务日计额度；失败尝试的模型用量仍记录。删除先封禁会话访问及生成，再异步清理正文；默认最近活动后保留 30 天。

**Rationale**：断网重试与晚到流必须可靠区分，否则会重复记账或恢复已删除内容。用户故事要求停止、重试、刷新和私人历史不串线。

**Alternatives considered**：仅前端去重无法覆盖刷新和并发请求；只在数据库删行后取消模型请求存在晚到写回窗口。

## R7. 待确认的上线集成项

以下事项不影响本地设计与假数据/替身开发，但没有答案时不能开放真实个人咨询：可信上游如何签发用户范围凭证；获准使用的 AI 服务商及其健康数据处理条件；生产密钥来源、聊天存储加密和备份到期策略。实施前按 [plan.md](plan.md) 的架构批准项确认，任何一项缺失都使服务保持关闭。
