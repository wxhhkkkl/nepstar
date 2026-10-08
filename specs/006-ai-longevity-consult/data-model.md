# Data Model: AI 长寿咨询

本文件定义拟实施的 `nepstar` 业务表。所有外部报告数据仍实时只读取得；本阶段没有创建表或执行迁移。迁移文件必须显式限定 `nepstar`，并以只读账号验证外部源不可写。

## 来源边界

| 来源 | 用途 | 写入权限 |
| --- | --- | --- |
| `nepstar.sa_indicator`、`sa_plan` 及新 `sa_ai_consult_*` | 维护文案、方案条件、聊天、规则和运营数据 | 仅当前功能所需的 `nepstar` 表允许写 |
| `platform.inspect_base` / 旧报告关联表 | 报告归属、状态、时间、同客户历史编号 | 只读 |
| `kj_fastplus` | 现有辅助资料按需读取 | 只读 |
| MongoDB `receive_report` | 原始指标树、当前及历史分数 | 只读 |

## 1. 访问主体与报告范围

访问主体是可信上游签名声明中的稳定主体标识 `(issuer, subject)`，与链接中的 `userId/customerId` 分离。服务端验证声明后生成短时咨询授权，范围固定为 `(subject, report_code, customer_id)`；授权本身不由数据库里的报告号推导。首次兑换再次用只读源核对报告归属和就绪状态。授权过期/撤销/主体不一致时，对会话、历史、证据及生成接口统一拒绝。

不必在 `nepstar` 保存原始签名声明或用户真实姓名；数据库保存主体不可逆摘要（含应用侧稳定盐）、签发者标识和报告范围。临时授权及一次性声明的重放保护由服务端短期状态承担；若采用数据库记录，仍只在 `nepstar`。

## 2. `sa_ai_consult_settings`

单行当前配置：`id`、`enabled`、`provider_code`、`model_code`、`maintenance_text`、`daily_success_limit`（建议默认 20）、`per_minute_limit`（默认 5）、`max_question_chars`（默认 2000）、`retention_days`（默认 30）、`active_rule_version_id`、`updated_by`、`updated_at`、`row_version`。范围校验：额度与字符限制必须为正，留存期符合已公布告知，模型必须在服务端允许名单内。凭据不入表。

开关变更对**新生成**立即生效；正在进行的生成由停用策略明确终止并记为 `cancelled_by_admin`。`row_version` 用于防止两个管理员相互覆盖。

## 3. `sa_ai_consult_rule_version`

`id`、`version`（唯一）、`status`（draft/published/retired）、`content`（规则正文）、`content_hash`、`created_by`、`created_at`、`published_by`、`published_at`。发布后内容不可原地修改；回退是把 settings 指针指向已发布版本，并产生审计事件。生成记录固定当时的版本 ID，不受未来改动影响。

## 4. `sa_ai_consult_consent`

`id`、`issuer`、`subject_hash`、`notice_version`、`provider_code`、`data_scope_hash`、`choice`（granted/withdrawn）、`decided_at`、`withdrawn_at`。只有与当前服务商、告知版本和处理范围一致的有效同意才可外发数据；改变任一项要求重新同意。撤回立即阻断新模型请求。索引 `(issuer, subject_hash, decided_at)`。

## 5. `sa_ai_consult_session`

`id`（不含身份信息的随机 UUID）、`issuer`、`subject_hash`、`report_code`、`customer_id`、`report_date`、`source`（home/plan）、`source_plan_id`（可空）、`consent_id`、`title`、`status`（active/deleted/expired）、`created_at`、`last_activity_at`、`expires_at`、`deleted_at`、`generation_epoch`。索引 `(issuer, subject_hash, report_code, last_activity_at)` 以及 `expires_at`；绝不能仅凭 `report_code` 查询私人列表。

报告切换新建/读取另一份报告的会话；不迁移旧会话消息。删除先将 `status=deleted`、递增 `generation_epoch`，所有后续读取和写回立即失败，清理任务再清除正文。

## 6. `sa_ai_consult_turn`

一次用户问题及其最终回答：`id`、`session_id`、`sequence`、`client_request_id`、`question_text`、`answer_text`（仅通过验证的完整回答）、`status`（accepted/generating/completed/failed/stopped/deleted）、`evidence_refs_json`、`rule_version_id`、`feedback_value`（helpful/unhelpful/null）、`feedback_reason`、`created_at`、`completed_at`。唯一约束 `(session_id, client_request_id)`，索引 `(session_id, sequence)`。

同一轮可重新生成，但不复制用户问题；反馈只允许对 completed 回答提交，且按轮次覆盖更新。报告数值、日期和导航引用存服务端签发的证据对象；模型输出的未知证据 ID 拒绝渲染。

## 7. `sa_ai_consult_generation`

每次实际模型尝试：`id`、`turn_id`、`attempt_number`、`generation_epoch`、`status`（queued/running/completed/failed/stopped/discarded）、`partial_text`（仅经分段校验且标记未完成）、`provider_request_id`、`model_code`、`prompt_tokens`、`completion_tokens`、`error_category`、`started_at`、`first_valid_chunk_at`、`finished_at`。唯一约束 `(turn_id, attempt_number)`。

生成结果提交需比较 session 的 `generation_epoch` 与当前 attempt；不匹配时丢弃，避免停止、删除、重试或切报告后的晚到结果。实际服务用量按 generation 汇总；用户额度只按 completed turn 且 `(issuer, subject_hash, 业务日)` 计数，重试成功不重复计。

## 8. `sa_ai_consult_admin_audit`

`id`、`actor_admin_id`、`action`（settings_update/rule_publish/rule_rollback/service_disable 等）、`target_id`、`change_summary_json`、`occurred_at`。不存用户问题、回答正文或明文密钥。运营汇总由 `turn`、`generation` 和审计记录查询，首版无需另外复制聊天到统计表。

## 状态转换

```text
session: active → deleted | expired
turn: accepted → generating → completed | failed | stopped
                  failed | stopped → generating（同一问题的新 attempt）
                  any → deleted（会话删除）
generation: queued → running → completed | failed | stopped | discarded
```

只有 `generation=completed` 且回答通过来源/健康内容校验，才可把 `turn` 置为 `completed`。服务调用已产生费用而用户停止/失败时，只记实际用量，不占用户成功问答额度。

## 数据保留和删除

- 用户删除：立即设置 deleted、撤销生成和读取；在线正文在 24 小时内清除，操作审计仅留必要非正文信息。
- 正常到期：最近活动起默认 30 天，过期按同样逻辑处理；告知变更与实际配置同步。
- 备份：最长 30 天到期，并在生产上线前验证恢复和到期清理流程。
- 日志与指标：仅记录 request id、耗时、错误类别和用量，不记录问题正文、回答正文、姓名、电话及模型密钥。

## 数据库迁移门槛

迁移须对 `NEPSTAR_DATABASE_URL` 指向的 `nepstar` 库执行，文件内只出现 `sa_ai_consult_*` 目标。运行前检查 DSN 的 host/database、数据库账号权限及迁移 SQL；运行期间不访问任何其他库的 DDL/DML。开发测试使用隔离的本地 `nepstar` 测试库，生产迁移需按发布流程审阅。
