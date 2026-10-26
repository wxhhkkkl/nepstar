# Contract: Report-bound Plan Detail

**Version**: 1 (planned) | **Transport**: 既有同源API，无新增认证体系或管理权限。

## Request

`GET /api/v1/report-view/{report_code}/plans/{plan_id}?customer_id={id}&indicator_code={code}`

| 参数 | 约束 |
| --- | --- |
| report_code | 复用既有报告路径验参及读取限制。 |
| plan_id | 必填正整数，拒绝0、负数和非整数。 |
| customer_id | 必填正整数，匹配报告归属。 |
| indicator_code | 可选；提供时为2–64字符，`^[A-Z][A-Z0-9_]+$`，必须是该方案在该报告的有效关联。 |

这是现有报告公开读取边界，不接受管理员JWT代替报告归属，也不要求为阅读创建guest。URL及planNavKey均不是权限凭证。响应设Cache-Control:no-store及Referrer-Policy:no-referrer，日志不记录正文、身份token或源库连接信息。

## Resolution Order

1. 验参；沿用_load_document_and_meta校验Mongo、旧SQL记录、客户一致及ready。不存在/非本客户对外相同。
2. 读取当前registry及报告真实系统/指标分支，应用fetch_plans_for_indicators的启用/关联/排序/local overlay规则。
3. 完整集合中固定plan_id，仅保留真实分数严格低于实际阈值的有效关联。指标定义、父系统及报告分支必须一致；不得只靠target_id或首页当前recommendation判断。
4. 指定indicator_code必须有效，否则返回plan_not_found；未指定按既有报告系统/指标顺序选择首项。无任何有效关联也返回plan_not_found。
5. 仅对结果中的有效product_ids批量补全启用商品及图库，保留方案关联顺序，不再读取远端关系替换overlay。
6. 清洗正文；独立读取AI全局状态。AI配置故障不影响已读取的方案正文。

## Success Body

沿用`ApiResponse`的code/message/data及既有公共字段。HTTP 200、业务code200；以下为data示例（文字仅示意，运行时必须读取维护内容）：

```json
{
  "report_code": "KH503LS0005835V26100716284345",
  "plan": {"plan_id": 1, "name": "松果体睡眠健康管理方案", "description": "后台维护的方案说明"},
  "primary_indicator": {
    "system_code": "SYS_ENDOCRINE", "system_name": "内分泌",
    "indicator_code": "IND_FIXTURE_SLEEP", "indicator_name": "性腺分泌",
    "indicator_score": 98, "trigger_score_below": 99
  },
  "related_indicators": [{
    "system_code": "SYS_ENDOCRINE", "system_name": "内分泌",
    "indicator_code": "IND_FIXTURE_SLEEP", "indicator_name": "性腺分泌",
    "indicator_score": 98, "trigger_score_below": 99
  }],
  "products": [{
    "product_id": 1, "name": "松果体睡眠健康管理礼盒", "description": "后台维护的商品简介",
    "images": [{"url": "/实际受控图片路径.png", "alt": "松果体睡眠健康管理礼盒"}],
    "detail_blocks": [], "detail_truncated": false
  }],
  "consult": {"status": "available", "message": null}
}
```

示例中的ID、IND_FIXTURE_SLEEP代码和资源路径是契约测试占位，不对应真实登记值；不得复制为运行时硬编码。实际related_indicators必须包含primary且按既有顺序返回。

| 字段 | 规则 |
| --- | --- |
| plan | 固定请求方案，description可null；不返回状态、内部时间或所有后台字段。 |
| primary_indicator | 当前有效关联，字段非空，score为0–100整数，严格阈值。 |
| related_indicators | 完整去重关联，至少一项；可逐项查看各自指标，不暗中改变默认primary。 |
| products | 0/1/多项，无演示数据；只有启用且当前关联商品。 |
| images | cover优先及有序图库稳定去重，空则[]；每项url/alt；原图比例展示。 |
| detail_blocks | 安全有限内容数组；清洗后无正文则[]。 |
| detail_truncated | 实际达到内容界限才true，显示“内容较长，仅展示部分说明”。 |
| consult | available/maintenance/unavailable；不暴露provider、密钥或guest配额。 |

方案无独立图片，hero使用第一件有有效图片的真实商品；无图显示中性占位。商品被停用/解绑后不继续显示快照内容。

## Safe Content Blocks

仅以下结构可以输出，Vue通过文本插值和受控图片组件渲染，禁止v-html或HTML属性透传：

```json
[
  {"type":"paragraph","text":"原文中的普通段落"},
  {"type":"heading","level":3,"text":"原文中的标题"},
  {"type":"list","ordered":false,"items":["原文第一项","原文第二项"]},
  {"type":"image","url":"https://受控资源域名/原文图片.png","alt":"原有图片说明"}
]
```

- HTMLParser解释原文；p/div/br等布局转换段落，h1–h6归一为二/三级标题；行内格式保留文本，不保留class/style/id/data-*等属性。列表可扁平化但不重写内容。
- script/style/iframe/object/embed/svg/math/form及主动内容子树丢弃；普通链接只保留可见文本，不执行跳转；不载入video/audio或第三方嵌入。
- 图片及封面统一验证URL：仅项目同源单斜杠路径、既有 ./assets/ 文件路径，以及 nepstar.kangjia.online、kj101.jiankangzhan.com 和现有 OSS_BUCKET+OSS_ENDPOINT 对应的确切资源主机（HTTP/S）；拒绝协议相对地址、反斜杠、控制字符、javascript/data/blob/file及可执行资源。相对路径按既有资源基址处理，不相对当前hash页面猜测。
- 图片组件均设置referrerpolicy=no-referrer，避免旧WebView外发包含报告参数的Referer。清洗不进行网络抓取。超长URL拒绝（上限2048字符）；正文最多解析100000字符、1000个输出块/列表项、32层；超界停止安全输出并标truncated。畸形/不闭合标签必须有确定结果，不抛原文给浏览器兜底。
- 只有被丢弃内容时返回[]，不生成摘要、建议或产品信息。测试必须覆盖事件属性、混淆协议、闭合错误、深嵌套和大输入。

## Errors and UI Mapping

沿用现有API约定：业务错误通常HTTP200并在ApiResponse.code表示错误；FastAPI参数校验HTTP422。客户端同时检查HTTP及业务code，复用ReportApiError。

reportClient新增PLAN_NOT_FOUND错误类型及report.plan_not_found映射；ReportErrorState只补对应方案不可用文案，保留原报告/系统/指标行为，不把该错误退化为通用网络重试。

| HTTP / code | key | 条件及展示 |
| --- | --- | --- |
| 422 | 既有validation格式 | 缺参数、格式错误；不发出有效读取。 |
| 200 / 404 | report.not_found | 报告不存在或非本客户；同文案，无存在性泄漏。 |
| 200 / 409 | report.not_ready | 报告未就绪，保留现有返回/重试模式。 |
| 200 / 404 | report.plan_not_found | 方案不存在/停用/解绑/不命中/显式指标不符，统一“该方案暂不可查看”。 |
| 200 / 503 | report.unavailable | 原始报告/配置/商品源失败，可重试；不能把超时误报方案不存在。 |
| 客户端timeout/network | 现有ReportApiError分类 | 明确网络提示及重试，不显示旧方案或假数据。 |

SQLAlchemy等源异常转换为ReportSourceUnavailableError，不返回SQL、主机、连接字符串或HTML异常内容。没有商品、无详情、缺图及咨询维护均属于成功正文的局部状态。

## AI Integration Boundary

详情GET仅读取全局gates和维护配置，选项读取设1秒上限，超时仅禁用咨询；available表示咨询入口开放，用户同意/许可/配额仍由AI页处理。不创建guest/consent/session/turn，不调用provider。

轻量report plan context供详情及AI共用：绑定report/customer/plan/indicator，严格匹配完整集合，不读取商品正文及图库。bootstrap和create-session应支持非首页当前推荐卡的有效关联；旧无效链接仍沿用原有stale-plan降级或entry_unavailable，不冒充有效方案。

AI回答取证通过ai_consult_sources显式plan_context读取分支和ReadOnlyReportSession，每次重验catalog/detail/context分数一致、系统/指标一致及阈值。使用现有_safe_plan_description与_add_plan_fact；商品内容、任意URL标签不进入模型。停用/解绑后保持plan_stale降级及零模型调用，不扩大SQL/工具权限。
