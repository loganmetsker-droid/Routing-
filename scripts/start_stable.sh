#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_HOME="${TROVAN_HOME:-$HOME/.trovan-routing}"
LOG_DIR="$APP_HOME/logs"
RUNTIME_DIR="$APP_HOME/runtime"
BACKUP_DIR="$APP_HOME/backups"
CONFIG_DIR="$APP_HOME/config"
FRONTEND_PORT="${FRONTEND_PORT:-5184}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_URL=""
BACKEND_URL=""
LOCAL_FRONTEND_URL=""
LOCAL_BACKEND_URL=""
LAN_FRONTEND_URL=""
LAN_BACKEND_URL=""
LAN_EXPOSE="${LAN_EXPOSE:-1}"
PUBLIC_HOST="${PUBLIC_HOST:-${LAN_HOST:-}}"
FRONTEND_BIND_HOST="${FRONTEND_BIND_HOST:-}"
NODE_HOME="${NODE_HOME:-$HOME/.local/node-v20.20.1-linux-x64/bin}"
NODE_BIN="${NODE_BIN:-$NODE_HOME/node}"
NPM_BIN="${NPM_BIN:-$NODE_HOME/npm}"
REBUILD_ON_START="${REBUILD_ON_START:-1}"
ENABLE_SCHEDULER="${ENABLE_SCHEDULER:-0}"
VITE_AUTH_BYPASS="${VITE_AUTH_BYPASS:-false}"
QUEUE_REQUIRED="${QUEUE_REQUIRED:-${REDIS_REQUIRED:-false}}"
AUTO_BOOTSTRAP_LOCAL_DB="${AUTO_BOOTSTRAP_LOCAL_DB:-1}"
ENV_SOURCES=()
BACKEND_ENTRY=""

mkdir -p "$LOG_DIR" "$RUNTIME_DIR" "$BACKUP_DIR" "$CONFIG_DIR"
rm -f "$RUNTIME_DIR/startup_error.json"

export PATH="$NODE_HOME:$PATH"
export ENABLE_SCHEDULER
export VITE_AUTH_BYPASS
export QUEUE_REQUIRED
export AUTO_BOOTSTRAP_LOCAL_DB

if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node)"
fi
if [[ ! -x "$NPM_BIN" ]]; then
  NPM_BIN="$(command -v npm)"
fi

log() {
  local msg="$1"
  echo "[$(date -Iseconds)] $msg" | tee -a "$LOG_DIR/start-stable.log"
}

write_error() {
  local code="$1"
  local message="$2"
  cat >"$RUNTIME_DIR/startup_error.json" <<EOF
{"code":"$code","message":"$message","logDir":"$LOG_DIR"}
EOF
}

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
    ENV_SOURCES+=("$file")
    log "Loaded env file: $file"
  fi
}

load_env_file "$ROOT_DIR/backend/.env"
load_env_file "$ROOT_DIR/backend/.env.local"
load_env_file "$ROOT_DIR/frontend/.env.local"
load_env_file "$ROOT_DIR/.env"
load_env_file "$CONFIG_DIR/backend.env"
if [[ ${#ENV_SOURCES[@]} -gt 0 ]]; then
  export TROVAN_ENV_SOURCES
  TROVAN_ENV_SOURCES="$(IFS=,; echo "${ENV_SOURCES[*]}")"
else
  export TROVAN_ENV_SOURCES="process-environment"
fi

resolve_backend_entry() {
  local candidates=(
    "$ROOT_DIR/backend/dist/main.js"
    "$ROOT_DIR/backend/dist/backend/src/main.js"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      BACKEND_ENTRY="$candidate"
      return 0
    fi
  done

  return 1
}

tcp_check() {
  local host="$1"
  local port="$2"

  "$NODE_BIN" -e "
const net = require('net');
const host = process.argv[1];
const port = Number(process.argv[2]);
const socket = net.createConnection({ host, port });
socket.setTimeout(1500);
socket.on('connect', () => { socket.end(); process.exit(0); });
socket.on('error', () => process.exit(1));
socket.on('timeout', () => { socket.destroy(); process.exit(1); });
" "$host" "$port"
}

detect_public_host() {
  if [[ "$LAN_EXPOSE" != "1" ]]; then
    PUBLIC_HOST="127.0.0.1"
    return 0
  fi

  if [[ -n "$PUBLIC_HOST" ]]; then
    return 0
  fi

  PUBLIC_HOST="$("$NODE_BIN" -e "
const os = require('os');
const ignored = /^(lo|docker|br-|veth|virbr|zt|tailscale)/i;
const interfaces = os.networkInterfaces();
const preferred = [];
const fallback = [];

for (const [name, addrs] of Object.entries(interfaces)) {
  for (const addr of addrs || []) {
    if (addr.family !== 'IPv4' || addr.internal) continue;
    if (ignored.test(name)) {
      fallback.push(addr.address);
      continue;
    }
    preferred.push(addr.address);
  }
}

process.stdout.write(preferred[0] || fallback[0] || '');
")"

  if [[ -z "$PUBLIC_HOST" ]]; then
    PUBLIC_HOST="127.0.0.1"
    log "Unable to detect a LAN IPv4 address; falling back to localhost-only URLs."
    LAN_EXPOSE="0"
  fi
}

join_csv_unique() {
  "$NODE_BIN" -e "
const values = process.argv.slice(1)
  .flatMap((value) => String(value || '').split(','))
  .map((value) => value.trim())
  .filter(Boolean);
process.stdout.write([...new Set(values)].join(','));
" "$@"
}

select_backend_port() {
  local preferred="$BACKEND_PORT"
  local candidate="$preferred"

  if tcp_check 127.0.0.1 "$candidate"; then
    log "Backend port ${candidate} is already occupied; searching for a free fallback port."
    for ((candidate=preferred + 1; candidate<=preferred + 20; candidate++)); do
      if ! tcp_check 127.0.0.1 "$candidate"; then
        break
      fi
    done
    if tcp_check 127.0.0.1 "$candidate"; then
      msg="No free backend port found in range ${preferred}-$((preferred + 20))."
      log "$msg"
      write_error "backend_port_unavailable" "$msg"
      exit 15
    fi
  fi

  BACKEND_PORT="$candidate"
  LOCAL_BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
  LAN_BACKEND_URL="http://${PUBLIC_HOST}:${BACKEND_PORT}"
  BACKEND_URL="$LAN_BACKEND_URL"
  export HOST="${HOST:-0.0.0.0}"
  export PORT="$BACKEND_PORT"
  export BACKEND_PORT
}

normalize_frontend_env() {
  if [[ -z "$FRONTEND_BIND_HOST" ]]; then
    if [[ "$LAN_EXPOSE" == "1" ]]; then
      FRONTEND_BIND_HOST="0.0.0.0"
    else
      FRONTEND_BIND_HOST="127.0.0.1"
    fi
  fi

  LOCAL_FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"
  LAN_FRONTEND_URL="http://${PUBLIC_HOST}:${FRONTEND_PORT}"
  FRONTEND_URL="$LAN_FRONTEND_URL"
  export FRONTEND_BIND_HOST
  export FRONTEND_PORT
  export FRONTEND_URL
  export BACKEND_URL
  export VITE_API_URL="$BACKEND_URL"
  export VITE_REST_API_URL="$BACKEND_URL/api"
  export VITE_GRAPHQL_URL="$BACKEND_URL/graphql"
  export VITE_WS_URL="$BACKEND_URL"
  export CORS_ORIGINS
  CORS_ORIGINS="$(join_csv_unique \
    "${CORS_ORIGINS:-}" \
    "http://localhost:${FRONTEND_PORT}" \
    "http://127.0.0.1:${FRONTEND_PORT}" \
    "$LAN_FRONTEND_URL")"
}

normalize_database_env() {
  local configured_host="${DATABASE_HOST:-${DB_HOST:-localhost}}"
  local configured_port="${DATABASE_PORT:-${DB_PORT:-5432}}"

  if [[ -n "${DATABASE_URL:-}" ]]; then
    configured_host="$("$NODE_BIN" -e "const u=new URL(process.argv[1]);console.log(u.hostname)" "$DATABASE_URL" 2>/dev/null || echo "localhost")"
    configured_port="$("$NODE_BIN" -e "const u=new URL(process.argv[1]);console.log(u.port||'5432')" "$DATABASE_URL" 2>/dev/null || echo "5432")"
  fi

  if tcp_check "$configured_host" "$configured_port"; then
    return 0
  fi

  for fallback_host in 127.0.0.1 localhost; do
    if tcp_check "$fallback_host" 5432; then
      log "Configured database endpoint ${configured_host}:${configured_port} is unavailable; falling back to ${fallback_host}:5432."
      if [[ -n "${DATABASE_URL:-}" ]]; then
        DATABASE_URL="$("$NODE_BIN" -e "
const url = new URL(process.argv[1]);
url.hostname = process.argv[2];
url.port = process.argv[3];
console.log(url.toString());
" "$DATABASE_URL" "$fallback_host" "5432")"
        export DATABASE_URL
      else
        export DATABASE_HOST="$fallback_host"
        export DATABASE_PORT="5432"
      fi
      return 0
    fi
  done

  return 1
}

if [[ -f "$ROOT_DIR/scripts/stop_all.sh" ]]; then
  FORCE_STOP_STALE=1 bash "$ROOT_DIR/scripts/stop_all.sh" >>"$LOG_DIR/start-stable.log" 2>&1 || true
fi

detect_public_host
select_backend_port
normalize_frontend_env
log "Frontend bind host: ${FRONTEND_BIND_HOST}"
log "Public frontend URL: ${LAN_FRONTEND_URL}"
log "Public backend URL: ${LAN_BACKEND_URL}"

DB_SOURCE="fallback-defaults"
if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_SOURCE="DATABASE_URL"
elif [[ -n "${DATABASE_HOST:-}" || -n "${DB_HOST:-}" ]]; then
  DB_SOURCE="DATABASE_HOST/DB_HOST"
fi
log "DB source: $DB_SOURCE"

if ! normalize_database_env; then
  msg="Database unavailable at configured endpoint and no reachable fallback was found."
  log "$msg"
  write_error "db_unavailable" "$msg"
  exit 12
fi

DB_HOST="${DATABASE_HOST:-${DB_HOST:-localhost}}"
DB_PORT="${DATABASE_PORT:-${DB_PORT:-5432}}"
if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_HOST="$("$NODE_BIN" -e "try{const u=new URL(process.argv[1]);console.log(u.hostname)}catch{process.exit(1)}" "$DATABASE_URL" 2>/dev/null || echo "localhost")"
  DB_PORT="$("$NODE_BIN" -e "try{const u=new URL(process.argv[1]);console.log(u.port||'5432')}catch{process.exit(1)}" "$DATABASE_URL" 2>/dev/null || echo "5432")"
fi
log "DB target host/port: ${DB_HOST}:${DB_PORT}"

if ! "$NODE_BIN" -e "
const net = require('net');
const host = process.argv[1];
const port = Number(process.argv[2]);
const s = net.createConnection({host, port});
s.setTimeout(2500);
s.on('connect',()=>{s.end();process.exit(0);});
s.on('error',()=>process.exit(1));
s.on('timeout',()=>{s.destroy();process.exit(1);});
" "$DB_HOST" "$DB_PORT"; then
  msg="Database unavailable at ${DB_HOST}:${DB_PORT}. Ensure Postgres is running and env config is correct."
  log "$msg"
  write_error "db_unavailable" "$msg"
  exit 12
fi

log "Database socket check passed."

REDIS_HOST_RESOLVED="${REDIS_HOST:-}"
REDIS_PORT_RESOLVED="${REDIS_PORT:-6379}"
if [[ -n "${REDIS_URL:-}" ]]; then
  REDIS_HOST_RESOLVED="$("$NODE_BIN" -e "try{const u=new URL(process.argv[1]);console.log(u.hostname)}catch{process.exit(1)}" "$REDIS_URL" 2>/dev/null || echo "")"
  REDIS_PORT_RESOLVED="$("$NODE_BIN" -e "try{const u=new URL(process.argv[1]);console.log(u.port||'6379')}catch{process.exit(1)}" "$REDIS_URL" 2>/dev/null || echo "6379")"
fi

if [[ -n "$REDIS_HOST_RESOLVED" ]]; then
  log "Queue source: redis (${REDIS_HOST_RESOLVED}:${REDIS_PORT_RESOLVED})"
  if ! "$NODE_BIN" -e "
const net = require('net');
const host = process.argv[1];
const port = Number(process.argv[2]);
const s = net.createConnection({host, port});
s.setTimeout(2500);
s.on('connect',()=>{s.end();process.exit(0);});
s.on('error',()=>process.exit(1));
s.on('timeout',()=>{s.destroy();process.exit(1);});
" "$REDIS_HOST_RESOLVED" "$REDIS_PORT_RESOLVED"; then
    msg="Queue unavailable at ${REDIS_HOST_RESOLVED}:${REDIS_PORT_RESOLVED}."
    if [[ "$QUEUE_REQUIRED" == "true" ]]; then
      log "$msg"
      write_error "worker_queue_unavailable" "$msg"
      exit 13
    fi
    log "$msg Continuing in degraded mode because QUEUE_REQUIRED=false."
  else
    log "Queue socket check passed."
  fi
else
  log "Queue source: disabled"
fi

if [[ "$REBUILD_ON_START" == "1" ]]; then
  log "Building backend from current worktree..."
  (
    cd "$ROOT_DIR/backend"
    "$NPM_BIN" run build >>"$LOG_DIR/backend-build.log" 2>&1
  )
  log "Building frontend from current worktree..."
  (
    cd "$ROOT_DIR/frontend"
    "$NPM_BIN" run build >>"$LOG_DIR/frontend-build.log" 2>&1
  )
fi

if ! resolve_backend_entry; then
  msg="Unable to locate backend entrypoint under backend/dist. Check backend build output."
  log "$msg"
  write_error "backend_entry_missing" "$msg"
  exit 14
fi

if [[ -f "$ROOT_DIR/scripts/bootstrap_local_db.cjs" ]]; then
  log "Ensuring local database schema and seed data are ready..."
  if ! "$NODE_BIN" "$ROOT_DIR/scripts/bootstrap_local_db.cjs" >>"$LOG_DIR/backend-build.log" 2>&1; then
    msg="Local database bootstrap failed. Check backend-build.log for details."
    log "$msg"
    write_error "db_bootstrap_failed" "$msg"
    exit 16
  fi
fi

(
  cd "$ROOT_DIR/backend"
  setsid "$NODE_BIN" "$BACKEND_ENTRY" >>"$LOG_DIR/backend.log" 2>&1 < /dev/null &
  echo $! >"$RUNTIME_DIR/backend.pid"
)
log "Started backend PID $(cat "$RUNTIME_DIR/backend.pid") using $BACKEND_ENTRY"

(
  cd "$ROOT_DIR/frontend"
  setsid "$NPM_BIN" run preview -- --host "$FRONTEND_BIND_HOST" --port "$FRONTEND_PORT" --strictPort >>"$LOG_DIR/frontend.log" 2>&1 < /dev/null &
  echo $! >"$RUNTIME_DIR/frontend.pid"
)
log "Started frontend PID $(cat "$RUNTIME_DIR/frontend.pid")"

log "Waiting for backend/frontend health..."
ATTEMPTS=90
for ((i=1; i<=ATTEMPTS; i++)); do
  backend_ok=0
  frontend_ok=0
  if ! kill -0 "$(cat "$RUNTIME_DIR/backend.pid")" 2>/dev/null; then
    write_error "backend_failed_to_boot" "Backend process exited before reaching healthy state. Check backend.log for the crash reason."
    log "Backend PID exited before health check passed."
    exit 1
  fi
  if ! kill -0 "$(cat "$RUNTIME_DIR/frontend.pid")" 2>/dev/null; then
    write_error "frontend_failed_to_boot" "Frontend preview process exited before reaching healthy state. Check frontend.log for the crash reason."
    log "Frontend PID exited before health check passed."
    exit 1
  fi
  "$NODE_BIN" -e "
fetch('${LOCAL_BACKEND_URL}/api/health/runtime')
  .then(async (response) => {
    if (!response.ok) process.exit(1);
    const text = await response.text();
    const payload = JSON.parse(text);
    const data = payload?.data ?? payload;
    process.exit(data && typeof data === 'object' && 'runtime' in data ? 0 : 1);
  })
  .catch(() => process.exit(1));
" || backend_ok=1
  "$NODE_BIN" -e "fetch('${LOCAL_FRONTEND_URL}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" || frontend_ok=1
  if [[ "$backend_ok" -eq 0 && "$frontend_ok" -eq 0 ]]; then
    runtime_json="$("$NODE_BIN" -e "fetch('${LOCAL_BACKEND_URL}/api/health/runtime').then(r=>r.ok?r.json().then(d=>console.log(JSON.stringify(d))):process.exit(1)).catch(()=>process.exit(1))" 2>/dev/null || true)"
    if [[ -n "$runtime_json" ]]; then
      runtime_status="$("$NODE_BIN" -e "const payload=JSON.parse(process.argv[1]); const data=payload.data ?? payload; console.log(data.status||'unknown')" "$runtime_json" 2>/dev/null || echo "unknown")"
      worker_status="$("$NODE_BIN" -e "const payload=JSON.parse(process.argv[1]); const data=payload.data ?? payload; console.log(data.worker?.status||'unknown')" "$runtime_json" 2>/dev/null || echo "unknown")"
      queue_status="$("$NODE_BIN" -e "const payload=JSON.parse(process.argv[1]); const data=payload.data ?? payload; console.log(data.queue?.status||'unknown')" "$runtime_json" 2>/dev/null || echo "unknown")"
      log "Runtime health summary: status=${runtime_status} queue=${queue_status} worker=${worker_status}"
      if [[ "$QUEUE_REQUIRED" == "true" && ( "$queue_status" == "unavailable" || "$worker_status" == "missing" ) ]]; then
        write_error "worker_queue_unavailable" "Queue or worker runtime health is unavailable while QUEUE_REQUIRED=true."
        exit 1
      fi
    fi
    log "Services are healthy."
    echo "$LOCAL_FRONTEND_URL" >"$RUNTIME_DIR/frontend.url"
    echo "$LOCAL_BACKEND_URL" >"$RUNTIME_DIR/backend.url"
    echo "$LAN_FRONTEND_URL" >"$RUNTIME_DIR/frontend.lan.url"
    echo "$LAN_BACKEND_URL" >"$RUNTIME_DIR/backend.lan.url"
    log "Open Routing frontend locally at ${LOCAL_FRONTEND_URL}/dispatch"
    log "Open Routing frontend over LAN at ${LAN_FRONTEND_URL}/dispatch"
    exit 0
  fi
  if [[ "$backend_ok" -ne 0 && "$frontend_ok" -ne 0 ]]; then
    write_error "backend_frontend_health_unavailable" "Backend and frontend health endpoints are unavailable."
  elif [[ "$backend_ok" -ne 0 ]]; then
    write_error "backend_health_unavailable" "Backend failed to boot or /api/health/runtime is unavailable."
  elif [[ "$frontend_ok" -ne 0 ]]; then
    write_error "frontend_health_unavailable" "Frontend failed to boot or base URL is unavailable."
  fi
  sleep 1
done

log "Failed to reach healthy state. Check logs in $LOG_DIR"
exit 1
