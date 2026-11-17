@echo off
REM ==============================================================================
REM Clario — Windows Automatic System Initialization & Environment Setup
REM ==============================================================================

setlocal enabledelayedexpansion

echo ================================================================
echo    CLARIO -- WINDOWS SYSTEM INITIALIZATION & ENVIRONMENT SETUP
echo    Automated dependency verification: Python, Node.js & Ollama
echo ================================================================

cd /d "%~dp0.."
set "PROJECT_ROOT=%CD%"

REM 1. Check Python
echo.
echo [1/5] Checking Python runtime...
set "PYTHON_CMD="
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
    for /f "tokens=*" %%i in ('python --version') do echo [OK] Detected %%i
) else (
    py --version >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_CMD=py"
        for /f "tokens=*" %%i in ('py --version') do echo [OK] Detected %%i
    )
)

if "%PYTHON_CMD%"=="" (
    echo [Notice] Python not detected. Attempting to install Python 3.12 via winget...
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [Warning] Automatic installation via winget failed.
        echo Please download and install Python 3.12 manually from: https://www.python.org/downloads/
        echo Ensure you check 'Add Python to PATH' during installation.
        pause
        exit /b 1
    )
    set "PYTHON_CMD=python"
)

REM 2. Check Node.js & npm
echo.
echo [2/5] Checking Node.js and npm...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [Notice] Node.js not detected. Attempting to install Node.js LTS via winget...
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [Warning] Please download and install Node.js from: https://nodejs.org/
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%i in ('node -v') do echo [OK] Detected Node.js %%i
)

REM 3. Check Ollama
echo.
echo [3/5] Checking Ollama local model engine...
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [Notice] Ollama not detected. Attempting installation via winget...
    winget install Ollama.Ollama --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [Notice] You can download Ollama for Windows from: https://ollama.com/download/windows
    ) else (
        echo [OK] Ollama installed.
    )
) else (
    echo [OK] Ollama is installed.
)

REM 4. Setup Python Virtual Environment & Dependencies
echo.
echo [4/5] Setting up Python backend virtual environment...
cd /d "%PROJECT_ROOT%\backend"
if not exist "venv" (
    echo Creating virtual environment at backend\venv...
    %PYTHON_CMD% -m venv venv
)

call venv\Scripts\activate.bat
echo Upgrading pip and installing backend requirements...
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

echo Initializing database and indexing sample policy documents...
set PYTHONPATH=.
python -m app.database.seed

REM 5. Setup Frontend
echo.
echo [5/5] Installing frontend dependencies...
cd /d "%PROJECT_ROOT%\frontend"
call npm install --silent
call npm run build --silent

echo.
echo ================================================================
echo    CLARIO INITIALIZATION COMPLETE!
echo ================================================================
echo Launch the full workspace anytime with:
echo    start.bat
echo.
echo Frontend Workspace:  http://localhost:5173
echo Backend REST API:    http://localhost:8000
echo OpenAPI Swagger:     http://localhost:8000/docs
echo ================================================================
cd /d "%PROJECT_ROOT%"
pause
