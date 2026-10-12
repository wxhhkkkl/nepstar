"""Direct Linux/venv deployment. No git writes, migrations or AI enablement.

The launcher uses only the standard library. A requirements-keyed venv keeps
dependency installation away from the running service's environment. Process
ownership is checked through Linux /proc before sending SIGTERM.
"""

import argparse
import ast
from contextlib import contextmanager
from datetime import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import sys
import time
from urllib.request import ProxyHandler, build_opener


BACKEND = Path(__file__).resolve().parents[1]
RUNTIME = BACKEND / ".deploy"
STATE = RUNTIME / "service.json"


class DeployError(Exception):
    pass


def say(message):
    print(f"[deploy] {message}", flush=True)


def process_info(pid):
    """Return only identity fields; never print process environment/arguments."""
    try:
        proc = Path("/proc") / str(pid)
        stat = (proc / "stat").read_text().rsplit(")", 1)[1].split()
        if stat[0] == "Z":
            return None
        return {
            "pid": pid, "started": stat[19],
            "parent": int(stat[1]),
            "cwd": (proc / "cwd").resolve(strict=True),
            "args": (proc / "cmdline").read_bytes().decode().strip("\0").split("\0"),
        }
    except (OSError, ValueError, UnicodeError):
        return None


def option(args, name, default):
    for i, arg in enumerate(args):
        if arg == name:
            return args[i + 1] if i + 1 < len(args) else None
        if arg.startswith(name + "="):
            return arg.split("=", 1)[1]
    return default


def project_process(info, port):
    if not info or info["cwd"] != BACKEND:
        return False
    args = info["args"]
    uvicorn = bool(args) and (
        Path(args[0]).name == "uvicorn"
        or (len(args) > 1 and Path(args[1]).name == "uvicorn")
        or (len(args) > 2 and args[1:3] == ["-m", "uvicorn"])
    )
    return uvicorn and "app.main:app" in args and option(args, "--port", "8000") == str(port)


def find_service(port):
    candidates = []
    for path in Path("/proc").iterdir():
        if path.name.isdigit():
            info = process_info(int(path.name))
            if project_process(info, port):
                candidates.append(info)
    if len(candidates) > 1:
        raise DeployError("找到多个项目进程，无法安全接管；请先核对原来的启动方式。")
    if candidates:
        candidate = candidates[0]
        args = candidate["args"]
        # Do not fight a process manager that may automatically respawn it.
        try:
            cgroup = (Path("/proc") / str(candidate["pid"]) / "cgroup").read_text()
        except OSError:
            raise DeployError("无法核对进程管理方式，已取消自动接管。") from None
        if re.search(r"/[^/\n]+\.service(?:/|$)", cgroup, re.MULTILINE):
            raise DeployError("当前服务属于 systemd service，请通过原服务管理器更新。")
        parent = candidate["parent"]
        for _ in range(12):
            if parent <= 1:
                break
            ancestor = process_info(parent)
            if not ancestor:
                break
            if any(Path(arg).name in {"supervisord", "gunicorn", "circusd"}
                   for arg in ancestor["args"][:3]):
                raise DeployError("当前服务由进程管理器管理，请通过原管理器更新。")
            parent = ancestor["parent"]
        if "--reload" in args or any(arg.startswith("--reload=") for arg in args):
            raise DeployError("当前使用开发热更新模式；请先用原启动方式停止，再执行部署。")
        if option(args, "--workers", "1") != "1":
            raise DeployError("当前为多 worker 服务，请继续使用原进程管理器部署。")
        return candidate
    return None


def same_process(info):
    current = process_info(info["pid"])
    return bool(current and current["started"] == info["started"]
                and current["cwd"] == info["cwd"] and current["args"] == info["args"])


def port_available(port):
    # IPv4 covers the default listener; a conflicting IPv6 wildcard is also
    # rejected by the kernel when it owns this IPv4 port.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


def health_ok(port):
    try:
        # Local health checks must not follow the machine's HTTP proxy settings.
        with build_opener(ProxyHandler({})).open(
            f"http://127.0.0.1:{port}/api/v1/health", timeout=2
        ) as response:
            return response.status == 200 and json.loads(response.read(4096)) == {"status": "ok"}
    except Exception:
        return False


def run_step(args, log, description):
    say(description)
    with log.open("ab") as output:
        result = subprocess.run(args, cwd=BACKEND, stdout=output, stderr=output)
    if result.returncode:
        raise DeployError(f"{description}失败。详情见 {log}；日志可能含环境信息，请勿公开原文。")


def prepare_python(log):
    requirement_bytes = (BACKEND / "requirements.txt").read_bytes()
    key = hashlib.sha256(requirement_bytes + sys.version.encode()).hexdigest()[:16]
    venv = RUNTIME / "venvs" / key
    python = venv / "bin" / "python"
    ready = venv / ".ready"
    if not ready.exists():
        if venv.exists():
            # Preserve incomplete installs for diagnosis; do not reuse or delete.
            venv = venv.with_name(key + "-" + datetime.now().strftime("%Y%m%d%H%M%S%f"))
            python, ready = venv / "bin" / "python", venv / ".ready"
        run_step([sys.executable, "-m", "venv", str(venv)], log, "准备独立 Python 环境")
        run_step([str(python), "-m", "pip", "install", "--disable-pip-version-check",
                  "-r", str(BACKEND / "requirements.txt")], log, "安装后端依赖（旧服务继续运行）")
        run_step([str(python), "-m", "pip", "check"], log, "检查依赖兼容性")
        ready.touch(mode=0o600)
    else:
        say("复用已安装的同版本依赖环境")
        run_step([str(python), "-m", "pip", "check"], log, "检查依赖兼容性")
    return python


def check_syntax():
    for directory in ("app", "alembic", "scripts"):
        for path in (BACKEND / directory).rglob("*.py"):
            try:
                ast.parse(path.read_bytes(), filename=str(path))
            except (SyntaxError, UnicodeError):
                raise DeployError(f"Python 语法错误：{path.relative_to(BACKEND)}") from None


def stop_owned(info, timeout):
    if not same_process(info):
        raise DeployError("进程身份发生变化，已取消停止操作。")
    say(f"平滑停止本项目旧服务（PID {info['pid']}，最多等待 {timeout} 秒）")
    os.kill(info["pid"], signal.SIGTERM)
    deadline = time.monotonic() + timeout
    while same_process(info) and time.monotonic() < deadline:
        time.sleep(0.25)
    if same_process(info):
        raise DeployError("旧进程未在规定时间退出；未强制杀进程，也未启动第二个服务。")


def save_state(info, log, port, python):
    data = {"pid": info["pid"], "started": info["started"], "port": port,
            "log": str(log), "python": str(python), "updated_at": datetime.now().isoformat()}
    pending = STATE.with_suffix(".tmp")
    pending.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    pending.replace(STATE)


@contextmanager
def deploy_lock():
    with (RUNTIME / "deploy.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeployError("另一个更新命令仍在运行，请等待完成。") from None
        yield


def deploy(args):
    if not (BACKEND / ".env").is_file():
        raise DeployError("backend/.env 不存在。请保留服务器原有配置，不能用本机 .env 覆盖。")
    old = find_service(args.port)
    if not port_available(args.port) and old is None:
        raise DeployError(f"端口 {args.port} 被其他进程或其他启动方式占用；未停止任何服务。")
    if old is not None:
        say(f"已识别当前项目服务：PID {old['pid']}")
    check_syntax()
    identifier = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    install_log = RUNTIME / "logs" / f"prepare-{identifier}.log"
    python = prepare_python(install_log)
    # This helper imports definitions only, and performs SELECT/metadata/ping.
    # It does not run FastAPI startup hooks, seed data or create schema.
    say("检查配置、MySQL 表结构和已配置的报告数据源（只读）")
    result = subprocess.run([str(python), "scripts/deploy_check.py"], cwd=BACKEND)
    if result.returncode:
        raise DeployError("部署检查未通过，未发送重启信号。修复上方提示后重新执行。")
    if args.command == "check":
        say("检查通过；未重启、未迁移数据库。")
        return
    # Recheck after potentially slow installation/DB checks.
    current = find_service(args.port)
    if (old is None) != (current is None) or (old and not same_process(old)):
        raise DeployError("检查期间服务进程发生变化，请重新执行。")
    if old:
        stop_owned(old, args.stop_timeout)
    if not port_available(args.port):
        raise DeployError("端口仍被占用，已停止部署；请核对端口占用。")
    service_log = RUNTIME / "logs" / f"service-{identifier}.log"
    with service_log.open("ab") as output:
        child = subprocess.Popen(
            [str(python), "-m", "uvicorn", "app.main:app", "--host", args.host,
             "--port", str(args.port), "--workers", "1", "--no-access-log"],
            cwd=BACKEND, stdin=subprocess.DEVNULL, stdout=output, stderr=output,
            start_new_session=True,
        )
    info = None
    deadline = time.monotonic() + args.health_timeout
    while time.monotonic() < deadline:
        if child.poll() is not None:
            raise DeployError(f"新服务启动失败，退出码 {child.returncode}。日志：{service_log}")
        info = process_info(child.pid)
        if project_process(info, args.port) and health_ok(args.port):
            save_state(info, service_log, args.port, python)
            say(f"更新成功：PID {child.pid}，健康检查通过。")
            say(f"服务日志：{service_log}")
            say("AI 启停状态沿用服务器配置；如需启用，请在管理端 AI 咨询设置中操作。")
            return
        time.sleep(1)
    # Only terminate the exact candidate we just created, never an unknown PID.
    if info and same_process(info):
        stop_owned(info, args.stop_timeout)
    raise DeployError(f"新服务健康检查超时，部署失败。日志：{service_log}。未自动回退代码或数据库。")


def main():
    parser = argparse.ArgumentParser(description="后端一键更新（Linux / Python 3.11+ / 直接运行）")
    parser.add_argument("command", choices=("deploy", "check", "status", "logs"), nargs="?", default="deploy")
    parser.add_argument("--host", choices=("0.0.0.0", "127.0.0.1"), default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--stop-timeout", type=int, default=45)
    parser.add_argument("--health-timeout", type=int, default=60)
    parser.add_argument("--dry-run", action="store_true", help="只显示计划，不写文件、不联网、不检查或重启服务")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535 or not 1 <= args.stop_timeout <= 300 or not 1 <= args.health_timeout <= 300:
        parser.error("端口须为 1–65535，超时须为 1–300 秒")
    os.chdir(BACKEND)
    if args.dry_run:
        say(f"项目目录：{BACKEND}")
        say(f"运行计划：{args.command}，监听 {args.host}:{args.port}")
        plans = {
            "deploy": "识别进程 → 独立环境安装依赖 → 只读配置/数据库检查 → SIGTERM → 启动 → 健康检查",
            "check": "识别进程 → 独立环境安装依赖 → 只读配置/数据库检查；不重启服务",
            "status": "识别当前目录的服务并检查健康状态",
            "logs": "查看最近一次成功部署的日志",
        }
        say(f"执行流程：{plans[args.command]}")
        say("保留 .env 和咨询记录；不会拉代码、迁移/清理数据库或修改 AI 开关。")
        return 0
    if not sys.platform.startswith("linux"):
        raise DeployError("此脚本用于 Linux 服务器；本机仅可执行 --help 或 --dry-run。")
    if args.command == "status":
        info = find_service(args.port)
        healthy = bool(info and health_ok(args.port))
        say(f"本项目服务 PID {info['pid']}，健康检查{'通过' if healthy else '未通过'}"
            if info else "未找到由当前 backend 目录启动的单进程服务。")
        return 0 if healthy else 1
    if args.command == "logs":
        if not STATE.is_file():
            raise DeployError("尚无此脚本的成功部署记录；请查看原启动方式的日志。")
        data = json.loads(STATE.read_text())
        log = Path(data["log"]).resolve()
        if log.parent != (RUNTIME / "logs").resolve() or not log.is_file():
            raise DeployError("日志记录无效，请检查 .deploy/logs。")
        say("显示最近 80 行并跟踪日志；Ctrl+C 只退出查看。不要公开未脱敏日志。")
        return subprocess.call(["tail", "-n", "80", "-f", str(log)])
    os.umask(0o077)
    RUNTIME.mkdir(mode=0o700, exist_ok=True)
    (RUNTIME / "logs").mkdir(mode=0o700, exist_ok=True)
    (RUNTIME / "venvs").mkdir(mode=0o700, exist_ok=True)
    with deploy_lock():
        deploy(args)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        say("命令已中断。请执行 bash deploy.sh status 核对服务状态。")
        raise SystemExit(130)
    except DeployError as exc:
        say(str(exc))
        raise SystemExit(1)
    except Exception as exc:
        # DB URLs and configuration validation errors may contain credentials.
        say(f"部署未完成（{type(exc).__name__}）。请核对目录权限和运行环境，执行 status 查看状态。")
        raise SystemExit(1)
