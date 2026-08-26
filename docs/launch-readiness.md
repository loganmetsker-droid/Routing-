# Assisted-Pilot Launch Readiness

Date: 2026-08-26

Scope: publicly marketed, manually approved paid pilots

Current verdict: **NO-GO until the local, hosted, operations, security, and legal evidence below is green**

Trovan is not being prepared for self-serve general availability. Launch is $399/month, Scale is $899/month, Enterprise is custom, all onboarding is reviewed, Stripe billing is operator-managed, cancellation is effective at period end, SMS and trials are disabled, and no uptime SLA is offered.

## Implemented release controls

- One shared plan catalog preserves database keys while exposing Launch, Scale, and Enterprise consistently.
- Public subscription creation is rejected unless `SELF_SERVE_BILLING_ENABLED=true`; the pilot configuration fixes it to false.
- Lead request types are shared between frontend and backend, the primary action posts to `VITE_REST_API_URL`, and email is an error fallback.
- Driver preview sessions clear auth/data/route state and seed an explicit dispatcher or driver identity.
- Authentication configuration uses a bounded request and a visible retry/error state.
- Pilot readiness treats database, Redis/worker, routing, WorkOS, Postmark, and R2 as critical; degraded readiness returns HTTP 503.
- Render migrations run before deployment, not during application startup.
- CI runs build, lint, backend/frontend/routing tests, empty-database migrations, dependency audit, and Playwright.
- Promotion uses an immutable SHA, protected staging/production environments, Cloudflare frontend deployment, Render service deployment, and captured rollback versions.
- Sitemap, robots, canonical, Open Graph, and Twitter metadata ship from the same frontend build; the sitemap has an explicit XML content type.
- The production build generates and verifies 23 route-specific HTML metadata shells, including a no-index login shell.
- The public site includes an accessibility statement and a standards-based `/.well-known/security.txt`; release and production-monitor workflows verify both deployed content and content type.
- Product screenshots and the captioned tour are captured from a clean immutable source commit and byte-verified against a committed manifest.
- SMS is globally disabled unless explicitly enabled after the pilot.
- The vulnerable React Router dependency has been removed. A small project-owned browser router now covers Trovan's fixed route table, navigation, parameters, and search parameters without the affected package.
- Hosted optimization requires a contracted OSRM-compatible road-network matrix, emits solver/provider provenance, and refuses to publish estimated-fallback routes.
- Hosted address lookup requires Mapbox; public Nominatim and public OSRM demo endpoints are explicitly local-only.
- Operator and driver status is derived from backend readiness instead of hard-coded operational copy.
- Assisted onboarding is backend-derived and shows the next blocked action for depot, fleet, jobs, optimization, dispatch, and proof.
- Trovan Academy provides role-filtered, versioned training with persisted progress, one knowledge check per track, and a mobile Driver Quick Start.
- Launch readiness now joins operational evidence, Champion/driver completion, and customer signoff in one tenant-scoped backend response.
- The versioned Customer Launch Docket ships as real PDF, ZIP, and CSV downloads; captioned Academy clips and written articles remain the canonical in-product guidance.
- Access codes use AES-256-GCM field encryption at rest and are revealed only in the authenticated driver manifest.
- Backend and authenticated frontend failures are delivered to a configurable redacted monitoring webhook with release metadata.

## Required evidence

### Local

- [x] Reproducible `npm ci` and workspace production build.
- [x] Frontend lint with zero warnings.
- [x] Backend: 281 tests; frontend: 99 tests; routing service: 20 tests.
- [x] Driver workflow: three consecutive isolated runs, two tests per run.
- [x] Complete installed-Chrome Playwright suite: 134 passed, two hosted-only tests skipped, zero failures (2026-08-26).
- [x] Full installed dependency audit and production-only audit both report zero vulnerabilities on 2026-08-26.
- [x] Database migrations applied successfully.
- [x] A recoverable local safety snapshot and a clean isolated candidate were produced; `release:check-scope -- origin/main` passed with generated QA/audit artifacts excluded.

### Hosted staging

- backend health/runtime/readiness, optimizer, queue, and protected metrics
- production geocoder plus road-network time/distance matrix provenance and representative route benchmarks; public Nominatim/OSRM demo services and straight-line estimates are not accepted as production routing inputs
- WorkOS login/logout/expiry/revocation
- two-organization tenant denial and fresh-session persistence
- lead persistence, deduplication, throttle, operator readback, Postmark delivery, and status update
- proof upload/download and R2 persistence
- API-key lifecycle, webhook signature/replay/SSRF, Socket.IO authorization, and public tracking
- assisted Stripe invoice/subscription, failed payment, period-end cancellation, and refund procedure without self-serve

### Operations and approval

- isolated Postgres restore, R2 recovery, rollback/incident exercise, and alert acknowledgement
- repository security review with every critical/high closed
- measured retention/deletion/export configuration
- approved data inventory, subprocessors, privacy, legal, support, and signed-order-form wording
- named launch owner approval

Production promotion must use the exact staging SHA. Verify live readiness, WorkOS, lead/Postmark, XML sitemap, bundle hash, and absence of preview flags; then close the synthetic lead and remove test customer data before paid onboarding.

## Remaining improvement backlog

These items do not change the assisted-pilot commercial boundary, but they should be completed before self-serve GA:

- Reassess whether the project-owned fixed-route router remains sufficient before adding dynamic routing requirements; any replacement must pass a fresh dependency audit.
- Keep local-only route exception decisions, route-version display, draft save, autosave status, and route-order locking hidden until backed by durable transactions.
- Split the large public-site and routing-workspace bundles further to improve first-load and route-change performance.
- Approve retention and reporting ownership for the first-party pilot funnel before using it for customer-facing claims or longer-term product analytics.
- Move DMARC from monitoring to quarantine after at least two weeks of clean delivery reports.
- Publish deletion, export, and backup-retention timing only after the hosted restore drill provides measured values.
