# Quickstart: 检测报告推送、回调与主动拉取

**Date**: 2026-11-13 | **Plan**: [plan.md](plan.md)

## 1. 配置（仅 `.env`，不入库、不入仓库）

```dotenv
# 海王接入（联调前替换占位符）
HAIXIN_APP_KEY=your-app-key
HAIXIN_APP_SECRET=your-secret
# 轮换期可同时登记新旧凭据（仅用于入站拉取验签）
# HAIXIN_APP_KEYS={"old-app-key":"old-secret"}
HAIXIN_AUTO_MAX_FAILED_ATTEMPTS=3
HAIXIN_PUSH_URL=https://partner.example.com/open/report/push
HAIXIN_PUSH_ENABLED=false          # 联调时再置 true
# HAIXIN_PUSH_METHOD=POST
# HAIXIN_PUSH_FIELD_MAP={"report_code":"reportNo"}

# 拉取限制（默认值即可）
HAIXIN_SIGN_TOLERANCE_SECONDS=600
HAIXIN_PULL_DEFAULT_DAYS=1
HAIXIN_PULL_MAX_DAYS=31
HAIXIN_PULL_DEFAULT_PAGE_SIZE=50
HAIXIN_PULL_MAX_PAGE_SIZE=100
```

> `backend/.env` 含生产数据库凭据，注意不要提交；新增的 `HAIXIN_*` 必须显式声明在 `app/config.py`（`BaseSettings` 对未知键严格）。

## 2. 建表

新增 revision `010_report_push_log`。仓库默认 `alembic.ini` 不指向 `nepstar`，**不得直接运行默认 `alembic upgrade head`**，也不要用 `stamp` 掩盖缺失结构。

选择其一：

1. 由 DBA 审核并执行 [data-model.md](data-model.md) 中的 `CREATE TABLE`；
2. 使用经审阅的专用迁移 runner，确认连接库与版本表都是 `nepstar` 后执行 `010`。

上线前用 `scripts/deploy_check.py` 核对表与索引存在。

## 3. 启动

```bash
cd nepstarAdmin/backend
./start-dev.sh          # 或 bash start-dev.sh -d

cd ../frontend
npm install
npm run dev
```

启动时自动幂等登记 `/report/push-records` 菜单，管理员角色自动获得权限。

## 4. 冒烟验证

### 4.1 设备回调

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/report-callback/device \
  -H 'Content-Type: application/json' \
  -d '{
    "reportId": "KH503LS0005835V261106093253957",
    "deviceId": "KH503LS0005835V",
    "h5Url": "http://kj101.jiankangzhan.com/common.html?reportId=KH503LS0005835V261106093253957&customerId=15418089",
    "appCustomerInfo": "{\"userName\":\"测试\",\"mobile\":\"13800000000\"}",
    "modelType": 30
  }'
```

预期：立即返回 `{"code":200,...,"data":{"accepted":true,...}}`；`HAIXIN_PUSH_ENABLED=true` 时后台异步投递；重复执行同一请求不应产生第二次投递。

### 4.2 本地 mock 客户接口

```python
# mock_partner.py —— 仅本地联调用，放在临时目录
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n).decode()
        print("RECEIVED:", body, flush=True)
        payload = json.dumps({"code": "0", "message": "success", "data": None}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

HTTPServer(("127.0.0.1", 9999), H).serve_forever()
```

```bash
python -I mock_partner.py
# .env: HAIXIN_PUSH_URL=http://127.0.0.1:9999/push, HAIXIN_PUSH_ENABLED=true
```

### 4.3 人工再次推送

1. 打开 `http://localhost:5173/report/list`；
2. 在有效报告行点击“再次推送”；
3. 预期 5 秒内出现成功/失败提示；失败原因可在 `/report/push-records` 查看。

### 4.4 客户拉取（签名）

```python
import hashlib, time, urllib.parse, httpx

APP_KEY, SECRET = "your-app-key", "your-secret"
params = {
    "appKey": APP_KEY,
    "timestamp": str(int(time.time())),
    "version": "1.0",
    "startDate": "2026-11-06",
    "endDate": "2026-11-13",
    "page": "1",
    "pageSize": "50",
}

def sign(p: dict) -> str:
    items = sorted((k, v) for k, v in p.items() if v not in (None, ""))
    s2 = "&".join(f"{k}={v}" for k, v in items) + f"&secret={SECRET}"
    return hashlib.sha1(hashlib.md5(s2.encode()).hexdigest().upper().encode()).hexdigest().upper()

params["sign"] = sign(params)
r = httpx.get("http://127.0.0.1:8000/api/v1/open/reports", params=params)
print(r.status_code, r.json())
```

预期：

- `code == "0"`；
- `data` 为字符串，`json.loads(data)` 后含 `records`、`total`、`startDate`、`endDate`；
- 篡改任意参数或把 `timestamp` 改成 20 分钟前 → `code == "401"`。

### 4.5 推送记录页

打开 `http://localhost:5173/report/push-records`：

- 按“失败”筛选能看到上述失败记录；
- 点击“重发”新增一条 `manual` 记录；
- 非管理员账号未授权时不可访问。

## 5. 自动化测试

```bash
cd nepstarAdmin/backend
pytest tests/unit/test_haixin_sign.py tests/api/test_report_push.py \
       tests/api/test_report_callback.py tests/api/test_report_pull.py -q
pytest -q                      # 回归
ruff check app tests

cd ../frontend
npm run test                   # Vitest
npm run build                  # vue-tsc + vite build
```

## 6. 关键验收点

| 项 | 预期 |
|----|------|
| 签名黄金用例 | `5F366AE0295C45AE78B11FC022199FBB0E5D4239` |
| 人工推送超时 | 5 秒内返回 `failed` / `delivery.timeout` |
| 回调应答 | <500ms，且重复回调不重复投递 |
| 回调早于数据 | 10s/20s/30s 重试后失败可见 |
| 拉取区间 | 31 天内全部有效报告，翻页无丢失 |
| 拉取鉴权 | 签名错误/过期一律 `401`，无数据泄露 |
| 回归 | 既有报告列表与报告展示测试全绿 |
