# Research: 检测报告推送、回调与主动拉取

**Date**: 2026-11-13 | **Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

所有 spec 中的 NEEDS CLARIFICATION 已在 `/speckit.clarify` 阶段解决；本文只记录实现层面的技术决策、依据与被否决的方案。

## R1. 海王签名实现

**Decision**: 新增 `app/utils/haixin_sign.py`，严格按文档实现：

1. 去掉 `sign`、`None`、空字符串与字节类型参数；
2. 参数名按 ASCII 升序排序；
3. 拼接 `a=v1&b=v2`，末尾追加 `&secret=<secret>`；
4. 对整串做 MD5，取大写十六进制；
5. 再对**大写 MD5 字符串**做 SHA1，取大写十六进制，即为 `sign`；
6. 校验使用 `hmac.compare_digest`，避免时序侧信道。

**Golden case**（来自《海王相关接口签名方案》示例）：

```text
appKey=test&phone=13798261307&timestamp=1547795196&type=1&version=1.0&secret=test
MD5  (upper) = F7EB1EA5D9BD607CAFC4600B03F9811A
SHA1 (upper) = 5F366AE0295C45AE78B11FC022199FBB0E5D4239
```

**Rationale**: 文档给出了完整示例与期望值，可直接作为黄金测试，避免“看起来对”的实现偏差。

**Alternatives considered**:
- 用 `hashlib.sha1(md5_bytes)`：错误，文档要求对 MD5 的**大写字面量**再 SHA1。
- 对 URL 编码后的值签名：错误，联调时会与客户计算结果不一致；签名必须基于原始值。

## R2. 客户拉取接口的传输与响应

**Decision**:
- `GET /api/v1/open/reports`，全部参数（系统参数 + 业务参数）放在 query；
- 必填：`appKey`、`timestamp`（10 位秒级）、`version=1.0`、`sign`；
- 业务参数：`startDate`、`endDate`（`YYYY-MM-DD`，GMT+8，含当天）、`page`（默认 1）、`pageSize`（默认 50，上限 100）；
- 时间戳容差 ±600 秒；
- appKey/secret 通过 `HAIXIN_APP_KEYS`（JSON 映射）与主 `HAIXIN_APP_KEY`/`HAIXIN_APP_SECRET` 合并后按 appKey 查找，支持新旧凭据并存；未知 appKey 一律 `401`；
- 响应 HTTP 200，`{"code": "0", "message": "success", "data": "<JSON 字符串>"}`；
- `data` 字符串内容：`{"records": [...], "total": n, "page": p, "pageSize": s, "startDate": "...", "endDate": "..."}`；
- 失败也返回 HTTP 200 + 非 `"0"` 的字符串 `code`（与海王口径一致），不返回堆栈。

**Rationale**: 文档明确“将 S4 作为 sign 传入 URL”、`code` 为 string、`data` 为 JSON 字符串；照此实现可让客户按其既有 SDK 解析，降低联调成本。

**Alternatives considered**:
- 复用后台 `ApiResponse`（`code=200`、`data` 为对象）：与客户文档不一致，客户需写分支兼容。
- POST JSON body：签名参数与文档“传入 URL”的描述不符，且客户侧改造成本更高。

## R3. 拉取查询与数据字段

**Decision**: 新增 `report_pull_service.list_reports_for_partner`，独立于用户 RBAC：

```sql
SELECT inspect_base.*, ne.device_name
FROM inspect_base LEFT JOIN ne ON inspect_base.device_id = ne.ne_id
WHERE dept_id = :DEPT_ID
  AND status = 1
  AND inspect_date BETWEEN :start AND :end
ORDER BY inspect_date DESC
LIMIT :page_size OFFSET ...
```

- 起止日期按 GMT+8 自然日：`start 00:00:00` 至 `end 23:59:59`；
- 返回字段：`report_id`、`report_code`、`customer_id`、`device_sn`、`device_name`、`inspect_date`、`total_score`、`status`、`status_text`、`name`、`mobile`、`report_url`；
- `name`/`mobile` 返回**完整值**（澄清结论），后端日志与推送记录不得记录；
- 报告链接复用 `report_service._build_report_url`。

**Rationale**: 复用既有只读链路与 `dept_id` 全局过滤；新增独立函数避免把“后台用户数据范围”误套到合作方拉取上。

**Alternatives considered**:
- 直接调用 `report_service.list_reports`：会应用当前用户 RBAC 并脱敏 PII，与合作伙伴语义不符。
- 另建报告同步表：超出范围，且会引入数据一致性问题。

## R4. 设备回调处理与幂等

**Decision**:
- 公开路由 `POST /api/v1/report-callback/device`，无签名；
- 只依赖 `reportId`（= `inspect_base.report_code`）与 `deviceId`（= `sn_num`）定位；
- 其余字段（`h5Url`、`appCustomerInfo`、`printH5`、`modelType`、`exceptionTab`、`customerType`）接收但不参与定位，不落库；
- 回调在写入/复用推送记录后立即返回 `{"code": 200, "message": "success", "data": {"accepted": true}}`；
- 异步任务查找报告：立即查一次，失败后延迟 `10s / 20s / 30s` 再查，共 3 次重试（跨度约 1 分钟）；
- 仍未定位或报告无效 → 推送记录 `failed`，原因 `report.not_found` / `report.invalid`；
- 幂等：自动推送记录写入 `dedupe_key = report_code`，数据库唯一索引兜底并发；重复回调：
  - 已有 `pending` / `success` / `skipped` → 直接应答“已处理”，不新增记录；
  - 已有 `failed` → 失败时已在同一事务内清空 `dedupe_key`，本次回调新建一条自动记录并调度，原失败记录保留（满足 FR-003 只追加不覆盖）；
  - 同一 `reportId` 的自动失败记录达到 `HAIXIN_AUTO_MAX_FAILED_ATTEMPTS`（默认 3）后 → 直接应答“已处理”，不再新建，避免无签名回调被反复触发导致记录膨胀；
- 已有成功推送（人工或自动）→ 自动任务写入 `skipped` 记录，不实际投递；
- 人工推送记录 `dedupe_key = NULL`，不受唯一约束，可重复补发。

**Rationale**: 设备回调必须快速应答；报告数据由设备侧另行写入旧库/Mongo，存在秒级时差，重试是必要的。唯一索引是并发下唯一可靠的幂等手段，且不需要引入锁或队列。

**Alternatives considered**:
- 在请求内同步等待客户接口：设备会超时重试，放大重复流量。
- 纯应用层“先查后写”：并发回调下会产生重复投递。
- 单独的回调事件表：与推送记录重复；澄清已确认不建。

## R5. 异步投递机制

**Decision**:
- 复用 `main.py` 已有的后台任务模式：`asyncio.create_task`，任务引用存入 `app.state` 防 GC；
- 投递一次，不自动重试客户接口；失败写入 `failed`（含超时/HTTP 错误/业务码非 `"0"`/响应非法），由运营在推送记录页重发；
- 启动时清扫：把创建超过 5 分钟仍为 `pending` 的记录标记为 `failed`，原因 `delivery.interrupted`，避免进程重启后永久悬挂。

**Rationale**: 项目没有消息队列；引入 Celery/Redis 属于架构变更且无必要。一次投递 + 人工补发与 spec 的“不做无限重试”一致，也避免超时后重试导致客户重复收到。

**Alternatives considered**:
- FastAPI `BackgroundTasks`：与请求生命周期绑定，长任务会拖慢响应；本项目已有 `create_task` 先例。
- 定时轮询扫描 pending 自动重发：会产生重复投递风险，且需要额外的退避策略；超出当前需求。

## R6. 出站推送请求格式

**Decision**:
- `POST` + `application/x-www-form-urlencoded`，系统参数与业务参数同在一份参数表；
- 系统参数：`appKey`、`timestamp`、`version=1.0`、`sign`；
- 业务参数默认名：`reportId`、`customerId`、`deviceSn`、`inspectDate`、`totalScore`、`reportUrl`；
- 字段名通过 `HAIXIN_PUSH_FIELD_MAP`（JSON）覆盖，联调不改代码；
- 超时 `HAIXIN_PUSH_TIMEOUT_SECONDS=5`；
- 成功判定：HTTP 2xx 且响应 JSON 的 `code` 为 `"0"`（兼容数字 `0`）；
- 响应摘要截断 500 字符写入推送记录，不记录 secret、签名原文以外的敏感信息；
- `HAIXIN_PUSH_ENABLED=false` 时拒绝发送并记失败（防止未配置环境误发）。

**Rationale**: 参数表 + 签名与文档模型一致；表单编码对客户最通用。推送契约尚未提供，字段映射把不确定性限制在配置层。

**Alternatives considered**:
- JSON body：签名覆盖 JSON 字段也可行，但客户文档以参数表描述，表单更贴近。
- 硬编码字段名：联调会反复改代码。

## R7. 推送记录与应用内权限

**Decision**:
- 新表 `sa_report_push_log`（详见 data-model.md）；
- 菜单：启动时在既有“检测报告”菜单同级插入“推送记录”（`/report/push-records`），幂等，`seed_admin_role` 随后自动授权；
- 接口：
  - `POST /api/v1/reports/{report_id}/push`（人工，同步 ≤5s）；
  - `GET /api/v1/reports/push-records`（筛选、分页）；
  - `POST /api/v1/reports/push-records/{log_id}/repush`；
- 所有管理端接口沿用 `Depends(check_permission)`；
- 既有 `check_permission` 不校验具体路径，只校验角色是否拥有对应动作。因此人工推送与记录查询在服务层额外校验报告所属设备是否在用户的组织数据范围内（admin 除外），防止越权操作。

**Rationale**: 不改造既有 RBAC 机制（超出范围），但用数据范围校验补上本次新增写操作的风险。

**Alternatives considered**:
- 修改 `check_permission` 为路径级校验：影响所有既有接口，回归面过大。
- 不校验数据范围：会允许有 `add` 权限的用户推送任意报告。

## R8. 前端实现

**Decision**:
- `ReportList.vue` 操作列新增“再次推送”，行内 loading，成功/失败用 `ElMessage` 提示；失败原因来自后端 `message`；
- 新增 `ReportPushLog.vue`：时间范围、结果、触发方式、设备 SN 四类筛选 + 分页；失败原因可展开；行内“重发”；
- 路由 `/report/push-records` 增加 `permission.meta`，与 AI 咨询页面一致；
- API 封装加入 `src/api/reports.ts`；文案加入三套 i18n；
- 前端测试：Vitest 覆盖 API 参数映射与筛选参数组装（现有后台前端无测试目录，本次按最小范围补齐）。

**Rationale**: 与现有 Element Plus 页面风格一致，复用既有组织树/分页模式，不引入新组件库。

## R9. 测试策略（TDD）

**Decision**:
1. 单元：签名黄金用例（文档示例）、参数排序/空值剔除、时间戳容差；
2. 服务：报告定位重试、幂等（success/pending/failed/skipped）、客户返回非 `0`、超时、字段映射；
3. API：人工推送（鉴权、数据范围、成功/失败记录）、回调（快速应答、重复、非法载荷）、拉取（签名、过期、范围、分页、完整 PII）；
4. 前端：API 层参数映射、推送记录筛选参数；
5. 回归：`pytest`、`npm run build`、既有 `test_reports.py`/`test_report_view.py` 全绿；
6. 人工联调：按 quickstart 用 curl/脚本验证签名拉取，用 mock 服务验证出站推送。

**Rationale**: 先写红测再实现，符合 constitution  Principle I；签名与幂等是本功能最容易出错的点，必须有确定性断言。

## R10. 已知风险与部署要求

| 风险 | 缓解 |
|------|------|
| 海王推送接口正式契约未提供 | 字段映射与地址配置化；联调只改 `.env` 与 `HAIXIN_PUSH_FIELD_MAP` |
| 回调接口无签名，可被任意来源触发 | 部署层 nginx 限制来源 IP + 频控；应用层幂等与推送记录兜底 |
| 旧库 `inspect_date` 索引未知，31 天拉取可能慢 | 分页上限 100；上线前用真实数据执行 EXPLAIN；必要时只允许更短区间 |
| 客户接口超时但实际已收到 | 不自动重试；运营可在推送记录页人工补发，并参考客户回执 |
| 报告数据晚于回调写入 | 10s/20s/30s 重试；仍失败则可见并可人工补发 |
| `check_permission` 路径无关 | 新增写操作在服务层校验组织数据范围 |
