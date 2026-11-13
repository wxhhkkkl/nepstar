# 契约：客户主动拉取报告

**路由**: `GET /api/v1/open/reports`  
**鉴权**: 海王 appKey + 签名（规则同《海王相关接口签名方案》）  
**响应**: HTTP 200；`code` 为字符串，`0` 表示成功；`data` 为 JSON 字符串

## 请求

```http
GET /api/v1/open/reports?appKey=test&timestamp=1547795196&version=1.0&startDate=2026-11-06&endDate=2026-11-13&page=1&pageSize=50&sign=5F366AE0295C45AE78B11FC022199FBB0E5D4239
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `appKey` | string | 是 | 海王分配的接入标识 |
| `timestamp` | long | 是 | 10 位秒级时间戳，GMT+8，误差 ≤10 分钟 |
| `version` | string | 是 | 固定 `1.0` |
| `sign` | string | 是 | 签名结果 |

服务端按 `appKey` 查找 secret：主凭据 `HAIXIN_APP_KEY`/`HAIXIN_APP_SECRET` 与 `HAIXIN_APP_KEYS`（`{appKey: secret}` JSON）合并后的映射；映射中不存在的 appKey 一律返回 `401`，因此可在轮换期同时登记新旧凭据。
| `startDate` | string | 否 | `YYYY-MM-DD`，GMT+8，含当天；默认 `endDate - 1 天` |
| `endDate` | string | 否 | `YYYY-MM-DD`，GMT+8，含当天；默认今天 |
| `page` | int | 否 | 默认 1，最小 1 |
| `pageSize` | int | 否 | 默认 50，最大 100；超过按 100 处理 |

### 时间范围规则

- 起止日期均按 GMT+8 自然日解释，查询区间为 `startDate 00:00:00` 至 `endDate 23:59:59`；
- 只返回 `status = 1` 的有效报告；
- 区间跨度最多 31 天；`startDate > endDate` 或超限返回 `400`；
- 只传 `startDate` 时 `endDate` 取 `startDate`；只传 `endDate` 时 `startDate = endDate - 1 天`。

### 签名算法

1. 取所有非空参数（不含 `sign`、字节类型、空字符串），按参数名 ASCII 升序排列；
2. 拼接为 `a=v1&b=v2`，末尾追加 `&secret=<secret>`；
3. 对整串做 MD5，取大写十六进制；
4. 对大写的 MD5 字符串做 SHA1，取大写十六进制，作为 `sign`；
5. 签名基于参数原始值计算，URL 编码仅用于传输。

文档黄金示例：

```text
appKey=test&phone=13798261307&timestamp=1547795196&type=1&version=1.0&secret=test
→ MD5  F7EB1EA5D9BD607CAFC4600B03F9811A
→ SHA1 5F366AE0295C45AE78B11FC022199FBB0E5D4239
```

## 成功响应

```json
{
  "code": "0",
  "message": "success",
  "data": "{\"records\":[{\"report_id\":123456,\"report_code\":\"KH503LS0005835V261106093253957\",\"customer_id\":15418089,\"device_sn\":\"KH503LS0005835V\",\"device_name\":\"检测仪-A\",\"inspect_date\":\"2026-11-06T10:32:53\",\"total_score\":82,\"status\":1,\"status_text\":\"有效\",\"name\":\"袁勇\",\"mobile\":\"13812345678\",\"report_url\":\"http://kj101.jiankangzhan.com/common.html?reportId=KH503LS0005835V261106093253957&customerId=15418089&middlePage=false&realName=1\"}],\"total\":1,\"page\":1,\"pageSize\":50,\"startDate\":\"2026-11-06\",\"endDate\":\"2026-11-13\"}"
}
```

`data` 字符串解析后：

| 字段 | 说明 |
|------|------|
| `records[].report_id` | 后台报告 ID |
| `records[].report_code` | 报告编号 |
| `records[].customer_id` | 客户编号 |
| `records[].device_sn` | 设备 SN |
| `records[].device_name` | 设备名称 |
| `records[].inspect_date` | 检测时间（GMT+8，ISO 格式） |
| `records[].total_score` | 综合得分 |
| `records[].status` | 1 有效 |
| `records[].status_text` | 有效/无效 |
| `records[].name` | 受检者姓名（完整） |
| `records[].mobile` | 手机号（完整） |
| `records[].report_url` | 报告展示链接 |
| `total` / `page` / `pageSize` | 分页信息 |
| `startDate` / `endDate` | 实际查询区间 |

## 失败响应

HTTP 状态码均为 200，按 `code` 判断：

```json
{ "code": "401", "message": "invalid signature", "data": null }
```

| `code` | 含义 |
|--------|------|
| `400` | 参数缺失/格式错误/日期区间非法/超过 31 天 |
| `401` | appKey 未配置或不匹配、签名错误、时间戳超限、version 不支持 |
| `503` | 报告数据源暂时不可用 |

- 失败响应不返回任何报告数据、堆栈或内部标识；
- 日志记录 appKey、结果、耗时与失败原因，不记录 secret、响应体、姓名/手机号；
- 本接口请求与响应均包含完整 PII，必须仅经 HTTPS 暴露。
