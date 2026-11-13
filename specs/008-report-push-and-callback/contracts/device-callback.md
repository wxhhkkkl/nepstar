# 契约：设备检测完成回调

**路由**: `POST /api/v1/report-callback/device`  
**鉴权**: 无签名（按 2026-11-13 澄清结论）；部署层通过 nginx 来源限制与频控兜底  
**响应封装**: 沿用后台 `ApiResponse`；应答不等待客户推送完成

## 请求

```http
POST /api/v1/report-callback/device
Content-Type: application/json
```

```json
{
  "h5Url": "http://kj101.jiankangzhan.com/common.html?reportId=KH503LS0005835V261106093253957&customerId=15418089&middlePage=false",
  "customerType": 1,
  "appCustomerInfo": "{\"age\":\"45\",\"appCustomerId\":\"1765248003014\",\"height\":\"163\",\"mobile\":\"28982108221\",\"sex\":\"1\",\"userName\":\"袁勇\",\"weight\":\"22\"}",
  "reportId": "KH503LS0005835V261106093253957",
  "exceptionTab": "[{\"key\":\"107\",\"value\":\"2\"},{\"key\":\"126\",\"value\":\"2\"},{\"key\":\"123\",\"value\":\"2\"}]",
  "printH5": "http://kj101.jiankangzhan.com/print/print151.html?reportId=KH503LS0005835V261106093253957&viewType=2",
  "modelType": 30,
  "deviceId": "KH503LS0005835V"
}
```

### 字段使用

| 字段 | 是否使用 | 说明 |
|------|----------|------|
| `reportId` | 是 | 等于旧库 `inspect_base.report_code`，幂等键 |
| `deviceId` | 是 | 等于旧库 `inspect_base.sn_num`，辅助校验 |
| `h5Url` | 否 | 仅接收；报告链接由后台按既有规则重新构造 |
| `appCustomerInfo` | 否 | 含姓名/手机号等个人信息，不持久化、不写日志 |
| `printH5` | 否 | 不持久化 |
| `modelType` | 否 | 不持久化 |
| `exceptionTab` | 否 | 不持久化 |
| `customerType` | 否 | 不持久化 |

未知字段一律忽略，不因多余字段拒绝请求。

## 响应

### 已受理

```json
{
  "code": 200,
  "message": "success",
  "data": { "accepted": true, "duplicate": false }
}
```

- `duplicate = true`：同一 `reportId` 已有 `pending` / `success` / `skipped` 自动记录，未新增记录；
- 已有 `failed` 自动记录时，其 `dedupe_key` 已清空；本次回调新建一条自动记录并调度，返回 `duplicate = false`，原失败记录保留；
- 同一 `reportId` 的自动失败记录达到上限（`HAIXIN_AUTO_MAX_FAILED_ATTEMPTS`，默认 3 条）后，后续回调直接返回 `duplicate = true`，不再新建尝试；该上限判断仅在不存在任何成功推送记录时生效；
- 应答目标 <500ms；报告定位与客户推送在后台异步执行。

### 拒绝

缺少 `reportId` / `deviceId`、JSON 非法、字段类型错误：

```json
{ "code": 400, "message": "callback.invalid", "data": null }
```

HTTP 状态码保持 200（与后台既有业务错误风格一致），设备侧重试策略不依赖 HTTP 状态。

## 处理规则

1. 校验 `reportId`、`deviceId` 非空且为字符串；
2. 检查该 `reportId` 的自动失败记录数：达到上限时直接应答“已处理”；否则按 `reportId` 创建自动推送记录（`dedupe_key = reportId`）；若唯一键冲突，说明已有 `pending`/`success`/`skipped` 记录，直接应答；`failed` 记录的 `dedupe_key` 已清空，不阻塞新记录；
3. 立即应答；
4. 异步定位报告：首次立即查，失败后 10s / 20s / 30s 重试；
5. 报告不存在或 `status != 1` → 记录 `failed`（`report.not_found` / `report.invalid`）；
6. 该报告已有成功推送（人工或自动）→ 记录 `skipped`；
7. 否则按出站契约推送，更新为 `success` / `failed`。

## 部署要求

- 仅允许设备侧出口 IP 访问该路由（nginx `allow` / `deny`）；
- 建议按来源做频率限制，防止被刷；
- 回调本身可作为幂等用例重复回放，不应产生重复推送。
