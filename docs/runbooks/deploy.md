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
npm ci
npm run build --workspaces
npm run test --workspace=backend
npm run test --workspace=frontend -- --run
npm audit --workspaces --audit-level=moderate
npm audit --workspaces --omit=dev --audit-level=moderate
npm run check:backend-deps
git diff --check
```

For the Python routing service, verify in a Python version that supports the pinned OR-Tools package before launch:

```sh
python3.11 -m pip install -r routing-service/requirements-dev.txt
python3.11 -m pytest routing-service/tests
```

## Immediate Triage Steps

1. Deploy the Render blueprint services: `trovan-routing-service`, `trovan-backend`, and `trovan-frontend`.
2. Apply migrations using the approved migration workflow before promoting traffic to the new backend.
3. Confirm backend env: `NODE_ENV=production`, `STRICT_ENV_VALIDATION=true`, `QUEUE_REQUIRED=true`, `DATABASE_URL`, Redis, `FRONTEND_URL`, `CORS_ORIGINS`, `METRICS_TOKEN`, WorkOS, Stripe test/live mode for the target, Postmark, Twilio, R2, and webhook receiver values.
4. Confirm frontend env has no `VITE_AUTH_BYPASS` or `VITE_MOCK_PREVIEW`, and sets `VITE_REST_API_URL`, `VITE_API_URL`, and `VITE_WS_URL` to the staging or production backend.
5. Confirm backend `ROUTING_SERVICE_URL` or Render `ROUTING_SERVICE_HOSTPORT` resolves to the FastAPI routing service, not OSRM.

## Verification

Run these against staging before production promotion:

```sh
export STAGING_FRONTEND_URL="https://<frontend-host>"
export STAGING_BACKEND_URL="https://<backend-host>"
export STAGING_ROUTING_SERVICE_URL="https://<routing-service-host>"
export LAUNCH_AUDIT_API_URL="$STAGING_BACKEND_URL"
export PLAYWRIGHT_BASE_URL="$STAGING_FRONTEND_URL"
export PLAYWRIGHT_SKIP_WEBSERVER=true
export LAUNCH_AUDIT_STRICT_OPTIMIZER=true

npm run smoke:staging
ROUTING_SERVICE_URL="$STAGING_ROUTING_SERVICE_URL" npm run smoke:optimizer
npm run launch:audit
```

Required pass evidence:

- `/health`, `/health/runtime`, and `/health/readiness` pass on the backend.
- routing-service `/health` passes and `/optimize` returns ordered stops with the requested objective.
- route creation returns `optimization_status=optimized`, `data_quality=live`, no fallback flags.
- WorkOS login/logout/session, API keys, webhook SSRF rejection, metrics token enforcement, strict CORS, and Socket.IO dispatch/tracking probes pass.
- Frontend has no preview banner and no preview auth flags.
- No unexpected browser console errors, no unexpected HTTP 4xx/5xx, and launch artifacts are saved under `.tmp/launch-audit/*`.

## Escalation Threshold

- Escalate if staging fails smoke tests.
- Escalate if production health fails after deploy.

## Restore vs Forward-Fix

- Roll back frontend/backend artifact first if schema-compatible.
- Restore database only for destructive or corrupting failures.
