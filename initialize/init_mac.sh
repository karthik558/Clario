#!/usr/bin/env bash
# ==============================================================================
# Clario — macOS Automatic System Initialization & Environment Setup
# ==============================================================================

set -e

# Terminal Formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}   CLARIO — MACOS SYSTEM INITIALIZATION & ENVIRONMENT SETUP${NC}"
echo -e "   Full-stack automated setup: Python, Node.js, Database & Ollama"
echo -e "${BLUE}================================================================${NC}"

REPO_URL="https://github.com/karthik558/Clario.git"
TARGET_DIR="Clario"

# 1. Determine Repository Root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../backend/requirements.txt" ]; then
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    echo -e "[Info] Running inside existing Clario repository at: ${BOLD}$PROJECT_ROOT${NC}"
else
    echo -e "[Info] Repository not found locally. Cloning from $REPO_URL..."
    if ! command -v git &>/dev/null; then
        echo -e "${RED}[Error] Git is not installed. Please install Command Line Tools via: xcode-select --install${NC}"
        exit 1
    fi
    git clone "$REPO_URL" "$TARGET_DIR"
    PROJECT_ROOT="$(cd "$TARGET_DIR" && pwd)"
    cd "$PROJECT_ROOT"
fi

cd "$PROJECT_ROOT"

# 2. Check Homebrew
echo -e "\n${BOLD}[1/7] Checking Homebrew package manager...${NC}"
if ! command -v brew &>/dev/null; then
    echo "[Notice] Homebrew not detected. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -d "/opt/homebrew/bin" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -d "/usr/local/bin" ]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
else
    echo -e "${GREEN}[OK] Homebrew is installed: $(brew --version | head -n 1)${NC}"
fi

# 3. Check Python 3 Runtime & Version
echo -e "\n${BOLD}[2/7] Checking Python runtime...${NC}"
PYTHON_CMD=""
FOUND_PY=""

for cmd in python3.12 python3.11 python3.10 python3 python; do
    if command -v $cmd &>/dev/null; then
        FOUND_PY="$cmd"
        MAJOR=$($cmd -c 'import sys; print(sys.version_info.major)' 2>/dev/null || echo 0)
        MINOR=$($cmd -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo 0)
        if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 10 ]; then
            PYTHON_CMD="$cmd"
            echo -e "${GREEN}[OK] Compatible Python detected: $($cmd --version) ($PYTHON_CMD)${NC}"
            break
        fi
    fi
done

if [ -z "$FOUND_PY" ]; then
    echo "[Notice] Python is not installed. Installing Python 3.12 via Homebrew..."
    brew install python@3.12
    if [ -x "$(brew --prefix python@3.12 2>/dev/null)/bin/python3.12" ]; then
        PYTHON_CMD="$(brew --prefix python@3.12)/bin/python3.12"
    else
        PYTHON_CMD="python3.12"
    fi
    echo -e "${GREEN}[OK] Python 3.12 installed: $($PYTHON_CMD --version)${NC}"
elif [ -z "$PYTHON_CMD" ]; then
    OLD_VER="$($FOUND_PY --version 2>&1)"
    echo -e "${YELLOW}[Warning] Detected older Python runtime: $OLD_VER.${NC}"
    echo -e "Clario requires Python 3.10 or newer (Python 3.12 recommended)."
    read -r -p "Would you like to install/update to Python 3.12 now? [Y/n] " UPDATE_CHOICE
    UPDATE_CHOICE="${UPDATE_CHOICE:-Y}"
    if [[ "$UPDATE_CHOICE" =~ ^[Yy]$ ]]; then
        echo "[Notice] Installing Python 3.12 via Homebrew..."
        brew install python@3.12
        if [ -x "$(brew --prefix python@3.12 2>/dev/null)/bin/python3.12" ]; then
            PYTHON_CMD="$(brew --prefix python@3.12)/bin/python3.12"
        else
            PYTHON_CMD="python3.12"
        fi
        echo -e "${GREEN}[OK] Python 3.12 installed: $($PYTHON_CMD --version)${NC}"
    else
        echo -e "${YELLOW}[Notice] Continuing with existing Python: $OLD_VER. Note that modern dependencies may fail.${NC}"
        PYTHON_CMD="$FOUND_PY"
    fi
fi

# 5. Check Node.js & npm
echo -e "\n${BOLD}[3/7] Checking Node.js and npm...${NC}"
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "[Notice] Node.js not detected. Installing via Homebrew..."
    brew install node
    echo -e "${GREEN}[OK] Installed Node.js: $(node -v) with npm: $(npm -v)${NC}"
else
    echo -e "${GREEN}[OK] Node.js is installed: $(node -v) (npm $(npm -v))${NC}"
fi

# 6. Check & Setup Ollama
echo -e "\n${BOLD}[4/7] Checking Ollama local model engine...${NC}"
if ! command -v ollama &>/dev/null; then
    echo "[Notice] Ollama is not installed. Installing via Homebrew..."
    brew install --cask ollama || {
        echo "[Notice] Falling back to direct download..."
        curl -fsSL https://ollama.com/download/Ollama-darwin.zip -o /tmp/Ollama.zip
        unzip -q /tmp/Ollama.zip -d /Applications/
        rm -f /tmp/Ollama.zip
    }
    echo -e "${GREEN}[OK] Ollama installed.${NC}"
else
    echo -e "${GREEN}[OK] Ollama is installed: $(ollama --version 2>/dev/null || echo 'installed')${NC}"
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

# Pull default model if needed
INSTALLED_MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || true)
if [ -n "$INSTALLED_MODELS" ]; then
    echo -e "${GREEN}[OK] Available Ollama models: $INSTALLED_MODELS${NC}"
else
    echo "[Notice] Pulling default model (llama3.2)..."
    ollama pull llama3.2 >/dev/null 2>&1 || echo "[Warning] Could not pull model automatically. You can pull later with: ollama pull llama3.2"
fi

# 7. Configure Environment Variables & Workspace Password
echo -e "\n${BOLD}[5/7] Configuring workspace environment & security...${NC}"
BACKEND_DIR="$PROJECT_ROOT/backend"
mkdir -p "$BACKEND_DIR/data/documents" "$BACKEND_DIR/data/reports"

if [ ! -f "$BACKEND_DIR/.env" ]; then
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$BACKEND_DIR/.env"
        echo -e "${GREEN}[OK] Created backend/.env from .env.example${NC}"
    else
        cat <<EOF > "$BACKEND_DIR/.env"
PROJECT_NAME="Clario"
TAGLINE="Every document. A clearer answer."
DATABASE_URL="sqlite:///./data/clario.db"
LLM_PROVIDER="extractive"
EOF
        echo -e "${GREEN}[OK] Generated backend/.env with default settings${NC}"
    fi
fi

# 8. Configure Python Backend Virtual Environment
echo -e "\n${BOLD}[6/7] Setting up Python backend virtual environment & database...${NC}"
cd "$BACKEND_DIR"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment at backend/venv using $PYTHON_CMD..."
    $PYTHON_CMD -m venv venv
fi

source venv/bin/activate
echo "Installing and upgrading backend dependencies..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

echo "Initializing database, extracting passages & indexing sample corpus..."
PYTHONPATH=. python -m app.database.seed

# 9. Configure Frontend
echo -e "\n${BOLD}[7/7] Installing frontend dependencies & building production bundle...${NC}"
cd "$PROJECT_ROOT/frontend"
npm install --silent
npm run build --silent

# 10. Self-Test & Verification
echo -e "\n${BOLD}[Verification] Performing full-stack self-test...${NC}"
cd "$BACKEND_DIR"
source venv/bin/activate
python -c "
import fastapi, pymupdf, openpyxl, docx, reportlab, sqlalchemy
print('  ✔ Backend core Python libraries verified')
"

if [ -f "$BACKEND_DIR/data/clario.db" ]; then
    echo -e "  ${GREEN}✔ SQLite database verified: backend/data/clario.db${NC}"
fi

if [ -f "$PROJECT_ROOT/frontend/dist/index.html" ]; then
    echo -e "  ${GREEN}✔ Frontend production bundle verified: frontend/dist/${NC}"
fi

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${BOLD}   CLARIO INITIALIZATION COMPLETE!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "Everything is set up and ready to use."
echo -e "\nLaunch the full application anytime with:"
echo -e "   ${BOLD}./start.sh${NC}"
echo -e "\nOr start services individually:"
echo -e "   Backend:  ${BOLD}cd backend && source venv/bin/activate && uvicorn app.main:app --reload${NC}"
echo -e "   Frontend: ${BOLD}cd frontend && npm run dev${NC}"
echo -e "\nAccess URLs:"
echo -e "   Frontend Workspace:  ${BLUE}http://localhost:5173${NC}"
echo -e "   Backend REST API:    ${BLUE}http://localhost:8000${NC}"
echo -e "   OpenAPI Swagger:     ${BLUE}http://localhost:8000/docs${NC}"
echo -e "${GREEN}================================================================${NC}"
