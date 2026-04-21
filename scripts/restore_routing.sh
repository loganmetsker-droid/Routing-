#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_HOME="${TROVAN_HOME:-$HOME/.trovan-routing}"
BACKUP_DIR="$APP_HOME/backups"
RUNTIME_DIR="$APP_HOME/runtime"
ARCHIVE="${1:-}"

if [[ -z "$ARCHIVE" ]]; then
  if [[ -f "$RUNTIME_DIR/latest-backup.txt" ]]; then
    ARCHIVE="$(cat "$RUNTIME_DIR/latest-backup.txt")"
  else
    ARCHIVE="$(ls -1t "$BACKUP_DIR"/backup-*.tgz 2>/dev/null | head -n 1 || true)"
  fi
fi

if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Backup archive not found. Provide path: scripts/restore_routing.sh /path/to/backup.tgz" >&2
  exit 1
fi

TMP_RESTORE="$RUNTIME_DIR/restore-$(date +%s)"
mkdir -p "$TMP_RESTORE"
tar -xzf "$ARCHIVE" -C "$TMP_RESTORE"

RESTORE_ROOT="$(find "$TMP_RESTORE" -maxdepth 2 -type d -name 'backup-*' | head -n 1)"
if [[ -z "$RESTORE_ROOT" ]]; then
  echo "Invalid backup archive structure." >&2
  exit 1
fi

if [[ -f "$RESTORE_ROOT/backend.env" ]]; then
  cp "$RESTORE_ROOT/backend.env" "$ROOT_DIR/backend/.env"
fi
if [[ -f "$RESTORE_ROOT/frontend.env" ]]; then
  cp "$RESTORE_ROOT/frontend.env" "$ROOT_DIR/frontend/.env"
fi
if [[ -f "$RESTORE_ROOT/root.env" ]]; then
  cp "$RESTORE_ROOT/root.env" "$ROOT_DIR/.env"
fi

if [[ -f "$RESTORE_ROOT/database.meta" ]]; then
  DB_META="$(cat "$RESTORE_ROOT/database.meta")"
  DB_DUMP="$RESTORE_ROOT/database.dump"
  if [[ "$DB_META" == postgres:* ]] && [[ -f "$DB_DUMP" ]]; then
    DB_URL="${DB_META#postgres:}"
    if command -v pg_restore >/dev/null 2>&1; then
      pg_restore --clean --if-exists --no-owner --dbname "$DB_URL" "$DB_DUMP"
      echo "Database restored from dump."
    else
      echo "pg_restore not found; skipped DB restore." >&2
    fi
  fi
fi

echo "Restore completed from $ARCHIVE"
