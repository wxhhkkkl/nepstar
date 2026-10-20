"""Reconnect an existing local report SSH tunnel without restarting the backend.

Uses the original runtime state's fixed loopback ports and existing SSH host key
and askpass helper. Does not change .env, databases, or remote services.
"""

import argparse
import json
import os
import signal
import subprocess
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values
from pymongo.uri_parser import parse_uri

BACKEND = Path(__file__).resolve().parents[1]


def ssh_command(values, state, folder):
    mongo_targets = parse_uri(values["MONGODB_URL"])["nodelist"]
    sql_targets = []
    for key in ("DATABASE_URL", "CONFIG_DATABASE_URL", "NEPSTAR_DATABASE_URL"):
        if values.get(key):
            source = urlsplit(values[key])
            target = (source.hostname, source.port or 3306)
            if target not in sql_targets:
                sql_targets.append(target)
    ports = state["loopback_ports"] + state["read_only_mysql_forward_ports"]
    targets = mongo_targets + sql_targets
    if (len(ports) != len(targets) or len(set(ports)) != len(ports)
            or any(type(port) is not int or not 1024 <= port <= 65535 for port in ports)):
        raise ValueError("Runtime forward ports do not match configured database sources")
    command = [
        "/usr/bin/ssh", "-N", "-T",
        "-o", "ConnectTimeout=10", "-o", "ConnectionAttempts=1",
        "-o", "NumberOfPasswordPrompts=1", "-o", "StrictHostKeyChecking=yes",
        "-o", f"UserKnownHostsFile={folder / 'known_hosts'}",
        "-o", "LogLevel=ERROR", "-o", "ExitOnForwardFailure=yes",
        "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2",
    ]
    for port, (host, target_port) in zip(ports, targets):
        command += ["-L", f"127.0.0.1:{port}:{host}:{target_port}"]
    return command + ["-l", values["SERVER_USER"], values["SERVER_IP"]]


def supervise(command, environment, stopped, log, launch=subprocess.Popen):
    delay = 1
    while not stopped.is_set():
        started = time.monotonic()
        process = launch(command, env=environment, stdin=subprocess.DEVNULL,
                         stdout=log, stderr=log)
        print(json.dumps({"event": "report_tunnel_started", "ssh_pid": process.pid}), flush=True)
        try:
            while process.poll() is None and not stopped.wait(1):
                pass
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=15)
        if stopped.is_set():
            break
        # Recover promptly after sleep/network changes; back off repeated failures.
        if time.monotonic() - started >= 30:
            delay = 1
        print(json.dumps({"event": "report_tunnel_reconnecting", "retry_seconds": delay}), flush=True)
        if stopped.wait(delay):
            break
        delay = min(delay * 2, 30)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-file", type=Path, required=True)
    args = parser.parse_args()
    folder = args.state_file.resolve().parent
    for name in ("known_hosts", "askpass.py"):
        if not (folder / name).is_file():
            parser.error(f"Existing runtime {name} is required")
    command = ssh_command(dotenv_values(BACKEND / ".env"),
                          json.loads(args.state_file.read_text()), folder)
    environment = os.environ.copy()
    environment.update(SSH_ASKPASS=str(folder / "askpass.py"),
                       SSH_ASKPASS_REQUIRE="force", DISPLAY="codex-ssh:0")
    stopped = threading.Event()
    for signum in (signal.SIGINT, signal.SIGTERM):
        signal.signal(signum, lambda *_: stopped.set())
    log_path = folder / "report-tunnel-ssh.log"
    fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(fd, "ab", buffering=0) as log:
        supervise(command, environment, stopped, log)


if __name__ == "__main__":
    main()
