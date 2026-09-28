@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo   Longevity Report V2 - Dev Server
echo ============================================
echo.

rem 1. Node version check (package.json engines: ^22.18.0 || >=24.12.0)
echo [1/3] Checking Node.js version ...
for /f "tokens=1,2 delims=." %%a in ('node -v 2^>nul') do (
    set "NODE_MAJOR=%%a"
    set "NODE_MINOR=%%b"
)
if not defined NODE_MAJOR (
    echo ERROR: Node.js not found. Install Node ^22.18+ ^(see .nvmrc^).
    pause
    exit /b 1
)
set "NODE_MAJOR=%NODE_MAJOR:v=%"
if %NODE_MAJOR% LSS 22 goto node_bad
if %NODE_MAJOR% EQU 22 if %NODE_MINOR% LSS 18 goto node_bad
if %NODE_MAJOR% EQU 23 goto node_bad
if %NODE_MAJOR% GTR 24 goto node_ok
if %NODE_MAJOR% EQU 24 if %NODE_MINOR% LSS 12 goto node_bad
goto node_ok

:node_bad
echo ERROR: Node %NODE_MAJOR%.%NODE_MINOR% is out of range, need ^^22.18.0 or ^>=24.12.0.
echo        Run "nvm use" first, or start Vite with another Node binary.
pause
exit /b 1

:node_ok
node -v
echo   Node version OK.

rem 2. deps
if not exist "node_modules\vite" (
    echo [2/3] Dependencies not installed, running npm install ...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
) else (
    echo [2/3] Dependencies ready.
)

echo [3/3] Starting Vite ...
echo.
echo ============================================
echo   Local:   http://localhost:5173
echo   Routes:  /#/  and  /#/system/{systemId}
echo   Press Ctrl+C to stop
echo ============================================
echo.

call npm run dev -- --host 0.0.0.0

pause
