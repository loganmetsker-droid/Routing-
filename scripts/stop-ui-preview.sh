#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="${ROOT_DIR}/.tmp"
MOCK_PID_FILE="${PID_DIR}/mock-preview-api.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend-preview.pid"

stop_from_pid_file() {
  local label="$1"
  local pid_file="$2"

  if [[ ! -f "${pid_file}" ]]; then
    echo "${label}: not running (no PID file)."
    return
  fi

  local pid
  pid="$(cat "${pid_file}")"
  if kill -0 "${pid}" 2>/dev/null; then
    kill "${pid}" 2>/dev/null || true
    echo "${label}: stopped PID ${pid}."
  else
    echo "${label}: PID ${pid} already stopped."
  fi

  rm -f "${pid_file}"
}

stop_from_pid_file "Frontend preview" "${FRONTEND_PID_FILE}"
stop_from_pid_file "Mock preview API" "${MOCK_PID_FILE}"

# Fallback cleanup for processes started outside PID file tracking.
pkill -f "node .*scripts/mock-preview-api.mjs" 2>/dev/null && echo "Mock preview API: stopped matching process pattern." || true
pkill -f "vite --host 127.0.0.1 --port 5173" 2>/dev/null && echo "Frontend preview: stopped matching vite process pattern." || true
