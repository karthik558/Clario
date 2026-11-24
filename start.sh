#!/usr/bin/env bash
# ==============================================================================
# Clario — Every document. A clearer answer.
# Unified Local Startup Script (macOS / Linux)
# ==============================================================================

set -e

# Terminal Colors
NAVY='\033[0;34m'
TEAL='\033[0;36m'
GOLD='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${TEAL}================================================================${NC}"
echo -e "${GOLD}   CLARIO — DOCUMENT INTELLIGENCE WORKSPACE${NC}"
echo -e "   Tagline: ${GREEN}Every document. A clearer answer.${NC}"
echo -e "${TEAL}================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# 0. Sync Repository (Pull latest updates)
echo -e "\n${TEAL}[Sync] Checking for repository updates (git pull)...${NC}"
if command -v git &>/dev/null; then
    if git pull; then
        echo -e "${GREEN}[OK] Repository updated successfully.${NC}"
    else
        echo -e "${GOLD}[Notice] Could not pull latest changes. Continuing with local version...${NC}"
    fi
fi

# 1. Check Python & Virtual Environment
echo -e "\n${NAVY}[1/4] Checking Python backend environment...${NC}"
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}[Error] Python 3 is not installed. Run ./initialize/setup.sh to install dependencies automatically.${NC}"
    exit 1
fi

PY_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)' 2>/dev/null || echo 0)
PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo 0)
if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]); then
    echo -e "${YELLOW}[Warning] Detected older Python version ($(python3 --version 2>&1)). Clario requires Python 3.10+.${NC}"
    echo -e "Run ${BOLD}./initialize/setup.sh${NC} to update Python to 3.12."
fi

if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "Creating Python virtual environment in $BACKEND_DIR/venv..."
    python3 -m venv "$BACKEND_DIR/venv"
    source "$BACKEND_DIR/venv/bin/activate"
    pip install --upgrade pip
    pip install -r "$BACKEND_DIR/requirements.txt"
else
    source "$BACKEND_DIR/venv/bin/activate"
fi

# 2. Database & Seed Corpus
echo -e "${NAVY}[2/4] Verifying SQLite database & document corpus...${NC}"
cd "$BACKEND_DIR"
PYTHONPATH=. python3 -m app.database.seed

# 3. Check Frontend Node Modules
echo -e "${NAVY}[3/4] Checking Frontend dependencies (Node.js & npm)...${NC}"
cd "$FRONTEND_DIR"
if ! command -v npm &>/dev/null; then
    echo -e "${RED}[Error] Node.js and npm are not installed. Run ./initialize/setup.sh to install them automatically.${NC}"
    exit 1
fi
if [ ! -d "node_modules" ]; then
    echo "Installing frontend npm packages..."
    npm install
fi

# 4. Launch Services
echo -e "${NAVY}[4/4] Starting Clario Backend and Frontend...${NC}"

# Cleanup background processes on exit
cleanup() {
    echo -e "\n${GOLD}Shutting down Clario services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Start Backend on Port 8000
cd "$BACKEND_DIR"
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start Frontend on Port 5173
cd "$FRONTEND_DIR"
npm run dev -- --host &
FRONTEND_PID=$!

echo -e "\n${GREEN}✔ Clario is up and running!${NC}"
echo -e "  &bull; Frontend Workspace:  ${TEAL}http://localhost:5173${NC}"
echo -e "  &bull; Backend REST API:    ${TEAL}http://localhost:8000${NC}"
echo -e "  &bull; OpenAPI Swagger:     ${TEAL}http://localhost:8000/docs${NC}"
echo -e "\n${GOLD}Press Ctrl+C to terminate both servers.${NC}\n"

wait
