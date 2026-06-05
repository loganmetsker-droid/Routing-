# Security Hardening Report

Date: 2026-04-27
Scope: local security and reliability audit of `/Users/logan/Desktop/Routing`

## Daily Pass: 2026-06-01

### Summary Of Risks Found

- Reliability/misconfiguration risk: `TRUST_PROXY` accepted arbitrary hop counts. Extremely large values can unintentionally widen trust in `X-Forwarded-*` headers (client IP/proto) beyond the intended proxy topology.
- Security hardening note (not changed in this pass): the frontend currently stores an auth token in `localStorage` (`AUTH_TOKEN_KEY=authToken`), which increases the impact of any XSS bug; prefer httpOnly cookies long-term.

### Changes Made

- Clamped `TRUST_PROXY` hop counts to a conservative maximum (10) to reduce accidental over-trust while preserving the intended “hop count” configuration mode.
- Added a focused unit test covering the clamp behavior.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/trust-proxy.util.ts`
- `backend/src/common/http/trust-proxy.util.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- trust-proxy.util --reporter verbose`
- `npm run build --workspace=backend`
- `npm audit --audit-level=high`
  - Failed: `getaddrinfo ENOTFOUND registry.npmjs.org` (network restricted) and npm could not write logs to `/Users/logan/.npm/_logs`.

## Daily Pass: 2026-05-30

### Summary Of Risks Found

- Reliability/log-amplification risk: when `LOG_REQUEST_BODIES=true`, the request-body sanitizer could attempt to JSON-serialize binary-like payloads (ex: `Buffer`, `Uint8Array`) or extremely large strings/arrays, potentially producing huge log lines and unnecessary CPU/memory pressure during abuse or misconfiguration scenarios.

### Changes Made

- Treated binary-like bodies as `[BINARY]` to avoid accidental serialization into logs.
- Added conservative caps for large strings and arrays during request-body sanitization so oversized values become `[TRUNCATED]` instead of ballooning logs.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/request-logging.middleware.ts`
- `backend/src/common/http/request-logging.middleware.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- request-logging.middleware --reporter verbose`
  - Passed (10 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

## Daily Pass: 2026-05-28

### Summary Of Risks Found

- The primary JWT auth surface accepted arbitrarily large `Authorization: Bearer ...` header values. Extremely long bearer tokens can amplify memory/CPU costs (parsing/base64) before signature validation and add avoidable reliability noise during abuse scenarios.
- Local automation/artifact directories (`.codex/`, `.artifacts/`) were not ignored, increasing the risk of accidentally committing local-only outputs (which can include security-relevant logs or environment hints).

### Changes Made

- Added a strict length cap (4096 chars) for extracted JWT bearer tokens in `JwtStrategy` so overlong tokens fail closed before verification.
- Added focused unit tests for the extractor behavior.
- Updated `.gitignore` to ignore `.codex/` and `.artifacts/` directories.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/modules/auth/strategies/jwt.strategy.ts`
- `backend/src/modules/auth/strategies/jwt.strategy.spec.ts`
- `.gitignore`

### Checks And Commands Run

- `npm run test --workspace=backend -- jwt.strategy`
  - Passed (3 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

### Remaining Risks

- Other authentication entry points (ex: WebSocket handshake headers, future auth middleware) could still parse large presented tokens if they implement custom extraction outside `JwtStrategy`; consider standardizing token extraction helpers across surfaces.

### Recommended Next Actions

1. Add request size limits for JSON bodies on public/auth endpoints (to reduce abuse/DoS surfaces independent of auth).
2. Consider applying similar presented-token length caps for Socket.IO authentication and any bearer-style query param flows (if/when introduced).

### Addendum (Later 2026-05-28): CORS Localhost In Staging

#### Summary Of Risks Found

- `createCorsOriginValidator()` implicitly allowed loopback (`localhost` / `127.0.0.1` / `*.localhost`) origins for any non-production `NODE_ENV`. In staging-like environments this can unintentionally allow credentialed cross-origin requests from `localhost` when a user has an active session cookie for the API domain.

#### Changes Made

- Limited implicit localhost CORS allowances to `NODE_ENV=development` / `test` only; staging-like environments now require an explicit `CORS_ORIGINS` allowlist entry for any localhost-based debugging.

#### Files Changed By This Addendum

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/cors-origin.util.ts`
- `backend/src/common/http/cors-origin.util.spec.ts`

#### Checks And Commands Run

- `cd backend && ../node_modules/.bin/vitest run --config vitest.config.ts cors-origin.util --reporter verbose`
  - Passed (9 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

## Daily Pass: 2026-05-29

### Summary Of Risks Found

- The Socket.IO authentication surface (`handshake.auth`, headers, or query string) accepted arbitrarily large bearer tokens before attempting JWT verification. Very large presented tokens can amplify CPU/memory work (regex/trim/base64 parsing) and add avoidable reliability noise during abuse scenarios.
- The public tracking link surface (`GET /public/tracking/:token`) verified a JWT presented in a URL path segment without an explicit length cap, re-introducing the same “overlong presented token” reliability risk on a public endpoint (even though request logging redacts the token from logs).

### Changes Made

- Applied the same strict presented-token length cap (4096 chars) used by the primary JWT strategy to:
  - Socket.IO bearer token extraction (`authenticateSocket()` / `extractSocketBearerToken()`).
  - Public tracking JWT verification (`RouteRunsService.getPublicTracking()`).
- Added focused unit tests ensuring overlong tokens fail closed *before* JWT verification is attempted.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/websocket/socket-auth.util.ts`
- `backend/src/common/websocket/socket-auth.util.spec.ts`
- `backend/src/modules/dispatch/route-runs.service.ts`
- `backend/src/modules/dispatch/route-runs.service.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- socket-auth.util --reporter verbose`
  - Passed (10 tests).
- `npm run test --workspace=backend -- route-runs.service --reporter verbose`
  - Passed (11 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

### Remaining Risks

- Any other surfaces that verify JWTs from non-header locations (ex: future “magic link” flows, query-param auth, or other public token endpoints) should also enforce strict presented-token length caps before verification.

### Recommended Next Actions

1. Inventory all endpoints that accept “token-like” inputs (path/query/header/Socket.IO auth) and standardize on a shared token extraction helper with caps + normalization.
2. Consider adding explicit request body size limits for the highest-risk public/auth endpoints (independent of auth) to reduce DoS surface.

## Daily Pass: 2026-05-26

### Summary Of Risks Found

- The outbound webhook URL validator accepted non-HTTP(S) protocols (ex: `file://`) which would only fail later at delivery time, adding avoidable reliability noise and complicating incident triage.
- In strict environments, webhook URLs could include embedded credentials (ex: `https://user:pass@host/...`), which risks credential leakage via database storage, logs, or accidental sharing of endpoint configuration.
- The metrics auth helper accepted arbitrarily large `Authorization` / `x-metrics-token` header values, allowing avoidable memory/CPU amplification during token parsing and constant-time comparison.

### Changes Made

- Restricted webhook URLs to `http:` and `https:` only.
- Blocked webhook URLs containing embedded credentials when `NODE_ENV` is not `development`/`test`.
- Added focused unit tests covering both behaviors.
- Capped presented metrics token length (512 chars) so overlong header values fail closed without large buffer allocations.
- Added focused unit tests covering the length cap.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/outbound-webhook-url.util.ts`
- `backend/src/common/http/outbound-webhook-url.util.spec.ts`
- `backend/src/common/http/metrics-auth.util.ts`
- `backend/src/common/http/metrics-auth.util.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- outbound-webhook-url.util`
  - Passed (11 tests).
- `npm run test --workspace=backend -- metrics-auth.util`
  - Passed (8 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

### Remaining Risks

- Webhook targets are still allowed over plaintext `http:` in strict environments; consider requiring `https:` by default (with an explicit opt-out env flag) to reduce confidentiality risks.

### Recommended Next Actions

1. Decide whether to enforce `https:` webhook URLs in production (with an explicit `WEBHOOK_ALLOW_INSECURE_HTTP` escape hatch if needed).
2. Consider per-endpoint delivery backoff/jitter and a max retry budget to reduce webhook storm risk when a customer endpoint is degraded.

## Daily Pass: 2026-05-24

### Summary Of Risks Found

- The request logging sanitizer (`sanitizeBody()` / `sanitizeValue()`) would recursively traverse request bodies without any depth cap. If `LOG_REQUEST_BODIES` is enabled (even temporarily), an attacker could send extremely deep JSON objects to spike CPU or trigger stack overflows during log sanitization.
- Express defaults include the `X-Powered-By` response header, which is a low-severity information disclosure vector.

### Changes Made

- Added a maximum sanitization depth cap so deeply nested request bodies are replaced with `[TRUNCATED]` once the limit is reached.
- Added a focused unit test covering the truncation behavior.
- Disabled the Express `x-powered-by` header during backend bootstrap.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/request-logging.middleware.ts`
- `backend/src/common/http/request-logging.middleware.spec.ts`
- `backend/src/main.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- request-logging.middleware`
  - Passed (8 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

### Remaining Risks

- The frontend supports an auth-bypass preview mode via `VITE_AUTH_BYPASS`; ensure this is never enabled in production build environments and that preview builds are isolated from real customer data.

### Recommended Next Actions

1. Add a basic server-side request size limit (JSON/body) and/or rate limiting for public/auth endpoints to reduce abuse/DoS surfaces.
2. Add authenticated Socket.IO handshake + organization scoping for gateway broadcasts (`/dispatch`, `/tracking`) to avoid unauthenticated subscriptions.

## Daily Pass: 2026-05-23

### Summary Of Risks Found

- Unhandled backend errors logged raw request URLs via `ApiExceptionFilter` (including path segments). This could leak bearer-style path tokens (ex: `/public/tracking/:token`) or other sensitive identifiers into error logs during 5xx/throw paths.
- `ApiExceptionFilter` would fall back to an untrusted inbound `x-request-id` header when `request.requestId` was absent, re-introducing a log/header injection surface that was previously addressed in the request-context middleware.

### Changes Made

- Sanitized unhandled error log paths in `ApiExceptionFilter` using the same `sanitizePath()` logic as the request logging middleware.
- Removed the untrusted `x-request-id` header fallback from `ApiExceptionFilter`; it now uses the middleware-provided `requestId` or generates a fresh UUID.
- Added focused unit tests covering both behaviors.
- Fixed `ApiKeyAuthGuard` unit tests to use Vitest (`vi.fn`) rather than Jest globals so they run reliably in CI/local.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/api/api-exception.filter.ts`
- `backend/src/common/api/api-exception.filter.spec.ts`
- `backend/src/modules/platform/api-key-auth.guard.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- api-exception.filter`
  - Passed (2 tests).
- `npm run test --workspace=backend -- api-key-auth.guard`
  - Passed (6 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

### Remaining Risks

- Other loggers (outside the request logging middleware + `ApiExceptionFilter`) may still log raw URLs/paths on error; any endpoint that uses opaque tokens in path segments remains a potential leak source until sanitized consistently.

### Recommended Next Actions

1. Grep for raw `req.originalUrl`/`req.url`/`request.originalUrl` usage in logs and standardize on `sanitizePath()` for any log lines that include request URLs.
2. Inventory all “public link” endpoints (tracking, share links, magic links) and ensure both success-path logs and error-path logs redact their token segments.

## Daily Pass: 2026-05-22

### Summary Of Risks Found

- The public tracking endpoint uses a bearer-style token in the URL path (`/public/tracking/:token`). The request logging sanitizer previously redacted UUIDs and JWT-like segments, but would log non-JWT tracking tokens in plaintext, increasing the risk of accidental token leakage via logs.

### Changes Made

- Redacted public tracking tokens from logged request paths regardless of token format by rewriting `/public/tracking/<token>` to `/public/tracking/:token` before other path sanitization runs.
- Updated the focused unit test to assert that public tracking tokens are always redacted.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/request-logging.middleware.ts`
- `backend/src/common/http/request-logging.middleware.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- request-logging.middleware`
  - Passed (7 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).
- `npm audit --omit=dev`
  - Failed (sandbox blocked npm registry DNS: `getaddrinfo ENOTFOUND registry.npmjs.org`; also npm could not write logs to `/Users/logan/.npm/_logs`).

### Blockers

- Sandbox network restrictions prevent `npm audit` from reaching `registry.npmjs.org`.
- Sandbox write restrictions prevent npm from writing error logs to `/Users/logan/.npm/_logs`.
- `codex_auto_memory.sh` printed `Operation not permitted` errors while writing to `/Users/logan/Desktop/CodexBrain` in this sandbox, so brain notes may be stale.

### Remaining Risks

- Any other endpoints that place opaque bearer tokens in path segments (rather than headers) can still leak via logs unless explicitly sanitized.

### Recommended Next Actions

1. Inventory any “public link” style endpoints (tracking, share links, magic login links) and ensure request logging sanitizes their token segments.

## Daily Pass: 2026-05-21

### Summary Of Risks Found

- The backend does not explicitly configure Express/Nest “trust proxy” behavior. When deployed behind one or more reverse proxies/load balancers, `req.ip` and related request metadata can be inaccurate. This undermines audit logging and makes future IP-based controls (throttling, allowlists, abuse detection) unreliable.

### Changes Made

- Added explicit, opt-in trust-proxy configuration:
  - New `TRUST_PROXY` env parsing supports `true/false` (trust all / trust none) or hop-count integers (ex: `1` to trust one proxy hop).
  - `backend/src/main.ts` now applies the setting during bootstrap when configured.
- Added focused unit tests for the parser + configuration helper.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/trust-proxy.util.ts`
- `backend/src/common/http/trust-proxy.util.spec.ts`
- `backend/src/main.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- trust-proxy.util`
  - Passed (6 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

### Blockers

- `codex_auto_memory.sh` could not write to `/Users/logan/Desktop/CodexBrain` in this sandbox (`Operation not permitted`), so brain automation notes may be stale until run with proper permissions.

### Remaining Risks

- Enabling `TRUST_PROXY=true` (trust all) can allow spoofed `X-Forwarded-For` chains to affect `req.ip` in logs unless upstream proxy configuration is correct; prefer a hop count (ex: `TRUST_PROXY=1`) in hosted environments.

### Recommended Next Actions

1. Decide the intended hosted deployment proxy topology and set `TRUST_PROXY` accordingly (prefer an integer hop count).
2. Before adding any IP-based throttling/rate limiting, ensure proxy headers are being set and validated correctly by the edge/load balancer.

## Daily Pass: 2026-05-20

### Summary Of Risks Found

- The request context middleware accepted arbitrary inbound `x-request-id` values and echoed them back in the response header and logs. This allowed unbounded/unsafe values (including control characters) to inflate log volume and risk log/header injection.

### Changes Made

- Hardened `x-request-id` handling:
  - Accept only safe characters (`A-Za-z0-9._:-`) and cap length at 128 chars.
  - Fall back to `crypto.randomUUID()` when the inbound header is blank/unsafe/too long.
- Added focused unit tests for the new normalization behavior.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/request-context.middleware.ts`
- `backend/src/common/http/request-context.middleware.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- request-context.middleware`
  - Passed (5 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

### Blockers

- `codex_auto_memory.sh` could not write to `/Users/logan/Desktop/CodexBrain` in this sandbox (`Operation not permitted`), so brain automation notes may be stale until run with proper permissions.

### Remaining Risks

- Even with validation, allowing clients to supply request IDs can still be used to spoof correlation; consider ignoring inbound `x-request-id` in production if that becomes an issue.

### Recommended Next Actions

1. Decide whether to trust inbound `x-request-id` at all in production (vs always generating server-side).
2. Add per-route throttling for public + webhook endpoints before any self-serve exposure.

## Daily Pass: 2026-05-19

### Summary Of Risks Found

- Request logging would include sanitized request bodies by default in non-production environments when `LOG_REQUEST_BODIES` was unset. This increases accidental sensitive-data exposure risk in shared staging/dev environments where `NODE_ENV` may be misconfigured.

### Changes Made

- Made request-body logging opt-in only:
  - `shouldLogRequestBody()` now returns `true` only when `LOG_REQUEST_BODIES` is explicitly enabled (`1/true/yes/on`).
  - Added a focused regression assertion to ensure development defaults to no request-body logging without explicit opt-in.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/request-logging.middleware.ts`
- `backend/src/common/http/request-logging.middleware.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- request-logging.middleware`
  - Passed (7 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

### Remaining Risks

- Even with redaction, enabling `LOG_REQUEST_BODIES` can still leak unexpected sensitive values if clients place secrets under non-obvious keys; keep it disabled in hosted envs unless actively debugging.

### Recommended Next Actions

1. Add rate limiting/throttling for public + webhook endpoints before any self-serve exposure.
2. Consider adding bounded-size truncation to request-body log output as defense-in-depth when `LOG_REQUEST_BODIES` is enabled.

## Daily Pass: 2026-05-18

### Summary Of Risks Found

- The optimizer request debug logs included a JSON summary derived from inbound payload fields without bounding string lengths. A malicious (or buggy) client could send very large IDs/objective values to amplify log volume and add noise to debugging output.

### Changes Made

- Hardened optimizer request log summarization:
  - Truncate overly long IDs/objective strings before logging.
  - Omit non-primitive objective values from the summary.
  - Treat any truncation as `truncated: true` in the summary for visibility.
- Tightened background job processor logging to avoid emitting unsanitized `job.data.jobId` directly in log lines.
- Added focused unit tests for the optimizer request log summary helper.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/routing/optimize-request-log.util.ts`
- `backend/src/common/routing/optimize-request-log.util.spec.ts`
- `backend/src/modules/jobs/jobs.processor.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- optimize-request-log.util`
  - Passed (4 tests).
- `npm run test --workspace=backend -- bull-job-log.util`
  - Passed (2 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).

### Remaining Risks

- Request bodies may still be logged outside production when `LOG_REQUEST_BODIES` is enabled; ensure staging/prod envs keep it disabled unless actively debugging.
- Webhook endpoints and public routes still need hosted-staging probes for rate limiting, strict CORS behavior, and log redaction under real traffic.

### Recommended Next Actions

1. Add per-endpoint rate limiting (or at least IP-based throttling) on public and webhook endpoints before self-serve exposure.
2. Run a full backend test suite once current in-flight changes settle to catch regressions across auth + dispatch flows.

## Daily Pass: 2026-05-17

### Summary Of Risks Found

- The integration API key guard accepted untrimmed header values and did not bound input size. This makes authentication more brittle (whitespace/casing mismatches) and increases risk of header-based resource abuse (very large keys reaching downstream auth/DB logic).

### Changes Made

- Hardened API key extraction in `ApiKeyAuthGuard`:
  - Trim `x-api-key` header values before authentication.
  - Parse `Authorization: Bearer ...` case-insensitively and trim the extracted token.
  - Reject excessively long API keys (over 512 chars) before invoking `PlatformService.authenticateApiKey()`.
- Added a focused unit test suite for the guard to prevent regressions.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/modules/platform/api-key-auth.guard.ts`
- `backend/src/modules/platform/api-key-auth.guard.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- api-key-auth.guard`
  - Passed (6 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).
- `npm run check:backend-deps`
  - Passed.
- `npm audit --workspaces --audit-level=moderate`
  - Blocked: DNS `ENOTFOUND registry.npmjs.org` and cannot write logs to `/Users/logan/.npm/_logs`.

### Remaining Risks

- Integration keys are accepted via `Authorization: Bearer ...` as well as `x-api-key`. This is convenient, but can be confusing alongside JWT bearer auth in mixed-client environments; consider standardizing on `x-api-key` for integration clients.

### Recommended Next Actions

1. Decide whether integration API keys should be accepted via `Authorization` at all (or only `x-api-key`) to reduce operational ambiguity.
2. Consider adding per-scope or per-endpoint rate limiting for integration routes if public exposure is planned.

## Daily Pass: 2026-05-16

### Summary Of Risks Found

- Request logs could include sensitive bearer-style tokens when those tokens are embedded in the URL path (example: the public tracking JWT at `GET /api/public/tracking/:token`). This creates accidental token disclosure risk via log aggregation and developer consoles.

### Changes Made

- Redacted JWT-like path segments in request logging:
  - Updated `sanitizePath()` to replace any JWT-looking URL path segment with `:jwt` after query/hash stripping and UUID sanitization.
  - Added a focused unit test to prevent regressions.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/request-logging.middleware.ts`
- `backend/src/common/http/request-logging.middleware.spec.ts`

### Checks And Commands Run

- `rg -l "sk_live|AKIA|-----BEGIN (RSA )?PRIVATE KEY|xox[baprs]-|ghp_" --hidden --glob '!node_modules/**' --glob '!.git/**'`
  - No matches outside `SECURITY_HARDENING_REPORT.md`.
- `npm run test --workspace=backend -- request-logging.middleware`
  - Passed (7 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).
- `npm run check:backend-deps`
  - Passed.

### Remaining Risks

- Other sensitive identifiers may still appear in paths (non-JWT opaque tokens). If more token-in-path routes are added, consider a more general “opaque token” segment redaction rule.

### Recommended Next Actions

1. If the public tracking token is ever moved to query string form, ensure query redaction remains strict (currently query/hash are stripped before logging).
2. Consider adding per-route throttling for public tracking to reduce token brute-force and scraping risk.

## Daily Pass: 2026-05-15

### Summary Of Risks Found

- Proof artifact downloads were served using stored `mimeType` metadata and `Content-Disposition: inline`. Combined with the frontend’s `blob:` open/download behavior (`target="_blank"`), this could enable blob-based XSS if an attacker uploads HTML/SVG or a spoofed file type.

### Changes Made

- Hardened proof-file uploads to reduce active-content injection risks:
  - Added `backend/src/common/files/proof-file.util.ts` to detect common file signatures (JPG/PNG/WEBP/PDF) and resolve/validate upload MIME types.
  - `backend/src/modules/dispatch/route-runs.service.ts` now rejects proof uploads unless the declared MIME type is allowed and matches the detected signature (or the client sends `application/octet-stream` and the signature is recognized).
- Forced proof artifact downloads to be treated as downloads (defense-in-depth against rendering untrusted content):
  - Added `buildAttachmentContentDisposition()` and switched proof downloads to `Content-Disposition: attachment`.
  - Proof downloads now always use `Content-Type: application/octet-stream` regardless of stored metadata.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/files/proof-file.util.ts`
- `backend/src/common/files/proof-file.util.spec.ts`
- `backend/src/common/http/content-disposition.util.ts`
- `backend/src/common/http/content-disposition.util.spec.ts`
- `backend/src/modules/dispatch/route-runs.controller.ts`
- `backend/src/modules/dispatch/route-runs.service.ts`

### Checks And Commands Run

- `rg -l "sk_live|AKIA|-----BEGIN (RSA )?PRIVATE KEY|xox[baprs]-|ghp_" --hidden --glob '!node_modules/**' --glob '!.git/**'`
  - Passed: no matches.
- `npm run test --workspace=backend -- proof-file.util content-disposition.util`
  - Passed (8 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).
- `npm run check:backend-deps`
  - Passed.

### Remaining Risks

- Frontend still opens proof blobs in a new tab (`target="_blank"`). With the backend now forcing `application/octet-stream`, this should behave as a download, but removing the new-tab open would be stronger defense-in-depth.

### Recommended Next Actions

1. Remove `target="_blank"` from the proof download UX (prefer a direct download only).
2. Consider adding a per-org max proof count / rate limit to prevent storage abuse.

## Launch Readiness Pass: 2026-05-06

### Summary Of Risks Found

- The prior deploy shape was backend-only and not launch-grade for a paid SaaS product.
- Root Docker Compose pointed route optimization at OSRM while backend dispatch/planning expects the FastAPI routing-service `/optimize` API.
- Production dependency reproducibility was weak because `package-lock.json` was ignored.
- Drivers, vehicles, and customers needed a hard organization-scope pass across REST and GraphQL surfaces.
- Dispatch and route-run mutation endpoints still used inline `@Body()` object shapes instead of DTOs.
- Customer-configurable outbound webhooks needed DNS/private-IP blocking before public self-serve use.
- Local browser QA was screenshot-heavy and wrote to tracked-ish artifact paths instead of an isolated launch evidence folder.
- Hosted staging, WorkOS, Stripe, Redis, storage, metrics, and live routing-service smoke are still not certified.

### Changes Made

- Stopped ignoring `package-lock.json` and switched Render backend/frontend builds to `npm ci`.
- Added Render services for backend, frontend, and the FastAPI routing-service, including frontend security headers and SPA rewrite.
- Updated Compose to run the project routing-service on port `8000` instead of the OSRM placeholder.
- Added backend routing-service URL resolution for explicit env, legacy provider URL, and Render internal host/port wiring.
- Scoped drivers, vehicles, and customers by actor organization in controllers, resolvers, and services; driver vehicle assignment now verifies organization ownership.
- Migrated dispatch and route-run action bodies to DTO classes.
- Added webhook allowlist/DNS/private-IP validation and wired it into create/update/dispatch/replay flows.
- Added launch Playwright audit coverage for primary routes, desktop/mobile render evidence, visible-control accounting, core SaaS forms, and preview route optimization status.
- Replaced tracked `.artifacts` launch evidence with untracked `.tmp/launch-audit/*` outputs.
- Updated `docs/launch-readiness.md` with the current no-go launch verdict and evidence.

### Files Changed By This Pass

- `.gitignore`
- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/outbound-webhook-url.util.ts`
- `backend/src/common/routing/routing-service-url.util.ts`
- `backend/src/modules/customers/*`
- `backend/src/modules/dispatch/*`
- `backend/src/modules/drivers/*`
- `backend/src/modules/planning/planning.service.ts`
- `backend/src/modules/platform/platform.service.ts`
- `backend/src/modules/vehicles/*`
- `docker-compose.yml`
- `docs/config-matrix.md`
- `docs/launch-readiness.md`
- `e2e/launch-audit.spec.ts`
- `e2e/ui-audit.spec.ts`
- `frontend/src/services/customersApi.ts`
- `frontend/src/services/fleetApi.ts`
- `frontend/src/services/jobsApi.ts`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `render.yaml`
- `routing-service/Dockerfile`
- `scripts/mock-preview-api.mjs`
- `scripts/optimizer-smoke.mjs`
- `scripts/playwright-preview-server.mjs`

### Checks And Commands Run

- `PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH" npm ci`
  - Passed: 953 packages audited, 0 vulnerabilities.
- `PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH" npm run build --workspaces`
  - Passed.
- `PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH" npm run test --workspace=backend`
  - Passed: 34 test files, 121 tests.
- `PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH" npm run test --workspace=frontend -- --run`
  - Passed: 6 test files, 8 tests.
- `PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH" npm audit --workspaces --audit-level=moderate`
  - Passed: found 0 vulnerabilities.
- `PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH" npm audit --workspaces --omit=dev --audit-level=moderate`
  - Passed: found 0 vulnerabilities.
- `PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH" npm run check:backend-deps`
  - Passed.
- `PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH" PLAYWRIGHT_BASE_URL="http://127.0.0.1:5201" PLAYWRIGHT_FRONTEND_PORT="5201" PLAYWRIGHT_MOCK_API_PORT="3201" LAUNCH_AUDIT_API_URL="http://127.0.0.1:3201" LAUNCH_AUDIT_DIR=".tmp/launch-audit/playwright" PLAYWRIGHT_OUTPUT_DIR=".tmp/launch-audit/test-results" npm run launch:audit`
  - Passed: 4 tests in 5.7 minutes.
- `python3.11 -m pytest routing-service/tests`
  - Blocked before tests: `zsh:1: command not found: python3.11`.
- `docker --version`
  - Blocked: `zsh:1: command not found: docker`.

### Remaining Risks

- Hosted staging is not yet deployed or certified.
- Real WorkOS login/logout/session/revocation was not tested in hosted staging.
- Real routing-service Python 3.11 tests and live optimizer smoke remain blocked locally.
- Stripe test checkout/webhook, email/SMS sandbox, and storage test bucket flows are not certified.
- `/health`, `/health/runtime`, `/health/readiness`, `/api/metrics`, strict CORS rejection, and authenticated Socket.IO org scoping still need hosted staging probes.
- Billing/subscription and public API detail reads still deserve a final tenant-isolation probe against seeded cross-org data.
- Backup/restore, migration, rollback, provider-failure, and incident runbooks remain launch gates.

### Recommended Next Actions

1. Deploy hosted staging from the updated Render blueprint and populate all staging provider sandboxes.
2. Run routing-service tests in Python 3.11 or in the routing-service container.
3. Run the launch Playwright suite against hosted staging with real WorkOS and no preview env.
4. Run security probes for tenant isolation, metrics token enforcement, CORS rejection, webhook SSRF rejection, API key revoke, and Socket.IO org scoping.
5. Keep public launch blocked until the hosted staging evidence is green.

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

## Daily Pass: 2026-05-11

### Summary Of Risks Found

- Routing-service base URL configuration (`ROUTING_SERVICE_URL` / legacy `ROUTING_PROVIDER_URL` / `ROUTING_SERVICE_HOSTPORT`) was accepted without validation. Misconfiguration could allow non-http(s) schemes, embedded credentials, control characters, or query/hash fragments that leak into logs and make routing-service calls unpredictable.

### Changes Made

- Hardened routing-service URL resolution:
  - Validates that configured URLs are absolute `http(s)` URLs.
  - Rejects control characters and URLs with embedded credentials.
  - Strips `?query` and `#hash` fragments before persisting/using the base URL.
  - Enforces `ROUTING_SERVICE_SCHEME` to `http` or `https` when using `ROUTING_SERVICE_HOSTPORT`.
- Added focused unit tests covering the validation behavior.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/routing/routing-service-url.util.ts`
- `backend/src/common/routing/routing-service-url.util.spec.ts`

### Checks And Commands Run

- `cd backend && ../node_modules/.bin/nest build`
  - Passed.
- `cd backend && npx --no-install tsc -p tsconfig.json --noEmit`
  - Failed: backend `tsc` includes spec files missing runner globals/types (`describe`/`it`/`expect`) and some Jest-era `jest` references; needs a deliberate TS + test-runner config cleanup pass.
- `npm run test --workspace=backend -- routing-service-url.util`
  - Passed (7 tests).
- `npm run test --workspace=backend`
  - Failed: `listen EPERM: operation not permitted` (sandboxed environment disallows binding listening sockets; `supertest` integration specs cannot run here).
- `npm audit --workspaces --audit-level=moderate`
  - Failed: `getaddrinfo ENOTFOUND registry.npmjs.org` + cannot write logs to `/Users/logan/.npm/_logs`.
- `python3 -m pytest routing-service/tests`
  - Blocked: `No module named pytest`.

### Blockers

- This sandbox disallows opening listening sockets (`listen EPERM`), preventing `supertest`-based backend integration tests from running locally here.
- `npm audit` is blocked by DNS failures and local permissions writing npm logs.

### Remaining Risks

- Backend still logs full optimizer payloads at debug level (`[ROUTING:REQUEST] Payload: ...`) which includes location data; ensure debug logging is disabled in production and consider structured redaction if debug logs are ever enabled.

### Recommended Next Actions

1. If you need to run the `dispatch.integration.spec.ts` tests locally, use an environment that allows binding loopback ports (or refactor integration tests away from `supertest` socket binding).
2. Re-run `npm audit` in an environment with registry access and writable npm logs; apply smallest same-major upgrades.

## Daily Pass: 2026-05-14

### Summary Of Risks Found

- Privacy/logging risk: `JobsProcessor` debug logs were stringifying the full Bull job payload (`job.data`). Depending on what producers enqueue, this could include customer addresses, notes, contact info, or other sensitive metadata.
- Observability reliability: error logging assumed `error.message`/`error.stack` are present (non-`Error` throwables can produce confusing logs).

### Changes Made

- Replaced full Bull job-payload debug logging with a safe structured summary:
  - Added `summarizeBullJobDataForLog()` in `backend/src/common/logging/bull-job-log.util.ts`.
  - `backend/src/modules/jobs/jobs.processor.ts` now logs `Job data summary` (ids + key list) instead of `JSON.stringify(job.data)`.
  - Summary truncates large key sets to avoid log amplification.
- Hardened `JobsProcessor` error logging to handle non-`Error` throwables.
- Added focused unit tests:
  - `backend/src/common/logging/bull-job-log.util.spec.ts`.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/logging/bull-job-log.util.ts`
- `backend/src/common/logging/bull-job-log.util.spec.ts`
- `backend/src/modules/jobs/jobs.processor.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- bull-job-log.util`
  - Passed (2 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).
- `npm run check:backend-deps`
  - Passed.
- `npm audit --workspaces --audit-level=moderate`
  - Failed: `getaddrinfo ENOTFOUND registry.npmjs.org` + cannot write logs to `/Users/logan/.npm/_logs`.

### Blockers

- `npm audit` is blocked by DNS failures and local permissions writing npm logs.

### Remaining Risks

- Other debug-level logs may still include sensitive customer location or metadata; prefer structured summaries and keep production log levels at `log/warn/error` unless actively debugging an incident.

### Recommended Next Actions

1. Re-run `npm audit` in an environment with npm registry access and a writable npm log directory; apply smallest same-major upgrades.
2. Scan other `logger.debug(JSON.stringify(...))` patterns (especially queue processors and webhook flows) and replace with summaries/redaction.

## Daily Pass: 2026-05-13

### Summary Of Risks Found

- Privacy/logging risk: backend debug logs included the full routing optimizer request payload (`lat`/`lng` coordinates for every stop and vehicle) via `DispatchService.callOptimizerV2()`. Even when debug logging is normally disabled in production, it is a footgun that can leak sensitive location data when debug is enabled.

### Changes Made

- Replaced the full optimizer payload debug log with a structured, coordinate-free summary:
  - Added `summarizeOptimizeRequestForLog()` in `backend/src/common/routing/optimize-request-log.util.ts`.
  - `backend/src/modules/dispatch/dispatch.service.ts` now logs `Payload summary` (counts + id samples) instead of `JSON.stringify(request)`.
  - Summary truncates large id lists to avoid log amplification.
- Added focused unit tests:
  - `backend/src/common/routing/optimize-request-log.util.spec.ts`.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/routing/optimize-request-log.util.ts`
- `backend/src/common/routing/optimize-request-log.util.spec.ts`
- `backend/src/modules/dispatch/dispatch.service.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- optimize-request-log.util`
  - Passed (2 tests).
- `npm run build --workspace=backend`
  - Passed (`nest build`).
- `npm run check:backend-deps`
  - Passed.
- `npm audit --workspaces --audit-level=moderate`
  - Failed: `getaddrinfo ENOTFOUND registry.npmjs.org` + cannot write logs to `/Users/logan/.npm/_logs`.

### Blockers

- `npm audit` is blocked here (DNS failures + cannot write logs to `/Users/logan/.npm/_logs`).

### Remaining Risks

- Debug logs still include optimizer request/response *summaries*; confirm production log level is `log/warn/error` unless explicitly debugging an incident.

### Recommended Next Actions

1. Re-run `npm audit` in an environment with npm registry access and a writable npm log directory; apply smallest same-major upgrades.
2. Review other debug-level logs that may include customer location data (and prefer structured summaries/redaction).

## Daily Pass: 2026-05-12

### Summary Of Risks Found

- Stripe webhook signature verification errors were returned verbatim to callers (`Webhook Error: ...`). This is mostly an information-leak footgun and makes the webhook surface noisier than necessary (even though the endpoint is only useful to Stripe).
- Reliability/observability: webhook error logging assumed `err.message` in multiple places, which can produce confusing logs when non-`Error` values are thrown.
- Report staleness note: the prior “WebSocket unauthenticated handshake” risk appears outdated — both `/dispatch` and `/tracking` gateways now authenticate during `handleConnection()` and join per-organization rooms.

### Changes Made

- Made Stripe webhook signature failures return a generic `400` response while preserving the detailed reason in server logs:
  - `backend/src/modules/subscriptions/subscriptions.controller.ts` now throws `BadRequestException('Webhook signature verification failed')` instead of echoing the underlying Stripe error message.
  - Error logging now safely handles non-`Error` throwables and includes stack traces when available.
- Added a focused unit test to ensure signature-verification failure details do not leak in HTTP responses.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/modules/subscriptions/subscriptions.controller.ts`
- `backend/src/modules/subscriptions/subscriptions.controller.spec.ts`

### Checks And Commands Run

- `npm run test --workspace=backend -- subscriptions.controller`
  - Passed (1 test).
- `npm run build --workspace=backend`
  - Passed (`nest build`).
- `npm run check:backend-deps`
  - Passed.
- `npm audit --workspaces --audit-level=moderate`
  - Failed: `getaddrinfo ENOTFOUND registry.npmjs.org` + cannot write logs to `/Users/logan/.npm/_logs`.

### Blockers

- `npm audit` is blocked by DNS failures and local permissions writing npm logs.

### Remaining Risks

- Public tracking endpoint (`GET /api/route-runs/public/tracking/:token`) is intentionally unauthenticated; ensure tokens are high-entropy, optionally time-limited, and that the response is scoped to the minimal data needed for the tracking UI.
- Socket.IO token-in-query-string support (`handshake.query.token`) remains a potential accidental secret-exposure vector (URLs are routinely logged); consider restricting it to `development`/`test` once clients are verified.

### Recommended Next Actions

1. Re-run `npm audit` in an environment with npm registry access and a writable npm log directory; apply smallest same-major upgrades.
2. Confirm public tracking link token properties (entropy + TTL) and add an explicit “expiresAt” check if the product requires link revocation.
3. Decide whether to disallow socket auth tokens via query-string outside local development.

## Daily Pass: 2026-05-10

### Summary Of Risks Found

- Response header injection risk: proof artifact downloads set `Content-Disposition` using a stored filename value. If an attacker-controlled upload filename contains control characters (e.g. CR/LF), this can enable response splitting / header injection in some environments.
- Content sniffing risk: proof downloads did not explicitly set `X-Content-Type-Options: nosniff`, increasing the odds of unexpected browser content interpretation if a content type is misclassified upstream.

### Changes Made

- Hardened proof artifact download headers:
  - Added `sanitizeContentDispositionFilename()` + `buildInlineContentDisposition()` helper in `backend/src/common/http/content-disposition.util.ts`.
  - `backend/src/modules/dispatch/route-runs.controller.ts` now uses the helper when setting `Content-Disposition` for proof downloads.
  - Proof downloads now set `X-Content-Type-Options: nosniff`.
- Added focused unit tests for the filename/header builder (not executable locally due to the Vitest native binding issue):
  - `backend/src/common/http/content-disposition.util.spec.ts`.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/http/content-disposition.util.ts`
- `backend/src/common/http/content-disposition.util.spec.ts`
- `backend/src/modules/dispatch/route-runs.controller.ts`

### Checks And Commands Run

- `cd backend && ../node_modules/.bin/nest build`
  - Passed.
- `cd backend && ../node_modules/.bin/vitest run --config vitest.config.ts src/common/http/content-disposition.util.spec.ts`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch / `ERR_DLOPEN_FAILED`).
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' audit --workspaces --audit-level=moderate`
  - Failed: DNS failure to `registry.npmjs.org` (`getaddrinfo ENOTFOUND`) and could not write logs to `/Users/logan/.npm/_logs`.

### Blockers

- Vitest remains blocked on this Mac by Rolldown native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so the added unit test could not be executed locally.
- `npm audit` is blocked by DNS failures to `registry.npmjs.org` and permissions errors writing logs to `/Users/logan/.npm/_logs`, so workspace vulnerabilities could not be re-evaluated in this pass.

### Remaining Risks

- Proof downloads are served with `Content-Disposition: inline`. If untrusted HTML is ever uploaded/served from the same origin, this can enable script execution in the browser. Consider forcing `attachment` or enforcing a strict allowlist of safe content types for inline display (migration-sized; coordinate with frontend UX).
- WebSocket auth + scoping: `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations.

### Recommended Next Actions

1. Repair the Rolldown native binding/code-signing mismatch so Vitest can run again (then re-run the added unit tests).
2. Decide whether proof artifacts should be inline-viewable or forced-download before shipping.
3. Add authenticated Socket.IO handshake + organization scoping for gateway broadcasts.

## Daily Pass: 2026-05-09

### Summary Of Risks Found

- Local proof artifact storage path traversal risk: `ProofStorageService.localPathForKey()` used a string prefix check (`startsWith(root)`), which can be bypassed by paths like `/proof2/...` when `root` is `/proof`. If an attacker can influence stored proof URIs/keys (or if the DB is compromised), this could allow reading/writing files outside the intended proof storage directory.

### Changes Made

- Hardened local proof storage path validation:
  - `backend/src/modules/dispatch/services/proof-storage.service.ts` now uses `path.relative(root, filePath)` to ensure resolved paths stay within the configured local storage root.
- Added focused unit tests:
  - `backend/src/modules/dispatch/services/proof-storage.service.spec.ts` asserts that `../` escapes are rejected and in-root keys are accepted.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/modules/dispatch/services/proof-storage.service.ts`
- `backend/src/modules/dispatch/services/proof-storage.service.spec.ts`

### Checks And Commands Run

- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run build --workspace=backend`
  - Passed (`nest build`).
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run test --workspace=backend -- proof-storage.service`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch / `ERR_DLOPEN_FAILED`).

### Blockers

- Vitest remains blocked on this Mac by Rolldown native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so the added unit test could not be executed locally.

### Remaining Risks

- Proof downloads are served with `Content-Disposition: inline`. If untrusted HTML is ever uploaded/served from the same origin, this can enable script execution in the browser. Consider forcing `attachment` or enforcing a strict allowlist of safe content types for inline display (migration-sized; coordinate with frontend UX).

### Recommended Next Actions

1. Repair the Rolldown native binding/code-signing mismatch so Vitest can run again (then re-run the added proof-storage tests).
2. Decide whether proof artifacts should be inline-viewable or forced-download before shipping.

## Daily Pass: 2026-05-08

### Summary Of Risks Found

- Tenant-boundary hardening: `getPublicTracking()` and `getDriverManifest()` resolved vehicles by `id` only. If data integrity is ever compromised (or a bug writes a cross-org `vehicleId`), the tracking surface could leak vehicle details across organizations.

### Changes Made

- Scoped vehicle lookup to the route’s organization when possible:
  - `backend/src/modules/dispatch/route-runs.service.ts` now resolves vehicles with `{ id, organizationId }` first.
  - Backwards-compatible fallback: if the vehicle record has no `organizationId` set, the service will still return it for the route. If the vehicle has a conflicting `organizationId`, it is treated as unavailable (returns `null`).
- Added a focused regression test:
  - `backend/src/modules/dispatch/route-runs.service.spec.ts` now asserts that public tracking does not expose vehicles with a mismatched `organizationId`.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/modules/dispatch/route-runs.service.ts`
- `backend/src/modules/dispatch/route-runs.service.spec.ts`

### Checks And Commands Run

- `cd backend && ../node_modules/.bin/nest build`
  - Passed.
- `cd backend && ../node_modules/.bin/vitest run src/modules/dispatch/route-runs.service.spec.ts`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch / `ERR_DLOPEN_FAILED`).

### Blockers

- Vitest remains blocked on this Mac by Rolldown native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so the added unit test could not be executed locally.

### Remaining Risks

- Webhooks still represent a possible SSRF surface via DNS resolution (hostnames that resolve to private IPs), redirects, and internal domains; consider an explicit allowlist + DNS/IP enforcement at request time.
- WebSocket auth + scoping: `/dispatch` and `/tracking` gateways still accept unauthenticated handshakes and broadcast unscoped events/locations.

### Recommended Next Actions

1. Repair the Rolldown native binding/code-signing mismatch so Vitest can run again (then re-run the added test).
2. Add authenticated Socket.IO handshake + organization scoping for gateway broadcasts.

## Daily Pass: 2026-05-07

### Summary Of Risks Found

- JWT verification failure handling gaps: Socket.IO auth verification and public tracking token verification did not normalize invalid/expired tokens into 401/400 responses, risking inconsistent 500s and noisy error telemetry.
- Input normalization gap for route-run messages: `RouteRunMessageDto` validated length but did not trim or reject whitespace-only bodies, creating mismatched behavior between request validation and service-side trimming.

### Changes Made

- Normalized Socket.IO JWT verification failures into `UnauthorizedException`:
  - `backend/src/common/websocket/socket-auth.util.ts` now catches `verifyAsync()` failures and throws `Invalid socket authentication token`.
  - Updated tests in `backend/src/common/websocket/socket-auth.util.spec.ts`.
- Normalized public tracking token verification failures into `BadRequestException`:
  - `backend/src/modules/dispatch/route-runs.service.ts` now catches `verifyAsync()` failures in `getPublicTracking()` and returns `Invalid tracking token`.
  - Added a regression test in `backend/src/modules/dispatch/route-runs.service.spec.ts`.
- Tightened route-run message DTO normalization:
  - `backend/src/modules/dispatch/dto/route-run-actions.dto.ts` trims `body` and rejects whitespace-only messages.
  - Added focused tests in `backend/src/modules/dispatch/dto/route-run-actions.dto.spec.ts`.

### Files Changed By This Pass

- `SECURITY_HARDENING_REPORT.md`
- `backend/src/common/websocket/socket-auth.util.ts`
- `backend/src/common/websocket/socket-auth.util.spec.ts`
- `backend/src/modules/dispatch/dto/route-run-actions.dto.ts`
- `backend/src/modules/dispatch/dto/route-run-actions.dto.spec.ts`
- `backend/src/modules/dispatch/route-runs.service.ts`
- `backend/src/modules/dispatch/route-runs.service.spec.ts`

### Checks And Commands Run

- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run build --workspace=backend`
  - Passed (`nest build`).
- `'/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin/node' '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' run test --workspace=backend -- socket-auth.util route-run-actions.dto route-runs.service`
  - Failed at Vitest startup due native binding/code-signing failure in `@rolldown/binding-darwin-arm64` (Team ID mismatch / `ERR_DLOPEN_FAILED`).
- `/Applications/Codex.app/Contents/Resources/node '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/lib/node_modules/npm/bin/npm-cli.js' audit --workspaces --omit=dev --audit-level=high`
  - Blocked: DNS failure to `registry.npmjs.org` (`getaddrinfo ENOTFOUND`) + npm could not write logs to `/Users/logan/.npm/_logs`.

### Blockers

- Vitest remains blocked on this Mac by Rolldown native binding/code-signing failures (`@rolldown/binding-darwin-arm64`), so the added unit tests could not be executed locally.
- `npm audit` is blocked by DNS resolution failure to `registry.npmjs.org` in this environment, and npm cannot write log files to `/Users/logan/.npm/_logs`.

### Remaining Risks

- Webhooks still represent a possible SSRF surface via DNS resolution (hostnames that resolve to private IPs) and internal domains; consider an explicit allowlist + DNS/IP enforcement at request time.
- Continue verifying organization scoping boundaries for new route-run messaging surfaces (messages are tenant-scoped by `organizationId`, but a full end-to-end review should confirm no cross-org read/write paths exist).

### Recommended Next Actions

1. Repair the Rolldown native binding/code-signing mismatch so Vitest can run again (then re-run the added tests).
2. Restore network/DNS to `registry.npmjs.org` (or run audits from a networked environment) so dependency vulnerability checks can be refreshed.

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
