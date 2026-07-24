# Trovan UI/UX and Backend Improvement Report

Last updated: 2026-07-24

This is the living review record for the assisted-pilot release candidate. A check is only marked complete when the rendered workflow and its underlying contract have direct evidence.

## Current verdict

The clean release candidate is materially ahead of the live website. The refreshed responsive audits report zero route findings, zero heading-outline findings, zero horizontal-overflow findings, zero safe-control failures, and zero API-probe failures. A maintained axe gate reports zero serious or critical WCAG A/AA violations across 68 route/viewport combinations. The clean install, reproducible build, frontend lint, 265 backend tests, 53 frontend tests, 13 routing-service tests, three consecutive isolated driver runs, and the uninterrupted Chromium suite (147 passed, one hosted-only persistence test skipped) pass. It is not yet proven ready for paid pilots because the provider-backed staging, recovery, and legal gates remain open.

## Evidence reviewed

- All 21 public routes at desktop, tablet, and mobile sizes.
- Twenty-four product, alias, driver, route-run, and public-tracking routes at desktop and mobile sizes.
- Sixty-eight axe-powered WCAG A/AA checks covering every public and product route on desktop plus every distinct mobile layout family.
- Safe control probes on Dashboard, Dispatch, Routing, Jobs, and Settings.
- Manual in-app browser inspection of alias navigation, route-run hierarchy, driver workspace, and driver stop execution.
- Backend coverage across 63 files and 265 passing tests.
- Live `https://trytrovan.com`, `robots.txt`, and `sitemap.xml`.
- Current Cloudflare, Render, Playwright, and launch-gate configuration.

## Findings and improvements

| Area | Current evidence | Improvement | Acceptance criteria |
|---|---|---|---|
| Production website | The live homepage is an older bundle. `/sitemap.xml` and `/robots.txt` return the SPA HTML with `text/html`. | Promote the exact verified release through Cloudflare after staging and make static files win before SPA fallback. | The live HTML reports the promoted SHA; sitemap returns XML with `<urlset>` and an XML content type; robots returns plain text; both differ from `index.html`. |
| Homepage hierarchy | Fixed. The prior mobile route measured 16.4 screenfuls and repeated buyer and product-tour material. | The home page now keeps the hero, outcome proof, product loop, concise security, assisted-pilot pricing, and final CTA. The full recording and ROI calculator live on `/demo` and `/pricing`. | PASS: 12.0 screenfuls at 390×844, one H1, no horizontal overflow, and zero marketing-audit findings. |
| Mobile operations | Fixed across Jobs, Customers, Drivers, Vehicles, and Proof of Delivery. Each previously depended on a clipped or wide desktop table. | Small screens now use purpose-built cards with the workflow's identity, state, key operating details, selection, and edit/detail actions. Desktop tables remain intact. Routing's map-mode toggle becomes an accessible select on mobile. | PASS: all five routes mount one mobile list and zero tables at 390px; all are exactly viewport width; the product audit reports no clipped controls. |
| Accessibility gate | Fixed. The earlier browser audits checked headings, names, clipping, and interaction but did not run a maintained accessibility engine. The first axe pass found low-contrast operational text, unnamed progress bars and checkboxes, invalid list/ARIA usage, nested controls, and an unfocusable horizontal metrics scroller. | Added `@axe-core/playwright` and a first-class `audit:accessibility` command. Shared semantic colors now meet light-surface contrast, progress and selection controls have names, route/job/customer/driver cards use explicit sibling controls, lists preserve list-item semantics, and scrollable summaries are keyboard focusable. | PASS: 68/68 desktop/mobile WCAG A/AA checks have zero serious or critical violations; the full 148-test Playwright inventory has zero failures. |
| Semantic hierarchy | Fixed. MUI subtitle and body variants previously emitted incidental H6 elements, creating skipped heading levels and numeric headings across public, operator, driver, and tracking screens. | Non-heading typography now renders as paragraphs by default, while every real section sets an explicit H1–H4 level. Both browser auditors fail on a missing/multiple H1, level jump, empty heading, or numeric-only heading. | PASS: 21 public routes and 48 product route/viewport checks report zero heading-outline findings; manual checks confirm Route Execution H1 → Route Run H2 → panel H3 → stop H4. |
| Alias navigation | Fixed. Legacy `/messages`, `/routes`, `/loads`, `/assets`, `/depots`, `/billing`, and `/integrations` URLs could render the correct module while the shell title and selected navigation fell back to Dashboard. | Every supported alias now resolves to one canonical shell module and route-run detail resolves to Dispatch. Unit coverage locks each mapping. | PASS: aliases show the correct H1 and active shell module in both desktop and mobile audits; the frontend navigation suite passes 53 tests. |
| Mutation recovery | Fixed for customer, driver, vehicle, and job creation/edit flows. Failed writes could previously leave a modal open without an actionable explanation. | Modal-scoped alerts retain entered data, submit buttons expose progress and prevent duplicate submission, and success/failure states are explicit. | Playwright proves successful create flows; failure rendering is present on every core CRUD modal and the public lead form preserves input with an email fallback. |
| Product audit | Fixed. The old script could report zero findings while every direct API probe failed and did not include aliases or execution detail. | API content type and base are explicit, failed probes fail the command, screenshots are captured for every route/viewport, and heading, clipped-control, wide-table, breakpoint, console, and stale-copy findings are reported. | PASS: 48 route/viewport checks, five safe button-probe routes, and all configured API checks report zero failures. |
| Settings and notification truth | Fixed. Mobile Settings previously put eight summary cards ahead of the selected section, exposed an SMS switch even though SMS is out of pilot scope, and the shell showed a generic all-clear state. | Mobile now starts with a compact section selector, hides overview cards after another section is selected, keeps exactly one H1, disables SMS with honest pilot copy, and shows real failed-delivery state in the shell. | PASS: mobile and desktop breakpoint assertions on Settings plus its Billing and Integrations aliases, one-H1 checks on all 48 product route/viewport combinations, notification failure badge/copy, and SMS-disabled Playwright coverage. |
| Dispatch tenant isolation | Fixed. Scheduled auto-dispatch previously selected jobs and vehicles globally, manual dispatch could run without a tenant, and optimization lifecycle records were returned across organizations. | Jobs are grouped by organization, vehicles are queried per organization, tenantless jobs fail closed, manual dispatch requires organization context, route reads/creation require organization context, and optimizer lifecycle records are filtered by organization. | PASS: multi-organization worker tests, manual fail-closed coverage, scoped lifecycle tests, and the full backend suite. |
| Notification and health-data safety | Fixed. Customer lookups were not consistently tenant-scoped, Postmark delivery had no bound, and public readiness/runtime responses could include delivery records plus internal database/failure details. | Customer and delivery reads are organization-scoped, Postmark delivery has an eight-second timeout with persisted failure state, and public health responses expose only sanitized dependency summaries. | PASS: tenant-lookup, delivery success/failure/timeout, readiness redaction, and provider-probe tests. |
| Preview-test isolation | Fixed. The Playwright preview server and production builds shared `frontend/dist`, so a production build could silently replace the authenticated preview bundle during a test run. | Preview builds now use a dedicated ignored output directory under `.tmp/playwright`. | The preview remains authenticated and driver workflows stay green even when a production build is created separately. |
| Backend confidence | Improved to 265 passing tests. New coverage directly exercises tenant-scoped dispatch, optimization lifecycle isolation, notification scoping/timeouts, SMS-off settings, sanitized health output, organization membership boundaries, API-key lifecycle, webhook replay scoping, private webhook targets, and unsubscribed events. | Add durable notification retry/idempotency only after the staging queue/provider behavior is measured. | PASS for local critical authorization and platform-control cases; hosted provider and worker behavior remains a staging gate. |
| Dependency audit | High-severity PostCSS source-map disclosure risk was discovered while adding the accessibility toolchain. | Pin PostCSS 8.5.23 across the workspaces and preserve the assisted-pilot React Router 6 exception. | PASS: clean install is reproducible; full and production audit gates have zero high or critical advisories. Two React Router 6 moderate advisories remain documented for the pre-GA Router 7 migration. |
| Hosted operations | Provider credentials and disposable staging identities are absent locally. | Complete the existing staging, restore, R2 recovery, rollback, alert, WorkOS, Postmark, and assisted Stripe procedures. | Every hosted and operations gate has dated evidence tied to the exact promoted SHA. |

## Design direction

The public site should remain dark navy and copper at the top, then move into restrained light operational surfaces. Product views must be large enough to inspect; decorative motion must never compete with route data. Mobile product workflows should use stacked summary cards and drawers, while desktop retains dense tables and map-first workspaces.

The implementation wireframe is in [`mockups/assisted-pilot-ui-optimization.svg`](../mockups/assisted-pilot-ui-optimization.svg).

## Deferred by launch scope

- React Router 7 migration remains required before self-serve GA.
- Formal analytics funnels remain a follow-up after consent and event definitions are approved.
- SMS remains disabled.
- No uptime SLA is offered for the assisted pilot.
