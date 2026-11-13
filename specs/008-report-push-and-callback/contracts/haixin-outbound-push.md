# 契约：向海王推送报告（出站）

**触发方**: 人工“再次推送” / 设备回调自动推送 / 推送记录重发  
**目标**: `HAIXIN_PUSH_URL`（联调前为占位，客户正式契约未提供）  
**实现**: `app/services/report_push_service.py` + `app/utils/haixin_sign.py`

## 请求

```http
POST {HAIXIN_PUSH_URL}
Content-Type: application/x-www-form-urlencoded
```

### 参数

| 内部字段 | 默认出站名 | 取值 |
|----------|------------|------|
| — | `appKey` | `HAIXIN_APP_KEY` |
| — | `timestamp` | 当前 10 位秒级时间戳 |
| — | `version` | `1.0` |
| — | `sign` | 按下方算法计算 |
| `report_code` | `reportId` | 报告编号 |
| `customer_id` | `customerId` | 客户编号 |
| `device_sn` | `deviceSn` | 设备 SN |
| `inspect_date` | `inspectDate` | `YYYY-MM-DD HH:MM:SS`（GMT+8） |
| `total_score` | `totalScore` | 综合得分 |
| `report_url` | `reportUrl` | 报告展示链接 |

- 不包含姓名、手机号、检测明细或报告文档。
- 出站固定使用主凭据 `HAIXIN_APP_KEY`/`HAIXIN_APP_SECRET`；轮换时更新主凭据，`HAIXIN_APP_KEYS` 仅用于入站拉取验签的新旧并存。
- `HAIXIN_PUSH_METHOD=GET` 时参数放 query，其余规则不变。

### 字段映射

客户契约字段名不同时，用 `.env` 覆盖，不改代码：

```dotenv
HAIXIN_PUSH_FIELD_MAP={"report_code":"reportNo","customer_id":"memberId","device_sn":"deviceCode","inspect_date":"checkTime","total_score":"score","report_url":"url"}
```

未出现在映射中的字段保持默认名。

### 签名

与拉取接口相同的规则：

1. 取全部非空参数（不含 `sign`），按参数名 ASCII 升序；
2. 拼接 `a=v1&b=v2`，末尾追加 `&secret=<HAIXIN_APP_SECRET>`；
3. MD5 大写 → 再 SHA1 大写 → `sign`。

## 成功判定

- HTTP 状态码 2xx；且
- 响应体为 JSON，`code` 为 `"0"` 或 `0`。

任一不满足即 `failed`：

| 场景 | `failure_reason` |
|------|------------------|
| 地址或凭据为空 | `delivery.config_missing` |
| `HAIXIN_PUSH_ENABLED=false` | `delivery.disabled` |
| 超时 | `delivery.timeout` |
| 连接失败/非 2xx | `delivery.network` |
| `code` 非 0 | `delivery.rejected` |
| 非 JSON/无法解析 | `delivery.bad_response` |

## 超时与重试

- 单次请求超时 5 秒（`HAIXIN_PUSH_TIMEOUT_SECONDS`）；
- 不自动重试客户接口；失败由运营在推送记录页重发；
- 回调路径的“报告定位”重试与出站投递重试相互独立。

## 记录与安全检查

- 推送记录只保存 `failure_reason` 与最多 500 字符的响应摘要；
- 不保存 secret、完整签名串、完整姓名/手机号；
- `HAIXIN_PUSH_ENABLED` 默认 `false`，避免测试/预发环境误发真实请求；
- 出站请求只由服务端发起，地址与凭据不暴露给前端。
