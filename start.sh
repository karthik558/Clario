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
echo -e "${GOLD}   CLARIO — AI DOCUMENT INTELLIGENCE WORKSPACE${NC}"
echo -e "   Tagline: ${GREEN}Every document. A clearer answer.${NC}"
echo -e "${TEAL}================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# 1. Check Python & Virtual Environment
echo -e "\n${NAVY}[1/4] Checking Python backend environment...${NC}"
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
echo -e "${NAVY}[2/4] Verifying SQLite database & synthetic corpus...${NC}"
cd "$BACKEND_DIR"
PYTHONPATH=. python3 -m app.database.seed

# 3. Check Frontend Node Modules
echo -e "${NAVY}[3/4] Checking Frontend dependencies...${NC}"
cd "$FRONTEND_DIR"
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
