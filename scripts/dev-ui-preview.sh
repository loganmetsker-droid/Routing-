#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_HOME="${HOME}/.local/node-v20.20.1-linux-x64"
NODE_BIN="${NODE_HOME}/bin"
PID_DIR="${ROOT_DIR}/.tmp"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5184}"
MOCK_API_PORT="${MOCK_API_PORT:-3001}"
FRONTEND_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}"
DISPATCH_PREVIEW_URL="${FRONTEND_URL}/dispatch"
MOCK_API_URL="http://${FRONTEND_HOST}:${MOCK_API_PORT}"
MOCK_PID_FILE="${PID_DIR}/mock-preview-api.pid"
FRONTEND_PID_FILE="${PID_DIR}/frontend-preview.pid"
MOCK_LOG="${PID_DIR}/mock-preview-api.log"
FRONTEND_LOG="${PID_DIR}/frontend-preview.log"

mkdir -p "${PID_DIR}"

ensure_port_available() {
  local port="$1"
  local label="$2"
  "${NODE_CMD}" -e "
const net = require('net');
const port = Number(process.argv[1]);
const host = process.argv[2];
const socket = net.createConnection({ host, port });
socket.setTimeout(500);
socket.on('connect', () => {
  console.error(\`${label} port \${port} is already in use on ${FRONTEND_HOST}.\`);
  process.exit(1);
});
socket.on('timeout', () => {
  socket.destroy();
  process.exit(0);
});
socket.on('error', () => process.exit(0));
" "${port}" "${FRONTEND_HOST}"
}

wait_for_http() {
  local url="$1"
  local pid="$2"
  local label="$3"

  for _ in $(seq 1 30); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      echo "${label} failed to start. Recent log output:"
      tail -n 40 "${FRONTEND_LOG}" 2>/dev/null || true
      tail -n 40 "${MOCK_LOG}" 2>/dev/null || true
      exit 1
    fi
    if "${NODE_CMD}" -e "
fetch(process.argv[1]).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));
" "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "${label} did not become reachable at ${url}."
  exit 1
}

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

if [[ ! -f "${MOCK_PID_FILE}" ]] || ! kill -0 "$(cat "${MOCK_PID_FILE}")" 2>/dev/null; then
  ensure_port_available "${MOCK_API_PORT}" "Mock preview API"
fi

if [[ ! -f "${FRONTEND_PID_FILE}" ]] || ! kill -0 "$(cat "${FRONTEND_PID_FILE}")" 2>/dev/null; then
  ensure_port_available "${FRONTEND_PORT}" "Routing frontend preview"
fi

if [[ -f "${MOCK_PID_FILE}" ]] && kill -0 "$(cat "${MOCK_PID_FILE}")" 2>/dev/null; then
  echo "Mock preview API already running (PID $(cat "${MOCK_PID_FILE}"))."
else
  cd "${ROOT_DIR}"
  setsid env MOCK_API_PORT="${MOCK_API_PORT}" "${NODE_CMD}" "${ROOT_DIR}/scripts/mock-preview-api.mjs" >"${MOCK_LOG}" 2>&1 < /dev/null &
  echo $! > "${MOCK_PID_FILE}"
  wait_for_http "${MOCK_API_URL}/health" "$(cat "${MOCK_PID_FILE}")" "Mock preview API"
  echo "Started mock preview API (PID $(cat "${MOCK_PID_FILE}")) on ${MOCK_API_URL}"
fi

if [[ -f "${FRONTEND_PID_FILE}" ]] && kill -0 "$(cat "${FRONTEND_PID_FILE}")" 2>/dev/null; then
  echo "Frontend already running (PID $(cat "${FRONTEND_PID_FILE}"))."
else
  cd "${ROOT_DIR}/frontend"
  setsid env \
    PATH="${NODE_PATH_EXPORT}" \
    VITE_MOCK_PREVIEW="true" \
    VITE_AUTH_BYPASS="true" \
    VITE_ENABLE_SOCKETS="false" \
    FRONTEND_PORT="${FRONTEND_PORT}" \
    VITE_FRONTEND_PORT="${FRONTEND_PORT}" \
    VITE_API_URL="${MOCK_API_URL}" \
    VITE_REST_API_URL="${MOCK_API_URL}" \
    VITE_GRAPHQL_URL="${MOCK_API_URL}/graphql" \
    VITE_WS_URL="ws://${FRONTEND_HOST}:${MOCK_API_PORT}" \
    "${NPM_CMD}" run dev -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" --strictPort >"${FRONTEND_LOG}" 2>&1 < /dev/null &
  echo $! > "${FRONTEND_PID_FILE}"
  wait_for_http "${FRONTEND_URL}" "$(cat "${FRONTEND_PID_FILE}")" "Routing frontend preview"
  echo "Started frontend preview (PID $(cat "${FRONTEND_PID_FILE}")) on ${FRONTEND_URL}"
fi

echo
echo "Routing Dispatch Preview URL: ${DISPATCH_PREVIEW_URL}"
echo "Mock Preview API URL: ${MOCK_API_URL}"
echo "Logs:"
echo "  ${MOCK_LOG}"
echo "  ${FRONTEND_LOG}"
