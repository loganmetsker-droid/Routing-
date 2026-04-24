#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:5185}"
export PLAYWRIGHT_BASE_URL

./node_modules/.bin/playwright test e2e/ui-audit.spec.ts --project=chromium "$@"
