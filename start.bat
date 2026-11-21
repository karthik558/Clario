@echo off
REM ==============================================================================
REM Clario — Every document. A clearer answer.
REM Local Startup Script (Windows)
REM Automatically validates, installs missing dependencies, and launches Clario
REM Supports local drives as well as UNC network shares (Parallels / VMs / SMB)
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
if not exist "venv\Scripts\activate.bat" (
    echo Creating virtual environment at backend\venv...
    !PYTHON_CMD! -m venv venv
    if !errorlevel! neq 0 (
        echo [Error] Failed to create virtual environment.
        pause
        exit /b 1
    )
    call venv\Scripts\activate.bat
    echo Installing Python backend dependencies...
    python -m pip install --upgrade pip --quiet
    pip install -r requirements.txt --quiet
) else (
    call venv\Scripts\activate.bat
)

REM ==============================================================================
REM 2. Database and Knowledge Base Verification
REM ==============================================================================
echo [2/4] Verifying database and sample documents...
set PYTHONPATH=.
python -m app.database.seed
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
REM 4. Launch Services
REM ==============================================================================
echo [4/4] Starting Clario Backend and Frontend...
start "Clario Backend (FastAPI)" cmd /k "pushd "!PROJECT_ROOT!\backend" && call venv\Scripts\activate.bat && set PYTHONPATH=. && uvicorn app.main:app --port 8000 --reload"
start "Clario Frontend (Vite)" cmd /k "pushd "!PROJECT_ROOT!\frontend" && npm run dev"

echo ================================================================
echo Clario is up and running!
echo   Frontend Workspace:  http://localhost:5173
echo   Backend REST API:    http://localhost:8000
echo   OpenAPI Swagger:     http://localhost:8000/docs
echo ================================================================
pause
