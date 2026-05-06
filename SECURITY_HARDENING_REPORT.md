# Security Hardening Report

Date: 2026-04-27
Scope: local security and reliability audit of `/Users/logan/Desktop/Routing`

## Daily Pass: 2026-04-26

### Summary Of Risks Found

- Input validation gaps remain in several REST endpoints that use inline `@Body()` shapes (bypassing nested `ValidationPipe` validation) and should be migrated to DTOs deliberately (examples: `auth.controller.ts` and multiple `route-runs.controller.ts` endpoints).
- Bulk import DOS risk: even with DTO validation, `POST /api/jobs/import` still lacks an explicit max payload size / array size cap; add this only after confirming UX + limits.
- Local tooling reliability risk persists: Vitest is blocked on macOS by an optional native binding code-signing/Team-ID validation failure (`@rolldown/binding-darwin-arm64`), preventing test execution in this environment.

### Changes Made

- Added DTO-based nested validation for `POST /api/jobs/import`.
  - File: `backend/src/modules/jobs/dto/import-jobs.dto.ts`.
  - `backend/src/modules/jobs/jobs.controller.ts` now uses the DTO and preserves the prior “missing jobs means empty import” behavior via `jobs ?? []`.
- Added focused DTO validation tests in `backend/src/modules/jobs/dto/import-jobs.dto.spec.ts` (blocked from execution locally due to the Vitest native binding issue).

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/modules/jobs/dto/import-jobs.dto.ts`
- `backend/src/modules/jobs/dto/import-jobs.dto.spec.ts`
- `backend/src/modules/jobs/jobs.controller.ts`

### Checks And Commands Run

- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run build --workspace=backend`
  - Passed (`nest build`).
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run test --workspace=backend -- import-jobs.dto`
  - Failed at Vitest startup: `Cannot find native binding` / `@rolldown/binding-darwin-arm64` code-signing mismatch Team ID.

### Recommended Next Actions

1. Fix the macOS native optional dependency/code-signing issue so Vitest can run, then re-run focused backend tests.
2. Migrate remaining inline `@Body()` shapes to DTOs for consistent validation (start with auth + route-runs).
3. Decide on and enforce import payload limits (`jobs/import`) after confirming acceptable UX and throughput.

## Stack Identified

- Root npm workspace with `backend` and `frontend`.
- Backend: NestJS 11, TypeORM/PostgreSQL, Apollo GraphQL, JWT/Passport, WorkOS integration, Stripe billing, Bull/Redis optional queueing, Socket.IO, Helmet, global validation pipe, global JWT/RBAC/throttling guards.
- Frontend: React 18, Vite, MUI, TanStack Query, Socket.IO client.
- Routing service: FastAPI/Pydantic route optimizer with SQLAlchemy/PostGIS-style models.
- Deployment/config: Docker, docker-compose, Kubernetes manifests, Render config, tracked `.env.example` files.

## Summary Of Risks Found

- Request logging risk: request logs can unintentionally capture secrets via request bodies or URL query strings; production body logging should be opt-in and logged paths should avoid query strings.
- Input validation gap: `POST /api/tracking/ingest` required a runtime DTO so Nest's `ValidationPipe` can validate vehicle IDs, coordinates, numeric ranges, and timestamps.
- Dependency visibility gap: `npm audit` is blocked here (DNS for `registry.npmjs.org` + npm cannot write logs to `/Users/logan/.npm/_logs`), so vulnerabilities were not re-evaluated in this pass.
- Local tooling reliability risk: Vitest and Vite builds are blocked on macOS by optional native bindings failing code-signing/Team-ID validation (`@rolldown/binding-darwin-arm64` and `@rollup/rollup-darwin-arm64`).
- Config mismatch risk: templates/deploy docs reference `CORS_ORIGIN`, while the backend expects `CORS_ORIGINS` (comma-separated). Without an alias, strict runtime config validation can fail in production-like environments.
- Docker Compose reliability risk: Redis is configured with `--requirepass` but its healthcheck did not authenticate, causing the service to appear unhealthy even when running.
- Unsafe defaults/templates: tracked examples still show placeholder/default values such as `JWT_SECRET=replace-with-a-strong-secret`, local admin credentials, and Kubernetes `CHANGE_ME_IN_PRODUCTION` secret templates. I found no tracked real `.env.local`; `backend/.env.local` is present locally but not tracked.
- Authorization/scoping review needed: customer and driver REST controllers do not consistently pass `req.user.organizationId` to services, unlike jobs/tracking/dispatch paths. This needs a careful service-level scoping pass before changing behavior.
- Billing/subscription scoping review needed: subscription lookup/cancel endpoints operate by `userId` or subscription ID and should be reviewed for organization ownership checks before production use.
- Bulk import validation gap: `POST /api/jobs/import` accepts an inline `{ jobs: CreateJobDto[] }` shape instead of a DTO with nested validation and size limits. This should be hardened deliberately because it can affect import workflows.
- Public/internal surface review needed: `/metrics` is public, and the FastAPI routing service exposes optimizer endpoints without auth. That may be acceptable behind private networking but should be explicitly enforced at deployment boundaries.
- Webhook storage review needed: outbound webhook deliveries store response bodies. Consider truncation/redaction to avoid persisting secrets returned by customer endpoints.

## Changes Made

- Hardened backend HTTP request logging in `backend/src/common/http/request-logging.middleware.ts`.
  - Redaction matches sensitive key fragments case-insensitively and across common key styles.
  - Logged paths strip query strings/hashes before UUID sanitization.
  - Request bodies are omitted in production logs unless `LOG_REQUEST_BODIES=true` is explicitly set.
  - Sanitizer helpers are exported for tests.
- Added focused request logging tests in `backend/src/common/http/request-logging.middleware.spec.ts`.
  - Covers nested redaction, array redaction, UUID + query stripping, production body logging defaults, and sensitive-key detection.
- Added runtime DTO validation for tracking telemetry ingest.
  - File: `backend/src/modules/tracking/dto/telemetry-ingest.dto.ts`.
  - Validates `vehicleId` as UUID, lat/lng numeric ranges, speed/heading/fuel bounds, timestamp format, and metadata object shape.
  - `backend/src/modules/tracking/tracking.controller.ts` now uses the DTO instead of a TypeScript-only type.
- Added DTO validation tests in `backend/src/modules/tracking/dto/telemetry-ingest.dto.spec.ts`.
- Fixed a backend build blocker by aligning `DispatchWorker.manualDispatch(...)` overloads with controller usage in `backend/src/modules/dispatch/dispatch.worker.ts`.
- Accepted `CORS_ORIGIN` as a legacy alias for `CORS_ORIGINS` in `backend/src/main.ts` to match templates and deployment docs.
- Fixed Redis healthcheck auth in `docker-compose.yml` to match `--requirepass`.
- Updated `.env.example` to prefer `CORS_ORIGINS` (comma-separated) with `CORS_ORIGIN` as a commented legacy alias.

## Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `.env.example`
- `backend/src/common/http/request-logging.middleware.ts`
- `backend/src/common/http/request-logging.middleware.spec.ts`
- `backend/src/main.ts`
- `backend/src/modules/dispatch/dispatch.worker.ts`
- `backend/src/modules/tracking/tracking.controller.ts`
- `backend/src/modules/tracking/dto/telemetry-ingest.dto.ts`
- `backend/src/modules/tracking/dto/telemetry-ingest.dto.spec.ts`
- `docker-compose.yml`

Note: the working tree already contained many unrelated frontend changes before this pass. I did not revert or edit those files.

## Checks And Commands Run

- `git status --porcelain=v1`
  - Passed; repo already had unrelated local frontend/package changes before this pass.
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run build --workspace=backend`
  - Passed; `nest build` succeeds.
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run test --workspace=backend -- request-logging.middleware telemetry-ingest.dto`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64`.
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run build --workspaces`
  - Failed in frontend build due native binding/code-signing failure in `@rollup/rollup-darwin-arm64`.
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run lint --workspace=frontend`
  - Failed: ESLint 10 requires `eslint.config.js` (flat config); frontend still uses legacy config.
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' audit --workspaces --audit-level=moderate`
  - Failed: `getaddrinfo ENOTFOUND registry.npmjs.org` and npm cannot write logs to `/Users/logan/.npm/_logs`.

## Test Status

- Backend build: passed (`nest build`).
- Focused Vitest tests: blocked before execution by native binding/code-signing failure.
- Full workspace tests: blocked before execution by native binding/code-signing failure.
- Frontend lint: blocked on ESLint flat-config migration.
- Frontend build: blocked by Rollup native optional dependency/code-signing issue.

## Remaining Risks

- Repair the macOS native optional dependency/code-signing issue for Rollup/Rolldown so Vitest and Vite can run locally.
- Migrate frontend lint to ESLint flat config (or pin ESLint to a compatible version) and re-run lint.
- Re-run `npm audit` in an environment with registry access and writable npm logs, then apply the smallest same-major upgrades.
- Add organization scoping to customer, driver, subscription, billing, and public API detail flows after reviewing existing demo data and frontend assumptions.
- Add nested DTO validation and size limits for `jobs/import`.
- Decide whether public `/metrics` and FastAPI optimizer routes must be private-network only, API-key protected, or disabled by default in production.
- Consider response-body truncation/redaction for webhook deliveries.

## Recommended Next Actions

1. Review this patch first because it is small and should be low-risk.
2. Repair local npm optional native dependencies (Rollup/Rolldown), then re-run backend focused tests and full workspace tests.
3. Update frontend ESLint config (flat config) or pin ESLint and re-run lint.
4. Re-run `npm audit` in an environment with registry access and writable npm logs, then apply the smallest same-major upgrades.
5. Open a separate tenant-scoping pass for customer, driver, subscription, billing, and public API detail flows.

## Daily Pass: 2026-04-27

### Summary Of Risks Found

- WebSocket gateway CORS was configured with `origin: '*'` and `credentials: true` for both `/dispatch` and `/tracking`, which allows any website origin to initiate browser socket connections. Even with JWT auth elsewhere, this is an unsafe default and should be tied to the same origin allowlist as HTTP.
- Swagger/OpenAPI advertised `@ApiSecurity('x-api-key')` on integration controllers but did not declare the `x-api-key` security scheme in the generated spec, making it easy to misconfigure integrations.

### Changes Made

- Centralized origin allowlist logic in `backend/src/common/http/cors-origin.util.ts` and reused it for both HTTP and Socket.IO:
  - HTTP: `backend/src/main.ts` now uses `createCorsOriginValidator()` instead of inline parsing/callback logic.
  - WebSockets: `backend/src/modules/dispatch/dispatch.gateway.ts` and `backend/src/modules/tracking/tracking.gateway.ts` now use `createCorsOriginValidator()` instead of `origin: '*'`.
  - Behavior: allow configured `CORS_ORIGINS`/`CORS_ORIGIN`/`FRONTEND_URL`; if unconfigured and not production, allow a small localhost allowlist; always allow missing `Origin` headers.
- Declared `x-api-key` in the Swagger DocumentBuilder in `backend/src/main.ts` so `@ApiSecurity('x-api-key')` is correctly represented in OpenAPI.
- Added focused unit tests for the origin validator in `backend/src/common/http/cors-origin.util.spec.ts` (not executed locally due to the Vitest native binding issue).

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/cors-origin.util.ts`
- `backend/src/common/http/cors-origin.util.spec.ts`
- `backend/src/main.ts`
- `backend/src/modules/dispatch/dispatch.gateway.ts`
- `backend/src/modules/tracking/tracking.gateway.ts`

### Checks And Commands Run

- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run build --workspace=backend`
  - Passed (`nest build`).
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run test --workspace=backend -- cors-origin.util`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch).

### Blockers

- Vitest is still blocked on this Mac by native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so unit tests could not be executed in this environment.
- Frontend Vite build is still blocked by optional native binding/code-signing failures (`@rollup/rollup-darwin-arm64`).
- `npm audit` remains blocked here (DNS to `registry.npmjs.org` + npm log path issue).

### Remaining Risks

- WebSocket auth + scoping: both `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations. They should require JWT (or API key) at connect-time and filter/broadcast by `organizationId` instead of global broadcast.

### Recommended Next Actions

1. Add authenticated Socket.IO handshake + organization scoping for gateway broadcasts.
2. Repair local native optional dependency/code-signing issues so tests/lint/build can run reliably here.

## Daily Pass: 2026-04-28

### Summary Of Risks Found

- Backend HTTP CORS configuration used an explicit `allowedHeaders` allowlist but did not include `x-api-key` (used by the integration API key guard) or `x-request-id` (request correlation). This can cause browser preflight failures and encourages unsafe client workarounds (query-string tokens, disabling CORS, etc.).
- Backend CORS did not explicitly expose `x-request-id`, making it harder for browser clients to read/request-correlate errors even though the backend sets the header.

### Changes Made

- Expanded backend CORS header allowlist and exposed headers:
  - `backend/src/main.ts` now allows `x-api-key` and `x-request-id`.
  - `backend/src/main.ts` now exposes `x-request-id` to browser clients.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/main.ts`

### Checks And Commands Run

- `/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin/node /Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js run build --workspace=backend`
  - Passed (`nest build`).
- `/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin/node /Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js run test --workspace=backend -- cors-origin.util`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch).

### Blockers

- Vitest is still blocked on this Mac by the `@rolldown/binding-darwin-arm64` native binding Team ID mismatch, preventing execution of focused backend unit tests.

### Remaining Risks

- WebSocket auth + scoping: both `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations.
- Swagger/OpenAPI remains exposed by default at `/api/docs` regardless of environment; consider gating it in production behind an explicit enable flag.

### Recommended Next Actions

1. Decide whether to gate `/api/docs` and `/graphql` in production (flag + allowlist).
2. Repair local `rolldown` native binding signing mismatch so Vitest can run, then execute focused tests for the existing hardening utilities.

## Daily Pass: 2026-04-29

### Summary Of Risks Found

- Swagger/OpenAPI (`/api/docs`) was always enabled regardless of environment, even though GraphQL Playground and introspection are disabled in production. This increases attack surface and can leak endpoint structure in production deployments.

### Changes Made

- Gated Swagger/OpenAPI by environment with an explicit override:
  - New `isSwaggerEnabled()` helper defaults to enabled outside production and disabled in production unless `SWAGGER_ENABLED=true`.
  - `backend/src/main.ts` now only registers Swagger routes when enabled.
- Documented `SWAGGER_ENABLED` in `.env.example` (commented by default).

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `.env.example`
- `backend/src/main.ts`
- `backend/src/common/http/swagger-enabled.util.ts`
- `backend/src/common/http/swagger-enabled.util.spec.ts`

### Checks And Commands Run

- `/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin/node /Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js run build --workspace=backend`
  - Passed (`nest build`).
- `/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin/node /Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js run test --workspace=backend -- swagger-enabled.util`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch).
- `/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin/node /Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js run build --workspaces`
  - Failed in frontend build due native binding/code-signing failure in `@rollup/rollup-darwin-arm64` (Team ID mismatch).
- `/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin/node /Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js run lint --workspace=frontend`
  - Failed: ESLint 10 requires `eslint.config.js` (flat config); frontend still uses legacy config.

### Blockers

- Vitest is still blocked on this Mac by native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so unit tests could not be executed in this environment.
- Frontend Vite build is still blocked by optional native binding/code-signing failures (`@rollup/rollup-darwin-arm64`).
- Frontend lint is still blocked on an ESLint flat-config migration (ESLint 10).

### Remaining Risks

- WebSocket auth + scoping: `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations.
- Swagger docs are now off by default in production, but enabling Swagger in production via `SWAGGER_ENABLED=true` should ideally be paired with an allowlist (or internal-only access) if the deployment is Internet-exposed.

### Recommended Next Actions

1. Decide whether production Swagger should be internal-only (allowlist/VPN) vs disabled entirely (keep `SWAGGER_ENABLED` unset/false).
2. Repair local Rollup/Rolldown native binding signing mismatch so Vitest/Vite can run and the added unit tests can be executed.
3. Add authenticated Socket.IO handshake + organization scoping for gateway broadcasts (migration-sized; do as a separate dedicated pass).

## Daily Pass: 2026-04-30

### Summary Of Risks Found

- `/api/metrics` (Prometheus exposition format) was effectively unauthenticated because the route is `@Public()`. If the backend is Internet-exposed, this can leak operational and fleet-level signals and increases attack surface.

### Changes Made

- Added optional token enforcement for `/api/metrics` via `METRICS_TOKEN`:
  - When `METRICS_TOKEN` is set, the request must include `Authorization: Bearer <METRICS_TOKEN>` (or `x-metrics-token`).
  - When `METRICS_TOKEN` is unset, behavior remains public for compatibility (recommended to protect upstream or set the token in production).
- Added a production startup warning when `METRICS_TOKEN` is not configured.
- Documented `METRICS_TOKEN` in `.env.example`.
- Added focused unit tests for token extraction/authorization logic.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `.env.example`
- `backend/src/main.ts`
- `backend/src/common/http/metrics-auth.util.ts`
- `backend/src/common/http/metrics-auth.util.spec.ts`
- `backend/src/modules/metrics/metrics.controller.ts`

### Checks And Commands Run

- `cd backend && ../node_modules/.bin/nest build`
  - Passed.
- `cd backend && ../node_modules/.bin/vitest run --config vitest.config.ts -- metrics-auth.util`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch).
- `cd backend && ../node_modules/.bin/tsc -p tsconfig.json --noEmit`
  - Failed due existing backend test typing/config issues (mix of Jest-era specs and Vitest globals; not caused by this change).

### Blockers

- Vitest is still blocked on this Mac by native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so unit tests could not be executed in this environment.
- Backend `tsc --noEmit` includes spec files that reference Jest/Vitest globals without type config; resolving this needs a deliberate test-runner + TS config cleanup pass.

### Remaining Risks

- `/api/metrics` remains public when `METRICS_TOKEN` is unset; production should set a token and/or restrict the route to internal networks.
- WebSocket auth + scoping: `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations.

### Recommended Next Actions

1. In production, set `METRICS_TOKEN` and configure Prometheus scraping headers, or restrict `/api/metrics` to an internal network/allowlist.
2. Repair local Rollup/Rolldown native binding signing mismatch so Vitest/Vite can run and the added unit tests can be executed.
3. Add authenticated Socket.IO handshake + organization scoping for gateway broadcasts (migration-sized; do as a separate dedicated pass).

## Daily Pass: 2026-05-02

### Summary Of Risks Found

- Outbound webhook SSRF risk: webhook endpoints are user-configurable and the server will `fetch()` arbitrary URLs during delivery. Even with `https`-only validation, an attacker (or compromised admin account) could target internal/private IPs and potentially exfiltrate internal data (via delivery response capture) or hit internal services.

### Changes Made

- Added a best-effort outbound webhook URL allow/deny check for strict environments (non-`development`/`test`):
  - Blocks `localhost`/`.localhost`, private IPv4 ranges, and private/loopback/link-local IPv6 when `NODE_ENV` is not `development`/`test`.
  - Leaves behavior unchanged in `development`/`test` to keep local testing possible.
  - Note: this does not protect against hostnames that resolve to private IPs (DNS rebinding / internal DNS); addressing that requires a dedicated allowlist/DNS-resolution hardening pass.
- Added focused unit tests for the allow/deny logic (not executable locally due to the Vitest native binding issue).

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/outbound-webhook-url.util.ts`
- `backend/src/common/http/outbound-webhook-url.util.spec.ts`
- `backend/src/modules/platform/platform.service.ts`

### Checks And Commands Run

- `cd backend && ../node_modules/.bin/nest build`
  - Passed.
- `cd backend && ../node_modules/.bin/vitest run --config vitest.config.ts -- outbound-webhook-url.util`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch).

### Blockers

- Vitest remains blocked on this Mac by native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so unit tests could not be executed in this environment.

### Remaining Risks

- Webhooks still represent a possible SSRF surface via DNS resolution (hostnames that resolve to private IPs), redirects, and internal domains; consider an explicit allowlist + DNS/IP enforcement at request time.
- WebSocket auth + scoping: `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations.

### Recommended Next Actions

1. Decide on a webhook delivery allowlist strategy (per-org allowed domains, or global allowlist), and enforce DNS/IP resolution blocking at request time.
2. Repair local Rollup/Rolldown native binding signing mismatch so Vitest/Vite can run and the added unit tests can be executed.

## Daily Pass: 2026-05-06

### Summary Of Risks Found

- Webhook delivery response capture risk: webhook deliveries stored the full `response.text()` in `webhook_deliveries.response_body` with no size cap. A malicious/buggy webhook endpoint can return very large bodies, bloating database storage and increasing the blast radius of any SSRF misconfiguration by persisting internal service responses.
- WebSocket tenant-boundary risk: `/dispatch` and `/tracking` accepted unauthenticated Socket.IO handshakes and broadcast route/location events globally instead of by `organizationId`.
- Local test runner diagnosis: Vitest fails under the Codex.app hardened Node binary, but the local Node install at `/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin` can load Rolldown/Rollup native bindings and run the backend suite.

### Changes Made

- Limited webhook response-body capture to a bounded size:
  - Added `readResponseTextLimited()` helper that reads webhook responses incrementally and truncates after `WEBHOOK_MAX_RESPONSE_BODY_BYTES` (default: 64 KiB).
  - Updated `backend/src/modules/platform/platform.service.ts` to use the bounded reader for both delivery and replay paths and annotate truncated bodies with `...[truncated]`.
- Kept webhook delivery timeouts active through bounded response-body reads so slow streaming bodies cannot bypass the existing 5-second abort window.
- Added authenticated and organization-scoped Socket.IO boundaries:
  - Added a shared socket JWT helper that accepts tokens from Socket.IO auth payloads, Authorization headers, or query token fallback.
  - `/dispatch` and `/tracking` now reject unauthenticated sockets or JWTs without `organizationId`.
  - Route, vehicle, tracking, driver-location, and generic gateway broadcasts now emit to organization-scoped rooms instead of global `server.emit(...)`.
  - Frontend Socket.IO clients now send the stored bearer token during connection handshakes.
- Fixed the current backend test failures:
  - Added explicit GraphQL field metadata for union-typed dispatch DTO fields.
  - Updated `PlanningService` specs for the newer constructor dependencies and coordinate requirements.
  - Fixed IPv6 bracket normalization in outbound webhook URL checks.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/websocket/socket-auth.util.ts`
- `backend/src/common/websocket/socket-auth.util.spec.ts`
- `backend/src/common/http/response-body.util.ts`
- `backend/src/common/http/response-body.util.spec.ts`
- `backend/src/common/http/outbound-webhook-url.util.ts`
- `backend/src/modules/platform/platform.service.ts`
- `backend/.env.example`
- `backend/.env.local.example`
- `backend/src/modules/dispatch/dispatch.gateway.ts`
- `backend/src/modules/dispatch/dispatch.worker.ts`
- `backend/src/modules/dispatch/dto/create-route.dto.ts`
- `backend/src/modules/dispatch/dto/update-route.dto.ts`
- `backend/src/modules/planning/planning.service.spec.ts`
- `backend/src/modules/tracking/tracking.gateway.ts`
- `backend/src/modules/tracking/tracking.module.ts`
- `frontend/src/services/socket.ts`

### Checks And Commands Run

- `cd backend && ../node_modules/.bin/nest build`
  - Passed.
- `export PATH='/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin':$PATH; cd backend && ../node_modules/.bin/vitest run --config vitest.config.ts`
  - Passed: 34 test files, 117 tests.
- `export PATH='/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin':$PATH; npm run build --workspace=frontend`
  - Passed.

### Blockers

- The shell still resolves `node` to the Codex.app binary by default, and that binary still fails to load the Rolldown native binding. Use the local Node path above for Routing backend tests and frontend builds until PATH is made persistent.

### Remaining Risks

- Webhooks still represent a possible SSRF surface via DNS resolution (hostnames that resolve to private IPs), redirects, and internal domains; consider an explicit allowlist + DNS/IP enforcement at request time.
- Socket.IO now requires JWT organization scope, but session revocation is still enforced by HTTP JWT strategy rather than by the lightweight socket helper; consider centralizing token/session validation if realtime sessions need immediate revocation semantics.

### Recommended Next Actions

1. Decide on a webhook delivery allowlist strategy (per-org allowed domains, or global allowlist), and enforce DNS/IP resolution blocking at request time.
2. Keep using the local Node path for tests/builds or make it persistent in the developer shell.
3. Start the scoped read-only assistant gateway only after this hardening set is reviewed/committed.

## Daily Pass: 2026-05-05

### Summary Of Risks Found

- Auth session context hardening gap: auth session `userAgent` and `ipAddress` values were persisted without any length clamp or control-character stripping, allowing oversized or control-character-injected header values to bloat session storage and potentially pollute logs/UI surfaces that display session metadata.

### Changes Made

- Sanitized auth session context values before persisting sessions:
  - Added `sanitizeSessionContext()` helper that trims, strips ASCII control characters, and clamps `userAgent` to 1024 chars and `ipAddress` to 128 chars.
  - Updated `backend/src/modules/auth/auth.service.ts` to apply the sanitizer within `createApplicationSession()` so all login paths are covered.
- Added focused unit tests for the sanitizer (not executable locally due to the Vitest native binding issue).

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/session-context.util.ts`
- `backend/src/modules/auth/session-context.util.spec.ts`

### Checks And Commands Run

- `cd backend && ../node_modules/.bin/nest build`
  - Passed.
- `cd backend && ../node_modules/.bin/vitest run --config vitest.config.ts -- session-context.util`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch / `ERR_DLOPEN_FAILED`).

### Blockers

- Vitest remains blocked on this Mac by native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so focused unit tests could not be executed locally.

### Remaining Risks

- Webhooks still represent a possible SSRF surface via DNS resolution (hostnames that resolve to private IPs), redirects, and internal domains; consider an explicit allowlist + DNS/IP enforcement at request time.
- WebSocket auth + scoping: `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations.

### Recommended Next Actions

1. Decide on a webhook delivery allowlist strategy (per-org allowed domains, or global allowlist), and enforce DNS/IP resolution blocking at request time.
2. Repair local Rollup/Rolldown native binding signing mismatch so Vitest/Vite can run and the added unit tests can be executed.
3. Add authenticated Socket.IO handshake + organization scoping for gateway broadcasts (migration-sized; do as a separate dedicated pass).

## Daily Pass: 2026-05-04

### Summary Of Risks Found

- Auth callback validation gap: `POST /api/auth/workos/callback` used an inline `@Body()` type instead of a DTO, bypassing global `ValidationPipe` protections (`whitelist`, `forbidNonWhitelisted`) and allowing malformed payloads to reach the auth service layer.

### Changes Made

- Added DTO-based validation for `POST /api/auth/workos/callback`:
  - New `WorkosCallbackDto` enforces `code` as a non-empty string and allows optional `invitationToken` and `state` (accepted for forward-compatibility, currently ignored).
  - Updated `backend/src/modules/auth/auth.controller.ts` to use `WorkosCallbackDto` and document the body shape in Swagger.
- Added focused DTO validation tests in `backend/src/modules/auth/dto/workos-callback.dto.spec.ts` (not executable locally due to the Vitest native binding issue).

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/dto/workos-callback.dto.ts`
- `backend/src/modules/auth/dto/workos-callback.dto.spec.ts`

### Checks And Commands Run

- `cd backend && ../node_modules/.bin/nest build`
  - Passed.
- `cd backend && ../node_modules/.bin/vitest run --config vitest.config.ts -- workos-callback.dto`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch / `ERR_DLOPEN_FAILED`).

### Blockers

- Vitest remains blocked on this Mac by native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so focused unit tests could not be executed locally.

### Remaining Risks

- Webhooks still represent an SSRF surface via DNS resolution (hostnames that resolve to private IPs) and internal domains; consider an explicit allowlist + DNS/IP enforcement at request time.
- WebSocket auth + scoping: `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations.

### Recommended Next Actions

1. Repair local Rollup/Rolldown native binding signing mismatch so Vitest/Vite can run and the added unit tests can be executed.
2. Add authenticated Socket.IO handshake + organization scoping for gateway broadcasts.
3. Decide on a webhook delivery allowlist strategy (per-org allowed domains, or global allowlist), and enforce DNS/IP resolution blocking at request time.

## Daily Pass: 2026-05-03

### Summary Of Risks Found

- Outbound webhook redirect SSRF risk: even with “safe” configured webhook URLs, Node’s `fetch()` follows redirects by default. A malicious endpoint can respond with a `30x` redirect to a private IP/localhost target, turning webhook delivery into an SSRF primitive.
- Reliability risk: `replayWebhookDelivery()` did not enforce any timeout/abort behavior, allowing a replay to hang indefinitely on slow/unresponsive webhook endpoints.

### Changes Made

- Prevented webhook deliveries and replays from following redirects:
  - `backend/src/modules/platform/platform.service.ts` now uses `redirect: 'manual'` so a `30x` response is treated as a failure instead of being followed.
- Added a replay timeout:
  - `backend/src/modules/platform/platform.service.ts` now applies a 5s `AbortController` timeout to `replayWebhookDelivery()`, matching the delivery path.
- Centralized the webhook delivery `fetch()` init options in a small helper to keep the security behavior consistent:
  - Added `backend/src/common/http/outbound-webhook-request.util.ts` + focused tests in `backend/src/common/http/outbound-webhook-request.util.spec.ts`.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/outbound-webhook-request.util.ts`
- `backend/src/common/http/outbound-webhook-request.util.spec.ts`
- `backend/src/modules/platform/platform.service.ts`

### Checks And Commands Run

- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run build --workspace=backend`
  - Passed (`nest build`).
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run test --workspace=backend -- outbound-webhook-request.util`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch / `ERR_DLOPEN_FAILED`).

### Blockers

- Vitest remains blocked on this Mac by native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so focused unit tests could not be executed locally.

### Remaining Risks

- Webhooks still represent an SSRF surface via DNS resolution (hostnames that resolve to private IPs) and internal domains; consider an explicit allowlist + DNS/IP enforcement at request time.
- WebSocket auth + scoping: `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations.

### Recommended Next Actions

1. Decide on a webhook delivery allowlist strategy (per-org allowed domains, or global allowlist), and enforce DNS/IP resolution blocking at request time.
2. Repair local Rollup/Rolldown native binding signing mismatch so Vitest/Vite can run and the added unit tests can be executed.
