#!/usr/bin/env bash
# ==============================================================================
# Clario — Unified Cross-Platform System Setup & Dependency Initializer
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARGS=("$@")

OS_NAME="$(uname -s 2>/dev/null || echo "Unknown")"

case "$OS_NAME" in
    Darwin*)
        echo "[Detected OS] macOS detected."
        bash "$SCRIPT_DIR/init_mac.sh" "${ARGS[@]}"
        ;;
    Linux*)
        echo "[Detected OS] Linux detected."
        bash "$SCRIPT_DIR/init_linux.sh" "${ARGS[@]}"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        echo "[Detected OS] Windows environment detected."
        cmd.exe /c "$SCRIPT_DIR\\init_windows.bat" "${ARGS[@]}"
        ;;
    *)
        echo "[Notice] Unrecognized OS: $OS_NAME. Attempting Unix initialization..."
        bash "$SCRIPT_DIR/init_linux.sh" "${ARGS[@]}"
        ;;
esac
