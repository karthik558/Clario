@echo off
REM ==============================================================================
REM Clario — Windows Automatic System Initialization & Environment Setup
REM Full-stack automated setup: Python, Node.js, Database & Ollama
REM Supports local drives as well as UNC network shares (Parallels / VMs / SMB)
REM ==============================================================================

setlocal enabledelayedexpansion

echo ================================================================
echo    CLARIO -- WINDOWS SYSTEM INITIALIZATION AND ENVIRONMENT SETUP
echo    Full-stack automated setup: Python, Node.js, Database and Ollama
echo ================================================================

REM ==============================================================================
REM 1. Repository Setup and Clone Verification
REM ==============================================================================
echo.
echo [1/8] Checking Clario repository files and cloning option...

set "REPO_URL=https://github.com/karthik558/Clario.git"
set "TARGET_DIR=Clario"
set "FORCE_CLONE=0"
set "FORCE_PULL=0"

REM Parse optional CLI flags
if /i "%~1"=="--clone" set "FORCE_CLONE=1"
if /i "%~1"=="-c" set "FORCE_CLONE=1"
if /i "%~1"=="--pull" set "FORCE_PULL=1"

REM Handle UNC network shares automatically via pushd
pushd "%~dp0"
set "SCRIPT_DIR=%CD%"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "PROJECT_ROOT="
if exist "%SCRIPT_DIR%\..\backend\requirements.txt" (
    pushd "%SCRIPT_DIR%\.."
    set "PROJECT_ROOT=!CD!"
    popd
) else if exist "%SCRIPT_DIR%\backend\requirements.txt" (
    set "PROJECT_ROOT=!SCRIPT_DIR!"
) else if exist "%SCRIPT_DIR%\%TARGET_DIR%\backend\requirements.txt" (
    pushd "%SCRIPT_DIR%\%TARGET_DIR%"
    set "PROJECT_ROOT=!CD!"
    popd
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
        pushd "%SCRIPT_DIR%\%TARGET_DIR%"
        set "PROJECT_ROOT=!CD!"
        popd
        echo [OK] Using existing Clario folder at: !PROJECT_ROOT!
    ) else (
        git clone !REPO_URL! !TARGET_DIR!
        if !errorlevel! neq 0 (
            echo [Error] Git clone failed. Please check your internet connection.
            pause
            exit /b 1
        )
        pushd "%SCRIPT_DIR%\%TARGET_DIR%"
        set "PROJECT_ROOT=!CD!"
        popd
        echo [OK] Clario repository cloned successfully to: !PROJECT_ROOT!
    )
) else (
    echo [OK] Existing Clario repository detected at: !PROJECT_ROOT!
    if "!FORCE_PULL!"=="1" (
        echo [Info] Pulling latest repository updates...
        pushd "!PROJECT_ROOT!"
        git pull
        popd
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
            pushd "!PROJECT_ROOT!"
            git pull
            popd
        ) else if "!REPO_ACTION!"=="3" (
            set "FRESH_DIR=Clario_fresh"
            echo [Info] Cloning fresh copy into "!SCRIPT_DIR!\!FRESH_DIR!"...
            pushd "!SCRIPT_DIR!"
            git clone !REPO_URL! !FRESH_DIR!
            if !errorlevel! equ 0 (
                pushd "!SCRIPT_DIR!\!FRESH_DIR!"
                set "PROJECT_ROOT=!CD!"
                popd
                echo [OK] Switched to freshly cloned repository: !PROJECT_ROOT!
            ) else (
                echo [Warning] Clone failed. Proceeding with existing repository.
            )
            popd
        )
    )
)

pushd "!PROJECT_ROOT!"

REM ==============================================================================
REM 2. Check Python Runtime and Version
REM ==============================================================================
echo.
echo [2/8] Checking Python runtime...

REM Add standard Python paths if installed
if exist "%LocalAppData%\Programs\Python\Python312" set "PATH=%LocalAppData%\Programs\Python\Python312;%LocalAppData%\Programs\Python\Python312\Scripts;!PATH!"
if exist "%LocalAppData%\Programs\Python\Python311" set "PATH=%LocalAppData%\Programs\Python\Python311;%LocalAppData%\Programs\Python\Python311\Scripts;!PATH!"
if exist "%ProgramFiles%\Python312" set "PATH=%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;!PATH!"
if exist "%ProgramFiles%\Python311" set "PATH=%ProgramFiles%\Python311;%ProgramFiles%\Python311\Scripts;!PATH!"

set "PYTHON_CMD="
set "PYTHON_VERSION_OK=0"

python -c "import sys; sys.exit(0)" >nul 2>&1
if !errorlevel! equ 0 (
    set "PYTHON_CMD=python"
) else (
    py -c "import sys; sys.exit(0)" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_CMD=py"
    )
)

if "%PYTHON_CMD%"=="" (
    echo [Notice] Python not detected on your system.
    echo Installing Python 3.12 automatically via winget...
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    if exist "%LocalAppData%\Programs\Python\Python312" set "PATH=%LocalAppData%\Programs\Python\Python312;%LocalAppData%\Programs\Python\Python312\Scripts;!PATH!"
    if exist "%ProgramFiles%\Python312" set "PATH=%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;!PATH!"

    python -c "import sys; sys.exit(0)" >nul 2>&1
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
            if exist "%LocalAppData%\Programs\Python\Python312" set "PATH=%LocalAppData%\Programs\Python\Python312;%LocalAppData%\Programs\Python\Python312\Scripts;!PATH!"
            if exist "%ProgramFiles%\Python312" set "PATH=%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;!PATH!"
            python -c "import sys; sys.exit(0)" >nul 2>&1
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
REM 3. Check Node.js and npm
REM ==============================================================================
echo.
echo [3/8] Checking Node.js and npm...

REM Add standard Node.js paths if installed
if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;!PATH!"
if exist "%ProgramFiles(x86)%\nodejs" set "PATH=%ProgramFiles(x86)%\nodejs;!PATH!"
if exist "%LocalAppData%\Programs\nodejs" set "PATH=%LocalAppData%\Programs\nodejs;!PATH!"
if exist "%AppData%\npm" set "PATH=%AppData%\npm;!PATH!"

call npm -v >nul 2>&1
if !errorlevel! neq 0 (
    echo [Notice] Node.js and npm not detected. Attempting to install Node.js LTS via winget...
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;!PATH!"
    if exist "%ProgramFiles(x86)%\nodejs" set "PATH=%ProgramFiles(x86)%\nodejs;!PATH!"
    if exist "%LocalAppData%\Programs\nodejs" set "PATH=%LocalAppData%\Programs\nodejs;!PATH!"
    if exist "%AppData%\npm" set "PATH=%AppData%\npm;!PATH!"
    call npm -v >nul 2>&1
    if !errorlevel! neq 0 (
        echo [Warning] Please download and install Node.js from: https://nodejs.org/
        pause
        exit /b 1
    )
    echo [OK] Node.js and npm installed successfully.
) else (
    for /f "tokens=*" %%i in ('node -v 2^>nul') do (
        for /f "tokens=*" %%j in ('call npm -v 2^>nul') do echo [OK] Detected Node.js %%i with npm %%j
    )
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
REM 5. Configure Workspace Environment and Security
REM ==============================================================================
echo.
echo [5/8] Configuring workspace environment and security...
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
REM 6. Setup Python Virtual Environment and Dependencies
REM ==============================================================================
echo.
echo [6/8] Setting up Python backend virtual environment and database...
pushd "%PROJECT_ROOT%\backend"
set "VENV_PYTHON=%PROJECT_ROOT%\backend\venv\Scripts\python.exe"
if not exist "!VENV_PYTHON!" (
    echo Creating virtual environment at backend\venv...
    %PYTHON_CMD% -m venv venv
)

call venv\Scripts\activate.bat
echo Upgrading pip and installing backend requirements...
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

REM Verify critical backend dependencies
"!VENV_PYTHON!" -c "import fastapi, uvicorn, sqlalchemy" >nul 2>&1
if !errorlevel! neq 0 (
    echo [Warning] Re-running pip install with full verbose output...
    pip install -r requirements.txt
)

echo Initializing local database schema (fresh clean workspace)...
set PYTHONPATH=.
"!VENV_PYTHON!" -m app.database.seed
popd

REM ==============================================================================
REM 7. Setup Frontend
REM ==============================================================================
echo.
echo [7/8] Installing frontend dependencies and building production bundle...
pushd "%PROJECT_ROOT%\frontend"
call npm install --silent
call npm run build --silent
popd

REM ==============================================================================
REM 8. Self-Test and Verification
REM ==============================================================================
echo.
echo [8/8] Performing full-stack self-test...
pushd "%PROJECT_ROOT%\backend"
call venv\Scripts\activate.bat
"!VENV_PYTHON!" -c "import fastapi, openpyxl, docx, reportlab, sqlalchemy; print('  ✔ Backend core Python libraries verified')"

if exist "%PROJECT_ROOT%\backend\data\clario.db" (
    echo   ✔ SQLite database verified: backend\data\clario.db
)
if exist "%PROJECT_ROOT%\frontend\dist\index.html" (
    echo   ✔ Frontend production bundle verified: frontend\dist\
)
popd

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
popd
pause
