#!/usr/bin/env bash
# ==============================================================================
# Clario — Linux Automatic System Initialization & Environment Setup
# ==============================================================================

set -e

echo "================================================================"
echo "   CLARIO — LINUX SYSTEM INITIALIZATION & ENVIRONMENT SETUP"
echo "   Automated dependency verification: Python, Node.js & Ollama"
echo "================================================================"

REPO_URL="https://github.com/karthik558/Clario.git"
TARGET_DIR="Clario"

# 1. Determine Repository Root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../backend/requirements.txt" ]; then
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    echo "[Info] Running inside existing Clario repository at: $PROJECT_ROOT"
else
    echo "[Info] Repository not found locally. Cloning from $REPO_URL..."
    if ! command -v git &>/dev/null; then
        echo "[Notice] Installing git..."
        if command -v apt-get &>/dev/null; then
            sudo apt-get update && sudo apt-get install -y git
        elif command -v dnf &>/dev/null; then
            sudo dnf install -y git
        elif command -v pacman &>/dev/null; then
            sudo pacman -Sy --noconfirm git
        fi
    fi
    git clone "$REPO_URL" "$TARGET_DIR"
    PROJECT_ROOT="$(cd "$TARGET_DIR" && pwd)"
    cd "$PROJECT_ROOT"
fi

cd "$PROJECT_ROOT"

# Helper for sudo
SUDO=""
if [ "$EUID" -ne 0 ]; then
    if command -v sudo &>/dev/null; then
        SUDO="sudo"
    else
        echo "[Warning] Running as non-root user and sudo is not installed. Package installations may fail if root access is required."
    fi
fi

# 2. Check Package Manager & Install System Prerequisites
echo -e "\n[1/6] Checking system package manager and build essentials..."
if command -v apt-get &>/dev/null; then
    PKG_MGR="apt"
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq build-essential curl wget git
elif command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
    $SUDO dnf install -y -q gcc gcc-c++ make curl wget git
elif command -v pacman &>/dev/null; then
    PKG_MGR="pacman"
    $SUDO pacman -Sy --noconfirm base-devel curl wget git
else
    PKG_MGR="unknown"
    echo "[Warning] Unknown package manager. Please ensure build essentials, curl, and git are installed."
fi

# 3. Check Python 3
echo -e "\n[2/6] Checking Python 3 runtime..."
PYTHON_CMD=""
for cmd in python3.12 python3.11 python3.10 python3; do
    if command -v $cmd &>/dev/null; then
        MAJOR=$($cmd -c 'import sys; print(sys.version_info.major)')
        MINOR=$($cmd -c 'import sys; print(sys.version_info.minor)')
        if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 10 ]; then
            PYTHON_CMD="$cmd"
            echo "[OK] Compatible Python detected: $($cmd --version) ($PYTHON_CMD)"
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "[Notice] Compatible Python 3 not detected. Installing via system package manager..."
    if [ "$PKG_MGR" = "apt" ]; then
        $SUDO apt-get install -y python3 python3-pip python3-venv python3-dev
        PYTHON_CMD="python3"
    elif [ "$PKG_MGR" = "dnf" ]; then
        $SUDO dnf install -y python3 python3-pip python3-devel
        PYTHON_CMD="python3"
    elif [ "$PKG_MGR" = "pacman" ]; then
        $SUDO pacman -S --noconfirm python python-pip
        PYTHON_CMD="python3"
    else
        echo "[Error] Could not automatically install Python 3. Please install Python 3.10+ manually."
        exit 1
    fi
fi

# Verify venv module
if ! $PYTHON_CMD -c "import venv" &>/dev/null; then
    echo "[Notice] Installing python3-venv package..."
    if [ "$PKG_MGR" = "apt" ]; then
        $SUDO apt-get install -y python3-venv
    fi
fi

# 4. Check Node.js & npm
echo -e "\n[3/6] Checking Node.js and npm..."
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "[Notice] Node.js not found. Installing Node.js LTS (v20)..."
    if [ "$PKG_MGR" = "apt" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
        $SUDO apt-get install -y nodejs
    elif [ "$PKG_MGR" = "dnf" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
        $SUDO dnf install -y nodejs
    elif [ "$PKG_MGR" = "pacman" ]; then
        $SUDO pacman -S --noconfirm nodejs npm
    fi
    echo "[OK] Installed Node.js: $(node -v) (npm $(npm -v))"
else
    echo "[OK] Node.js is installed: $(node -v) (npm $(npm -v))"
fi

# 5. Check Ollama
echo -e "\n[4/6] Checking Ollama local model engine..."
if ! command -v ollama &>/dev/null; then
    echo "[Notice] Ollama is not installed. Installing via official installer script..."
    curl -fsSL https://ollama.com/install.sh | sh
    echo "[OK] Ollama installed."
else
    echo "[OK] Ollama is installed: $(ollama --version 2>/dev/null || echo 'installed')"
fi

# Ensure service is running
if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "[Notice] Starting Ollama service..."
    if command -v systemctl &>/dev/null; then
        $SUDO systemctl start ollama || ollama serve >/dev/null 2>&1 &
    else
        ollama serve >/dev/null 2>&1 &
    fi
    sleep 3
fi

# 6. Configure Python Backend
echo -e "\n[5/6] Setting up Python backend virtual environment..."
cd "$PROJECT_ROOT/backend"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment at backend/venv..."
    $PYTHON_CMD -m venv venv
fi

source venv/bin/activate
echo "Upgrading pip and installing backend dependencies..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

echo "Initializing database and indexing sample policy documents..."
PYTHONPATH=. python3 -m app.database.seed

# 7. Configure Frontend
echo -e "\n[6/6] Installing frontend dependencies..."
cd "$PROJECT_ROOT/frontend"
npm install --silent

echo "Building frontend production bundle..."
npm run build --silent

echo ""
echo "================================================================"
echo "   CLARIO INITIALIZATION COMPLETE!"
echo "================================================================"
echo "Launch the application anytime with:"
echo "   ./start.sh"
echo ""
echo "Frontend Workspace:  http://localhost:5173"
echo "Backend REST API:    http://localhost:8000"
echo "OpenAPI Swagger:     http://localhost:8000/docs"
echo "================================================================"
