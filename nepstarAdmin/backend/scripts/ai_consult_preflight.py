"""Offline AI deployment checks. Never import app, connect, migrate or enable AI.

Exit 0 means ONLY offline configuration checks passed; live gates remain open.
Exit 2 means configuration is blocked/unreadable. Output contains no values.
"""

import argparse
import ipaddress
import json
import math
import os
import re
from io import StringIO
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values
from dotenv.parser import parse_stream
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


FLAGS = (
    "AI_CONSULT_GUEST_ENABLED", "AI_CONSULT_SESSIONS_ENABLED",
    "AI_CONSULT_ANSWERS_ENABLED", "AI_CONSULT_OPERATIONS_READY",
)
MANUAL_GATES = (
    "nepstar_migration_and_mysql_concurrency",
    "external_mysql_and_mongo_read_only_grants",
    "provider_health_data_processing_approval",
    "current_notice_published_rules_and_quota",
    "live_admin_rbac_and_chat_isolation",
    "permanent_records_backup_and_restore",
    "proxy_streaming_and_sensitive_log_redaction",
    "live_load_and_mobile_latency",
    "real_device_and_first_use_acceptance",
    "clinical_review_and_helpfulness_feedback",
)


def _normalize(values):
    result = {}
    for key, value in values.items():
        name = key.upper()
        if name not in FLAGS and name != "NEPSTAR_DATABASE_URL" and not name.startswith("AI_CONSULT_"):
            continue
        if name in result and result[name] != value:
            raise ValueError("Ambiguous case-insensitive configuration")
        result[name] = value
    return result


def load_configuration(env_file, environment=None):
    """Match case-insensitive Settings and environment-over-dotenv precedence.

    An explicit missing/unreadable/malformed file must fail, not use defaults.
    Do not source the file as shell code or print parser/exception details.
    """
    content = Path(env_file).read_text(encoding="utf-8")
    if any(binding.error for binding in parse_stream(StringIO(content))):
        raise ValueError("Invalid environment file syntax")
    values = _normalize(dotenv_values(stream=StringIO(content)))
    values.update(_normalize(os.environ if environment is None else environment))
    return values


def _provider_valid(config):
    try:
        parsed = urlsplit((config.get("AI_CONSULT_PROVIDER_BASE_URL") or "").strip())
        host = (parsed.hostname or "").lower().rstrip(".")
        path = parsed.path.rstrip("/")
        try:
            ipaddress.ip_address(host)
            return False
        except ValueError:
            pass
        hosts = {item.strip().lower().rstrip(".") for item in
                 (config.get("AI_CONSULT_PROVIDER_ALLOWED_HOSTS") or "").split(",") if item.strip()}
        timeout = float(config.get("AI_CONSULT_PROVIDER_TIMEOUT_SECONDS", "20"))
        return bool(
            parsed.scheme == "https" and host and host in hosts
            and parsed.username is None and parsed.password is None and parsed.port is None
            and not parsed.query and not parsed.fragment and ".." not in path.split("/")
            and (not path or re.fullmatch(r"/[A-Za-z0-9._~/-]*", path))
            and (config.get("AI_CONSULT_PROVIDER_API_KEY") or "").strip()
            and (config.get("AI_CONSULT_PROVIDER_MODEL") or "").strip()
            and math.isfinite(timeout) and 1 <= timeout <= 60
        )
    except (ValueError, TypeError):
        return False


def evaluate(config, *, prepare_pilot=False):
    checks = []

    def record(name, valid, message, *, optional=False):
        checks.append({"id": name, "status": "passed" if valid else
                       "warning" if optional else "blocked", "message": message})

    for name in FLAGS:
        value = config.get(name)
        closed = isinstance(value, str) and value.lower() in {"false", "0", "no", "off", "n", "f"}
        record(name, closed,
               "试点准备期间需显式 false；未设置时由后台总开关控制，离线检查无法确认数据库当前状态。检查命令不会修改开关。",
               optional=value is None and not prepare_pilot)

    raw_url = config.get("NEPSTAR_DATABASE_URL") or ""
    try:
        url = make_url(raw_url)
        valid_db = (url.drivername == "mysql+aiomysql" and url.database == "nepstar"
                    and bool(url.host) and not url.query)
    except (ArgumentError, ValueError, TypeError):
        valid_db = False
    record("NEPSTAR_DATABASE_URL", valid_db,
           "必须使用显式 mysql+aiomysql/nepstar 写连接，禁止 query 覆盖或回退到其他库。",
           optional=not raw_url and not prepare_pilot)
    key = config.get("AI_CONSULT_TOKEN_HMAC_KEY") or ""
    record("AI_CONSULT_TOKEN_HMAC_KEY", len(key.encode("utf-8")) >= 32,
           "需专用高熵摘要密钥且至少 32 字节；长度通过不证明随机性。",
           optional=not key and not prepare_pilot)
    provider = config.get("AI_CONSULT_PROVIDER", "disabled")
    provider_ok = _provider_valid(config) if provider == "openai_compatible" else provider == "disabled" and not prepare_pilot
    record("provider_configuration", provider_ok,
           "关闭模式允许 disabled；试点准备需完整 HTTPS 精确主机白名单、服务端密钥、模型和合法超时。")
    return {
        "mode": "prepare_pilot" if prepare_pilot else "closed",
        "offline_checks_passed": not any(c["status"] == "blocked" for c in checks),
        "ready_to_enable": False,
        "scope": "offline configuration only; no database, model or application startup",
        "checks": checks, "manual_gates": list(MANUAL_GATES),
        "retention_policy": "permanent_records; no_automatic_cleanup",
    }


def main():
    parser = argparse.ArgumentParser(description="AI 咨询离线部署检查（不连接数据库、不启用服务）")
    parser.add_argument("--env-file", default=".env", help="读取指定配置文件，系统环境变量优先")
    parser.add_argument("--prepare-pilot", action="store_true", help="核对试点配置，但仍要求全部公开开关关闭")
    args = parser.parse_args()
    try:
        result = evaluate(load_configuration(args.env_file), prepare_pilot=args.prepare_pilot)
    except (OSError, ValueError, UnicodeError):
        result = {"offline_checks_passed": False, "ready_to_enable": False,
                  "checks": [{"id": "configuration_file", "status": "blocked",
                              "message": "配置文件缺失、不可读、格式错误或键名大小写冲突；未执行其他操作。"}]}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["offline_checks_passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
