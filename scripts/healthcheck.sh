#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_HOME="${NODE_HOME:-$HOME/.local/node-v20.20.1-linux-x64/bin}"
NODE_BIN="${NODE_BIN:-$NODE_HOME/node}"
export PATH="$NODE_HOME:$PATH"
APP_HOME="${TROVAN_HOME:-$HOME/.trovan-routing}"
CONFIG_DIR="$APP_HOME/config"
RUNTIME_DIR="$APP_HOME/runtime"
FRONTEND_PORT="${FRONTEND_PORT:-5184}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_URL="${FRONTEND_URL:-$(cat "$RUNTIME_DIR/frontend.url" 2>/dev/null || echo "http://127.0.0.1:${FRONTEND_PORT}")}"
BACKEND_URL="${BACKEND_URL:-$(cat "$RUNTIME_DIR/backend.url" 2>/dev/null || echo "http://127.0.0.1:${BACKEND_PORT}")}"

if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node)"
fi

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

pass() {
  echo "[OK] $1"
}

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
    pass "Loaded env file $file"
  fi
}

load_env_file "$ROOT_DIR/backend/.env"
load_env_file "$ROOT_DIR/backend/.env.local"
load_env_file "$ROOT_DIR/.env"
load_env_file "$CONFIG_DIR/backend.env"

check_url() {
  local label="$1"
  local url="$2"
  "$NODE_BIN" -e "fetch('${url}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    && pass "$label reachable: $url" \
    || fail "$label unreachable: $url"
}

check_env_var() {
  local label="$1"
  local value="$2"
  [[ -n "$value" ]] && pass "$label present" || fail "$label missing"
}

fetch_json() {
  local label="$1"
  local url="$2"
  local output

  if ! output="$("$NODE_BIN" -e "
fetch(process.argv[1])
  .then(async (response) => {
    if (!response.ok) process.exit(2);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      console.log(JSON.stringify(data));
    } catch {
      process.exit(3);
    }
  })
  .catch(() => process.exit(1));
" "$url" 2>/dev/null)"; then
    fail "${label} did not return JSON: ${url}"
  fi

  printf '%s' "$output"
}

check_url "Frontend" "$FRONTEND_URL"
check_url "Backend ping" "$BACKEND_URL/api/health/ping"

BACKEND_ENV="$ROOT_DIR/backend/.env"
BACKEND_ENV_LOCAL="$ROOT_DIR/backend/.env.local"
if [[ -f "$BACKEND_ENV" || -f "$BACKEND_ENV_LOCAL" ]]; then
  ENV_SOURCE_FILE="$BACKEND_ENV"
  if [[ ! -f "$ENV_SOURCE_FILE" ]]; then
    ENV_SOURCE_FILE="$BACKEND_ENV_LOCAL"
  fi
  DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_SOURCE_FILE" | tail -n 1 | cut -d= -f2- || true)"
  DB_HOST_FILE="$(grep -E '^DATABASE_HOST=' "$ENV_SOURCE_FILE" | tail -n 1 | cut -d= -f2- || true)"
  DB_PORT_FILE="$(grep -E '^DATABASE_PORT=' "$ENV_SOURCE_FILE" | tail -n 1 | cut -d= -f2- || true)"
  DB_NAME_FILE="$(grep -E '^DATABASE_NAME=' "$ENV_SOURCE_FILE" | tail -n 1 | cut -d= -f2- || true)"
  DB_USER_FILE="$(grep -E '^DATABASE_USER=' "$ENV_SOURCE_FILE" | tail -n 1 | cut -d= -f2- || true)"
  DB_PASSWORD_FILE="$(grep -E '^DATABASE_PASSWORD=' "$ENV_SOURCE_FILE" | tail -n 1 | cut -d= -f2- || true)"
  JWT_SECRET="$(grep -E '^JWT_SECRET=' "$ENV_SOURCE_FILE" | tail -n 1 | cut -d= -f2- || true)"
  if [[ -n "$DB_URL" ]]; then
    check_env_var "DATABASE_URL in ${ENV_SOURCE_FILE#$ROOT_DIR/}" "$DB_URL"
  else
    check_env_var "DATABASE_HOST in ${ENV_SOURCE_FILE#$ROOT_DIR/}" "$DB_HOST_FILE"
    check_env_var "DATABASE_PORT in ${ENV_SOURCE_FILE#$ROOT_DIR/}" "$DB_PORT_FILE"
    check_env_var "DATABASE_NAME in ${ENV_SOURCE_FILE#$ROOT_DIR/}" "$DB_NAME_FILE"
    check_env_var "DATABASE_USER in ${ENV_SOURCE_FILE#$ROOT_DIR/}" "$DB_USER_FILE"
    check_env_var "DATABASE_PASSWORD in ${ENV_SOURCE_FILE#$ROOT_DIR/}" "$DB_PASSWORD_FILE"
  fi
  check_env_var "JWT_SECRET in ${ENV_SOURCE_FILE#$ROOT_DIR/}" "$JWT_SECRET"
else
  echo "[WARN] backend/.env and backend/.env.local not found; using loaded env from root/config if present."
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_HOST="$("$NODE_BIN" -e "const u=new URL(process.argv[1]);console.log(u.hostname)" "$DATABASE_URL" 2>/dev/null || echo "unknown")"
  DB_PORT="$("$NODE_BIN" -e "const u=new URL(process.argv[1]);console.log(u.port||'5432')" "$DATABASE_URL" 2>/dev/null || echo "5432")"
  pass "DB source DATABASE_URL -> ${DB_HOST}:${DB_PORT}"
else
  pass "DB source host/port -> ${DATABASE_HOST:-${DB_HOST:-localhost}}:${DATABASE_PORT:-${DB_PORT:-5432}}"
fi

HEALTH_JSON="$(fetch_json "Backend health" "${BACKEND_URL}/health")"
pass "Backend health returned JSON"
RUNTIME_JSON="$(fetch_json "Backend runtime health" "${BACKEND_URL}/api/health/runtime")"
pass "Backend runtime health returned JSON"
if echo "$HEALTH_JSON" | grep -q '"database"'; then
  pass "Database health present in backend /health response"
else
  fail "Database health not present in /health response"
fi

if echo "$HEALTH_JSON" | grep -q '"status":"ok"'; then
  pass "Backend overall health ok"
else
  fail "Backend reports non-ok health"
fi

if echo "$RUNTIME_JSON" | grep -q '"runtime"'; then
  pass "Runtime health payload present"
else
  fail "Runtime health payload missing"
fi

QUEUE_REQUIRED_RESOLVED="${QUEUE_REQUIRED:-${REDIS_REQUIRED:-false}}"
QUEUE_STATUS="$("$NODE_BIN" -e "const payload=JSON.parse(process.argv[1]); const data=payload.data ?? payload; console.log(data.queue?.status||'unknown')" "$RUNTIME_JSON" 2>/dev/null || echo "unknown")"
WORKER_STATUS="$("$NODE_BIN" -e "const payload=JSON.parse(process.argv[1]); const data=payload.data ?? payload; console.log(data.worker?.status||'unknown')" "$RUNTIME_JSON" 2>/dev/null || echo "unknown")"
RUNTIME_STATUS="$("$NODE_BIN" -e "const payload=JSON.parse(process.argv[1]); const data=payload.data ?? payload; console.log(data.status||'unknown')" "$RUNTIME_JSON" 2>/dev/null || echo "unknown")"

pass "Runtime status: ${RUNTIME_STATUS}"
pass "Queue status: ${QUEUE_STATUS}"
pass "Worker status: ${WORKER_STATUS}"

if [[ "$QUEUE_REQUIRED_RESOLVED" == "true" ]]; then
  [[ "$QUEUE_STATUS" != "unavailable" ]] || fail "Queue runtime unavailable while QUEUE_REQUIRED=true"
  [[ "$WORKER_STATUS" != "missing" ]] || fail "Worker heartbeat missing while QUEUE_REQUIRED=true"
fi

HEALTHCHECK_AUTH_EMAIL="${HEALTHCHECK_AUTH_EMAIL:-${AUTH_ADMIN_EMAIL:-}}"
HEALTHCHECK_AUTH_PASSWORD="${HEALTHCHECK_AUTH_PASSWORD:-${AUTH_ADMIN_PASSWORD:-}}"
if [[ -n "$HEALTHCHECK_AUTH_EMAIL" && -n "$HEALTHCHECK_AUTH_PASSWORD" ]]; then
  AUTH_TOKEN="$("$NODE_BIN" -e "
const base = process.argv[1];
const email = process.argv[2];
const password = process.argv[3];
fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({email, password}),
}).then(async (r) => {
  if (!r.ok) process.exit(1);
  const payload = await r.json();
  const data = payload.data || payload;
  process.stdout.write(data.accessToken || '');
}).catch(() => process.exit(1));
" "$BACKEND_URL" "$HEALTHCHECK_AUTH_EMAIL" "$HEALTHCHECK_AUTH_PASSWORD" 2>/dev/null || true)"
  [[ -n "$AUTH_TOKEN" ]] && pass "Auth login path healthy" || fail "Auth login path failed"
  "$NODE_BIN" -e "
fetch(process.argv[1] + '/api/auth/me', {
  headers: {Authorization: 'Bearer ' + process.argv[2]},
}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1));
" "$BACKEND_URL" "$AUTH_TOKEN" && pass "Auth session path healthy" || fail "Auth session path failed"
else
  echo "[WARN] Auth path checks skipped; HEALTHCHECK_AUTH_EMAIL/HEALTHCHECK_AUTH_PASSWORD not set."
fi

echo "Healthcheck completed successfully."
