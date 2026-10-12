# Contract: 报告端咨询 API

基础路径：`/api/v1/ai-consult`。JSON 成功使用 `{ "code": 200, "message": "ok", "data": ... }`；失败使用实际 HTTP 4xx/5xx 与稳定错误码，`data` 通常为 `null`，限流或维护时可含公开的恢复提示。流式端点使用 `text/event-stream`，在事件流已开始后以 `error` 事件表示故障。公开报告仍可仅凭有效 `reportId/userId` 查看；所有聊天端点另须验证 `Authorization: Bearer <guest_token>`。这个随机秘密只授权访问该匿名访客创建的聊天，不证明访客是报告本人；后台管理员 JWT 也不能替代它。

2026-10-12：后台独立服务开关现可启停。数据库总开关默认 false；四个部署开关未设置时委托后台，显式 false 仍拒绝。暂停后新问答/重试返回 `503 consult.disabled`；生成准备前和最终发布前重新检查暂停审计栅栏，关闭后即使恢复也不发布旧未完成回答，失败终态保留实际 token/未知预留。流中返回 `error {code:"consult.disabled",retryable:false}`，页面保留当前对话、禁用继续发送与重试，不误报网络故障。开关不提供用户历史读取或删除。

## 匿名聊天建立

`POST /guest-contexts`：输入 `{ "report_code": "...", "customer_id": 123 }`。后端先按现有公开报告规则核对二者对应、报告已就绪，再生成至少 256 位随机 `guest_token` 并仅保存其 HMAC 摘要。输出 `{ guest_token, expires_at, report_code, customer_id }`；凭证签发后 30 天到期，不滑动续期，只返回本次，前端在当前标签页 `sessionStorage` 保存，不放入 URL 或持久化存储。报告端内部跳转复制公开链接参数时须过滤 `guest_token`，且不得从 URL 读取此凭证。无有效报告返回 404/409；频繁创建受服务端总量和速率限制。

同一标签页刷新时可继续携带已保存的 guest 授权凭证，但必须创建新的空白咨询；前端不得将 session ID 写入 `sessionStorage`。独立新标签页/设备也创建新的匿名上下文。若凭证已丢失/过期，允许继续查看公开报告，并可创建新的聊天，但不能凭报告链接取回旧聊天。后端历史正文仍永久保留，访问凭证 30 天到期不代表正文到期或清理。

## 启动与可选处理选择（2026-10-12 当前契约）

`GET /bootstrap?report_code=...`：携带 `Authorization: Bearer <guest_token>`，读取绑定报告的日期、总分、事实摘要、可问问题、方案、服务状态和剩余额度，不返回 `notice` 或 `consent_status`，也不创建同意记录。服务开关、后台配置、服务商/模型匹配、无维护文案及无明确撤回时才可返回 `service_status: "available"`；缺失同意记录本身不阻断。生产默认关闭；维护返回 `maintenance` 及最多 500 字公开说明，其他不可用状态返回 `unavailable`。`remaining_today` 按 UTC 自然日统计该凭证跨会话的已完成轮次，截断至不小于 0；服务不可用或额度配置无效时为 `null`。新凭证在维护期不签发，返回 503 `consult.maintenance`；环境开关关闭时返回 `consult.disabled`。bootstrap 不调用模型。

欢迎页使用 `report_score`（缺失时为 `null`）、`focus_systems`（按已核对分数升序取两个系统）和 `management_plans`（当前有效推荐）。方案复用原有指标关联、发布和严格低于阈值的规则，只投影必要资料和首张商品图片；无匹配时隐藏，不补假方案。顶部没有历史入口，服务可用时直接展示输入框，不展示强制同意弹层。首次发送才创建新会话。

`POST /consents` 仅作旧客户端兼容，当前 Vue 页和验收工具不调用、不代用户同意。输入仍为 `{report_code, notice_version, provider_code, accepted}`，需有效绑定凭证与当前完整告知配置，记录到 `nepstar`，已有记录和关联不删除。最新明确撤回阻断新会话、新提问、重试及轮次读取/反馈，返回 403 `consult.processing_withdrawn`；没有记录不等于拒绝。选择记录不证明访问者是报告本人；正式生产告知及授权方案仍属 T065。

生成过程中撤回时，最终保存前再次检查最新选择；丢弃回答正文和依据，但把 generation 保存为失败终态并保留可信实际 token（未知则保留预留），提交后发送 `consult.access_changed`，不发送 delta/evidence/completed。停止接口仍允许安全停止原尝试。008 迁移仅使 `consent_id` 可空，不改变凭证和报告隔离。

创建更新会话后，旧会话的发送、幂等重放、重试和反馈同样返回 404，不只隐藏历史列表。生成最终保存前核对最新会话；若已被替代，保存失败终态与用量但不发布旧正文。写路径维持 session→settings→轮次/生成的锁顺序，最新会话核对不额外锁第二个 session，避免锁顺序反转。真实 MySQL 多进程和并发重入窗口仍须独立验收，不能用隔离单测宣称完全验证。

## 会话

| 方法与路径 | 输入 | 输出/行为 |
| --- | --- | --- |
| `POST /sessions` | home: `{report_code, source:"home"}`；indicator: `{report_code, source:"indicator", indicator_code}`；plan: `{report_code, source:"plan", plan_id, indicator_code}` | 创建绑定 guest 凭证和公开报告的会话；指标必须在当前报告中唯一登记；方案须由当前报告实时聚合结果再次确认仍发布、关联同一指标且 `score < trigger_score_below` |
| `GET /sessions?report_code=...&cursor=...` | — | 不提供最近咨询列表；固定返回 HTTP 410 `consult.history_unavailable`，不查询数据库 |
| `GET /sessions/{session_id}?report_code=...` | — | 不提供完整会话/历史读取；固定返回 HTTP 410 `consult.history_unavailable`，不查询数据库 |
| `DELETE /sessions/{session_id}?report_code=...` | — | 不提供用户删除；固定返回 HTTP 410 `consult.history_unavailable`，不修改数据库 |

每次进入 AI 咨询均创建新会话，来源包括首页、单指标和管理方案。方案/指标来源在创建时由当前报告重新核验，并保存 `source_indicator_code`；回答生成时再验证一次。若方案后来下架或不再满足阈值，服务端只解释绑定指标并明确方案已失效，不再把它作为当前推荐依据。详情页入口参数不是授权凭证。`GET /bootstrap` 可接受 `plan_id` 与 `indicator_code` 作为不可信入口提示，响应只返回本报告当前验证后的 `entry_context`。完整问题、完整回答及必要的会话/依据元数据永久保留在 `nepstar`，不因 guest/session 凭证到期而删除；自动清理入口会在创建数据库连接前失败关闭。用户端只持有本页面内存中的 session ID；单轮状态读取只允许该 guest/report 最新创建的活动会话，用于本页断线核对。历史列表、完整会话详情和用户删除均不可用。后端公开入口和问答运营开关仍按独立配置控制。

报告端不显示最近咨询或历史会话，也不保留 session ID。每次进入页面后第一次发送前创建新的空白 session；离开后再次进入或刷新均不得通过列表、完整详情或单轮 API 读取旧咨询。用户不能删除后台记录。

`POST /sessions/{session_id}/end?report_code=...`：通过请求头 Bearer 凭证验证 guest/report/session 归属，幂等返回 `{id, status:"ended"}`；服务关闭时仍可结束。仅更新 `nepstar` 中已有会话及尚在运行的轮次/生成记录，保留全部已保存问题、回答和用量，拒绝结束后的晚到回答。最后发送问题或重试满 10 分钟时，服务端拒绝继续使用旧会话；生成完成、反馈、滚动和查看不延长有效活动时间。报告页同步计时并提示开始新咨询。返回/跳转在已有对话或输入草稿时弹出“结束本次咨询？”确认，取消保留对话，确认结束后离开；关闭/刷新用浏览器原生提示，实际 pagehide 通过携 Bearer 头的 keepalive 请求尽力结束，丢失信号由服务端时间判定兜底。

## 发送、重试和停止

报告端依据 bootstrap 与 completed SSE 中的 `remaining_today` 同步剩余额度，正常发送及同轮重试均更新；0 时禁用新提问但保留当前对话和输入草稿。`consult.daily_limit` 将剩余次数置 0，`consult.global_budget_exhausted` 禁用本页新提问；限流/并发拒绝以响应中安全整数 `retry_after_seconds` 或数字 `Retry-After`（1–86400 秒）提示倒计时，等待期间不允许反复发送。没有可信等待时间时限流缺省 60 秒、并发忙缺省 5 秒，后端仍作最终准入校验。原位重发沿用原 UUID 和问题，不增加气泡；这些状态只在当前页内存中维护，不能用于访问旧咨询。

单轮 API 的 `status: incomplete, can_retry: false` 不代表可以重新生成；页面保留“查询回答状态”，在确认终态前不发送下一条问题，也不展示未审校正文。超时状态核对不调用模型、不增加 generation。刷新仍开始空白咨询，不凭旧 session ID 查回先前内容。

接收 SSE 后，服务端对本轮上下文、规则、报告依据、模型草稿与审校的候选准备阶段设置 60 秒上限，模型请求自身仍有更短的独立超时。准备超时取消当前工作，尝试将 generation 记为 `failed/error_category=timeout`，成功保存后发送 `error {code: "consult.timeout", retryable: true}`，不发送正文/依据/完成事件，不计成功次数；模型实际耗用未知时不能记成 0 token。客户端将该错误纳入超时恢复流程，先读取当前轮状态，只有 `can_retry=true` 才允许同轮新 generation。准入事务、最终保存、代理传输不在该 60 秒阶段上限内；保存失败仍发送 `consult.storage_unavailable`，不能宣称整个接口的端到端 SLA 已通过。客户端既有 65 秒 deadline 仍作为断流保护，后台卡住的运行状态由既有恢复机制处理。

`POST /sessions/{session_id}/turns?report_code=...`：JSON `{ "question": "..." }`，请求头 `Idempotency-Key: <UUID>`；成功为 SSE。再次校验凭证、报告绑定、最新处理选择、服务商匹配、规则和额度。服务器先持久化/复用唯一问题，再启动候选；同会话已有运行中生成时拒绝新的 key。`max_question_chars` 为 1–500，缺省 500，服务端始终保留硬上限。空白、过长、服务关闭、明确撤回或授权不符均返回错误；重复 key 不新建问题。生产问答开关默认关闭，真实验收尚未完成。

`POST /sessions/{session_id}/turns/{turn_id}/stop?report_code=...`：请求体 `{ "generation_id": 123 }`。要求有效 guest 凭证、该报告下未删除的会话，以及与当前运行尝试精确匹配的 generation。成功返回 `{ "turn_id": 1, "generation_id": 123, "status": "stopped" }`；同一已停止尝试重复请求幂等成功，其他尝试或已完成回答返回 409，找不到该轮/尝试返回 404。服务端保留原问题，将本轮及该 generation 标记 `stopped`，清空未完成回答和依据，递增会话 epoch 以拒绝晚到结果。即使问答开关随后关闭，持有效凭证仍可停止运行中的尝试。报告端只在收到 `accepted` 的轮次和 generation ID 后显示停止按钮；服务端确认成功后才中止本地流，并显示“已停止，本次回答未完成”。这不保证模型服务商立即取消推理或退还用量。

`POST /sessions/{session_id}/turns/{turn_id}/retry?report_code=...`：请求体 `{ "generation_id": 123 }` 必须匹配客户端所见上一代。仅失败/停止的当前尝试可新建 generation，沿用原问题；重复请求只回放直接后继，不再次调用模型或重复计费。新尝试仍校验报告凭证、明确撤回、服务商、频率/并发/日额度及 token 预算。`GET /sessions/{session_id}/turns/{turn_id}?report_code=...` 仅用于当前页面内存中的最新活动会话，须重新核对 guest/report、最新 session 及处理选择；非最新会话 404，撤回 403。未完成或无有效依据的正文不返回。重入/刷新不恢复旧 ID 或旧咨询。

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

证据项必须由服务端按当前报告读取生成，包含类型（报告事实/后台维护资料/用户补充）、真实检测日期、指标编码和当前报告路由。用户明确询问行动建议时，可将当前指标 `report_actions` 中通过隐私和健康安全检查的最多三条内容作为独立 `source_type: "action"` 引用返回；它们标注为后台维护资料，不混入模型事实提示或 AI 回答正文。聊天中的证据读取仍按 guest 与绑定报告校验；打开公开指标页本身沿用报告公开访问规则。用户自述不可冒充检测依据。聊天历史查询不得仅凭 `report_code` 或 `customer_id`。

稳定错误码至少包括：`consult.guest_token_required`、`consult.guest_token_expired`、`consult.consent_required`、`consult.notice_changed`、`consult.processing_withdrawn`、`consult.access_changed`、`consult.report_unavailable`、`consult.session_not_found`、`consult.disabled`、`consult.maintenance`、`consult.rate_limited`、`consult.quota_exhausted`、`consult.capacity_reached`、`consult.provider_unavailable`、`consult.timeout`、`consult.unsafe_answer`。旧 consent 错误仅用于兼容路径。403/404 避免透露其他 guest 的会话是否存在；429 的 `data.retry_after_seconds` 与 `Retry-After` 响应头提供重试等待时间。维护时的 503 仅提供后台审核的公开说明，不包含内部错误。匿名会话额度不足不等于识别了真实用户。
