# Deploy Runbook

## Detection

- Planned release or deploy request.

## First Checks

1. Confirm latest backup exists.
2. Confirm staging is healthy.
3. Confirm smoke suite passes in staging.

## Preflight Commands

Run with the local Node binary first on `PATH` until the default shell Node binding issue is fixed:

```sh
export PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH"
npm run test --workspace=backend
npm run test --workspace=frontend -- --run
npm run build --workspaces
npm audit --workspaces --audit-level=moderate
npm audit --workspaces --omit=dev --audit-level=moderate
npm run check:backend-deps
```

For the Python routing service, verify in a Python version that supports the pinned OR-Tools package before launch:

```sh
python -m pytest routing-service/tests
```

## Immediate Triage Steps

1. Deploy backend artifact.
2. Apply migrations using the approved migration workflow.
3. Deploy worker/runtime changes if queue behavior changed.
4. Deploy frontend artifact.
5. Confirm `STRICT_ENV_VALIDATION=true`, `QUEUE_REQUIRED=true`, `METRICS_TOKEN`, `FRONTEND_URL`, and `CORS_ORIGINS` are configured for the target environment.

## Verification

- `/health/ping`
- `/health`
- `/health/runtime`
- smoke suite pass artifact
- no queue lag spike
- frontend can log in through WorkOS and call the production API without preview auth flags
- `/api/metrics` rejects unauthenticated requests when `METRICS_TOKEN` is set

## Escalation Threshold

- Escalate if staging fails smoke tests.
- Escalate if production health fails after deploy.

## Restore vs Forward-Fix

- Roll back frontend/backend artifact first if schema-compatible.
- Restore database only for destructive or corrupting failures.
