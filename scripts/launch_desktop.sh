#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_HOME="${NODE_HOME:-$HOME/.local/node-v20.20.1-linux-x64/bin}"
NPM_BIN="${NPM_BIN:-$NODE_HOME/npm}"
export PATH="$NODE_HOME:$PATH"

if [[ ! -x "$NPM_BIN" ]]; then
  NPM_BIN="$(command -v npm)"
fi

cd "$ROOT_DIR/desktop/electron"
"$NPM_BIN" run stable
