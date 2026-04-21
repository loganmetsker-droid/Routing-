#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="$HOME/.local/share/applications"
mkdir -p "$APP_DIR"

EXEC_CMD="/bin/bash -lc '$ROOT_DIR/scripts/launch_desktop.sh'"
ICON_PATH="$ROOT_DIR/desktop/assets/icon.svg"
SRC_DESKTOP="$ROOT_DIR/desktop/linux/trovan-routing.desktop"
DEST_DESKTOP="$APP_DIR/trovan-routing.desktop"

sed \
  -e "s|__TROVAN_EXEC__|$EXEC_CMD|g" \
  -e "s|__TROVAN_ICON__|$ICON_PATH|g" \
  "$SRC_DESKTOP" > "$DEST_DESKTOP"

chmod +x "$DEST_DESKTOP"
update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true

echo "Installed desktop entry: $DEST_DESKTOP"
echo "You can launch 'Trovan Routing' from your app menu."
