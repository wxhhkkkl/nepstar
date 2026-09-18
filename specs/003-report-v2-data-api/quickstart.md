# Quickstart: 报告展示数据接口

**Feature**: `003-report-v2-data-api`

本文件说明如何本地起服务、跑测试、手工验证两个报告展示接口。

---

## 前置条件

| 依赖 | 说明 |
| --- | --- |
| 后端 venv | `nepstarAdmin/backend/.venv`（已存在，含 pytest / httpx / aiomysql / pymongo） |
| 后端 `.env` | 已配置 `DATABASE_URL`（旧库 platform）、`NEPSTAR_DATABASE_URL`（sa_* 库）、`MONGODB_URL`（报告文档）。**含生产库凭据，禁止提交** |
| 新增依赖 | `motor`（MongoDB 异步驱动），需 `pip install -r requirements.txt` |
| MongoDB 白名单 | 报告文档是阿里云副本集，**必须在控制台为其实例配置本机公网出口 IP**，否则连接会被代理层立即断开（表现为 TCP 可连但收到 EOF） |
| Node | `reportFront/report-v2` 需要 Node `^22.18.0 || >=24.12.0` |

> **注意**: 后端配置的 `DEPT_ID=225721` 在旧库报告表中零记录（用户确认为预期）。但**报告文档侧不受此影响**——MongoDB 的 `reportV2Info` 有大量真实报告，可直接用于验证。端到端验收只需一份可用的报告编号。

---

## 1. 后端:迁移与种子

```bash
cd nepstarAdmin/backend
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m alembic upgrade head
```

本特性新增 revision `004`：`sa_indicator` 增加 `target_id`（含唯一约束）与四个报告文案列。

`backend/sql/seed-report-target-ids.sql` 把 10 个旧一级系统的 `targetId`（3087/3095/3108/3115/3127/3135/3143/3163/3195/3244）登记到相应指标上。**该脚本内容依赖尚未确认的 V2 展示口径**，确认后补全。

## 2. 后端:启动与测试

```bash
cd nepstarAdmin/backend

# 启动（默认 0.0.0.0:8000）
./start-dev.sh start

# 单元测试（服务层与数据源层，不连真实数据源）
.venv/Scripts/python.exe -m pytest tests/unit -q

# 接口测试（会连真实数据源，见 tests/api/ 的说明）
.venv/Scripts/python.exe -m pytest tests/api -q

# 覆盖率 / 静态检查
.venv/Scripts/python.exe -m pytest --cov=app -q
.venv/Scripts/ruff.exe check .
```

> 新增的接口测试请使用 `tests/api/health_helpers.py` 的 `make_client()`，不要用 conftest 的 `client` fixture——前者为每个测试建独立 engine 并在同一个事件循环里释放，规避 Windows 下 proactor 事件循环的连接缓存崩溃。

## 3. 手工验证接口

```bash
# 首页（成功路径）
curl "http://127.0.0.1:8000/api/v1/report-view/<REPORT_CODE>/home?customer_id=<CUSTOMER_ID>"

# 系统详情
curl "http://127.0.0.1:8000/api/v1/report-view/<REPORT_CODE>/systems/SYS_BONE?customer_id=<CUSTOMER_ID>"

# 错误路径（报告不存在 / 客户不匹配，应返回同一 message）
curl "http://127.0.0.1:8000/api/v1/report-view/NOPE/home?customer_id=1"
curl "http://127.0.0.1:8000/api/v1/report-view/<REPORT_CODE>/home?customer_id=999999"
```

两条错误路径必须返回**完全相同**的 `code` 与 `message`（都是 `report.not_found`），差异只体现在后端日志里。

## 4. 前端:接入与验证

```bash
cd reportFront/report-v2
nvm use
npm install

npm run test        # vitest 单元/组件
npm run test:e2e    # playwright 端到端
npm run build
npm run dev -- --host 0.0.0.0
```

> `playwright.config.js` 的 `webServer.command` 里写死了 macOS 的 Node 路径（`/Users/leelee/.cache/...`）。在非 macOS 机器上跑 `npm run test:e2e` 前需要先把它改成本机的 `node node_modules/vite/bin/vite.js`。

前端接入后需要验证：

- 接口可用时页面展示接口返回的真实数据；
- 接口返回任一错误时展示对应错误状态，**不回退到模拟数据**（FR-043）；
- `src/data/report.js` 中的业务值已移除，`tests/unit/` 的断言改为基于 fixture。

## 5. 端到端验收路径

1. 在"健康管理 → 指标管理"给某个二级指标登记 `targetId`（如 3116），保存。
2. 请求该报告的首页，确认该系统与指标得分与报告文档中对应 `targetId` 的值一致。
3. 改动 `report_summary` 文案，重新请求，确认报告输出随之变化且未发版（SC-016）。
4. 进入系统详情，比对 `score` / `status_text` / `summary` / `visualization` / `recommendation` 与首页返回的同一系统完全一致（SC-002）。
5. 用男性报告与女性报告各请求一次，确认生殖系统下返回的二级分支随性别变化（SC-004）。
6. 用另一客户的 `customer_id` 请求同一报告，确认被拒且 message 与"报告不存在"相同（SC-006、SC-007）。
7. 断开 MongoDB 连通性（或填错 `MONGODB_URL`），确认返回 `report.unavailable` 而非 `report.not_found` 或残缺报告（SC-014）。
