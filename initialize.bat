@echo off
REM ==============================================================================
REM Clario — Windows Initialization Launcher
REM Double-click to clone repository files (if missing) and set up full environment.
REM ==============================================================================

setlocal
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

if exist "%SCRIPT_DIR%\initialize\init_windows.bat" (
    call "%SCRIPT_DIR%\initialize\init_windows.bat" %*
) else (
    echo ================================================================
    echo    CLARIO -- INITIALIZATION LAUNCHER
    echo ================================================================
    where git >nul 2>&1
    if %errorlevel% neq 0 (
        echo [Notice] Git not detected. Installing Git via winget...
        winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements
        if exist "%ProgramFiles%\Git\cmd" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
    )
    echo Cloning Clario repository...
    cd /d "%SCRIPT_DIR%"
    git clone https://github.com/karthik558/Clario.git
    if exist "%SCRIPT_DIR%\Clario\initialize\init_windows.bat" (
        cd /d "%SCRIPT_DIR%\Clario"
        call initialize\init_windows.bat %*
    ) else (
        echo [Error] Failed to initialize Clario.
        pause
    )
)
