@echo off
REM ==============================================================================
REM Clario — Every document. A clearer answer.
REM Local Startup Script (Windows)
REM Automatically validates, installs missing dependencies, and launches Clario
REM Supports local drives as well as UNC network shares (Parallels / VMs / SMB)
REM Runs in a single unified window (no multiple command prompt popups)
REM ==============================================================================

setlocal enabledelayedexpansion

echo ================================================================
echo    CLARIO -- DOCUMENT INTELLIGENCE WORKSPACE
echo    Tagline: Every document. A clearer answer.
echo ================================================================

REM Handle UNC network shares and mapped drives automatically
pushd "%~dp0"
set "PROJECT_ROOT=%CD%"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

REM ==============================================================================
REM 1. Backend Python Runtime and Virtual Environment
REM ==============================================================================
echo [1/4] Checking Python backend environment...

REM Add standard Python paths if installed but not yet in session PATH
if exist "%LocalAppData%\Programs\Python\Python312" set "PATH=%LocalAppData%\Programs\Python\Python312;%LocalAppData%\Programs\Python\Python312\Scripts;!PATH!"
if exist "%LocalAppData%\Programs\Python\Python311" set "PATH=%LocalAppData%\Programs\Python\Python311;%LocalAppData%\Programs\Python\Python311\Scripts;!PATH!"
if exist "%ProgramFiles%\Python312" set "PATH=%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;!PATH!"
if exist "%ProgramFiles%\Python311" set "PATH=%ProgramFiles%\Python311;%ProgramFiles%\Python311\Scripts;!PATH!"

set "PYTHON_CMD="

REM Verify functional Python (bypasses Windows Store 0-byte execution alias)
python -c "import sys; sys.exit(0)" >nul 2>&1
if !errorlevel! equ 0 (
    set "PYTHON_CMD=python"
) else (
    py -c "import sys; sys.exit(0)" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_CMD=py"
    )
)

if "!PYTHON_CMD!"=="" (
    echo [Notice] Python not detected on your system.
    echo Installing Python 3.12 automatically via winget...
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    if exist "%LocalAppData%\Programs\Python\Python312" set "PATH=%LocalAppData%\Programs\Python\Python312;%LocalAppData%\Programs\Python\Python312\Scripts;!PATH!"
    if exist "%ProgramFiles%\Python312" set "PATH=%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;!PATH!"

    python -c "import sys; sys.exit(0)" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_CMD=python"
        echo [OK] Python 3.12 installed and verified.
    ) else (
        echo [Error] Automatic Python installation via winget failed.
        echo Please install Python 3.12 from https://www.python.org/downloads/
        echo Ensure 'Add Python to PATH' is checked during setup.
        pause
        exit /b 1
    )
)

pushd "!PROJECT_ROOT!\backend"
set "VENV_PYTHON=!PROJECT_ROOT!\backend\venv\Scripts\python.exe"

if not exist "!VENV_PYTHON!" (
    echo Creating virtual environment at backend\venv...
    !PYTHON_CMD! -m venv venv
    if !errorlevel! neq 0 (
        echo [Error] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

call venv\Scripts\activate.bat

REM Verify backend dependencies are actually installed in the venv
"!VENV_PYTHON!" -c "import fastapi, uvicorn, sqlalchemy" >nul 2>&1
if !errorlevel! neq 0 (
    echo [Notice] Backend packages not detected in virtual environment.
    echo Installing Python backend dependencies from requirements.txt...
    python -m pip install --upgrade pip --quiet
    pip install -r requirements.txt
    if !errorlevel! neq 0 (
        echo [Error] Failed to install backend dependencies.
        pause
        exit /b 1
    )
    echo [OK] Backend dependencies installed successfully.
)

REM ==============================================================================
REM 2. Database and Knowledge Base Verification
REM ==============================================================================
echo [2/4] Verifying database and sample documents...
set PYTHONPATH=.
"!VENV_PYTHON!" -m app.database.seed
if !errorlevel! neq 0 (
    echo [Error] Database initialization failed.
    pause
    exit /b 1
)
popd

REM ==============================================================================
REM 3. Frontend Node.js, npm and Dependencies
REM ==============================================================================
echo [3/4] Checking frontend dependencies (Node.js and npm)...
pushd "!PROJECT_ROOT!\frontend"

REM Add standard Node.js paths if installed but not yet in session PATH
if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;!PATH!"
if exist "%ProgramFiles(x86)%\nodejs" set "PATH=%ProgramFiles(x86)%\nodejs;!PATH!"
if exist "%LocalAppData%\Programs\nodejs" set "PATH=%LocalAppData%\Programs\nodejs;!PATH!"
if exist "%AppData%\npm" set "PATH=%AppData%\npm;!PATH!"

call npm -v >nul 2>&1
if !errorlevel! neq 0 (
    echo [Notice] Node.js / npm not detected.
    echo Installing Node.js LTS automatically via winget...
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;!PATH!"
    if exist "%ProgramFiles(x86)%\nodejs" set "PATH=%ProgramFiles(x86)%\nodejs;!PATH!"
    if exist "%LocalAppData%\Programs\nodejs" set "PATH=%LocalAppData%\Programs\nodejs;!PATH!"
    if exist "%AppData%\npm" set "PATH=%AppData%\npm;!PATH!"

    call npm -v >nul 2>&1
    if !errorlevel! neq 0 (
        echo [Error] Node.js and npm could not be found or installed automatically.
        echo Please download and install Node.js LTS from: https://nodejs.org/
        pause
        exit /b 1
    )
    echo [OK] Node.js and npm installed successfully.
)

if not exist "node_modules" (
    echo Installing frontend npm packages...
    call npm install
    if !errorlevel! neq 0 (
        echo [Error] npm install failed.
        pause
        exit /b 1
    )
)
popd

REM ==============================================================================
REM 4. Launch Services in a Single Unified Window
REM ==============================================================================
echo [4/4] Starting Clario Backend and Frontend...
echo.
echo ================================================================
echo    CLARIO IS UP AND RUNNING!
echo    Frontend Workspace:  http://localhost:5173
echo    Backend REST API:    http://localhost:8000
echo    OpenAPI Swagger:     http://localhost:8000/docs
echo ================================================================
echo.

REM Start FastAPI Backend in background within this same console session
pushd "!PROJECT_ROOT!\backend"
set PYTHONPATH=.
start /B "" "!PROJECT_ROOT!\backend\venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
popd

REM Open default web browser to the Frontend
start http://localhost:5173

REM Run Vite Frontend server in foreground in this same window
pushd "!PROJECT_ROOT!\frontend"
call npm run dev

REM Clean up background backend process when user quits frontend (Ctrl+C)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
popd
popd
exit /b 0
