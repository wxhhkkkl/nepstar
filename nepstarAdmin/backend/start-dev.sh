#!/usr/bin/env bash
# ==============================================
#  Smart Admin Backend — Dev Server
#  用法:
#    ./start-dev.sh          前台运行（开发调试）
#    ./start-dev.sh -d       后台运行
#    ./start-dev.sh stop     停止后台服务
#    ./start-dev.sh status   查看运行状态
#    ./start-dev.sh log      查看实时日志
# ==============================================

cd "$(dirname "$0")"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
PID_FILE=".server.pid"
LOG_FILE="/tmp/smart-admin-backend.log"

# ---- 子命令: stop / status / log ----
case "${1:-}" in
  stop)
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            rm -f "$PID_FILE"
            echo "✅ 后台服务已停止 (PID=$PID)"
        else
            rm -f "$PID_FILE"
            echo "⚠️  PID 文件存在但进程已不存在，已清理。"
        fi
    else
        echo "⚠️  未找到后台服务 PID 文件。"
        echo "   手动查找: ps aux | grep uvicorn"
    fi
    exit 0
    ;;
  status)
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "✅ 后台服务运行中 (PID=$PID) — http://${HOST}:${PORT}"
        else
            echo "❌ 进程已退出 (PID=$PID)，但 PID 文件未清理。"
            rm -f "$PID_FILE"
        fi
    else
        echo "❌ 后台服务未运行。"
    fi
    exit 0
    ;;
  log|logs)
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        echo "⚠️  日志文件不存在: $LOG_FILE"
    fi
    exit 0
    ;;
esac

# ---- 主流程：环境准备 ----
echo "============================================"
echo "  Smart Admin Backend — Dev Server"
echo "============================================"
echo ""

# 0. 检查 Python 版本
PYTHON_BIN="python3.11"
if ! command -v $PYTHON_BIN &> /dev/null; then
    PYTHON_BIN="python3"
fi
PY_VER=$($PYTHON_BIN --version 2>&1 | grep -oP '\d+\.\d+')
PY_MAJOR=$(echo $PY_VER | cut -d. -f1)
PY_MINOR=$(echo $PY_VER | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 11 ]); then
    echo "错误: 需要 Python 3.11+，当前版本: $PY_VER"
    echo "CentOS 安装 Python 3.11:"
    echo "  sudo yum install -y epel-release"
    echo "  sudo yum install -y python3.11 python3.11-devel"
    exit 1
fi

# 1. 虚拟环境
PYTHON_EXE=".venv/bin/python"
if [ ! -f "$PYTHON_EXE" ]; then
    echo "[1/3] 创建虚拟环境 .venv (Python $PY_VER) ..."
    # --without-pip 跳过联网下载，避免卡死
    $PYTHON_BIN -m venv .venv --without-pip || {
        echo "错误: 无法创建虚拟环境"
        echo "Ubuntu: sudo apt install -y python3-venv"
        exit 1
    }
    # 用系统 pip 装进 venv
    if command -v pip3 &>/dev/null; then
        .venv/bin/python -m ensurepip --upgrade 2>/dev/null || true
    fi
    echo "  虚拟环境已创建。"
else
    echo "[1/3] 虚拟环境已存在，跳过创建。"
fi

# 2. 激活 + 安装依赖
echo "[2/3] 安装依赖 ..."
source .venv/bin/activate

if ! .venv/bin/python -c "import fastapi" 2>/dev/null; then
    echo "  依赖未安装，正在安装 ..."
    # 优先用 venv 内的 pip，否则用系统的
    if .venv/bin/python -m pip --version 2>/dev/null; then
        .venv/bin/python -m pip install --upgrade pip
        .venv/bin/python -m pip install -r requirements.txt
    elif command -v pip3 &>/dev/null; then
        pip3 install --target .venv/lib/python${PY_MAJOR}.${PY_MINOR}/site-packages -r requirements.txt
    else
        echo "错误: 未找到 pip，请先安装 python3-pip"
        exit 1
    fi
    if [ $? -ne 0 ]; then
        echo "错误: 依赖安装失败"
        exit 1
    fi
    echo "  依赖安装完成。"
else
    echo "  依赖已就绪。"
fi

# 3. 环境变量
if [ ! -f ".env" ]; then
    echo "警告: 未找到 .env 文件，使用 config.py 中的默认配置。"
else
    echo "[3/3] .env 配置文件已就绪。"
fi

echo ""
echo "============================================"
echo "  启动服务: http://${HOST}:${PORT}"
echo "  Swagger:  http://${HOST}:${PORT}/docs"
echo "============================================"
echo ""

# ---- 启动 ----
if [ "$1" = "-d" ] || [ "$1" = "--daemon" ]; then
    # 检查是否已在运行
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "⚠️  服务已在运行 (PID=$OLD_PID)。如需重启请先执行: ./start-dev.sh stop"
            exit 1
        fi
    fi
    # 后台启动
    echo "  后台模式 (PID=$PID_FILE, log=$LOG_FILE)"
    nohup .venv/bin/uvicorn app.main:app --host "$HOST" --port "$PORT" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "✅ 后台服务已启动 (PID=$(cat $PID_FILE))"
    echo "   查看日志: ./start-dev.sh log"
    echo "   停止服务: ./start-dev.sh stop"
else
    # 前台运行
    echo "  前台模式（按 Ctrl+C 停止，加 -d 后台运行）"
    echo ""
    uvicorn app.main:app --reload --host "$HOST" --port "$PORT"
fi
