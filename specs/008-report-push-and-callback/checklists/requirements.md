# Specification Quality Checklist: 检测报告推送、回调与主动拉取

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- `/speckit.specify` 阶段 3 项澄清已完成（2026-11-13）：
  1. FR-002：推送内容 = 报告基础摘要 + 报告链接（报告编号、客户编号、设备 SN、检测时间、总分、报告 URL）。
  2. FR-005：回调载荷 = 仅报告定位信息，报告内容从既有只读数据源读取。
  3. FR-010 / FR-010a：拉取接口使用海王分配的 appKey/secret 签名校验；设备回调不签名，依赖部署层来源限制与幂等。
- `/speckit.clarify` 阶段 5 项澄清已完成（2026-11-13）：
  1. 人工推送同步等待（约 5 秒超时），自动推送先应答回调再异步投递（FR-004、FR-006、SC-001）。
  2. 海王推送接口契约未定，本期做可配置外发，联调时只改配置（FR-002、Assumptions）。
  3. 对外拉取响应采用海王口径 `code=0`，后台管理接口维持 `code=200`（FR-013a）。
  4. 回调早于报告数据可查时，有限次延迟重试（约 3 次、1 分钟内），仍失败则记录并可见（FR-007）。
  5. 新增独立“推送记录”页面与菜单，支持筛选与重发（US4、FR-020~FR-023）。
- 第二轮 `/speckit.clarify` 4 项澄清已完成（2026-11-13）：
  1. 拉取接口用 GET + query，签名覆盖全部非空参数，基于原始值计算（FR-009、FR-010）。
  2. 拉取返回时间范围内全部有效报告，不按推送结果过滤（FR-013）。
  3. 回调沿用设备侧现有格式（reportId/deviceId/h5Url/appCustomerInfo 等），以 reportId 幂等，个人信息不落盘（FR-005、FR-006）。
  4. 拉取返回完整姓名与手机号，推送内容不含 PII；日志与推送记录不记录（FR-013、FR-014、Edge Cases）。
- 第三轮 `/speckit.clarify` 3 项澄清已完成（2026-11-13）：
  1. 不单独建回调事件表，回调结果写入推送记录（FR-007、Key Entities）。
  2. 同一 reportId 已有成功推送记录时，自动推送跳过；人工推送仍强制发送（FR-006、SC-003）。
  3. 拉取响应 `data` 为 JSON 字符串，严格遵循海王文档（FR-013a）。
- 全部 17 项通过，可进入 `/speckit-plan`。
- 计划阶段已定值：拉取单页默认 50、上限 100；客户投递失败不自动重试（人工补发）；同一 reportId 自动失败上限 3 条；报告定位重试 10s/20s/30s；推送记录表 `sa_report_push_log` 与迁移 `010`；菜单 `/report/push-records` 幂等登记。
- 凭据轮换：主 `HAIXIN_APP_KEY/SECRET` + `HAIXIN_APP_KEYS` 映射，拉取验签支持新旧并存。
