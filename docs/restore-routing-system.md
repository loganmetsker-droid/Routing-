# Trovan Routing System Restore Guide

## Runtime and config locations
- Runtime home: `~/.trovan-routing/`
- Logs: `~/.trovan-routing/logs/`
- Backups: `~/.trovan-routing/backups/`
- Runtime PID/URL files: `~/.trovan-routing/runtime/`

## Environment files
- Backend local env: `backend/.env.local`
- Backend template: `backend/.env.local.example`
- Frontend env: `frontend/.env`
- Optional root env: `.env`

Known-good minimum backend env:
- `DATABASE_URL` (PostgreSQL URL)
- `JWT_SECRET`
- `PORT` (optional, defaults to 3000)
- `AUTH_PROVIDER`
- `ALLOW_LOCAL_AUTH`

Known-good minimum frontend env:
- `VITE_API_URL` or `VITE_REST_API_URL`

## Startup sequence (current)
1. `npm run bootstrap:local`
2. Start Postgres and Redis locally or through Docker.
3. `npm run dev --workspace=backend`
4. `npm run dev --workspace=frontend`
5. `npm run smoke:local`

Optional provider setup for parity with staging/prod:
- WorkOS: `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_REDIRECT_URI`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, plan price IDs
- Postmark: `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- R2: bucket, endpoint, and access key variables

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
- `npm run smoke:local`
- Verifies:
  - frontend reachable
  - backend reachable
  - backend `/health/readiness` reachable
  - Postgres reachability
  - Redis reachability when queueing is required
  - provider readiness summary from the backend

## Roll-forward sanity checks
- Confirm `/login`, `/auth/callback`, `/settings`, `/driver`, and `/track/:token` render in the frontend.
- Confirm `/api/auth/config`, `/api/auth/sessions`, `/api/organizations/current/members`, `/api/platform/api-keys`, and `/api/platform/webhooks` respond after login.

## Linux desktop launcher
- Install launcher:
  - `bash desktop/linux/install-desktop-entry.sh`
- Launch from app menu: **Trovan Routing**

## Rollback path
1. Stop the current backend/frontend processes.
2. Restore the previous database backup into the staging or local clone.
3. Restore proof artifacts from object storage backup if the affected release changed artifact handling.
4. Start backend and frontend again.
5. Re-run `npm run smoke:local` or the staging smoke suite.
