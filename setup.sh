#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/log"

DEFAULT_VENV_NAME="${VENV_NAME:-venv}"

say() {
  printf '\n[setup] %s\n' "$1"
}

fail() {
  printf '\n[setup] Error: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

find_available_venv_name() {
  local base_name="$1"
  local candidate="$base_name"
  local counter=1

  while [ -e "$BACKEND_DIR/$candidate" ]; do
    candidate="${base_name}_${counter}"
    counter=$((counter + 1))
  done

  printf '%s' "$candidate"
}

choose_venv_name() {
  local requested_name="$1"

  if [ ! -e "$BACKEND_DIR/$requested_name" ]; then
    printf '%s' "$requested_name"
    return 0
  fi

  say "A virtual environment named '$requested_name' already exists in backend/."

  if [ -t 0 ]; then
    printf '[setup] Enter a new virtualenv name, or press Enter to use an automatic fallback: '
    local custom_name
    IFS= read -r custom_name || true
    custom_name="$(printf '%s' "$custom_name" | tr -d '[:space:]')"

    if [ -n "$custom_name" ]; then
      if [ -e "$BACKEND_DIR/$custom_name" ]; then
        fail "The virtual environment name '$custom_name' already exists."
      fi
      printf '%s' "$custom_name"
      return 0
    fi
  fi

  find_available_venv_name "$requested_name"
}

cleanup() {
  if [ -n "${BACKEND_PID:-}" ] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    say "Stopping backend server..."
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

require_cmd python3
require_cmd npm

mkdir -p "$LOG_DIR"

VENV_NAME="$(choose_venv_name "$DEFAULT_VENV_NAME")"
VENV_DIR="$BACKEND_DIR/$VENV_NAME"
BACKEND_LOG="$LOG_DIR/backend-dev.log"

say "Using virtual environment: backend/$VENV_NAME"
python3 -m venv "$VENV_DIR"

say "Installing backend dependencies..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt"

say "Running backend migrations..."
(
  cd "$BACKEND_DIR"
  "$VENV_DIR/bin/python" manage.py migrate
)

say "Installing frontend dependencies..."
(
  cd "$FRONTEND_DIR"
  npm install
)

say "Starting backend server on http://127.0.0.1:8000 ..."
(
  cd "$BACKEND_DIR"
  "$VENV_DIR/bin/python" manage.py runserver 8000
) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

sleep 2

if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
  fail "Backend failed to start. Check $BACKEND_LOG"
fi

say "Backend is running. Logs: $BACKEND_LOG"
say "Starting frontend server on http://localhost:5173 ..."
say "Press Ctrl+C to stop both servers."

(
  cd "$FRONTEND_DIR"
  npm run dev
)
