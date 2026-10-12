# AI 长寿咨询真实环境验收

## HTTP/SSE 测量工具（T063）

入口：`nepstarAdmin/backend/scripts/ai_consult_live_acceptance.py`。工具直接读取 HTTP 流，记录从发送提问到 `accepted`、首个已审校 `delta` 和 `completed` 的 P50/P95/P99；服务端 `consult.timeout` 另记耗时。不导入应用、不加载 `.env`、不连接数据库、不调整额度或开关。

`tests/fixtures/ai_consult_load.example.json` 是 20 个输入格式示例，不表示对应报告已经存在。执行人须提供已由数据源负责人准备的独立合成报告及客户号，每份包含 `SYS_LUNG_SLEEP_BREATHING` 指标；只能使用 `AI-CONSULT-TEST-*` 编号。不得将真实报告改名后当作合成报告，也不得由此工具向其他 MySQL/Mongo 库创建资料。

在 backend 目录先检查输入；默认不发出网络请求：

```sh
.venv/bin/python scripts/ai_consult_live_acceptance.py \
  --base-url http://127.0.0.1:8000 \
  --fixtures tests/fixtures/ai_consult_load.example.json
```

输入准备完成后，显式执行本机或隔离环境测量。下面的 HTTPS 地址须换为实际隔离环境；非本机地址必须与 `--staging-host` 精确匹配，不能包含用户名、密码、路径或查询参数：

```sh
.venv/bin/python scripts/ai_consult_live_acceptance.py \
  --base-url https://staging.example.invalid \
  --staging-host staging.example.invalid \
  --fixtures /absolute/path/to/synthetic-fixtures.json \
  --run --confirm SYNTHETIC_STAGING_ONLY
```

一次执行最多建立 20 个报告绑定的咨询上下文/会话，同时发送最多 20 个问题、触发最多 20 次模型调用。问题固定为解释虚构资料；会产生服务商费用和 `nepstar` 中永久保留的合成咨询记录。不重试、不删除记录、不修改服务端模型、配置、限流或预算。有任一样本准备失败，就不发出任何问题；已创建的上下文/会话仍保留。额度不足会记录为失败，不能排除限流样本后宣称通过 20 并发。

准备阶段每个样本最多 30 秒；提问到终态最多等待 65 秒。客户端超时只断开测量连接，不保证服务端或服务商立刻停止，后台仍依既有恢复机制处理。验证服务端 60 秒超时须在独立验收环境安排可控的慢提供方场景；工具不会向普通应用新增故障注入参数。

输出聚合 JSON，不含凭证、报告编号、客户号、问题、回答或证据文本。每个流核对会话/轮次/生成编号、连续序号、证据所属报告/客户及最终正文与收到片段一致。提前断流、串报告和终态错误单独计数；成功耗时不混入失败样本。`client_in_flight_peak` 只是客户端在途峰值，不能证明模型同时推理 20 路。

`status=passed` 和退出码 0 表示所请求的合成流完成且协议检查通过；`http_p95_targets_met` 分别比较 1/10/45 秒 HTTP 计时目标。`release_accepted` 始终为 false。HTTP `accepted` 不代表手机界面可见反馈；真机点击到更新的计时、代理缓冲和模型实际并发须另存证据。少于 20 个样本时 `trial_target_sample_count_met=false`。T063 只有真实 MySQL、实际模型、部署代理和真机证据齐全后才能勾选。

## 外部数据源只读验证（T061）

`tests/integration/test_ai_consult_read_only.py` 只读取显式指定的合成 staging 报告，不回退应用 `.env`。由数据源负责人在本机私密环境中注入以下变量；不要将连接串或密码放进聊天、命令参数或验收记录：

- `AI_CONSULT_READONLY_TEST_CONFIRM=READ_ONLY_STAGING_ONLY`
- `AI_CONSULT_READONLY_MYSQL_URL`：显式 `mysql+aiomysql`、主机、端口和非 `nepstar` 测试库；账号只能有 SELECT/USAGE。
- `AI_CONSULT_READONLY_MONGO_URI`、`AI_CONSULT_READONLY_MONGO_DATABASE`、`AI_CONSULT_READONLY_MONGO_COLLECTION`：认证账号只能有指定测试库的内置 `read` 角色。
- `AI_CONSULT_READONLY_REPORT_CODE`：已存在的 `AI-CONSULT-TEST-*` 合成报告。
- `AI_CONSULT_READONLY_CUSTOMER_ID`：该合成报告对应的正整数测试客户号。

```sh
.venv/bin/python -m pytest --noconftest tests/integration/test_ai_consult_read_only.py -q
```

没有显式变量时真实集成跳过；不完整配置和真实报告编号拒绝执行。成功时 `pytest -s` 可输出固定 `READ_ONLY_ACCEPTANCE=` 摘要，仅包含 MySQL 只读命令数、Mongo 命令数、双方写命令数和报告路径验证状态；其他子进程日志不转发。摘要缺失/重复、命令数不足、任何写命令或未知字段均拒绝通过。保留该脱敏摘要作为真实运行证据，跳过不是完成。本地只读护栏 5 项通过，真实 staging 集成仍跳过。

## 本机真实 MySQL + 模型测量（2026-10-10）

新增 `scripts/ai_consult_local_load.py`，使用真实咨询路由、行锁/准入、证据审校、SSE 和本机 `127.0.0.1:3306/nepstar`。报告读接口只提供内存虚构数据；不用其他 MySQL/Mongo，也不读取真实报告。临时服务只绑定 loopback 随机端口，结束后退出，现有 8000 服务不变。不开普通应用 lifespan，不运行播种、迁移、清理或部署。

```sh
# 默认只验证输入，不读取应用配置或联网。
.venv/bin/python scripts/ai_consult_local_load.py --samples 20

# 显式实际调用；会计费并留下永久合成咨询记录。
.venv/bin/python scripts/ai_consult_local_load.py --samples 20 --run --real-model

# 单请求取证故障注入：等待普通 60 秒 deadline，不调用外部模型。
.venv/bin/python scripts/ai_consult_local_load.py --samples 1 --scenario timeout --run

# 单请求模型等待故障注入：验证默认 20 秒模型保护，不调用外部模型。
.venv/bin/python scripts/ai_consult_local_load.py --samples 1 --scenario provider_timeout --run
```

实际运行前先核验当前已批准的本机 `local-browser-v1` 策略、模型匹配和没有运行中咨询。并发、全局 token 和入口额度只在该临时进程以 committed ORM 值覆盖，flush 禁止持久修改策略字段；结束后用普通本机连接再次对比全部受保护配置。其他连接设为不可用的本机目标，虚构读接口拒绝不匹配的报告/客户。提供方最多调用样本数次，无重试；只接受 1～20。常规浏览器的并发上限未被调高。故障模式只接受一个样本，替身仅异步等待，不触达外部模型；分别验证默认 20 秒模型等待和 60 秒整个候选准备 deadline，不缩短真实时间，校验取消/错误帧、数据库失败终态、无保存正文和保守 token 预留。

先前测量问题包含“诊断”字样，即使是否定表述也被现有保守安全规则拒绝：该路径模型调用 0。仅修改验收问题为普通演示解释，不改产品安全规则。单次真实模型预跑成功（1.43 秒、提示 555/输出 68 tokens），之后 20 路真实 HTTP 联调完成 20/20，提供方请求在途峰值 20。

| HTTP 测量事件 | P50 | P95 | P99 |
| --- | --- | --- | --- |
| accepted | 232.80 ms | 403.50 ms | 422.01 ms |
| 首个已审核 delta | 1330.65 ms | 1526.83 ms | 1731.79 ms |
| completed | 1330.88 ms | 1527.10 ms | 1732.22 ms |

20 个问题、20 个生成尝试、20 个 completed 均从本机数据库查得；提示 11100/输出 1564 tokens。持久策略全部未改，记录永久保留；不删除失败预跑或合成记录。[脱敏实测摘要](evidence/local-load-2026-10-10.json)只含计数与耗时。短问题、相近提示及服务商缓存可能使本次表现好于代表性问题集；不承诺实际用户均达到该耗时。

首段指安全/依据校验后的用户可见正文，不是提供方首 token；请求在途峰值不证明 DeepSeek 内部同时推理 20 路。该结果验证本机真实存储/模型/HTTP，未经过部署反向代理、未测真机点击到渲染，也不代表外部服务商真的发生过故障。因此 T063 的本机部分已有实证，整体仍不能勾选为生产验收完成。

单请求慢取证源故障已完整等待 60 秒：60051.30ms 收到 `consult.timeout`，取证任务取消一次；查本机 MySQL 为一个问题、一个 failed/timeout attempt、零 completed/运行中/回答正文，外部模型调用 0，持久策略未改。[60 秒脱敏证据](evidence/local-timeout-2026-10-10.json)已保存。未知用量依既有规则保守预留 16384 tokens，这不是外部模型实际消耗；测试记录会进入本机统计与预算、不自动删除。

模型等待保护另测得 20106.46ms 返回 `consult.provider_unavailable`，替身取消一次；本机 MySQL 为一个 failed/provider_unavailable、零 completed/运行中/回答，实际模型请求 0，策略不变。[20 秒脱敏证据](evidence/local-provider-timeout-2026-10-10.json)已保存。此处错误类别与整个候选阶段的 `consult.timeout` 不同，不把两层 deadline 混为一个机制。两组故障均通过真正 HTTP 和 MySQL，只对源/模型等待注入替身，不声称发生真实外部故障。

## 本机 Vue 页面 + 流式代理联验（2026-10-10）

`scripts/ai_consult_local_load.py --browser` 接入 `reportFront/scripts/ai-consult-browser-trial.mjs`。使用项目当前 Vue 页面、真实 FastAPI 咨询路由、本机 MySQL 和已配置 DeepSeek；仍只有内存虚构报告。浏览器只访问临时 loopback 代理，API 转发到临时咨询服务、静态资源转发到本机 Vite，不拦截或伪造 API 响应。代理逐块转发 SSE、禁止其他 API/重试入口，提问硬上限为样本数；浏览器阻止其他网络 origin，子进程只向父进程返回严格白名单的聚合计数/耗时，不输出正文、凭证或来源链接。

先启动当前报告端 Vite，确认开发 API 使用 `/api/v1`；不要改生产默认域名。然后在 backend 目录执行：

```sh
# 默认不联网、不读应用配置，也不会启动浏览器。
.venv/bin/python scripts/ai_consult_local_load.py --browser --samples 20

# 显式调用：最多 20 次真实模型请求，永久保留本机合成记录。
.venv/bin/python scripts/ai_consult_local_load.py --browser --samples 20 \
  --frontend-url http://127.0.0.1:5173 --run --real-model
```

沿用项目 E2E 的已安装 Chrome channel，不下载浏览器、不使用用户现有浏览器配置。每个样本有独立 context，414×740 移动端模拟；全部接受当前告知、准备好固定虚构问题后同时发送。验证页面正文含对应虚构分数/日期、来源链接保留同报告 `userId`、没有横向溢出、每页仅一个问题且不自动重试/查询旧会话。`userId` 是 Vue 对外路由参数，不误用接口内部的 `customerId` 做断言。

计时从真实发送按钮的捕获阶段开始，目标节点在可视区域内并经过两次 `requestAnimationFrame` 后记录：等待反馈、接收状态、首个已审核正文与完成正文。20 页无头并发时关闭后台计时/渲染限速，使窗口可以各自测量；这仅代表本机 DOM 渲染机会，**不是物理手机屏幕绘制、键盘/安全区、真实移动网络或生产反向代理验收**。

实际单次预跑通过，随后 20/20 页面完成；代理请求与提供方请求在途峰值均为 20。首段和完成在同一渲染机会可见，本次两者计时相同，不捏造中间流式动画时长。

| 点击到页面事件 | P50 | P95 | P99 |
| --- | --- | --- | --- |
| 等待反馈 | 22.00 ms | 30.20 ms | 31.60 ms |
| 接收状态 | 625.60 ms | 747.50 ms | 748.00 ms |
| 已审核回答显示 | 2608.80 ms | 2973.90 ms | 3397.30 ms |
| 完成正文 | 2608.80 ms | 2973.90 ms | 3397.30 ms |

查本机 MySQL：20 个问题、20 个生成、20 个 completed、20 个答案，运行中与故障计数均为零；提示 11100/输出 1579 tokens。持久策略未变，没有其他库/真实报告/部署操作。[页面代理实测摘要](evidence/local-browser-proxy-2026-10-10.json)只含计数与耗时。此前浏览器准备失败和来源参数断言失败的预跑不能算通过，也不删除其已保存的合成记录。短问题与相近提示仍不能代表完整健康咨询问题集。

本机代理的单元测试独立证明 accepted 可在 completed 前收到，拦截超额提问及无关 API；HTTP 测试逐条比较 delta/completed 顺序，不使用不同样本的 P95/P50 比较先后。复跑护栏：backend 相关测试命令见既有文件；reportFront 执行 `node --test tests/unit/ai-consult-browser-trial.test.mjs`（需要临时 loopback 端口）。没有新增普通业务故障注入入口或修改页面/业务路由。

## 当前状态（2026-10-10）

用户已确认把线上代理、真机性能及网络故障实测留到上线前进行。现阶段暂缓这三项，不阻塞本地功能开发，不继续执行部署或环境故障操作；T063 仍未完成。进入上线前阶段后，再确认验收环境和操作范围，执行这三项并保存实测证据，不以已有本机模拟/代理结果替代。

HTTP 测量工具、固定合成输入、本机真实模型负载与 Vue/本机代理入口已交付。真实 HTTP/页面 20 路与实际 20/60 秒本机故障计时见上节，不混同 fake HTTP 回归。负载护栏覆盖样本上限、合成范围、配置覆盖不变脏、模型硬上限、故障取消、答案落库/无运行中验证及默认不执行。T061 仍缺实际只读 staging 凭证/已有合成报告；T063 剩部署代理/真机与环境网络故障验收；T065 的待确认资料与服务商询证草稿见 [provider-data-review.md](provider-data-review.md)。

T065 文案子项更新：运营主体“海王星辰”和隐私联系邮箱 `245743255@qq.com` 已按用户提供的信息写入用户须知；不再列为缺失资料。服务商事实、授权及权利请求流程、正式告知发布与零外发验收仍待完成，没有向邮箱发送消息或修改数据库/服务配置。

此前回归 59 passed、1 skipped；新增浏览器/存储护栏后，最新后端专项 71 passed、1 skipped，另 Node 代理护栏 5/5。跳过项是没有显式隔离凭证的 T061 集成。只有既有 `datetime.utcnow()` 弃用提示。本轮补启 Vite，仅监听 127.0.0.1；8000 启动尝试因已有进程占用端口退出，没有替换原进程，授权复核原服务仍为 `status=ok`、`mode=local_ai_isolated`、`ai_enabled=true`。没有修改配置、构建/提交或更新服务器。
