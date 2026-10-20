# 本地报告数据库隧道恢复

本地隔离后端通过 SSH 隧道读取报告 MongoDB 和旧库 MySQL。原 SSH 进程在网络中断、电脑休眠后可能退出，而后端仍然存活，因此健康检查正常也可能返回 `503 report.unavailable`。

`scripts/keep_report_tunnel.py` 为已有本地运行环境恢复隧道：复用原端口，SSH 断开后自动重连，连续失败时以 1、2、4 秒递增重试，最长间隔 30 秒。网络不通时报告仍会暂时不可用，恢复连接后可重新加载页面。

在 backend 目录运行（另开终端并保持运行）：

```bash
.venv/bin/python scripts/keep_report_tunnel.py \
  --state-file /tmp/nepstar-ai-server-check/local-mongo-service.json
```

运行前确认旧隧道已退出，且没有同一脚本的其他实例。状态文件必须来自当前隔离后端，并在同目录保留原 `known_hosts` 和 `askpass.py`；不要重新生成端口，否则现有后端仍会连接原端口。脚本只绑定 `127.0.0.1`，保留 SSH 主机密钥校验，不修改 `.env`、数据库、远程服务或后端进程。

自动重连事件输出至标准输出，SSH 错误保存在状态文件旁的 `report-tunnel-ssh.log`。Ctrl+C 正常停止脚本及其 SSH 子进程；后台运行时可对本脚本 PID 发送 SIGTERM。电脑重启或临时运行文件被清理后，需重新建立本地隔离运行环境；本工具不安装系统自启动服务。
