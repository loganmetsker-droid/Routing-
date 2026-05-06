# Migration Recovery Runbook

## Detection

- Migration fails during deploy.
- Backend readiness fails after migration.
- Rollback is blocked because the schema is no longer compatible with the previous app version.

## First Checks

1. Stop promotion and pause further deploys.
2. Capture the failing migration name, SQL error, backend release id, and database backup id.
3. Check whether the failed migration is additive, destructive, or partially applied.

## Preflight Commands

Run locally before shipping migrations:

```sh
export PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH"
npm run build --workspace=backend
npm run test --workspace=backend
```

Run against staging after applying migrations:

```sh
curl -fsS "$STAGING_BACKEND_URL/health/readiness"
npm run smoke:staging
ROUTING_SERVICE_URL="$STAGING_ROUTING_SERVICE_URL" npm run smoke:optimizer
```

## Recovery Steps

1. If the migration is additive and partially applied, write an idempotent forward-fix migration using `IF EXISTS` or `IF NOT EXISTS` guards.
2. If the migration is destructive and failed mid-flight, restore the latest verified backup into staging and reproduce before touching production.
3. If the app is down but data is intact, deploy a compatibility patch that can run against both old and new schemas.
4. Keep public traffic on the known-good app/database pair until readiness and smoke pass.

## Verification

- `npm run test --workspace=backend` passes after the migration patch.
- `/health/readiness` passes against the migrated database.
- Staging smoke proves auth, metrics, API keys, webhooks, route optimization, and Socket.IO.
- Launch audit proves primary UI flows still load and route optimization is live.

## Escalation Threshold

- Escalate if a migration touches tenant identifiers, billing records, API key tables, webhook secrets, route-run state, or public tracking tokens.

## Restore Vs Forward-Fix

- Forward-fix additive schema drift.
- Restore when destructive migration damage is confirmed or when tenant isolation can no longer be trusted.
