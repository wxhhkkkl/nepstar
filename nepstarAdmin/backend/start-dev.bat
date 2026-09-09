@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo   Smart Admin Backend - Dev Server
echo ============================================
echo.

rem 1. venv
if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Creating virtual environment .venv ...
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: Failed to create venv. Is Python 3.11+ installed?
        pause
        exit /b 1
    )
) else (
    echo [1/3] venv already exists, skipping.
)

rem 2. activate + deps
echo [2/3] Activating venv and checking dependencies ...
call .venv\Scripts\activate.bat

python -c "import fastapi" 2>nul
if errorlevel 1 (
    echo Dependencies not installed, installing ...
    pip install -e ".[dev]"
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies.
        pause
        exit /b 1
    )
) else (
    echo Dependencies ready.
)

rem 3. .env
if not exist ".env" (
    echo WARNING: .env file not found, using defaults from config.py.
) else (
    echo [3/3] .env config file found.
)

echo.
echo ============================================
echo   Starting at: http://localhost:8000
echo   Swagger:     http://localhost:8000/docs
echo   Press Ctrl+C to stop
echo ============================================
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
