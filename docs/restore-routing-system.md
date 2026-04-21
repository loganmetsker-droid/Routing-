# Trovan Routing System Restore Guide

## Runtime and config locations
- Runtime home: `~/.trovan-routing/`
- Logs: `~/.trovan-routing/logs/`
- Backups: `~/.trovan-routing/backups/`
- Runtime PID/URL files: `~/.trovan-routing/runtime/`

## Environment files
- Backend env: `backend/.env`
- Frontend env: `frontend/.env`
- Optional root env: `.env`

Known-good minimum backend env:
- `DATABASE_URL` (PostgreSQL URL)
- `JWT_SECRET`
- `PORT` (optional, defaults to 3000)

Known-good minimum frontend env:
- `VITE_API_URL` or `VITE_REST_API_URL`

## Startup sequence (stable)
1. `bash scripts/start_stable.sh`
2. `bash scripts/healthcheck.sh`
3. Launch desktop shell (optional): `npm run desktop:stable`

## Backup
- Create backup:
  - `bash scripts/backup_routing.sh`
- Backup archive path is written to:
  - `~/.trovan-routing/runtime/latest-backup.txt`

## Restore
- Restore latest backup:
  - `bash scripts/restore_routing.sh`
- Restore specific backup:
  - `bash scripts/restore_routing.sh ~/.trovan-routing/backups/backup-YYYYMMDD-HHMMSS.tgz`

## Health verification
- `bash scripts/healthcheck.sh`
- Verifies:
  - frontend reachable
  - backend reachable
  - backend `/health` includes database check
  - required env values (from backend `.env`) when present

## Smoke test
- `bash scripts/smoke_test.sh`
- Optional auth token if API is protected:
  - `SMOKE_AUTH_TOKEN=<token> bash scripts/smoke_test.sh`

## Linux desktop launcher
- Install launcher:
  - `bash desktop/linux/install-desktop-entry.sh`
- Launch from app menu: **Trovan Routing**

## Rollback path
1. Stop services:
   - `bash scripts/stop_all.sh`
2. Restore previous backup:
   - `bash scripts/restore_routing.sh <backup-file>`
3. Start services:
   - `bash scripts/start_stable.sh`
4. Re-run healthcheck and smoke test.
