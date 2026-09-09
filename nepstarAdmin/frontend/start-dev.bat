@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo   Smart Admin Frontend - Dev Server
echo ============================================
echo.

rem 1. Check Node.js
echo [1/2] Checking Node.js ...
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 18+.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo   Node.js %%v ready.

rem 2. Check dependencies
if not exist "node_modules" (
    echo [2/2] Dependencies not installed, running npm install ...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
) else (
    echo [2/2] node_modules exists, skipping install.
)

echo.
echo ============================================
echo   Starting at: http://localhost:5173
echo   Press Ctrl+C to stop
echo ============================================
echo.

call npx vite --host 0.0.0.0

pause
