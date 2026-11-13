# 契约：后台人工推送与推送记录

**范围**: `nepstarAdmin/backend/app/api/reports.py`（新增路由）  
**鉴权**: 管理端 JWT（`Authorization: Bearer <token>`）+ 既有 `check_permission`  
**响应封装**: 沿用后台统一 `ApiResponse`（HTTP 200，业务码在 `code`）

## 1. 人工再次推送

```http
POST /api/v1/reports/{report_id}/push
Authorization: Bearer <token>
```

- `report_id`：旧库 `inspect_base_id`。
- 同步等待客户接口，最长约 5 秒。
- 推送内容与出站格式见 [haixin-outbound-push.md](haixin-outbound-push.md)。

### 成功（投递成功或投递失败均已执行业务）

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "record_id": 1024,
    "status": "success",
    "failure_reason": null
  }
}
```

投递失败时 `status = "failed"`，`failure_reason` 为稳定标识：

| 标识 | 含义 |
|------|------|
| `delivery.config_missing` | 未配置推送地址或凭据 |
| `delivery.disabled` | `HAIXIN_PUSH_ENABLED=false` |
| `delivery.timeout` | 客户接口超时 |
| `delivery.network` | 连接失败/HTTP 非 2xx |
| `delivery.rejected` | 客户返回业务码非 `0` |
| `delivery.bad_response` | 客户响应不是约定 JSON |
| `delivery.interrupted` | 进程重启导致 pending 超时 |

### 业务拒绝（未产生投递）

| `code` | `message` | 场景 |
|--------|-----------|------|
| 404 | `report.not_found` | 报告不存在 |
| 403 | `report.forbidden` | 报告所属设备不在用户组织数据范围内 |
| 409 | `report.invalid` | 报告状态无效或缺少报告编号/客户编号 |

> HTTP 状态码保持 200，前端按 `code !== 200` 提示错误；投递失败仍返回 `code = 200`，由 `data.status` 区分，避免把“已尝试但客户拒绝”显示成接口异常。

## 2. 推送记录列表

```http
GET /api/v1/reports/push-records?page=1&page_size=20&start_date=2026-11-01&end_date=2026-11-13&status=failed&trigger_type=auto&sn=KH503
Authorization: Bearer <token>
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `page` | 否 | 默认 1 |
| `page_size` | 否 | 默认 20，上限 100 |
| `start_date` / `end_date` | 否 | 按 `created_at` 过滤，GMT+8，含当天 |
| `status` | 否 | `pending` / `success` / `failed` / `skipped` |
| `trigger_type` | 否 | `manual` / `auto` |
| `sn` | 否 | 设备 SN 模糊匹配 |

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "records": [
      {
        "id": 1024,
        "report_id": 123456,
        "report_code": "KH503LS0005835V261106093253957",
        "device_sn": "KH503LS0005835V",
        "trigger_type": "auto",
        "operator_id": null,
        "status": "failed",
        "failure_reason": "delivery.timeout",
        "response_summary": "timeout after 5.0s",
        "created_at": "2026-11-13T10:00:00",
        "finished_at": "2026-11-13T10:00:05"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

- 数据范围：只返回用户有权查看的报告对应记录；无法从旧库确认归属的记录不返回。
- 不含完整姓名/手机号、secret 或签名原文以外的凭据。

## 3. 从记录重发

```http
POST /api/v1/reports/push-records/{log_id}/repush
Authorization: Bearer <token>
```

- 读取记录中的 `report_code`，按人工推送流程重新发送；
- 新增一条 `trigger_type = "manual"` 的记录，原记录不变；
- 响应同“人工再次推送”；
- 报告已无效或不在数据范围时返回 409 / 403。

## 4. 权限与菜单

- 路由沿用 `Depends(check_permission)`；
- 菜单 `/report/push-records` 在启动时幂等登记，`admin` 角色自动获得全部动作；
- 非管理员角色需由管理员授予 `view`（查询）与 `add`（POST 推送/重发）；
- 服务层额外校验报告设备是否在用户组织数据范围内。
