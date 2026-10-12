# AI 长寿咨询：本地交付与发布收尾

更新：2026-10-12。结论：当前可在本地完成的代码、回归和文档收尾已完成，尚不等于生产发布验收完成。本次没有部署服务器、执行迁移或修改真实数据库。

## 后续增量：后台紧急启停（2026-10-12）

设置页新增独立“前台 AI 咨询开关”，修复后台保存强制关闭和运行状态硬编码不可启用的问题。数据库总开关仍默认关闭；未设置的部署开关委托后台，显式 false 仍为硬禁用。额度保存不影响启停，切换须确认、编辑权限、行版本及审计；暂停/恢复之间的旧生成由既有暂停审计主键栅栏拦截，不新增表或迁移。报告端保留当前对话并禁用发送/重试，已发送模型请求不保证立即取消或退款。

增量后验证：后端 694、管理端 68、报告端 158、移动 Chrome mock E2E 36 项通过；管理端合成 Chrome 启用/暂停/冲突、类型检查及两端临时构建通过。见 [启停验证摘要](evidence/service-control-2026-10-12.json)。以下首次收尾数字作为之前的回归快照保留。真实 MySQL 竞争、T061/T063/T065 状态不变。

线上报告使用线上 API 时，须部署新版后端并使用连接同一 API 的后台；本地开关不能控制线上。部署旧配置中显式 false 需负责人解除并重启 worker，之后日常后台启停无需重启。详见 [部署说明](deployment.md)。本次未修改真实开关或 `.env`，未重启持久服务、部署或覆盖项目 dist。

## 本次完成

- 同步当前可选处理选择契约：可用时直接展示输入框，bootstrap 不返回 `notice/consent_status`，新会话允许 `consent_id=null`；前端和验收工具都不自动替访问者记录同意。不存在选择记录不代表已取得授权。
- 补齐兼容选择记录的保护：最新明确撤回阻断新会话、发送、重试、轮次读取和反馈；生成期间撤回则提交失败终态、保留实际用量或未知预留，不保存或发布回答正文与依据。
- 补齐旧会话发送、幂等重放、重试和反馈拒绝，以及生成完成前的最新会话核对。当前页仍可断线核对；刷新/重入空白新咨询、报告端无历史、后台永久留存的规则不变。
- 补齐 008 迁移护栏：只允许 `nepstar`，仅改变会话关联的可空性，不删除既有记录；存在空关联时拒绝降级，不自动修补或删数据。
- 修复移动输入文字样式：输入为 16px，placeholder 保持 14px、浅色与普通字重，保留左右内边距。
- 运行概览已有四张统计卡、北京时间日/月 token 趋势、筛选分页会话列表、独立授权和审计后的完整问答详情；本次全量管理端测试再次通过。

## 本次验证证据

| 验证 | 结果 | 实际范围 |
| --- | --- | --- |
| AI 后端及本地运行边界专项 | 674 passed | fake session、内存数据库、mock provider；不导入公共数据库夹具 |
| 报告端单元/组件 | 156 passed | 全量 Vitest |
| 管理端单元/组件/路由 | 63 passed | 全量 Vitest |
| 移动端浏览器 | 35 passed | Chrome，模拟移动尺寸；合成 API / 本机 SSE，不是物理手机 |
| 集成入口护栏 | 6 passed、2 deselected | 只跑安全护栏；真实外部只读与 MySQL 竞争测试明确未执行 |
| 浏览器代理 Node 护栏 | 5 passed | 临时本机服务与合成数据 |
| 管理端类型检查、两端生产构建 | 通过 | 临时目录产物，不覆盖仓库 `dist` |

完整范围摘要见 [本地回归记录](evidence/local-regression-2026-10-12.json)。既有 UTC 弃用提示及管理端第三方注释/大包提示不阻断本次测试和构建；本次未进行依赖升级。

复跑后端（在 `nepstarAdmin/backend`）：

```sh
.venv/bin/python -m pytest --noconftest tests/unit/test_ai_consult* tests/api/test_ai_consult* tests/unit/test_local_ai_policy.py tests/unit/test_local_ai_runtime.py tests/unit/test_configure_local_ai.py tests/unit/test_report_plan_source.py -q --tb=short
```

两端分别在各自目录运行 `node node_modules/vitest/vitest.mjs run --reporter=dot`。管理端类型检查为 `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`。移动端复跑（在 `reportFront`，需要本机监听和 Chrome 权限）：

```sh
node node_modules/@playwright/test/cli.js test tests/e2e/ai-consult-welcome.spec.js tests/e2e/ai-consult-mobile.spec.js tests/e2e/ai-consult-limits.spec.js tests/e2e/ai-consult-evidence.spec.js tests/e2e/ai-consult-http-stream.spec.js --workers=1
```

上述命令不包括真实数据库集成测试。不要移除其 opt-in、目标库和合成报告护栏来凑通过数；也不要改用会加载应用真实数据库配置的公共 `tests/conftest.py`。

## 仍需外部条件的发布门槛

1. **T061：真实只读隔离验收。** 需要独立 staging MySQL/Mongo 只读账号和 `AI-CONSULT-TEST-*` 合成报告，在 [现有集成入口](../../nepstarAdmin/backend/tests/integration/test_ai_consult_read_only.py) 取得全链路命令零写证据。不得使用现有生产凭据回退，其他库永远只读；凭据通过受控本地配置提供，不贴入聊天或文档。
2. **T063：部署代理、真机性能与网络故障。** 按用户决定留到上线前，当前不部署、不做线上故障注入。既有本机真实联调证据只证明当时环境；本次 mock 浏览器回归不替代该验收，也不撤销已完成的 T045 手机自测。
3. **T065：正式数据处理与告知/授权方案验收。** 运营主体“海王星辰”和联系邮箱已写入须知草案，T027 代码/草案交付状态不变。仍需负责人核验实际 API 数据处理约定、公开报告访问者的有效授权路径、权利请求处理和正式告知发布方案。当前无强制弹层、预检通过或缺少选择记录都不证明已取得生产处理授权；当前 optional 契约不能通过“未勾选一律拒绝”的旧用例验收。
4. **真实状态一致性与运维验证。** 隔离 MySQL 多进程重试/停止/完成/新会话竞争、额度一致性、实际 RBAC 撤权和详情审计、备份恢复及告警需要真实环境记录；不能以 SQLite/fake 锁替代。最新会话检查刻意不在 settings 锁后再锁第二个 session，以避免锁顺序反转；MySQL 隔离级别和并发重入窗口仍需真实测试。
5. **真实报告与回答质量。** 合成依据/安全样本已通过，但仍需要真实报告抽样核对和代表性提供方回答的专业审核。不能将离线规则通过宣称为专业审核通过。

真实环境操作须先确认精确目标、隔离权限、备份及执行范围。默认 `alembic.ini` 不指向 `nepstar`，不能直接运行默认 `upgrade head`。008 本次仅完成代码与护栏回归，未在任何实例上执行；参见 [部署手册](deployment.md)。

## 构建与交付边界

本机 `.env.local` 的 API 前缀适用于本地代理。此次报告端临时生产构建显式指定 `VITE_API_BASE_URL=https://nepstar.kangjia.online/api/v1`，避免本地配置进入生产产物；未修改 `.env.local`。正式发布应使用审核后的构建环境，并检查产物实际前缀。

本次没有真实模型请求、真实数据库连接/写入、迁移、配置修改、持久服务重启、清理作业、Git 提交/推送或发布。临时测试服务已随测试结束退出。问答永久留存，不新增清理任务；代码进入现有分支工作区，已有未提交改动保留。
