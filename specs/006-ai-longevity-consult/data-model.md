# Data Model: AI 长寿咨询

本文件定义当前 `nepstar` 业务模型与迁移；实例是否应用迁移须单独核对，不能从源码推断。2026-10-12 本轮仅离线回归，未执行任何数据库迁移。外部报告源严格只读，所有迁移必须显式限定 `nepstar`。

## 来源边界

| 来源 | 用途 | 写入权限 |
| --- | --- | --- |
| `nepstar.sa_indicator`、`sa_plan` 及新 `sa_ai_consult_*` | 维护文案、方案条件、聊天、规则和运营数据 | 仅当前功能所需的 `nepstar` 表允许写 |
| `platform.inspect_base` / 旧报告关联表 | 报告归属、状态、时间、同客户历史编号 | 只读 |
| `kj_fastplus` | 现有辅助资料按需读取 | 只读 |
| MongoDB `receive_report` | 原始指标树、当前及历史分数 | 只读 |

## 1. `sa_ai_consult_guest`：匿名标签页与报告范围

报告链接不要求登录。创建匿名上下文时服务端先用只读源核对报告编号、客户编号是否对应且报告已就绪，然后生成至少 256 位随机 `guest_token`。只向当前标签页返回一次明文；前端存于 `sessionStorage`，不得拼进 URL、埋点或日志。服务端仅保存加盐/HMAC 摘要，后续请求以 `Authorization: Bearer` 提交并恒时比较摘要。这个秘密保护聊天，**不**证明访问者是报告本人。

表字段：`id`、`token_digest`（唯一）、`report_code`、`customer_id`、`created_at`、`last_activity_at`、`expires_at`、`revoked_at`。匿名访问凭证最长 30 天有效；到期或撤销时服务端拒绝，且不因活动续期。该期限仅限制访问，不能触发会话、问题或回答的删除。`guest_token` 与报告范围一对一；换报告建新的上下文。会话 ID 仅留在当前页面内存，不写进 URL 或浏览器存储；刷新、离开后再进入和独立新标签页均创建空白新会话，不能凭报告链接找回历史。

## 2. `sa_ai_consult_settings`

单行当前配置：`id`、`enabled`、`provider_code`、`model_code`、`maintenance_text`、`notice_version`、`notice_text`、`data_scope_text`、`data_scope_hash`、`guest_create_limit_per_minute`、`guest_create_window_start`、`guest_create_count`、`daily_success_limit`、`per_minute_limit`、`global_daily_token_limit`、`max_concurrent_generations`、`max_question_chars`、`retention_days`（旧字段，仅兼容现有 schema，不再用于正文清理）、`active_rule_version_id`、`updated_by`、`updated_at`、`row_version`。新设置默认 `enabled=true`，各额度默认为 0（不限制）；首次保存后才创建设置行。此默认不改写已有记录，显式部署禁用和运行时就绪检查仍优先，环境未就绪时服务不可用。用户确认的数据范围文案由后端附加“咨询问题和 AI 回答与报告关联永久保存在后台；重新进入不展示历史”的说明，并以附加后的文案计算同意摘要，从而使旧版本同意失效。`retention_days` 不参与有效期判定或清理。

开关变更对**新生成**立即生效；正在进行的生成由停用策略明确终止并记为 `cancelled_by_admin`。`row_version` 用于防止两个管理员相互覆盖。

## 3. `sa_ai_consult_rule_version`

`id`、`version`（唯一）、`status`（draft/published/retired）、`content`（规则正文）、`content_hash`、`created_by`、`created_at`、`published_by`、`published_at`。发布后内容不可原地修改；回退是把 settings 指针指向已发布版本，并产生审计事件。生成记录固定当时的版本 ID，不受未来改动影响。

## 4. `sa_ai_consult_consent`

`id`、`guest_id`、`notice_version`、`notice_content_hash`、`provider_code`、`data_scope_hash`、`choice`（granted/withdrawn）、`decided_at`、`withdrawn_at`。旧选择接口及已有记录保留；当前交互不要求存在 granted 记录，也不自动写入同意。按 `(decided_at DESC, id DESC)` 只认绑定凭证的最新选择，明确撤回阻断新会话/生成和回答发布，生成已产生的实际用量仍记录。该记录不证明报告本人身份或生产处理依据。索引 `(guest_id, decided_at)`。

## 5. `sa_ai_consult_session`

`id`（不含身份信息的随机 UUID）、`guest_id`、`report_code`、`customer_id`、`report_date`、`source`（home/plan/indicator）、`source_plan_id`（可空）、`source_indicator_code`（可空，迁移 007 添加）、`consent_id`（迁移 008 改为可空）、`title`、`status`、`created_at`、`last_activity_at`、`expires_at`、`deleted_at`、`generation_epoch`。新会话不自动关联或创建同意记录；008 保留已有记录与引用，仅修改可空性，已有 NULL 引用时拒绝降级，不以删记录解决降级。`expires_at` 只限制访问，不表示数据过期。所有新增 DDL 仅允许在 `nepstar` 执行；发布前检查实际实例是否完成 006→007→008。

每次进入 AI 咨询创建全新会话；旧会话保留在服务端，但任何访客端历史列表、会话详情和删除接口均不可用。仅当前页面内存中的会话 ID 可用于本次提问、重试和断线核对；轮次读取仅允许该 guest/report 最近创建的活动会话。

## 6. `sa_ai_consult_turn`

一次用户问题及其最终回答：`id`、`session_id`、`sequence`、`client_request_id`、`question_text`、`answer_text`（仅通过验证的完整回答）、`status`（accepted/generating/completed/failed/stopped/deleted）、`evidence_refs_json`、`rule_version_id`、`feedback_value`（helpful/unhelpful/null）、`feedback_reason`、`created_at`、`completed_at`。唯一约束 `(session_id, client_request_id)`，索引 `(session_id, sequence)`。

同一轮可重新生成，但不复制用户问题；反馈只允许对 completed 回答提交，且按轮次覆盖更新。报告数值、日期和导航引用存服务端签发的证据对象；模型输出的未知证据 ID 拒绝渲染。

## 7. `sa_ai_consult_generation`

每次实际模型尝试：`id`、`turn_id`、`attempt_number`、`generation_epoch`、`status`（queued/running/completed/failed/stopped/discarded）、`partial_text`（仅经分段校验且标记未完成）、`provider_request_id`、`model_code`、`budget_tokens`、`prompt_tokens`、`completion_tokens`、`error_category`、`started_at`、`first_valid_chunk_at`、`finished_at`。唯一约束 `(turn_id, attempt_number)`，并按 `started_at` 建索引。新生成在 `nepstar` 配置行锁下预留 token；服务商返回可信用量后按实际值结算，无可信用量的尝试按预留额占用当日预算。

生成结果提交需比较 session 的 `generation_epoch` 与当前 attempt；不匹配时丢弃，避免停止、删除、重试或切报告后的晚到结果。实际服务用量按 generation 汇总；匿名会话额度只按 completed turn 且 `(guest_id, 业务日)` 计数，重试成功不重复计。另设全局并发、总消耗和异常流量保护，因为新标签页可创建新 guest，不能按 guest_id 证明是同一真实用户。

## 8. `sa_ai_consult_admin_audit`

`id`、`actor_admin_id`、`action`（settings_update/rule_publish/rule_rollback/service_disable 等）、`target_id`、`change_summary_json`、`occurred_at`。不存用户问题、回答正文或明文密钥。运营汇总由 `turn`、`generation` 和审计记录查询，首版无需另外复制聊天到统计表。

## 状态转换

```text
guest: active → revoked | expired
session: active → deleted | expired
         expired（仅访问失效，数据继续保留）
turn: accepted → generating → completed | failed | stopped
                  failed | stopped → generating（同一问题的新 attempt）
                  any → deleted（仅历史兼容状态，不由用户端写入）
generation: queued → running → completed | failed | stopped | discarded
```

只有 `generation=completed` 且回答通过来源/健康内容校验，才可把 `turn` 置为 `completed`。服务调用已产生费用而访问者停止/失败时，只记实际用量，不占该匿名会话的成功问答额度。

## 数据保留和删除

- 咨询会话、用户问题、完整回答和必要的依据/反馈永久保存在 `nepstar`，不设置聊天内容 TTL，不自动清理或硬删除；运行入口在连库前明确失败，防止旧调度误触发。
- 报告端不提供最近咨询、历史读取、会话切换或用户删除功能。匿名凭证/访问会话过期只使访问拒绝，不删除或擦除后台记录。
- 备份遵循数据库整体备份制度；本功能不额外创建会话级清理或过期任务。
- 日志与指标：仅记录 request id、耗时、错误类别和用量，不记录问题正文、回答正文、姓名、电话及模型密钥。

## 数据库迁移门槛

迁移须对 `NEPSTAR_DATABASE_URL` 指向的 `nepstar` 库执行，文件内只出现 `sa_ai_consult_*` 目标。运行前检查 DSN 的 host/database、数据库账号权限及迁移 SQL；运行期间不访问任何其他库的 DDL/DML。开发测试使用隔离的本地 `nepstar` 测试库，生产迁移需按发布流程审阅。
