@echo off
REM ==============================================================================
REM Clario — Windows Automatic System Initialization & Environment Setup
REM ==============================================================================

setlocal enabledelayedexpansion

echo ================================================================
echo    CLARIO -- WINDOWS SYSTEM INITIALIZATION & ENVIRONMENT SETUP
echo    Full-stack automated setup: Python, Node.js, Database & Ollama
echo ================================================================

cd /d "%~dp0.."
set "PROJECT_ROOT=%CD%"

REM Parse optional password argument
set "USER_PASSWORD="
if "%~1"=="--password" (
    set "USER_PASSWORD=%~2"
) else if "%~1"=="-p" (
    set "USER_PASSWORD=%~2"
) else if not "%~1"=="" (
    set "USER_PASSWORD=%~1"
)
if "%USER_PASSWORD%"=="" (
    if defined PASSWORD set "USER_PASSWORD=%PASSWORD%"
    if defined WORKSPACE_PASSWORD set "USER_PASSWORD=%WORKSPACE_PASSWORD%"
)

REM 1. Check Python
echo.
echo [1/7] Checking Python runtime...
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
echo [2/7] Checking Node.js and npm...
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
echo [3/7] Checking Ollama local model engine...
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

REM 4. Configure Workspace Environment & Security
echo.
echo [4/7] Configuring workspace environment & security...
if not exist "%PROJECT_ROOT%\backend\data\documents" mkdir "%PROJECT_ROOT%\backend\data\documents"
if not exist "%PROJECT_ROOT%\backend\data\reports" mkdir "%PROJECT_ROOT%\backend\data\reports"

if not exist "%PROJECT_ROOT%\backend\.env" (
    if exist "%PROJECT_ROOT%\.env.example" (
        copy "%PROJECT_ROOT%\.env.example" "%PROJECT_ROOT%\backend\.env" >nul
        echo [OK] Created backend\.env from .env.example
    ) else (
        (
            echo PROJECT_NAME="Clario"
            echo TAGLINE="Every document. A clearer answer."
            echo DATABASE_URL="sqlite:///./data/clario.db"
            echo LLM_PROVIDER="extractive"
        ) > "%PROJECT_ROOT%\backend\.env"
        echo [OK] Generated backend\.env with default settings
    )
)

if not "%USER_PASSWORD%"=="" (
    echo WORKSPACE_PASSWORD="%USER_PASSWORD%">>"%PROJECT_ROOT%\backend\.env"
    echo [OK] Workspace password configured successfully.
)

REM 5. Setup Python Virtual Environment & Dependencies
echo.
echo [5/7] Setting up Python backend virtual environment & database...
cd /d "%PROJECT_ROOT%\backend"
if not exist "venv" (
    echo Creating virtual environment at backend\venv...
    %PYTHON_CMD% -m venv venv
)

call venv\Scripts\activate.bat
echo Upgrading pip and installing backend requirements...
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

echo Initializing database, extracting passages & indexing sample corpus...
set PYTHONPATH=.
python -m app.database.seed

REM 6. Setup Frontend
echo.
echo [6/7] Installing frontend dependencies & building production bundle...
cd /d "%PROJECT_ROOT%\frontend"
call npm install --silent
call npm run build --silent

REM 7. Self-Test & Verification
echo.
echo [7/7] Performing full-stack self-test...
cd /d "%PROJECT_ROOT%\backend"
call venv\Scripts\activate.bat
python -c "import fastapi, pymupdf, openpyxl, docx, reportlab, sqlalchemy; print('  ✔ Backend core Python libraries verified')"

if exist "%PROJECT_ROOT%\backend\data\clario.db" (
    echo   ✔ SQLite database verified: backend\data\clario.db
)
if exist "%PROJECT_ROOT%\frontend\dist\index.html" (
    echo   ✔ Frontend production bundle verified: frontend\dist\
)

echo.
echo ================================================================
echo    CLARIO INITIALIZATION COMPLETE!
echo ================================================================
echo Everything is set up and ready to use.
echo.
echo Launch the full workspace anytime with:
echo    start.bat
echo.
echo Or start services individually:
echo    Backend:  cd backend ^&^& call venv\Scripts\activate.bat ^&^& uvicorn app.main:app --reload
echo    Frontend: cd frontend ^&^& npm run dev
echo.
echo Access URLs:
echo    Frontend Workspace:  http://localhost:5173
echo    Backend REST API:    http://localhost:8000
echo    OpenAPI Swagger:     http://localhost:8000/docs
echo ================================================================
cd /d "%PROJECT_ROOT%"
pause
