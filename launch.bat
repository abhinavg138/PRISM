@echo off
setlocal enabledelayedexpansion

:: Switch working directory to repository root
cd /d "%~dp0"

echo ========================================
echo          PRISM SYSTEM LAUNCHER
echo ========================================
echo.

:: 1. Detect Python Executable
echo Checking Python environment...

set "PYTHON_CMD="

if exist "%~dp0.venv\Scripts\python.exe" (
    set "PYTHON_CMD=%~dp0.venv\Scripts\python.exe"
    goto python_found
)

if exist "%~dp0venv\Scripts\python.exe" (
    set "PYTHON_CMD=%~dp0venv\Scripts\python.exe"
    goto python_found
)

python -c "import fastapi, uvicorn" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python"
    goto python_found
)

py -c "import fastapi, uvicorn" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=py"
    goto python_found
)

if exist "%LOCALAPPDATA%\Python\bin\python.exe" (
    "%LOCALAPPDATA%\Python\bin\python.exe" -c "import fastapi, uvicorn" >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON_CMD=%LOCALAPPDATA%\Python\bin\python.exe"
        goto python_found
    )
)

where python.exe >nul 2>&1
if not errorlevel 1 (
    python.exe -c "import sys" >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON_CMD=python.exe"
        goto python_found
    )
)

:python_missing
echo.
echo [ERROR] Python environment not found or missing required dependencies (fastapi, uvicorn).
echo Please verify Python is installed and dependencies are installed via:
echo     pip install -r requirements.txt
echo.
pause
exit /b 1

:python_found
echo Python detected.

:: 2. Resolve Configured Port (default 8000)
set "PRISM_PORT=8000"
for /f "delims=" %%P in ('"%PYTHON_CMD%" -c "import os, sys; from pathlib import Path; from dotenv import load_dotenv; load_dotenv(Path(r'%~dp0') / '.env'); sys.stdout.write(os.getenv('API_PORT', '8000'))" 2^>nul') do (
    if not "%%P"=="" set "PRISM_PORT=%%P"
)

echo Configured Port: %PRISM_PORT%

:: 3. Launch PRISM FastAPI Backend in dedicated window
echo Starting PRISM backend...
start "PRISM Backend Server" cmd /k %PYTHON_CMD% -m uvicorn backend.main:app --host 127.0.0.1 --port %PRISM_PORT%

:: 4. Poll Health Endpoint until ready (max 30 seconds)
echo Waiting for PRISM API...

set /a ATTEMPTS=0
set /a MAX_ATTEMPTS=30

:health_loop
set /a ATTEMPTS+=1

"%PYTHON_CMD%" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:%PRISM_PORT%/api/health', timeout=1)" >nul 2>&1
if not errorlevel 1 goto backend_ready

if %ATTEMPTS% geq %MAX_ATTEMPTS% goto backend_timeout

timeout /t 1 /nobreak >nul 2>&1
goto health_loop

:backend_ready
echo PRISM backend is ready!
echo.
echo Opening in default browser:
echo   - PRISM Portal:      http://127.0.0.1:%PRISM_PORT%/
echo   - PRISM Admin Panel: http://127.0.0.1:%PRISM_PORT%/admin/login
echo.

start "" "http://127.0.0.1:%PRISM_PORT%/"
start "" "http://127.0.0.1:%PRISM_PORT%/admin/login"

echo ========================================
echo   PRISM is running successfully.
echo   Keep the backend window open to maintain service.
echo ========================================
echo.
pause
exit /b 0

:backend_timeout
echo.
echo [ERROR] PRISM backend failed to respond at http://127.0.0.1:%PRISM_PORT%/api/health within %MAX_ATTEMPTS% seconds.
echo Please inspect the "PRISM Backend Server" terminal window for error logs or port conflicts.
echo.
pause
exit /b 1
