#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_HOME="${HOME}/.local/node-v20.20.1-linux-x64"
NODE_BIN="${NODE_HOME}/bin"
PID_DIR="${ROOT_DIR}/.tmp"
MOCK_PID_FILE="${PID_DIR}/mock-preview-api.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend-preview.pid"
MOCK_LOG="${PID_DIR}/mock-preview-api.log"
FRONTEND_LOG="${PID_DIR}/frontend-preview.log"

mkdir -p "${PID_DIR}"

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  NODE_CMD="$(command -v node)"
  NPM_CMD="$(command -v npm)"
  NODE_PATH_EXPORT="$(dirname "${NODE_CMD}"):${PATH}"
elif [[ -x "${NODE_BIN}/node" && -x "${NODE_BIN}/npm" ]]; then
  NODE_CMD="${NODE_BIN}/node"
  NPM_CMD="${NODE_BIN}/npm"
  NODE_PATH_EXPORT="${NODE_BIN}:${PATH}"
else
  echo "Node/npm not found on PATH and local fallback runtime missing at ${NODE_HOME}"
  echo "Install Node 20, then rerun this script."
  exit 1
fi

if [[ -f "${MOCK_PID_FILE}" ]] && kill -0 "$(cat "${MOCK_PID_FILE}")" 2>/dev/null; then
  echo "Mock preview API already running (PID $(cat "${MOCK_PID_FILE}"))."
else
  cd "${ROOT_DIR}"
  nohup env MOCK_API_PORT=3001 "${NODE_CMD}" "${ROOT_DIR}/scripts/mock-preview-api.mjs" >"${MOCK_LOG}" 2>&1 &
  echo $! > "${MOCK_PID_FILE}"
  echo "Started mock preview API (PID $(cat "${MOCK_PID_FILE}")) on http://127.0.0.1:3001"
fi

if [[ -f "${FRONTEND_PID_FILE}" ]] && kill -0 "$(cat "${FRONTEND_PID_FILE}")" 2>/dev/null; then
  echo "Frontend already running (PID $(cat "${FRONTEND_PID_FILE}"))."
else
  cd "${ROOT_DIR}/frontend"
  nohup env \
    PATH="${NODE_PATH_EXPORT}" \
    VITE_API_URL="http://127.0.0.1:3001" \
    VITE_REST_API_URL="http://127.0.0.1:3001" \
    VITE_GRAPHQL_URL="http://127.0.0.1:3001/graphql" \
    VITE_WS_URL="ws://127.0.0.1:3001" \
    "${NPM_CMD}" run dev -- --host 127.0.0.1 --port 5173 >"${FRONTEND_LOG}" 2>&1 &
  echo $! > "${FRONTEND_PID_FILE}"
  echo "Started frontend preview (PID $(cat "${FRONTEND_PID_FILE}")) on http://127.0.0.1:5173"
fi

echo
echo "Open: http://127.0.0.1:5173"
echo "Logs:"
echo "  ${MOCK_LOG}"
echo "  ${FRONTEND_LOG}"
