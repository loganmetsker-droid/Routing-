# Trovan UI/UX and Backend Improvement Report

Last updated: 2026-07-24

This is the living review record for the assisted-pilot release candidate. A check is only marked complete when the rendered workflow and its underlying contract have direct evidence.

## Current verdict

The clean release candidate is materially ahead of the live website. The refreshed responsive audits report zero route findings, zero horizontal-overflow findings, zero safe-control failures, and zero API-probe failures. The clean install, reproducible build, frontend lint, 265 backend tests, 52 frontend tests, 13 routing-service tests, three consecutive isolated driver runs, and the uninterrupted Chromium suite (79 passed, one hosted-only persistence test skipped) pass. It is not yet proven ready for paid pilots because the provider-backed staging, recovery, and legal gates remain open.

## Evidence reviewed

- All 21 public routes at desktop, tablet, and mobile sizes.
- Fourteen product routes at desktop and mobile sizes.
- Safe control probes on Dashboard, Dispatch, Routing, Jobs, and Settings.
- Backend coverage across 63 files and 265 passing tests.
- Live `https://trytrovan.com`, `robots.txt`, and `sitemap.xml`.
- Current Cloudflare, Render, Playwright, and launch-gate configuration.

## Findings and improvements

| Area | Current evidence | Improvement | Acceptance criteria |
|---|---|---|---|
| Production website | The live homepage is an older bundle. `/sitemap.xml` and `/robots.txt` return the SPA HTML with `text/html`. | Promote the exact verified release through Cloudflare after staging and make static files win before SPA fallback. | The live HTML reports the promoted SHA; sitemap returns XML with `<urlset>` and an XML content type; robots returns plain text; both differ from `index.html`. |
| Homepage hierarchy | Fixed. The prior mobile route measured 16.4 screenfuls and repeated buyer and product-tour material. | The home page now keeps the hero, outcome proof, product loop, concise security, assisted-pilot pricing, and final CTA. The full recording and ROI calculator live on `/demo` and `/pricing`. | PASS: 12.0 screenfuls at 390×844, one H1, no horizontal overflow, and zero marketing-audit findings. |
| Mobile operations | Fixed across Jobs, Customers, Drivers, Vehicles, and Proof of Delivery. Each previously depended on a clipped or wide desktop table. | Small screens now use purpose-built cards with the workflow's identity, state, key operating details, selection, and edit/detail actions. Desktop tables remain intact. Routing's map-mode toggle becomes an accessible select on mobile. | PASS: all five routes mount one mobile list and zero tables at 390px; all are exactly viewport width; the product audit reports no clipped controls. |
| Product audit | Fixed. The old script could report zero findings while every direct API probe failed. | API base is explicit, failed probes fail the command, screenshots are captured for every route/viewport, and clipped controls plus wide internal tables are reported. | PASS: 28 route/viewport checks, five safe button-probe routes, and all configured API checks report zero failures. |
| Settings and notification truth | Fixed. Mobile Settings previously put eight summary cards ahead of the selected section, exposed an SMS switch even though SMS is out of pilot scope, and the shell showed a generic all-clear state. | Mobile now starts with a compact section selector, hides overview cards after another section is selected, keeps exactly one H1, disables SMS with honest pilot copy, and shows real failed-delivery state in the shell. | PASS: mobile and desktop breakpoint assertions, one-H1 checks on all 28 product route/viewport combinations, notification failure badge/copy, and SMS-disabled Playwright coverage. |
| Dispatch tenant isolation | Fixed. Scheduled auto-dispatch previously selected jobs and vehicles globally, manual dispatch could run without a tenant, and optimization lifecycle records were returned across organizations. | Jobs are grouped by organization, vehicles are queried per organization, tenantless jobs fail closed, manual dispatch requires organization context, route reads/creation require organization context, and optimizer lifecycle records are filtered by organization. | PASS: multi-organization worker tests, manual fail-closed coverage, scoped lifecycle tests, and the full backend suite. |
| Notification and health-data safety | Fixed. Customer lookups were not consistently tenant-scoped, Postmark delivery had no bound, and public readiness/runtime responses could include delivery records plus internal database/failure details. | Customer and delivery reads are organization-scoped, Postmark delivery has an eight-second timeout with persisted failure state, and public health responses expose only sanitized dependency summaries. | PASS: tenant-lookup, delivery success/failure/timeout, readiness redaction, and provider-probe tests. |
| Preview-test isolation | Fixed. The Playwright preview server and production builds shared `frontend/dist`, so a production build could silently replace the authenticated preview bundle during a test run. | Preview builds now use a dedicated ignored output directory under `.tmp/playwright`. | The preview remains authenticated and driver workflows stay green even when a production build is created separately. |
| Backend confidence | Improved to 265 passing tests. New coverage directly exercises tenant-scoped dispatch, optimization lifecycle isolation, notification scoping/timeouts, SMS-off settings, sanitized health output, organization membership boundaries, API-key lifecycle, webhook replay scoping, private webhook targets, and unsubscribed events. | Add durable notification retry/idempotency only after the staging queue/provider behavior is measured. | PASS for local critical authorization and platform-control cases; hosted provider and worker behavior remains a staging gate. |
| Hosted operations | Provider credentials and disposable staging identities are absent locally. | Complete the existing staging, restore, R2 recovery, rollback, alert, WorkOS, Postmark, and assisted Stripe procedures. | Every hosted and operations gate has dated evidence tied to the exact promoted SHA. |

## Design direction

The public site should remain dark navy and copper at the top, then move into restrained light operational surfaces. Product views must be large enough to inspect; decorative motion must never compete with route data. Mobile product workflows should use stacked summary cards and drawers, while desktop retains dense tables and map-first workspaces.

The implementation wireframe is in [`mockups/assisted-pilot-ui-optimization.svg`](../mockups/assisted-pilot-ui-optimization.svg).

## Deferred by launch scope

- React Router 7 migration remains required before self-serve GA.
- Formal analytics funnels remain a follow-up after consent and event definitions are approved.
- SMS remains disabled.
- No uptime SLA is offered for the assisted pilot.
