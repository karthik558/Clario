@echo off
REM ==============================================================================
REM Clario — Windows Automatic System Initialization & Environment Setup
REM ==============================================================================

setlocal enabledelayedexpansion

echo ================================================================
echo    CLARIO -- WINDOWS SYSTEM INITIALIZATION & ENVIRONMENT SETUP
echo    Full-stack automated setup: Python, Node.js, Database & Ollama
echo ================================================================

REM ==============================================================================
REM 1. Repository Setup & Clone Verification
REM ==============================================================================
echo.
echo [1/8] Checking Clario repository files & cloning option...

set "REPO_URL=https://github.com/karthik558/Clario.git"
set "TARGET_DIR=Clario"
set "FORCE_CLONE=0"
set "FORCE_PULL=0"

REM Parse optional CLI flags
if /i "%~1"=="--clone" set "FORCE_CLONE=1"
if /i "%~1"=="-c" set "FORCE_CLONE=1"
if /i "%~1"=="--pull" set "FORCE_PULL=1"

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "PROJECT_ROOT="
if exist "%SCRIPT_DIR%\..\backend\requirements.txt" (
    cd /d "%SCRIPT_DIR%\.."
    set "PROJECT_ROOT=!CD!"
) else if exist "%SCRIPT_DIR%\backend\requirements.txt" (
    cd /d "%SCRIPT_DIR%"
    set "PROJECT_ROOT=!CD!"
) else if exist "%SCRIPT_DIR%\%TARGET_DIR%\backend\requirements.txt" (
    cd /d "%SCRIPT_DIR%\%TARGET_DIR%"
    set "PROJECT_ROOT=!CD!"
)

REM If repository files are not found locally, trigger auto-clone
if "!PROJECT_ROOT!"=="" (
    echo [Notice] Clario repository files not detected in: !SCRIPT_DIR!
    echo Automatic cloning enabled from !REPO_URL!...
    set "FORCE_CLONE=1"
)

REM Check or install Git if cloning or pulling is needed
if "!FORCE_CLONE!"=="1" (
    where git >nul 2>&1
    if !errorlevel! neq 0 (
        echo [Notice] Git is not detected on your system.
        echo Installing Git for Windows automatically via winget...
        winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements
        if !errorlevel! neq 0 (
            echo [Error] Git installation via winget failed.
            echo Please download and install Git from: https://git-scm.com/download/win
            pause
            exit /b 1
        )
        if exist "%ProgramFiles%\Git\cmd" set "PATH=%ProgramFiles%\Git\cmd;!PATH!"
        if exist "%ProgramFiles(x86)%\Git\cmd" set "PATH=%ProgramFiles(x86)%\Git\cmd;!PATH!"
        if exist "%LocalAppData%\Programs\Git\cmd" set "PATH=%LocalAppData%\Programs\Git\cmd;!PATH!"
    )

    echo [Info] Cloning Clario repository from !REPO_URL!...
    cd /d "!SCRIPT_DIR!"
    if exist "%TARGET_DIR%\backend\requirements.txt" (
        cd /d "%SCRIPT_DIR%\%TARGET_DIR%"
        set "PROJECT_ROOT=!CD!"
        echo [OK] Using existing Clario folder at: !PROJECT_ROOT!
    ) else (
        git clone !REPO_URL! !TARGET_DIR!
        if !errorlevel! neq 0 (
            echo [Error] Git clone failed. Please check your internet connection.
            pause
            exit /b 1
        )
        cd /d "!SCRIPT_DIR!\%TARGET_DIR%"
        set "PROJECT_ROOT=!CD!"
        echo [OK] Clario repository cloned successfully to: !PROJECT_ROOT!
    )
) else (
    echo [OK] Existing Clario repository detected at: !PROJECT_ROOT!
    if "!FORCE_PULL!"=="1" (
        echo [Info] Pulling latest repository updates...
        cd /d "!PROJECT_ROOT!"
        git pull
    ) else (
        echo.
        echo Repository options:
        echo   [1] Use current local files and proceed with setup (Default)
        echo   [2] Pull latest changes from GitHub (git pull)
        echo   [3] Clone a fresh copy of Clario
        set "REPO_ACTION=1"
        set /p "REPO_ACTION=Select option (1-3, default 1): "
        if "!REPO_ACTION!"=="" set "REPO_ACTION=1"
        if "!REPO_ACTION!"=="2" (
            echo [Info] Pulling latest changes from GitHub...
            cd /d "!PROJECT_ROOT!"
            git pull
        ) else if "!REPO_ACTION!"=="3" (
            set "FRESH_DIR=Clario_fresh"
            echo [Info] Cloning fresh copy into "!SCRIPT_DIR!\!FRESH_DIR!"...
            cd /d "!SCRIPT_DIR!"
            git clone !REPO_URL! !FRESH_DIR!
            if !errorlevel! equ 0 (
                cd /d "!SCRIPT_DIR!\!FRESH_DIR!"
                set "PROJECT_ROOT=!CD!"
                echo [OK] Switched to freshly cloned repository: !PROJECT_ROOT!
            ) else (
                echo [Warning] Clone failed. Proceeding with existing repository.
            )
        )
    )
)

cd /d "!PROJECT_ROOT!"

REM ==============================================================================
REM 2. Check Python Runtime & Version
REM ==============================================================================
echo.
echo [2/8] Checking Python runtime...
set "PYTHON_CMD="
set "PYTHON_VERSION_OK=0"

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_CMD=python"
) else (
    py --version >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_CMD=py"
    )
)

if "%PYTHON_CMD%"=="" (
    echo [Notice] Python not detected on your system.
    echo Installing Python 3.12 automatically via winget...
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    if !errorlevel! neq 0 (
        echo [Warning] Automatic installation via winget failed.
        echo Please download and install Python 3.12 manually from: https://www.python.org/downloads/
        echo Ensure you check 'Add Python to PATH' during installation.
        pause
        exit /b 1
    )
    set "PYTHON_CMD=python"
    set "PYTHON_VERSION_OK=1"
    echo [OK] Python 3.12 installed successfully.
) else (
    for /f "tokens=*" %%i in ('%PYTHON_CMD% --version 2^>^&1') do echo [Info] Detected %%i

    for /f "tokens=1,2 delims=." %%a in ('%PYTHON_CMD% -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2^>nul') do (
        set "PY_MAJOR=%%a"
        set "PY_MINOR=%%b"
    )

    if defined PY_MAJOR if defined PY_MINOR (
        if !PY_MAJOR! equ 3 if !PY_MINOR! geq 10 (
            set "PYTHON_VERSION_OK=1"
            echo [OK] Compatible Python runtime verified (!PY_MAJOR!.!PY_MINOR!).
        )
    )

    if "!PYTHON_VERSION_OK!"=="0" (
        echo [Warning] Detected older Python version (!PY_MAJOR!.!PY_MINOR!).
        echo Clario requires Python 3.10 or newer (Python 3.11 or 3.12 recommended).
        echo.
        set /p "UPDATE_CHOICE=Would you like to install/update to Python 3.12 now? (Y/N, default Y): "
        if /i "!UPDATE_CHOICE!"=="" set "UPDATE_CHOICE=Y"
        if /i "!UPDATE_CHOICE!"=="Y" (
            echo Installing/updating to Python 3.12 via winget...
            winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
            if !errorlevel! equ 0 (
                echo [OK] Python 3.12 installed.
                set "PYTHON_CMD=python"
            ) else (
                echo [Warning] Automatic update failed. Please update Python from https://www.python.org/downloads/
            )
        ) else (
            echo [Notice] Continuing with existing Python (!PY_MAJOR!.!PY_MINOR!). Some dependencies may fail.
        )
    )
)

REM ==============================================================================
REM 3. Check Node.js & npm
REM ==============================================================================
echo.
echo [3/8] Checking Node.js and npm...
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

REM ==============================================================================
REM 4. Check Ollama Local Model Engine
REM ==============================================================================
echo.
echo [4/8] Checking Ollama local model engine...
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

REM ==============================================================================
REM 5. Configure Workspace Environment & Security
REM ==============================================================================
echo.
echo [5/8] Configuring workspace environment & security...
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

REM ==============================================================================
REM 6. Setup Python Virtual Environment & Dependencies
REM ==============================================================================
echo.
echo [6/8] Setting up Python backend virtual environment & database...
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

REM ==============================================================================
REM 7. Setup Frontend
REM ==============================================================================
echo.
echo [7/8] Installing frontend dependencies & building production bundle...
cd /d "%PROJECT_ROOT%\frontend"
call npm install --silent
call npm run build --silent

REM ==============================================================================
REM 8. Self-Test & Verification
REM ==============================================================================
echo.
echo [8/8] Performing full-stack self-test...
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
