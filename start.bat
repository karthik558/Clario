@echo off
REM ==============================================================================
REM Clario — Every document. A clearer answer.
REM Local Startup Script (Windows)
REM ==============================================================================

echo ================================================================
echo    CLARIO -- AI DOCUMENT INTELLIGENCE WORKSPACE
echo    Tagline: Every document. A clearer answer.
echo ================================================================

cd /d "%~dp0"

REM 1. Backend Setup
echo [1/4] Checking Python backend environment...
cd backend
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

REM 2. Seed Database
echo [2/4] Verifying database and sample documents...
set PYTHONPATH=.
python -m app.database.seed

REM 3. Frontend Setup
echo [3/4] Checking frontend dependencies...
cd ..\frontend
if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
)

REM 4. Launch Services
echo [4/4] Starting Clario Backend and Frontend...
start "Clario Backend (FastAPI)" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate.bat && set PYTHONPATH=. && uvicorn app.main:app --port 8000 --reload"
start "Clario Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo ================================================================
echo Clario is up and running!
echo   Frontend Workspace:  http://localhost:5173
echo   Backend REST API:    http://localhost:8000
echo   OpenAPI Swagger:     http://localhost:8000/docs
echo ================================================================
pause
