#!/usr/bin/env bash
# ==============================================================================
# Clario — Academic Verification & Demonstration Runner
# ==============================================================================

set -e

GREEN='\033[0;32m'
TEAL='\033[0;36m'
GOLD='\033[0;33m'
NC='\033[0m'

echo -e "${TEAL}================================================================${NC}"
echo -e "${GOLD}   CLARIO ACADEMIC VERIFICATION & TEST RUNNER${NC}"
echo -e "${TEAL}================================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run Backend Pytest Suite
echo -e "\n${TEAL}--- [1/2] Running Backend Pytest Test Suite ---${NC}"
cd "$PROJECT_ROOT/backend"
source venv/bin/activate
PYTHONPATH=. pytest tests/test_api.py -v

# Run Frontend Vitest Suite
echo -e "\n${TEAL}--- [2/2] Running Frontend Vitest Test Suite ---${NC}"
cd "$PROJECT_ROOT/frontend"
npm test

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}✔ ALL ACADEMIC REQUIREMENTS & AUTOMATED TESTS VERIFIED 100%!${NC}"
echo -e "${GREEN}================================================================${NC}\n"
