#!/usr/bin/env bash
# ==============================================================================
# Clario — Linux Automatic System Initialization & Environment Setup
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
echo -e "${BOLD}   CLARIO — LINUX SYSTEM INITIALIZATION & ENVIRONMENT SETUP${NC}"
echo -e "   Full-stack automated setup: Python, Node.js, Database & Ollama"
echo -e "${BLUE}================================================================${NC}"

# Parse optional password argument
USER_PASSWORD=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--password)
            USER_PASSWORD="$2"
            shift 2
            ;;
        --password=*)
            USER_PASSWORD="${1#*=}"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

USER_PASSWORD="${USER_PASSWORD:-${PASSWORD:-${SUDO_PASSWORD:-${WORKSPACE_PASSWORD:-}}}}"

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
        echo -e "[Notice] Installing git..."
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
        if [ -n "$USER_PASSWORD" ]; then
            echo -e "\n[Auth] Authenticating administrator privileges with provided password..."
            if echo "$USER_PASSWORD" | sudo -S -v 2>/dev/null; then
                SUDO="echo '$USER_PASSWORD' | sudo -S"
                echo -e "${GREEN}[OK] Administrator privileges authenticated.${NC}"
                # Keep-alive sudo in background
                while true; do echo "$USER_PASSWORD" | sudo -S -n true; sleep 50; kill -0 "$$" || exit; done 2>/dev/null &
            else
                echo -e "${YELLOW}[Notice] Provided password is not a sudo password; saving as workspace password.${NC}"
                SUDO="sudo"
            fi
        else
            echo -e "\n[Auth] System dependencies may require administrator (sudo) access."
            sudo -v || true
            SUDO="sudo"
            # Keep-alive sudo in background
            while true; do sudo -n true; sleep 50; kill -0 "$$" || exit; done 2>/dev/null &
        fi
    else
        echo -e "${YELLOW}[Warning] Running as non-root user and sudo is not installed. Package installations may fail if root access is required.${NC}"
    fi
fi

# 2. Check Package Manager & Install System Prerequisites
echo -e "\n${BOLD}[1/7] Checking system package manager and build essentials...${NC}"
if command -v apt-get &>/dev/null; then
    PKG_MGR="apt"
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq build-essential curl wget git software-properties-common
elif command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
    $SUDO dnf install -y -q gcc gcc-c++ make curl wget git
elif command -v pacman &>/dev/null; then
    PKG_MGR="pacman"
    $SUDO pacman -Sy --noconfirm base-devel curl wget git
else
    PKG_MGR="unknown"
    echo -e "${YELLOW}[Warning] Unknown package manager. Please ensure build essentials, curl, and git are installed.${NC}"
fi

# 3. Check Python 3
echo -e "\n${BOLD}[2/7] Checking Python 3 runtime...${NC}"
PYTHON_CMD=""
for cmd in python3.12 python3.11 python3.10 python3; do
    if command -v $cmd &>/dev/null; then
        MAJOR=$($cmd -c 'import sys; print(sys.version_info.major)' 2>/dev/null || echo 0)
        MINOR=$($cmd -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo 0)
        if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 10 ]; then
            PYTHON_CMD="$cmd"
            echo -e "${GREEN}[OK] Compatible Python detected: $($cmd --version) ($PYTHON_CMD)${NC}"
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
        echo -e "${RED}[Error] Could not automatically install Python 3. Please install Python 3.10+ manually.${NC}"
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
echo -e "\n${BOLD}[3/7] Checking Node.js and npm...${NC}"
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
    echo -e "${GREEN}[OK] Installed Node.js: $(node -v) (npm $(npm -v))${NC}"
else
    echo -e "${GREEN}[OK] Node.js is installed: $(node -v) (npm $(npm -v))${NC}"
fi

# 5. Check Ollama
echo -e "\n${BOLD}[4/7] Checking Ollama local model engine...${NC}"
if ! command -v ollama &>/dev/null; then
    echo "[Notice] Ollama is not installed. Installing via official installer script..."
    curl -fsSL https://ollama.com/install.sh | sh
    echo -e "${GREEN}[OK] Ollama installed.${NC}"
else
    echo -e "${GREEN}[OK] Ollama is installed: $(ollama --version 2>/dev/null || echo 'installed')${NC}"
fi

# Ensure service is running
if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "[Notice] Starting Ollama service..."
    if command -v systemctl &>/dev/null && [ -n "$SUDO" ]; then
        $SUDO systemctl start ollama 2>/dev/null || ollama serve >/dev/null 2>&1 &
    else
        ollama serve >/dev/null 2>&1 &
    fi
    sleep 3
fi

# 6. Configure Environment Variables & Workspace Password
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

# Set password if provided
if [ -n "$USER_PASSWORD" ]; then
    if grep -q "WORKSPACE_PASSWORD=" "$BACKEND_DIR/.env"; then
        sed -i "s/^WORKSPACE_PASSWORD=.*/WORKSPACE_PASSWORD=\"$USER_PASSWORD\"/" "$BACKEND_DIR/.env"
    else
        echo "WORKSPACE_PASSWORD=\"$USER_PASSWORD\"" >> "$BACKEND_DIR/.env"
    fi
    echo -e "${GREEN}[OK] Workspace password configured successfully.${NC}"
fi

# 7. Configure Python Backend Virtual Environment
echo -e "\n${BOLD}[6/7] Setting up Python backend virtual environment & database...${NC}"
cd "$BACKEND_DIR"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment at backend/venv..."
    $PYTHON_CMD -m venv venv
fi

source venv/bin/activate
echo "Upgrading pip and installing backend dependencies..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

echo "Initializing database, extracting passages & indexing sample corpus..."
PYTHONPATH=. python -m app.database.seed

# 8. Configure Frontend
echo -e "\n${BOLD}[7/7] Installing frontend dependencies & building production bundle...${NC}"
cd "$PROJECT_ROOT/frontend"
npm install --silent
npm run build --silent

# 9. Self-Test & Verification
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
echo -e "\nLaunch the application anytime with:"
echo -e "   ${BOLD}./start.sh${NC}"
echo -e "\nOr start services individually:"
echo -e "   Backend:  ${BOLD}cd backend && source venv/bin/activate && uvicorn app.main:app --reload${NC}"
echo -e "   Frontend: ${BOLD}cd frontend && npm run dev${NC}"
echo -e "\nAccess URLs:"
echo -e "   Frontend Workspace:  ${BLUE}http://localhost:5173${NC}"
echo -e "   Backend REST API:    ${BLUE}http://localhost:8000${NC}"
echo -e "   OpenAPI Swagger:     ${BLUE}http://localhost:8000/docs${NC}"
echo -e "${GREEN}================================================================${NC}"
