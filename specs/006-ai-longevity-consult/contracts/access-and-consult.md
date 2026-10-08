# Contract: 报告端咨询 API

基础路径：`/api/v1/ai-consult`。JSON 成功使用 `{ "code": 200, "message": "ok", "data": ... }`；失败使用实际 HTTP 4xx/5xx 与 `{ "code": 状态码, "message": 稳定错误码, "data": null }`。流式端点使用 `text/event-stream`，在事件流已开始后以 `error` 事件表示故障。所有私人端点须验证 `Authorization: Bearer <短时咨询授权>`；后台管理员 JWT 不可代替报告用户授权。

## 可信入口

`POST /access/exchange`：输入 `{ "launch_assertion": "<trusted signed assertion>" }`。声明必须由已验证用户的上游签发，包含 issuer、subject、audience、单次 nonce、report_code、customer_id、iat、exp（建议不超过 60 秒）；后端核验签名、重放、撤销和报告归属。输出 `{ access_token, expires_at, report_code, customer_id }`，短时 token 仅存当前页面内存。当前只有裸报告链接时返回 `401 consult.verified_entry_required`，不能自动换发。

上游声明的提供方式属于待确认集成项；不得把长期 token 放入 `reportId`/`userId` 查询参数。前端仅接收已验证入口传来的声明；刷新或跨设备恢复需再次走已验证入口。

## 启动与同意

`GET /bootstrap?report_code=...`：返回报告日期、简短摘要、三个真实可问的问题、服务状态、当前告知版本、是否已同意以及剩余额度。只返回与 token 报告范围相同的数据；服务未就绪返回明确状态，不显示示例报告。

`POST /consents`：输入 `{ "notice_version": "...", "provider_code": "...", "accepted": true }`；仅在显示当前告知后接受。`accepted=false` 记录拒绝/撤回并不外发；服务商或处理范围变化后要求新的同意。

## 会话

| 方法与路径 | 输入 | 输出/行为 |
| --- | --- | --- |
| `POST /sessions` | `{report_code, source: "home"\|"plan", plan_id?}` | 创建绑定当前授权主体和报告的会话；方案 ID 在服务端重新验证发布与 `< 阈值` |
| `GET /sessions?report_code=...` | 分页游标 | 仅本人、仅该报告的标题和时间，不含其他报告聊天 |
| `GET /sessions/{session_id}` | — | 本人且授权报告范围内的轮次、答案、依据和未完成状态 |
| `DELETE /sessions/{session_id}` | — | 立即撤销访问和后续生成；返回 204；重复删除仍为 204 |

## 发送、重试和停止

`POST /sessions/{session_id}/turns`：JSON `{ "question": "..." }`，请求头 `Idempotency-Key: <UUID>`；成功为 SSE。服务器先持久化/复用唯一用户问题，再启动模型尝试。空白问题、超过当前字符上限、服务关闭、频率/日额度不足、未同意或授权不符返回明确错误；重复 key 不创建第二条问题。

`POST /sessions/{session_id}/turns/{turn_id}/retry`：对 failed/stopped 的同一问题发起新 generation；不增加用户问题条数。`POST /sessions/{session_id}/turns/{turn_id}/stop`：停止有效尝试并标记已校验的部分为“未完成”。`GET /sessions/{session_id}/turns/{turn_id}`：刷新后查询当前状态及已持久化结果。

SSE 事件每条包含 `session_id`、`turn_id`、`generation_id`、单调递增 `seq`：

```text
event: accepted   data: {"turn_id":"...","generation_id":"..."}
event: status     data: {"phase":"reading_evidence"|"answering"}
event: delta      data: {"text":"经验证的文字片段"}
event: evidence   data: {"items":[{"id":"ev1","kind":"report","label":"...","report_date":"YYYY-MM-DD","route":"#/system/..."}]}
event: completed  data: {"answer":"完整回答","remaining_today":19}
event: error      data: {"code":"consult.provider_unavailable","retryable":true}
```

只有证据与健康内容验证通过的片段才能发送为 `delta`；未验证的原始模型片段不直接外显。页面丢弃不属于当前 generation 的事件；服务端同样以 epoch 防止晚到写入。`completed` 才表示可反馈、计用户成功额度；断流只显示未完成状态。

`PUT /sessions/{session_id}/turns/{turn_id}/feedback`：`{ "helpful": true|false, "reason": "inaccurate"|"unclear"|"unresolved"|null }`。仅 completed 回答可评价，覆盖本轮之前评价，不暴露给其他报告查看者。

## 证据与错误

证据项必须由服务端按当前报告读取生成，包含类型（报告事实/后台维护资料/用户补充）、真实检测日期、指标编码和当前报告路由。跳转前仍按当前授权范围校验；用户自述不可冒充检测依据。咨询历史查询不得仅凭 `report_code` 或 `customer_id`。

稳定错误码至少包括：`consult.verified_entry_required`、`consult.access_expired`、`consult.consent_required`、`consult.report_unavailable`、`consult.session_not_found`、`consult.disabled`、`consult.rate_limited`、`consult.quota_exhausted`、`consult.provider_unavailable`、`consult.timeout`、`consult.unsafe_answer`。403/404 避免透露不属于本人的会话是否存在；429 提供 `retry_after_seconds`。
