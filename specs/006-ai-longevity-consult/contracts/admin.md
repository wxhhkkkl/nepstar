# Contract: 管理后台 AI 咨询 API 与页面

路径 `/api/v1/admin/ai-consult`。沿用现有管理端登录 JWT，但每个接口须按 `/health/ai-consult/settings` 或 `/health/ai-consult/overview` 的**具体菜单与动作**校验权限；现有“拥有任一菜单动作即可”的通用判定不能直接作为发布权限。响应沿用 `{code,message,data}`，错误同时给正确 HTTP 状态。

## 管理页面

| 页面 | 首屏信息 | 可操作项 | 权限 |
| --- | --- | --- | --- |
| `/health/ai-consult/settings` AI 咨询配置 | 服务状态、服务商/模型、密钥是否已配置、每匿名会话额度、全局每日 token/并发上限、告知版本、当前规则版本 | 开关、额度与维护文案；保存草稿、发布/回退规则 | 查看/编辑/发布分别授权 |
| `/health/ai-consult/overview` 运行概览 | 今日/时间段问答量、完成率、首段耗时、实际 token 用量、失败原因、反馈分布 | 时间筛选、汇总查看 | 查看权限 |

布局沿用管理端现有 Element Plus 样式。配置页先显示服务状态与最近发布信息，再显示基础配置和规则版本；避免在一张表单里同时暴露大量底层模型参数。概览页只提供汇总，不显示姓名、手机号、报告编号或聊天正文列表。

## API

| 方法与路径 | 行为 |
| --- | --- |
| `GET /settings` | 返回非敏感配置、`credential_state: configured/missing`、当前规则及 `row_version`，不返回密钥 |
| `PUT /settings` | 输入开关、模型 allowlist 编码、每 guest 额度、`global_daily_token_limit`、`max_concurrent_generations`、维护文案、`row_version`；冲突返回 409；写审计 |
| `GET /rules` | 分页返回版本、状态、作者与时间；只有授权者可读取规则正文 |
| `POST /rules` | 新建草稿，版本唯一，服务端校验禁用覆盖既有报告事实的规则 |
| `POST /rules/{id}/publish` | 精确发布权限；仅发布有效草稿，更新 settings 指针并写审计 |
| `POST /rules/{id}/activate` | 回退到既有已发布版本，写审计，不覆盖旧版本内容 |
| `GET /overview?from=...&to=...` | 返回按日汇总的成功/失败数、完成率、首段耗时分位数、token 用量、反馈数量；无聊天正文 |
| `GET /audit` | 仅授权者查看配置及规则操作记录，不含健康会话正文 |

服务凭据仅由部署环境或密钥服务注入；后台不得回显、下载或通过 JSON 响应传递。若未来要在页面轮换密钥，需要另立需求和权限设计。配置修改只影响后续生成；回答记录引用实际使用的规则版本。

## 验证边界

- 未授权用户对配置发布、规则发布和运行数据分别收到 403；普通已登录管理员不自动获得发布权限。
- 关闭服务后新问答返回 `consult.disabled`，已完成聊天仍可凭当前 guest 凭证阅读。
- 用量统计按真实 generation 尝试累计；每匿名会话额度按 completed turn 计，不能因重试重复扣减。重新开标签页可以获得新 guest，因此还需全局成本/并发保护。
- 发布规则、改变服务商或告知范围时，按新版本判断是否需要重新征得当前匿名访问者同意。
