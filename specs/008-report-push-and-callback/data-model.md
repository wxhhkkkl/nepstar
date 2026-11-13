# Data Model: 检测报告推送、回调与主动拉取

**Date**: 2026-11-13 | **Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## 1. 既有只读实体（不修改）

### 检测报告（旧库 `inspect_base` + `ne`，只读）

| 字段 | 类型 | 用途 |
|------|------|------|
| `inspect_base_id` | bigint | 后台报告 ID（`report_id`） |
| `report_code` | varchar | 报告编号（设备回调的 `reportId`，推送/拉取的业务主键） |
| `customer_id` | bigint | 客户编号 |
| `sn_num` | varchar | 设备 SN（设备回调的 `deviceId`） |
| `device_id` | varchar | 关联 `ne.ne_id`，用于组织数据范围校验 |
| `inspect_date` | datetime | 检测时间（GMT+8 口径） |
| `total_score` | int | 综合得分 |
| `status` | int | 1 有效，其余无效 |
| `name` / `mobile` | varchar | 受检者姓名/手机号（拉取返回完整值；推送不返回） |
| `dept_id` | varchar | 全局部门过滤（`settings.DEPT_ID`） |

报告链接沿用 `report_service._build_report_url`：
`{REPORT_BASE_URL}?reportId={report_code}&customerId={customer_id}&middlePage=false&realName=1`

报告文档（MongoDB `receive_report.reportV2Info`，`_id = report_code`）本功能不直接读取；推送与拉取只依赖旧库字段与报告链接。

## 2. 新增实体：推送记录（`sa_report_push_log`）

```sql
CREATE TABLE nepstar.sa_report_push_log (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  report_id        BIGINT       NULL COMMENT '旧库 inspect_base_id',
  report_code      VARCHAR(64)  NOT NULL COMMENT '报告编号；回调幂等键',
  device_sn        VARCHAR(64)  NULL,
  trigger_type     VARCHAR(10)  NOT NULL COMMENT 'manual/auto',
  operator_id      BIGINT       NULL COMMENT '人工推送操作人',
  status           VARCHAR(10)  NOT NULL COMMENT 'pending/success/failed/skipped',
  dedupe_key       VARCHAR(64)  NULL COMMENT '自动推送活动/成功时为 report_code；失败或人工为 NULL',
  failure_reason   VARCHAR(255) NULL,
  response_summary VARCHAR(500) NULL COMMENT '客户响应摘要，已脱敏截断',
  created_at       DATETIME     NOT NULL,
  finished_at      DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_push_dedupe (dedupe_key),
  KEY idx_push_report_code (report_code),
  KEY idx_push_created (created_at),
  KEY idx_push_status_created (status, created_at),
  KEY idx_push_device (device_sn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 字段规则

- `report_code`：必填；来自报告主记录。自动推送的 `dedupe_key` 与它相同。
- `dedupe_key`：自动推送在 `pending`/`success`/`skipped` 状态下为 `report_code`；转为 `failed` 时**清空为 NULL**，让同一报告的下一次回调可以新建一条尝试记录，同时保留原失败记录。人工推送始终为 NULL；MySQL 唯一索引允许多个 NULL，因此人工补发可重复。
- `status` 取值：
  - `pending`：已受理，等待投递或正在定位报告；
  - `success`：客户返回 HTTP 2xx 且业务码为 `0`；
  - `failed`：报告未定位/无效、配置关闭、网络错误、超时、客户业务失败；
  - `skipped`：该 `report_code` 已存在成功推送，自动推送被跳过。
- `failure_reason`：稳定的机器可读标识（如 `report.not_found`、`report.invalid`、`delivery.timeout`、`delivery.config_missing`、`delivery.rejected`），前端按 i18n 映射展示。
- `response_summary`：最多 500 字符；不含 secret、完整姓名/手机号。
- `operator_id`：仅 `trigger_type=manual` 时写入。

### 状态流转

| 起点 | 事件 | 终点 | 说明 |
|------|------|------|------|
| — | 人工点击“再次推送” | `pending` | 同步投递 |
| — | 回调受理且无历史自动记录 | `pending` | 异步投递 |
| — | 回调受理但已有 `pending`/`success`/`skipped` | 不变 | 直接应答“已处理” |
| `pending` | 客户返回成功 | `success` | 记录 `finished_at`，保留 `dedupe_key` |
| `pending` | 报告未定位/无效、配置缺失、网络/超时/业务失败 | `failed` | 记录原因，**清空 `dedupe_key`**，可人工补发 |
| `pending` | 发现同报告已有成功推送（自动路径） | `skipped` | 不实际投递，保留 `dedupe_key` |
| `pending` | 进程重启超过 5 分钟 | `failed` | 原因 `delivery.interrupted`，清空 `dedupe_key` |
| `failed`（`dedupe_key` 已清空） | 同一 `report_code` 的回调再次到达（自动） | 新增 `pending` | 新建一条自动记录，原失败记录保留 |
| `failed` | 运营点击“重发” | 新增 `pending`（manual） | 原记录保留 |

### 并发与幂等

- 自动路径插入时依赖 `uk_push_dedupe`；`IntegrityError` 表示同报告已有 `pending`/`success`/`skipped` 记录，读取后直接应答“已处理”；`failed` 记录已清空 `dedupe_key`，不会阻塞新记录。
- 人工路径不写 `dedupe_key`，允许多条；并发人工推送互不影响。
- 自动投递开始前再次检查该 `report_code` 是否已有 `success`（含人工），有则写 `skipped`。
- 失败写库与清空 `dedupe_key` 必须在同一事务内完成；新回调的插入与成功判定同样以事务 + 唯一索引兜底。
- 同一 `report_code` 的自动失败记录达到 `HAIXIN_AUTO_MAX_FAILED_ATTEMPTS`（默认 3）后，回调直接应答“已处理”，不再插入新记录；该判断仅在不存在任何成功推送记录时生效（有成功记录时优先走 `skipped`/重复处理）；人工“再次推送”不受此限制。
- 拉取验签的 secret 通过 `HAIXIN_APP_KEYS` + 主 `HAIXIN_APP_KEY`/`HAIXIN_APP_SECRET` 合并后的映射按 appKey 查找；映射中不存在的 appKey 一律 `401`。
- 不新建回调事件表；回调处理结果全部体现在推送记录中（澄清结论）。

## 3. 新增配置项（`app/config.py`）

| 配置 | 默认 | 说明 |
|------|------|------|
| `HAIXIN_APP_KEY` | `""` | 海王分配的主 appKey（出站推送使用） |
| `HAIXIN_APP_SECRET` | `""` | 主签名 secret，只在服务端使用 |
| `HAIXIN_APP_KEYS` | `{}` | JSON 对象 `{appKey: secret}`；拉取验签时与主凭据合并（主凭据优先），用于新旧凭据并存轮换 |
| `HAIXIN_AUTO_MAX_FAILED_ATTEMPTS` | `3` | 同一 `reportId` 允许的自动失败记录上限；达到后回调只应答不新增 |
| `HAIXIN_PUSH_URL` | `""` | 客户报告接收地址 |
| `HAIXIN_PUSH_ENABLED` | `false` | 关闭时不发起外发，直接记录失败 |
| `HAIXIN_PUSH_METHOD` | `POST` | `POST`（表单）或 `GET` |
| `HAIXIN_PUSH_TIMEOUT_SECONDS` | `5.0` | 人工推送同步等待上限 |
| `HAIXIN_PUSH_FIELD_MAP` | `{}` | JSON 字段映射覆盖，如 `{"report_code":"reportId"}` |
| `HAIXIN_SIGN_TOLERANCE_SECONDS` | `600` | 拉取时间戳容差 |
| `HAIXIN_PULL_DEFAULT_DAYS` | `1` | 拉取缺省区间 |
| `HAIXIN_PULL_MAX_DAYS` | `31` | 拉取最大区间 |
| `HAIXIN_PULL_DEFAULT_PAGE_SIZE` | `50` | 拉取默认页大小 |
| `HAIXIN_PULL_MAX_PAGE_SIZE` | `100` | 拉取最大页大小 |

## 4. 菜单数据

在既有“检测报告”菜单同级插入：

| 字段 | 值 |
|------|-----|
| `route_path` | `/report/push-records` |
| `name_zh` | 推送记录 |
| `name_en` | Push Records |
| `name_es` | Registros de Envío |
| `icon` | `tickets` |
| `parent_id` | 与 `/report/list` 相同的父级 |
| `sort_order` | `/report/list` 的 `sort_order + 1` |

启动顺序：`seed_root_org` → `seed_health_menus` → `seed_report_push_menu` → `seed_admin_role`（管理员自动获得新菜单权限）。

兜底：若目标环境不存在 `/report/list` 菜单（全新库或其它部署），`seed_report_push_menu` MUST 新建一个顶层“推送记录”菜单（`parent_id = NULL`），而不是静默跳过；重复启动仍保持幂等。
