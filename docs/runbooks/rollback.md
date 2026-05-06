# Rollback Runbook

## Detection

- Regression after deploy.
- Health failure after release.
- Smoke suite failure after promotion.

## First Checks

1. Determine whether the failure is frontend-only, backend-only, queue/worker-only, or schema/data related.
2. Check whether the current schema is compatible with the previous backend artifact.

## Immediate Triage

1. Stop further rollout.
2. Revert frontend artifact if the issue is UI-only.
3. Revert backend artifact if schema-compatible.
4. Revert worker artifact if queue behavior regressed.

## Recovery Steps

1. Re-run backend health checks:

   ```sh
   curl -fsS "$STAGING_BACKEND_URL/health"
   curl -fsS "$STAGING_BACKEND_URL/health/runtime"
   curl -fsS "$STAGING_BACKEND_URL/health/readiness"
   ```

2. Re-run the staging smoke gate:

   ```sh
   npm run smoke:staging
   ROUTING_SERVICE_URL="$STAGING_ROUTING_SERVICE_URL" npm run smoke:optimizer
   PLAYWRIGHT_SKIP_WEBSERVER=true npm run launch:audit
   ```

3. Keep traffic pinned to the known-good build until the smoke gate passes.

## Verification

- health endpoints healthy
- smoke suite passes
- route optimization is live and not fallback
- API key revoke and metrics-token checks still pass
- audit writes still succeed

## Escalation Threshold

- Escalate immediately if rollback is blocked by schema incompatibility.

## Restore vs Forward-Fix

- Prefer forward-fix if rollback would worsen schema state.
- Restore DB only for corruption or irrecoverable destructive writes.
