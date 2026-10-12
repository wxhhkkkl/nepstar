#!/usr/bin/env bash
# 在服务器 backend 目录执行：bash deploy.sh
set -euo pipefail
DEPLOY_BACKEND_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_BACKEND_DIR"

# 启动器只使用标准库；依赖由部署程序安装到独立虚拟环境。
for DEPLOY_PYTHON in .venv/bin/python venv/bin/python python3.12 python3.11 python3; do
    if command -v "$DEPLOY_PYTHON" >/dev/null 2>&1 &&
       "$DEPLOY_PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
        exec "$DEPLOY_PYTHON" scripts/deploy_backend.py "$@"
    fi
done
echo '[deploy] 需要 Python 3.11+，请先安装 Python 和对应的 venv 模块。' >&2
exit 1
