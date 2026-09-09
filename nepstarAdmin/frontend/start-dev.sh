#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "============================================"
echo "  Smart Admin Frontend — Dev Server"
echo "============================================"
echo ""

# 1. Node.js 检查
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请安装 Node.js 18+"
    exit 1
fi
echo "[1/2] Node.js $(node -v) 已就绪。"

# 2. 依赖检查
if [ ! -d "node_modules" ]; then
    echo "[2/2] 依赖未安装，正在 npm install ..."
    npm install
    if [ $? -ne 0 ]; then
        echo "错误: 依赖安装失败"
        exit 1
    fi
else
    echo "[2/2] node_modules 已存在，跳过安装。"
fi

echo ""
echo "============================================"
echo "  启动服务: http://localhost:5173"
echo "  按 Ctrl+C 停止"
echo "============================================"
echo ""

npx vite --host 0.0.0.0
