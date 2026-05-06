# Launch Readiness

Date: 2026-05-06
Scope: `/Users/logan/Desktop/Routing`
Verdict: **NO-GO for public paid SaaS launch**

## Summary

This pass moved the repo from local/demo hardening toward a real SaaS staging posture: reproducible npm installs, hosted frontend and routing-service declarations, stricter tenant scoping, DTO validation on dispatch/route-run mutations, webhook SSRF/DNS blocking, staging smoke tooling, and a Playwright launch audit that inventories and exercises primary UI controls.

The local codebase is materially healthier, and the routing-service now passes Python 3.11 plus Docker optimizer proof locally. Public launch is still blocked because hosted staging has not been deployed and proven with real WorkOS, Redis, database, Stripe test mode, email/SMS sandbox, storage, authenticated Socket.IO, public API keys, and provider-backed staging smoke.

## Changes Closed In This Pass

- Added `package-lock.json` to source control readiness by removing the lockfile ignore and switching Render build commands to `npm ci`.
- Expanded `render.yaml` to include `trovan-backend`, `trovan-routing-service`, and `trovan-frontend`; frontend is static-hosted with production Vite env placeholders and SPA rewrite/security headers, while backend receives the routing service host/port from the Render service graph.
- Replaced the root Docker Compose OSRM placeholder with the project FastAPI routing-service on port `8000`, matching backend route optimization expectations.
- Added a routing-service URL resolver so backend planning/dispatch code supports explicit `ROUTING_SERVICE_URL`, legacy provider URL, and Render internal host/port wiring.
- Fixed routing-service startup under Docker by avoiding SQLAlchemy's reserved `metadata` declarative attribute name.
- Raised OR-Tools disjunction penalties so feasible stops are not dropped in `balanced` mode simply because span cost is cheaper than assignment.
- Scoped drivers, vehicles, and customers REST/GraphQL flows by actor organization, including vehicle assignment checks for drivers.
- Scoped subscription reads/cancel/create paths by actor organization, added a migration to attach `organization_id` to subscriptions, and backfilled from default organization memberships when available.
- Scoped public API tracking telemetry reads through the route organization instead of vehicle id alone.
- Replaced remaining dispatch and route-run inline `@Body()` object shapes with DTOs for validation.
- Hardened outbound webhook targets with allowlist support plus DNS/private-IP blocking before create/update/dispatch/replay.
- Added `npm run smoke:staging` for hosted staging health, metrics-token, strict CORS, protected API rejection, API key lifecycle, webhook SSRF rejection, Socket.IO dispatch/tracking, provider-env, and routing-service smoke evidence.
- Extended the launch Playwright audit for hosted staging with `PLAYWRIGHT_SKIP_WEBSERVER=true`, bearer-token seeding, and strict optimizer mode.
- Added a Playwright launch audit that renders desktop/mobile primary routes, saves route/control inventory evidence, fills customer/driver/vehicle/job forms, accounts for visible controls, and proves the preview optimizer path returns `optimized`, `live`, and non-fallback route data.
- Moved launch audit evidence into untracked `.tmp/launch-audit/*` and stopped using tracked `.artifacts` paths for this suite.
- Added launch runbooks for backup/restore and migration recovery, and updated deploy/rollback/provider-outage runbooks with exact staging verification commands.

## Verified Checks

Run with:

```sh
export PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH"
```

Passed on 2026-05-06:

- `npm ci`
  - Passed; 953 packages audited, 0 vulnerabilities.
- `npm run build --workspaces`
  - Passed; backend Nest build and frontend Vite production build completed.
- `npm run test --workspace=backend`
  - Passed; 35 test files, 123 tests.
- `npm run test --workspace=frontend -- --run`
  - Passed; 6 test files, 8 tests.
- `npm audit --workspaces --audit-level=moderate`
  - Passed; 0 vulnerabilities.
- `npm audit --workspaces --omit=dev --audit-level=moderate`
  - Passed; 0 vulnerabilities.
- `npm run check:backend-deps`
  - Passed; NestJS and TypeORM dependency tree is consistent.
- `npm run test --workspace=backend -- public-api.controller.spec.ts subscriptions.service.spec.ts route-runs.service.spec.ts`
  - Passed; confirms subscription org scoping, public API telemetry scoping, and route-run tracking expectations.
- `STAGING_SMOKE_ALLOW_PARTIAL=true STAGING_REQUIRE_PROVIDER_CHECKS=false npm run smoke:staging`
  - Passed in scaffold mode; confirms the staging smoke runner executes and writes `.tmp/launch-audit/staging-smoke/staging-smoke-results.json`.
- `PLAYWRIGHT_BASE_URL="http://127.0.0.1:5201" PLAYWRIGHT_FRONTEND_PORT="5201" PLAYWRIGHT_MOCK_API_PORT="3201" LAUNCH_AUDIT_API_URL="http://127.0.0.1:3201" LAUNCH_AUDIT_DIR=".tmp/launch-audit/playwright" PLAYWRIGHT_OUTPUT_DIR=".tmp/launch-audit/test-results" npm run launch:audit`
  - Passed; 4 Playwright launch audit tests in 2.6 minutes.
  - Evidence: `.tmp/launch-audit/playwright` and `.tmp/launch-audit/test-results`.
  - Known warnings: React Router v7 future-flag warnings and Vite/Rolldown deprecation warnings. No console errors or unexpected HTTP 4xx/5xx were accepted by the suite.
- `.tmp/routing-service-py311/bin/python -m pytest routing-service/tests`
  - Passed; 5 routing-service tests under Python 3.11.0.
  - Added app-startup coverage so SQLAlchemy model import failures are caught before container deploy.
- `/Applications/Docker.app/Contents/Resources/bin/docker build -t trovan-routing-service:launch routing-service`
  - Passed; production routing-service image builds from `python:3.11-slim`.
- `curl -fsS http://127.0.0.1:18080/health`
  - Passed against the Dockerized routing-service.
- `ROUTING_SERVICE_URL=http://127.0.0.1:18080 npm run smoke:optimizer`
  - Passed against the Dockerized routing-service.
  - Evidence: `objectiveUsed=balanced`, `orderedStops=["stop-a","stop-b"]`, `warnings=[]`, `totalDistanceM=5768`, `totalDurationS=2065`.

Still not certified locally:

- Backend readiness endpoints `/health`, `/health/runtime`, and `/health/readiness`
  - Not certified against hosted staging because staging is not deployed/configured in this environment.

## Launch Blockers

- Deploy hosted staging from the updated blueprint and populate real staging env: WorkOS, database, Redis, `ROUTING_SERVICE_URL`/internal host, `FRONTEND_URL`, `CORS_ORIGINS`, `METRICS_TOKEN`, Stripe test mode, webhook receiver, email/SMS sandbox, and object storage test bucket.
- Deploy the Python 3.11 routing-service to hosted staging and run the same live optimizer smoke against `STAGING_ROUTING_SERVICE_URL`.
- Run hosted staging Playwright with real WorkOS test login and no preview env (`VITE_AUTH_BYPASS` and `VITE_MOCK_PREVIEW` absent).
- Prove authenticated Socket.IO connect/revocation expectations and organization-scoped dispatch/tracking events against staging.
- Prove public API key create/revoke plus `x-api-key` calls against staging, including cross-org denial.
- Prove webhook create/deliver/replay/rotate behavior against staging, including signature verification, response body cap, allowlist/private-IP rejection, and no redirect/private-IP SSRF path.
- Prove Stripe test checkout and webhook flow if billing is included in launch.
- Run `npm run smoke:staging` with real `STAGING_FRONTEND_URL`, `STAGING_BACKEND_URL`, `STAGING_ROUTING_SERVICE_URL`, `STAGING_AUTH_TOKEN`, `METRICS_TOKEN`, WorkOS, Stripe, webhook receiver, Postmark, Twilio, and R2 sandbox env.
- Verify `/api/metrics` rejects unauthenticated requests when `METRICS_TOKEN` is set.
- Verify production/staging disables Swagger unless explicitly enabled, uses strict CORS, hides validation internals, and avoids logging secrets/request bodies.
- Finish backup/restore, migration, rollback, provider-failure, and incident runbooks before charging real customers.

## Go / No-Go

Go for continued private staging hardening and internal pilot demos.

No-go for public paid SaaS launch until hosted staging passes the full provider-backed smoke with live routing-service, tenant isolation, metrics protection, WorkOS, Stripe, Redis, storage, and webhook security verified.
