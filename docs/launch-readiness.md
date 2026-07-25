# Assisted-Pilot Launch Readiness

Date: 2026-07-24

Scope: publicly marketed, manually approved paid pilots

Current verdict: **NO-GO until the local, hosted, operations, security, and legal evidence below is green**

Trovan is not being prepared for self-serve general availability. Launch is $399/month, Scale is $899/month, Enterprise is custom, all onboarding is reviewed, Stripe billing is operator-managed, cancellation is effective at period end, SMS and trials are disabled, and no uptime SLA is offered.

## Implemented release controls

- One shared plan catalog preserves database keys while exposing Launch, Scale, and Enterprise consistently.
- Public subscription creation is rejected unless `SELF_SERVE_BILLING_ENABLED=true`; the pilot configuration fixes it to false.
- Lead request types are shared between frontend and backend, the primary action posts to `VITE_REST_API_URL`, and email is an error fallback.
- Driver preview sessions clear auth/data/route state and seed an explicit dispatcher or driver identity.
- Desktop routing exposes the selected-route inspector, and whole-route order protection is one tenant-checked backend update with an audit event instead of a partial per-stop request loop.
- Authentication configuration uses a bounded request and a visible retry/error state.
- Pilot readiness live-probes database, Redis/worker, routing, WorkOS, Postmark, and R2 with bounded timeouts; any unavailable critical dependency returns HTTP 503.
- Render migrations run before deployment, not during application startup.
- Telemetry migrations normalize legacy camelCase fuel/engine columns to the runtime schema so the Prometheus fuel-efficiency refresh succeeds on both upgraded and empty databases.
- CI runs build, lint, backend/frontend/routing tests, empty-database migrations, dependency audit, and Playwright.
- OpenAPI docs advertise only validated, environment-configured API origins; no placeholder production server is published when hosted configuration is absent.
- Job creation reports whether background queueing actually occurred, so queue-disabled local workflows cannot emit a false “added to queue” success message.
- Promotion uses an immutable SHA, protected staging/production environments, Cloudflare frontend deployment, Render service deployment, and captured rollback versions.
- A successful promotion records an explicit GitHub deployment for the exact release SHA; production refuses any SHA without a successful staging deployment record.
- The scheduled production monitor verifies readiness plus a revocable authenticated session and protected metrics access.
- Publishing a route plan now creates the canonical published route-version snapshot before dispatch handoff, preserving the audit and rollback chain.
- Customer notifications reserve a durable idempotency key before delivery, retry only confirmed transient provider responses within a three-attempt bound, and surface ambiguous outcomes for operator review.
- Sitemap, robots, canonical, Open Graph, and Twitter metadata ship from the same frontend build; the sitemap has an explicit XML content type.
- SMS is globally disabled unless explicitly enabled after the pilot.
- React Router 6 remains for this pilot. Controlled navigation and the moderate advisory are accepted only for authenticated, application-controlled destinations; migrate to Router 7 before self-serve GA.

## Required evidence

### Local

- [x] Reproducible `npm ci` and workspace production build.
- [x] Frontend lint with zero warnings.
- [x] Backend: 289 tests; frontend: 58 tests; routing service: 13 tests.
- [x] Driver workflow: three consecutive isolated runs, two tests per run.
- [x] Complete Chromium Playwright suite: 151 passed, one hosted-only persistence test skipped, zero failures.
- [x] Full and production dependency audits: zero critical/high findings. Two accepted React Router 6 moderate advisories remain documented for the pilot.
- [x] Full-history Gitleaks scan: zero unadjudicated findings. Exact fake
  test/example fixtures are narrowly allowlisted by both path and match.
- [ ] CodeQL `security-extended` analysis for JavaScript/TypeScript and Python
  is required on every release pull request; the latest results must have zero
  open critical/high alerts before promotion.
- [x] Database migrations applied successfully.
- [x] Release scope contains only application code, migrations, configuration, production assets, tests, and runbooks; generated QA/audit artifacts are excluded.

### Hosted staging

- backend health/runtime/readiness, optimizer, queue, and protected metrics
- WorkOS login/logout/expiry/revocation
- two-organization tenant denial and fresh-session persistence
- lead persistence, transaction-serialized deduplication, throttle, operator readback, Postmark delivery, and status update
- proof upload/download and R2 persistence
- API-key lifecycle, webhook signature/replay/SSRF, Socket.IO authorization, and public tracking
- assisted Stripe invoice/subscription, failed payment, period-end cancellation, and refund procedure without self-serve

### Operations and approval

- isolated Postgres restore, R2 recovery, rollback/incident exercise, and alert acknowledgement
- repository security review with every critical/high closed; see
  `docs/repository-security-review.md`
- measured retention/deletion/export configuration
- approved data inventory, subprocessors, privacy, legal, support, and signed-order-form wording
- named launch owner approval

Production promotion must use the exact staging SHA. Verify live readiness, WorkOS, lead/Postmark, XML sitemap, bundle hash, and absence of preview flags; then close the synthetic lead and remove test customer data before paid onboarding.

## Remaining improvement backlog

These items do not change the assisted-pilot commercial boundary, but they should be completed before self-serve GA:

- Move from React Router 6 to Router 7 and remove the two accepted moderate advisories.
- Replace the remaining local-only route exception decisions, route-version display, draft save, and autosave status with durable backend transactions before exposing those controls in production.
- Replace the stale external Vercel repository checks with Cloudflare/Render checks so a retired frontend provider cannot leave unrelated red statuses on release PRs.
- Add production analytics funnels only after consent, retention, and event ownership are approved.
- Move DMARC from monitoring to quarantine after at least two weeks of clean delivery reports.
- Publish deletion, export, and backup-retention timing only after the hosted restore drill provides measured values.
