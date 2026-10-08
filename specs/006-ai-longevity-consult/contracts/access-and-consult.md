# Contract: 报告端咨询 API

基础路径：`/api/v1/ai-consult`。JSON 成功使用 `{ "code": 200, "message": "ok", "data": ... }`；失败使用实际 HTTP 4xx/5xx 与 `{ "code": 状态码, "message": 稳定错误码, "data": null }`。流式端点使用 `text/event-stream`，在事件流已开始后以 `error` 事件表示故障。公开报告仍可仅凭有效 `reportId/userId` 查看；所有聊天端点另须验证 `Authorization: Bearer <guest_token>`。这个随机秘密只授权访问该匿名访客创建的聊天，不证明访客是报告本人；后台管理员 JWT 也不能替代它。

## 匿名聊天建立

`POST /guest-contexts`：输入 `{ "report_code": "...", "customer_id": 123 }`。后端先按现有公开报告规则核对二者对应、报告已就绪，再生成至少 256 位随机 `guest_token` 并仅保存其 HMAC 摘要。输出 `{ guest_token, expires_at, report_code, customer_id }`；凭证签发后 30 天到期，不滑动续期，只返回本次，前端在当前标签页 `sessionStorage` 保存，不放入 URL 或持久化存储。报告端内部跳转复制公开链接参数时须过滤 `guest_token`，且不得从 URL 读取此凭证。无有效报告返回 404/409；频繁创建受服务端总量和速率限制。

同一标签页刷新时可继续携带已保存的凭证；另以公开链接独立打开的新标签页或其他设备创建新的匿名上下文。应用主动打开新标签页时使用 `noopener`，防止 `sessionStorage` 被 `opener` 复制；浏览器的“恢复标签页”行为可能保留该标签页会话，不能把关闭页面等同于立即删除服务端记录。若凭证已丢失/过期，允许继续查看公开报告，并可创建新的聊天，但不能凭报告链接取回旧聊天。

## 启动与同意

`GET /bootstrap?report_code=...`：携带 `Authorization: Bearer <guest_token>`，从凭证绑定的报告读取日期、总分和可见系统，返回简短事实摘要、三个依据真实报告生成的可问问题、服务状态、当前告知版本/正文/服务商/处理范围、该 guest 最新的同意状态及剩余额度。只返回必要字段，不复制报告编号、姓名、设备信息或完整指标树。候选阶段真实模型与额度统计未实现，分别返回 `service_status: "unavailable"` 和 `remaining_today: null`，不伪装为可咨询或虚构额度；服务未就绪时不显示示例报告。

`POST /consents`：输入 `{ "report_code": "...", "notice_version": "...", "provider_code": "...", "accepted": true }`，并在 `Authorization` 头携带 guest 凭证；仅在显示当前告知后接受。服务端校验该凭证绑定的报告、当前服务商、告知版本、告知正文摘要与处理范围摘要。记录的是持有此 guest 凭证的访问者的选择，不声称是报告本人同意。`accepted=false` 记录拒绝/撤回并不外发；服务商、告知正文或处理范围变化后要求新的同意。

## 会话

| 方法与路径 | 输入 | 输出/行为 |
| --- | --- | --- |
| `POST /sessions` | `{report_code, source: "home"\|"plan", plan_id?}` | 创建绑定 guest 凭证和公开报告的会话；方案 ID 在服务端重新验证发布与 `< 阈值` |
| `GET /sessions?report_code=...` | 分页游标 | 仅该 guest、仅绑定报告的标题和时间，不含其他访问者聊天 |
| `GET /sessions/{session_id}` | — | 持有效 guest 凭证且报告范围匹配时读取轮次、答案、依据和未完成状态 |
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

证据项必须由服务端按当前报告读取生成，包含类型（报告事实/后台维护资料/用户补充）、真实检测日期、指标编码和当前报告路由。聊天中的证据读取仍按 guest 与绑定报告校验；打开公开指标页本身沿用报告公开访问规则。用户自述不可冒充检测依据。聊天历史查询不得仅凭 `report_code` 或 `customer_id`。

稳定错误码至少包括：`consult.guest_token_required`、`consult.guest_token_expired`、`consult.consent_required`、`consult.notice_changed`、`consult.report_unavailable`、`consult.session_not_found`、`consult.disabled`、`consult.rate_limited`、`consult.quota_exhausted`、`consult.capacity_reached`、`consult.provider_unavailable`、`consult.timeout`、`consult.unsafe_answer`。403/404 避免透露其他 guest 的会话是否存在；429 的 `data.retry_after_seconds` 与 `Retry-After` 响应头提供重试等待时间。匿名会话额度不足不等于识别了真实用户。
