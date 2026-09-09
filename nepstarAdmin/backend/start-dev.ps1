$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Smart Admin Backend — Dev Server"          -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. 虚拟环境
$pythonExe = ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Host "[1/3] 创建虚拟环境 .venv ..." -ForegroundColor Yellow
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 无法创建虚拟环境，请确认已安装 Python 3.11+" -ForegroundColor Red
        Read-Host "按 Enter 退出"
        exit 1
    }
} else {
    Write-Host "[1/3] 虚拟环境已存在，跳过创建。" -ForegroundColor Green
}

# 2. 激活 + 安装依赖
Write-Host "[2/3] 激活虚拟环境并检查依赖 ..." -ForegroundColor Yellow
. .venv\Scripts\Activate.ps1

$fastapiInstalled = & python -c "import fastapi" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "依赖未安装，正在安装 ..." -ForegroundColor Yellow
    pip install -e ".[dev]"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 依赖安装失败" -ForegroundColor Red
        Read-Host "按 Enter 退出"
        exit 1
    }
} else {
    Write-Host "依赖已就绪。" -ForegroundColor Green
}

# 3. 环境变量
if (-not (Test-Path ".env")) {
    Write-Host "警告: 未找到 .env 文件，使用 config.py 中的默认配置。" -ForegroundColor Yellow
} else {
    Write-Host "[3/3] .env 配置文件已就绪。" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  启动服务: http://localhost:8000"             -ForegroundColor Cyan
Write-Host "  Swagger:  http://localhost:8000/docs"         -ForegroundColor Cyan
Write-Host "  按 Ctrl+C 停止"                               -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
