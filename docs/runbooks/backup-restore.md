# Backup And Restore Runbook

## Detection

- Planned release with schema changes.
- Suspected destructive write, data corruption, or failed migration.
- Restore drill request before public launch.

## First Checks

1. Confirm the latest Postgres backup timestamp and retention policy in the hosting provider dashboard.
2. Confirm object storage bucket versioning or lifecycle policy for proof artifacts and exports.
3. Confirm Redis is treated as disposable cache/queue state unless a provider-specific persistence mode is enabled.
4. Record the exact app version, migration version, and database backup id before changing anything.

## Preflight Commands

```sh
export STAGING_BACKEND_URL="https://<backend-host>"
curl -fsS "$STAGING_BACKEND_URL/health/readiness"
npm run smoke:staging
```

## Restore Drill

1. Restore the selected Postgres backup into an isolated staging database, never over production first.
2. Point a temporary backend service or Render preview environment at the restored database.
3. Run migrations forward only if the restored backup predates the current app schema.
4. Verify app readiness and tenant isolation:

   ```sh
   curl -fsS "$STAGING_BACKEND_URL/health"
   curl -fsS "$STAGING_BACKEND_URL/health/runtime"
   curl -fsS "$STAGING_BACKEND_URL/health/readiness"
   npm run smoke:staging
   PLAYWRIGHT_SKIP_WEBSERVER=true npm run launch:audit
   ```

5. Verify representative data: organizations, users, jobs, routes, drivers, vehicles, customers, webhooks, API keys, subscriptions, and tracking links.

## Verification

- Restored backend reaches readiness.
- WorkOS-authenticated user sees only their organization data.
- Route optimization and public tracking still work.
- API keys remain hashed and revoked keys stay rejected.
- Webhook signing secrets and subscription records are present without exposing raw secrets in logs.

## Escalation Threshold

- Escalate immediately if a backup cannot be restored into staging or if restored data crosses organization boundaries.

## Restore Vs Forward-Fix

- Prefer forward-fix for non-destructive application bugs.
- Restore only for destructive writes, corruption, or a migration that cannot be safely repaired in place.
