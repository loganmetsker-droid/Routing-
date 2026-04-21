#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_HOME="${TROVAN_HOME:-$HOME/.trovan-routing}"
BACKUP_DIR="$APP_HOME/backups"
RUNTIME_DIR="$APP_HOME/runtime"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TARGET_DIR="$BACKUP_DIR/backup-$TIMESTAMP"

mkdir -p "$TARGET_DIR" "$RUNTIME_DIR"

echo "Creating backup at $TARGET_DIR"

if [[ -f "$ROOT_DIR/backend/.env" ]]; then
  cp "$ROOT_DIR/backend/.env" "$TARGET_DIR/backend.env"
fi
if [[ -f "$ROOT_DIR/frontend/.env" ]]; then
  cp "$ROOT_DIR/frontend/.env" "$TARGET_DIR/frontend.env"
fi
if [[ -f "$ROOT_DIR/.env" ]]; then
  cp "$ROOT_DIR/.env" "$TARGET_DIR/root.env"
fi

cp -r "$ROOT_DIR/scripts" "$TARGET_DIR/scripts"
mkdir -p "$TARGET_DIR/config"
cp -r "$ROOT_DIR/docs" "$TARGET_DIR/config/docs" 2>/dev/null || true

DB_DUMP_PATH="$TARGET_DIR/database.dump"
DB_META_PATH="$TARGET_DIR/database.meta"
DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" && -f "$ROOT_DIR/backend/.env" ]]; then
  DB_URL="$(grep -E '^DATABASE_URL=' "$ROOT_DIR/backend/.env" | tail -n 1 | cut -d= -f2- || true)"
fi

if [[ -n "$DB_URL" && "$DB_URL" == postgres* ]]; then
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DB_URL" -Fc -f "$DB_DUMP_PATH"
    echo "postgres:$DB_URL" >"$DB_META_PATH"
    echo "Database backup complete: $DB_DUMP_PATH"
  else
    echo "pg_dump not found; database backup skipped" >&2
    echo "postgres:$DB_URL" >"$DB_META_PATH"
  fi
else
  echo "DATABASE_URL not set; database backup skipped" >"$DB_META_PATH"
fi

tar -czf "$BACKUP_DIR/backup-$TIMESTAMP.tgz" -C "$BACKUP_DIR" "backup-$TIMESTAMP"
echo "$BACKUP_DIR/backup-$TIMESTAMP.tgz" >"$RUNTIME_DIR/latest-backup.txt"
echo "Backup archive: $BACKUP_DIR/backup-$TIMESTAMP.tgz"
