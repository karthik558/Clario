#!/usr/bin/env bash
# ==============================================================================
# Clario — macOS Automatic System Initialization & Environment Setup
# ==============================================================================

set -e

# Terminal Formatting
BOLD='\033[1m'
NC='\033[0m'

echo "================================================================"
echo "   CLARIO — MACOS SYSTEM INITIALIZATION & ENVIRONMENT SETUP"
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
        echo "[Error] Git is not installed. Please install Command Line Tools via: xcode-select --install"
        exit 1
    fi
    git clone "$REPO_URL" "$TARGET_DIR"
    PROJECT_ROOT="$(cd "$TARGET_DIR" && pwd)"
    cd "$PROJECT_ROOT"
fi

cd "$PROJECT_ROOT"

# 2. Check Homebrew
echo -e "\n[1/6] Checking Homebrew package manager..."
if ! command -v brew &>/dev/null; then
    echo "[Notice] Homebrew not detected. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -d "/opt/homebrew/bin" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -d "/usr/local/bin" ]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
else
    echo "[OK] Homebrew is installed: $(brew --version | head -n 1)"
fi

# 3. Check Python 3
echo -e "\n[2/6] Checking Python runtime..."
PYTHON_CMD=""
for cmd in python3.12 python3.11 python3.10 python3; do
    if command -v $cmd &>/dev/null; then
        VER=$($cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
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
    echo "[Notice] Python 3.12 or compatible version not found. Installing via Homebrew..."
    brew install python@3.12
    PYTHON_CMD="python3.12"
fi

# 4. Check Node.js & npm
echo -e "\n[3/6] Checking Node.js and npm..."
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "[Notice] Node.js not detected. Installing via Homebrew..."
    brew install node
    echo "[OK] Installed Node.js: $(node -v) with npm: $(npm -v)"
else
    echo "[OK] Node.js is installed: $(node -v) (npm $(npm -v))"
fi

# 5. Check & Setup Ollama
echo -e "\n[4/6] Checking Ollama local model engine..."
if ! command -v ollama &>/dev/null; then
    echo "[Notice] Ollama is not installed. Installing via Homebrew..."
    brew install --cask ollama || {
        echo "[Notice] Falling back to direct download..."
        curl -fsSL https://ollama.com/download/Ollama-darwin.zip -o /tmp/Ollama.zip
        unzip -q /tmp/Ollama.zip -d /Applications/
        rm /tmp/Ollama.zip
    }
    echo "[OK] Ollama installed."
else
    echo "[OK] Ollama is installed: $(ollama --version 2>/dev/null || echo 'installed')"
fi

# Check if Ollama daemon is responding; start if needed
if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "[Notice] Starting Ollama daemon in background..."
    if [ -d "/Applications/Ollama.app" ]; then
        open -a Ollama || true
    else
        ollama serve >/dev/null 2>&1 &
    fi
    sleep 3
fi

# Check available models
INSTALLED_MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || true)
if [ -n "$INSTALLED_MODELS" ]; then
    echo "[OK] Available Ollama models: $INSTALLED_MODELS"
else
    echo "[Notice] No Ollama models found. Pulling default lightweight model (llama3.2:3b)..."
    ollama pull llama3.2 || echo "[Warning] Could not pull model automatically. You can pull later with: ollama pull llama3.2"
fi

# 6. Configure Python Backend Virtual Environment
echo -e "\n[5/6] Setting up Python backend virtual environment..."
cd "$PROJECT_ROOT/backend"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment at backend/venv using $PYTHON_CMD..."
    $PYTHON_CMD -m venv venv
fi

source venv/bin/activate
echo "Upgrading pip and installing backend dependencies from requirements.txt..."
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
echo "You can now launch the full application anytime with:"
echo "   ./start.sh"
echo ""
echo "Or start individual services:"
echo "   Backend:  cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
echo "   Frontend: cd frontend && npm run dev"
echo ""
echo "Frontend Workspace:  http://localhost:5173"
echo "Backend REST API:    http://localhost:8000"
echo "OpenAPI Swagger:     http://localhost:8000/docs"
echo "================================================================"
