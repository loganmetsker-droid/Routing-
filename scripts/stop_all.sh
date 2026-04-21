#!/usr/bin/env bash
set -euo pipefail

APP_HOME="${TROVAN_HOME:-$HOME/.trovan-routing}"
RUNTIME_DIR="$APP_HOME/runtime"
FORCE_STOP_STALE="${FORCE_STOP_STALE:-0}"

stop_pid_file() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/${name}.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      for _ in {1..20}; do
        if ! kill -0 "$pid" 2>/dev/null; then
          break
        fi
        sleep 0.2
      done
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
      echo "Stopped $name PID $pid"
    fi
    rm -f "$pid_file"
  fi
}

stop_pid_file "frontend"
stop_pid_file "backend"

if [[ "$FORCE_STOP_STALE" == "1" ]]; then
  pkill -f "npm run preview -- --host .* --port" 2>/dev/null || true
  pkill -f "vite preview --host .* --port" 2>/dev/null || true
  pkill -f "nest start" 2>/dev/null || true
  pkill -f "node dist/main" 2>/dev/null || true
  pkill -f "node .*dist/backend/src/main.js" 2>/dev/null || true
  pkill -f "ts-node/register/transpile-only src/main.ts" 2>/dev/null || true
fi

echo "Tracked routing processes stopped."
