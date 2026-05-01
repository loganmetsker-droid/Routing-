# Trovan Codebase Audit And Hardening Report

Audit date: 2026-04-25

Workspace: `/Users/logan/Desktop/Routing`

Branch: `codex/route-optimization-objectives`

HEAD: `ca4f428`

Scope: current dirty working tree, including uncommitted files and generated Playwright audit screenshots.

## Executive Summary

### Current State

Trovan is moving in the right product direction: the dispatcher shell, routing, dispatch, maps, preview/demo mode, and objective selector have real structure now. The build is green and the frontend unit suite is green. The codebase is not GA-ready yet because the backend test suite is currently red, production dependency audit reports high-severity findings, and several realtime/dispatch paths still do not enforce tenant boundaries strongly enough.

This is no longer just "make the UI nicer" work. The primary hardening work is now about keeping route, vehicle, optimizer, telemetry, and dispatch event data scoped to the right organization while preserving the premium UI and demo mode.

### Top 5 Risks

1. **P1: Realtime dispatch/tracking sockets are open and globally broadcast operational data.** `backend/src/modules/dispatch/dispatch.gateway.ts` and `backend/src/modules/tracking/tracking.gateway.ts` use `origin: '*'`, do not authenticate Socket.IO handshakes, join global rooms, and emit route/vehicle events globally.
2. **P1: Dispatch timeline and optimizer event history are not tenant-scoped.** `dispatch_events` has no `organizationId`, and timeline/optimizer event endpoints do not receive or apply the authenticated user's organization scope.
3. **P1: Auto-dispatch worker queries pending jobs and available vehicles globally.** `backend/src/modules/dispatch/dispatch.worker.ts` can mix jobs and vehicles across organizations or fail unpredictably once tenant-scoped service methods are enforced.
4. **P1: Backend tests are red on current tree.** The route objective DTO breaks GraphQL reflection, and planning service tests are out of sync with the new constructor dependencies.
5. **P1/P2: Production hardening is incomplete.** CSP is disabled, Swagger is always exposed, production sourcemaps are enabled, request body logging defaults on outside `production`, and `npm audit` reports high-severity production vulnerabilities.

### Top 5 Fastest Wins

1. Add Socket.IO authentication, organization rooms, origin allowlists, and no-global-broadcast rules for dispatch/tracking gateways.
2. Add `organizationId` to dispatch events and optimization job/event records, then pass `req.user` through timeline/optimizer endpoints.
3. Rewrite auto-dispatch to process per organization with an explicit service actor and org-scoped job/vehicle queries.
4. Fix the backend test blockers: explicit GraphQL field typing for `CreateRouteDto.objective`, plus updated `PlanningService` mocks for `HttpService` and `ConfigService`.
5. Disable production sourcemaps, gate Swagger/docs by env, add CSP, and make request body logging opt-in for any shared/staging environment.

## Verification Run

### Commands That Passed

```sh
PATH=/tmp/trovan-node-v24.14.0-darwin-arm64/bin:$PATH npm run build
```

Result: passed. Backend Nest build and frontend TypeScript/Vite production build completed.

```sh
PATH=/tmp/trovan-node-v24.14.0-darwin-arm64/bin:$PATH npm test --workspace=frontend
```

Result: passed. 6 test files, 8 tests.

```sh
PATH=/tmp/trovan-node-v24.14.0-darwin-arm64/bin:$PATH npm run capture:ui
```

Result: passed. Playwright captured desktop screenshots for primary routes under `.artifacts/ui-audit/playwright/`.

Captured routes include dashboard, jobs, routing, dispatch, exceptions, tracking, drivers, vehicles, customers, analytics, settings, driver, and public tracking at laptop and widescreen sizes.

### Commands That Failed Or Are Blocked

```sh
PATH=/tmp/trovan-node-v24.14.0-darwin-arm64/bin:$PATH npm test --workspace=backend
```

Result: failed. 24 test files total, 21 passed and 3 failed. 73 tests total, 68 passed and 5 failed.

Failures:

- `src/modules/dispatch/dispatch.controller.rbac.spec.ts` failed at import time: `Undefined type error. Make sure you are providing an explicit type for the "objective" of the "CreateRouteDto" class.`
- `src/modules/dispatch/dispatch.integration.spec.ts` failed with the same GraphQL reflection error.
- `src/modules/planning/planning.service.spec.ts` failed five tests with `TypeError: Cannot read properties of undefined (reading 'get')` because tests instantiate `PlanningService` without the new `HttpService` and `ConfigService` constructor dependencies.

```sh
python3 -m pytest routing-service/tests
```

Result: blocked. Local Python does not have `pytest` installed: `No module named pytest`.

```sh
PATH=/tmp/trovan-node-v24.14.0-darwin-arm64/bin:$PATH npm audit --omit=dev --json
```

Result: failed. Production dependency audit reports 14 vulnerabilities: 4 low, 7 moderate, 3 high, 0 critical.

High-severity items include `@nestjs/core`, `@nestjs/platform-express`, and `path-to-regexp`.

```sh
PATH=/tmp/trovan-node-v24.14.0-darwin-arm64/bin:$PATH npm run lint --workspace=frontend
```

Result: failed before linting. ESLint 10 expects `eslint.config.js`; the frontend still relies on older lint config assumptions.

```sh
PATH=/tmp/trovan-node-v24.14.0-darwin-arm64/bin:$PATH npm run lint --workspace=backend
```

Result: failed before linting. Backend has no `lint` script.

### Static Debt Snapshot

- `any` / `as any` references in `backend/src`, `frontend/src`, and `shared`: 229.
- `TODO/FIXME/HACK/XXX` references: 1.
- Console logging references in source/scripts: 126.
- Frontend `localStorage` / `sessionStorage` references: 15.
- Hardcoded frontend hex colors: 204.
- Largest files: `backend/src/modules/dispatch/dispatch.service.ts` is 2882 lines, `frontend/src/pages/SettingsPage.tsx` is 1782 lines, `backend/src/modules/planning/planning.service.ts` is 1097 lines, `frontend/src/pages/RoutingWorkspacePage.tsx` is 932 lines, and `frontend/src/pages/DispatchBoardOpsPage.tsx` is 779 lines.

## Findings

### P0/P1 Security Or Data-Risk

#### P1-01: Socket.IO dispatch and tracking gateways are unauthenticated and globally scoped

Files:

- `backend/src/modules/dispatch/dispatch.gateway.ts:15`
- `backend/src/modules/dispatch/dispatch.gateway.ts:31`
- `backend/src/modules/dispatch/dispatch.gateway.ts:45`
- `backend/src/modules/dispatch/dispatch.gateway.ts:65`
- `backend/src/modules/tracking/tracking.gateway.ts:19`
- `backend/src/modules/tracking/tracking.gateway.ts:47`
- `backend/src/modules/tracking/tracking.gateway.ts:151`
- `backend/src/modules/tracking/tracking.gateway.ts:229`
- `frontend/src/services/socket.ts:28`
- `frontend/src/services/socket.ts:75`

Impact: Any client that can connect to the Socket.IO namespaces can subscribe to route or vehicle updates. Tracking also accepts `driver:location` updates over the socket and broadcasts vehicle updates globally. This is a direct privacy and tenant-isolation risk for fleet locations, route state, and driver telemetry.

Recommended fix: Add gateway auth middleware that validates JWT/session at handshake, rejects unauthenticated sockets, maps sockets to `organizationId`, and joins only organization-specific rooms. Replace `this.server.emit(...)` and global `routes`/`locations` rooms with `org:${organizationId}:...` rooms. Align frontend socket connection with the same token/session mechanism as REST. Add tests that prove org A never receives org B route, vehicle, or telemetry events.

#### P1-02: Dispatch timeline and optimizer events are not organization-scoped

Files:

- `backend/src/modules/dispatch/dispatch.controller.ts:439`
- `backend/src/modules/dispatch/dispatch.controller.ts:449`
- `backend/src/modules/dispatch/dispatch.controller.ts:465`
- `backend/src/modules/dispatch/services/dispatch-events.service.ts:36`
- `backend/src/modules/dispatch/services/dispatch-events.service.ts:72`
- `backend/src/modules/dispatch/entities/dispatch-event.entity.ts:13`

Impact: Auth guards are present, but the data model and query path do not scope dispatch event records by organization. Timeline queries can return cross-tenant operational history if the table contains events from multiple organizations. Optimizer event/job lifecycle records are exposed through controller methods without `req.user` scope.

Recommended fix: Add `organizationId` to `DispatchEvent`, optimizer event records, and optimization job lifecycle records. Require organization scope in controller methods. Pass actor context into `getOptimizerEvents`, `getOptimizationJobs`, and `getDispatchTimeline`. Add repository filters and DB indexes on `(organization_id, created_at)` and `(organization_id, route_id, created_at)`. Backfill or safely isolate existing rows.

#### P1-03: Auto-dispatch worker queries jobs and vehicles globally

Files:

- `backend/src/modules/dispatch/dispatch.worker.ts:70`
- `backend/src/modules/dispatch/dispatch.worker.ts:97`
- `backend/src/modules/dispatch/dispatch.worker.ts:125`
- `backend/src/modules/dispatch/dispatch.worker.ts:142`

Impact: The worker selects all pending unassigned jobs and all available vehicles without organization constraints, then creates routes without an actor context. In a public SaaS deployment this can mix tenants or break when downstream service methods require an organization. This path should not run in production until it is explicitly tenant-aware.

Recommended fix: Process auto-dispatch by organization. Query distinct organizations with pending work, load only that organization's jobs/vehicles, and call dispatch service with a service actor containing `organizationId`, `userId: system`, and a clearly auditable source. Add integration tests with two organizations to prove no cross-org assignments.

#### P1-04: Backend test suite is red on current tree

Files:

- `backend/src/modules/dispatch/dto/create-route.dto.ts:31`
- `backend/src/modules/dispatch/dto/create-route.dto.ts:37`
- `backend/src/modules/dispatch/dto/update-route.dto.ts:8`
- `backend/src/modules/planning/planning.service.ts:134`
- `backend/src/modules/planning/planning.service.spec.ts:70`
- `backend/src/modules/planning/planning.service.spec.ts:92`
- `backend/src/modules/planning/planning.service.spec.ts:114`
- `backend/src/modules/planning/planning.service.spec.ts:140`
- `backend/src/modules/planning/planning.service.spec.ts:165`

Impact: The code builds, but the backend test suite cannot pass. GraphQL cannot infer `CreateRouteDto.objective` because it is typed as `OptimizationObjective | string` with `@Field({ nullable: true })`. Planning tests instantiate `PlanningService` with the old constructor shape, so `configService.get(...)` is called on `undefined`.

Recommended fix: Either split REST DTOs from GraphQL input types or make GraphQL decorators explicit, for example `@Field(() => String, { nullable: true })` on `objective`. Update planning tests to provide mocked `HttpService` and `ConfigService`, and add objective-path tests that verify the solver-backed planning path.

#### P1-05: Production runtime defaults still leak too much surface area

Files:

- `backend/src/main.ts:153`
- `backend/src/main.ts:215`
- `backend/src/main.ts:242`
- `backend/src/common/http/request-logging.middleware.ts:76`
- `backend/src/common/http/request-logging.middleware.ts:96`
- `frontend/vite.config.ts:62`

Impact: CSP is disabled, Swagger docs are always mounted, request bodies are logged by default for every non-`production` `NODE_ENV`, and frontend production builds emit sourcemaps. This is too permissive for staging and public SaaS production. Staging often contains realistic customer data, so `NODE_ENV=staging` should not default to body logging.

Recommended fix: Enable a CSP policy suitable for the app, gate Swagger behind `ENABLE_SWAGGER=true` or admin-only access outside local dev, set request body logging to opt-in only, redact address/name/customer fields if body logging is ever used, and disable production sourcemaps unless an explicit private error-reporting upload flow exists.

#### P1-06: Production dependency audit contains high-severity vulnerabilities

Files:

- `package.json:34`
- `backend/package.json:22`
- `backend/package.json:29`
- `backend/package.json:35`

Impact: `npm audit --omit=dev` reports high-severity production vulnerabilities in the Nest/Express routing stack through `@nestjs/core`, `@nestjs/platform-express`, and `path-to-regexp`, plus moderate issues in Apollo/Bull/TypeORM/uuid. This is a release blocker for a public SaaS GA bar.

Recommended fix: Run a controlled dependency hardening branch. Start with same-major safe upgrades where available, then test Nest/GraphQL/Apollo compatibility. If Apollo/GraphQL is only compatibility residue, consider removing GraphQL from the public runtime rather than carrying the migration cost.

### P2 Maintainability And Tech Debt

#### P2-01: `dispatch.service.ts` is a 2882-line mixed-responsibility hotspot

File: `backend/src/modules/dispatch/dispatch.service.ts:1`

Impact: One service owns route creation, route status transitions, optimizer calls, fallback routing, move/reorder, telemetry-style event logging, route versions, reroutes, timeline access, and response mapping. That makes every dispatch change risky, especially the route optimization and manual editing work.

Recommended fix: Split by responsibility: `DispatchRouteService`, `DispatchOptimizerService`, `DispatchMoveService`, `DispatchTimelineService`, `DispatchRerouteService`, and `DispatchPresenter`. Keep the current API contract stable while moving internals behind smaller service tests.

#### P2-02: Optimizer fallback can quietly turn failures into degraded route output

Files:

- `backend/src/modules/dispatch/dispatch.service.ts:714`
- `backend/src/modules/dispatch/dispatch.service.ts:803`
- `backend/src/modules/dispatch/dispatch.service.ts:826`

Impact: When the routing service fails, the backend logs a failure and returns fallback sequential routing. This is useful for local/demo resilience, but dangerous if production dispatch can publish fallback routes without clear operator acknowledgement. The UI must not present degraded optimization as equivalent to optimized output.

Recommended fix: Treat fallback as a separate state with explicit `data_quality: degraded`, a visible UI warning, and a publish guard or confirmation in production. Add tests that prove optimizer outage cannot silently create a normal-looking route.

#### P2-03: Dispatch service methods still allow unscoped service calls when actor is absent

Files:

- `backend/src/modules/dispatch/dispatch.service.ts:748`
- `backend/src/modules/dispatch/dispatch.service.ts:756`
- `backend/src/modules/dispatch/dispatch.service.ts:1296`

Impact: Controller paths usually pass `req.user`, but internal service calls and worker paths can omit actor context. `findAll` returns all routes when no actor is provided. `callRoutingService` loads vehicles/jobs by ID without organization filtering. That makes the code safe only when every caller remembers to scope correctly.

Recommended fix: Make organization scope required at service boundaries for all dispatch mutations and reads except explicitly marked system-health endpoints. Move unscoped helpers to private methods that require a verified organization context. Add tests for no-actor rejection.

#### P2-04: Tracking REST was hardened, but tracking WebSocket still bypasses those DTO and tenant checks

Files:

- `backend/src/modules/tracking/tracking.controller.ts:79`
- `backend/src/modules/tracking/dto/telemetry-ingest.dto.ts`
- `backend/src/modules/tracking/tracking.gateway.ts:229`
- `backend/src/modules/tracking/tracking.service.ts:99`

Impact: REST ingest now requires organization scope and validated DTO input. Socket ingest still accepts a loose inline payload, does not pass organization scope, and calls `trackingService.ingestTelemetry(...)` directly. That leaves two different telemetry security models.

Recommended fix: Reuse the same DTO validation and org-scoped ingest path for socket updates. Socket driver location events should require a driver/session identity and verify that the vehicle belongs to the same organization.

#### P2-05: Routing-service has two optimization APIs with different hardening assumptions

Files:

- `routing-service/app/main.py:63`
- `routing-service/app/main.py:146`
- `routing-service/app/main.py:209`
- `routing-service/app/solver.py:262`
- `routing-service/app/solver.py:338`

Impact: `/optimize` uses typed Pydantic schemas and objective normalization. Legacy `/route` and `/route/global` query vehicles/jobs by ID from the service database and have no auth or organization boundary. The solver also hard-codes a 10-second search limit and legacy `solve_vrp(...)` does not expose objective selection.

Recommended fix: Make `/optimize` the only production path or protect legacy endpoints behind internal auth and explicit deprecation. Add service-level API key or network isolation. Move solver time limit and strategy into config. Add tests for objective differences, infeasible solutions, and dropped-work diagnostics.

#### P2-06: Frontend auth/session still stores bearer tokens in localStorage

Files:

- `frontend/src/services/apiClient.ts:13`
- `frontend/src/services/apiClient.ts:27`
- `frontend/src/services/apiClient.ts:52`
- `frontend/src/services/api.session.ts:112`

Impact: This is acceptable for early local preview, but it is not the target posture for WorkOS-backed public SaaS sessions. A stolen token from XSS or browser extension context can be replayed. The code also mixes demo bypass and normal auth in the same storage key.

Recommended fix: Move production auth toward HttpOnly secure cookies or WorkOS session exchange with server-side session validation. Keep local preview bypass isolated behind local-only flags and a separate storage key. Add tests that production builds cannot enable bypass.

#### P2-07: Design system is still split across duplicate token and status systems

Files:

- `frontend/src/theme/designTokens.ts:1`
- `frontend/src/theme/tokens.ts:1`
- `frontend/src/components/StatusPill.tsx`
- `frontend/src/components/ui/StatusPill.tsx`
- `frontend/src/theme/trovanTheme.ts:53`

Impact: The UI looks much better, but it is still easy for screens to drift because there are multiple token sources and duplicate `StatusPill` components. `frontend/src/theme/tokens.ts:93` even names `background.light` as `#050403`, which is conceptually dark and confusing.

Recommended fix: Choose one canonical token source and one status pill primitive. Keep page-level code from choosing raw colors. Add a lint or test that blocks hardcoded colors in core dispatcher pages except in the token file.

#### P2-08: Primary frontend workflow components are still too large

Files:

- `frontend/src/layout/AppShell.tsx:1`
- `frontend/src/pages/RoutingWorkspacePage.tsx:1`
- `frontend/src/pages/DispatchBoardOpsPage.tsx:1`
- `frontend/src/pages/SettingsPage.tsx:1`

Impact: The new UI direction is working, but the implementation is still concentrated in large components. That makes it harder to keep Routing and Dispatch synchronized, enforce map-first layouts, and avoid regressions in narrow layouts.

Recommended fix: Extract reusable primitives already implied by the UI: `MapFirstWorkspace`, `RouteLaneList`, `RouteInspectorPanel`, `OpsCommandBar`, `TopoShellBackground`, and page view-model builders. Keep page files mostly data wiring plus composition.

#### P2-09: Linting is not a usable gate

Files:

- `frontend/package.json:10`
- `backend/package.json:5`

Impact: Frontend lint fails before checking code because ESLint 10 expects flat config. Backend has no lint script. This means style, `any`, hooks, accessibility, dead code, and unsafe patterns are not being enforced by CI.

Recommended fix: Add root `eslint.config.js` or pin/migrate ESLint intentionally. Add backend lint script. Make lint part of the release gate after current red tests are fixed.

#### P2-10: Leaflet attribution is hidden globally

File: `frontend/src/theme/trovanTheme.ts:152`

Impact: The map UI looks cleaner, but hiding Leaflet/CARTO/OpenStreetMap attribution globally can violate provider attribution requirements. This is a legal and vendor-risk issue, not just a UI preference.

Recommended fix: Replace the default banner with a compact custom attribution treatment that is visually premium but still compliant.

### P3 Polish And UX

#### P3-01: UI visual direction is much closer, but the app still has theme drift risk

Files:

- `frontend/src/theme/trovanTheme.ts:53`
- `frontend/src/theme/designTokens.ts:45`
- `frontend/src/theme/tokens.ts:1`
- `frontend/src/pages/Dashboard.tsx:1`
- `frontend/src/pages/RoutingWorkspacePage.tsx:1`
- `frontend/src/pages/DispatchBoardOpsPage.tsx:1`

Impact: Playwright screenshots show the black/copper shell, topo background, map-first routing/dispatch layouts, and brighter maps are working. The risk is that page-local colors and duplicate status primitives will reintroduce mismatch as more features land.

Recommended fix: Lock the visual system now. Core pages should use only shared primitives and tokenized values. Add visual snapshots for dashboard, routing, dispatch, exceptions, tracking, jobs, analytics, and settings.

#### P3-02: Dashboard is visually coherent but less operationally dense than Routing/Dispatch

File: `frontend/src/pages/Dashboard.tsx:1`

Impact: The dashboard now matches the black/copper atmosphere, but it still reads more like a stacked operations summary than a true command center. Routing and Dispatch feel richer and more map-first.

Recommended fix: Make Dashboard the entry point into workflow pressure: live map first, exception queue, jobs waiting, route health, and next action shortcuts. Keep the same shell and panel grammar as Routing/Dispatch.

#### P3-03: Routing and Dispatch need component-level workflow tests for drag/drop behavior

Files:

- `frontend/src/pages/RoutingWorkspacePage.tsx:1`
- `frontend/src/pages/DispatchBoardOpsPage.tsx:1`

Impact: The UI exposes drag/drop and route editing affordances, but there are not enough tests proving reorder, cross-lane moves, locked stops, read-only routes, optimistic updates, and failure rollback behavior from the operator's perspective.

Recommended fix: Add Playwright workflow tests for route generation, manual reorder, cross-route move, publish, dispatch stop move, read-only route rejection, and exception creation. Use preview fixtures for stable UI tests and backend integration tests for API correctness.

#### P3-04: Accessibility and responsive quality need a formal pass

Files:

- `frontend/src/layout/AppShell.tsx:1`
- `frontend/src/pages/RoutingWorkspacePage.tsx:1`
- `frontend/src/pages/DispatchBoardOpsPage.tsx:1`
- `frontend/src/components/TopoShellBackground.tsx:1`

Impact: The visual style is premium, but premium cannot mean brittle. The map-first screens need keyboard navigation, focus visibility, screen-reader labels for icon rail items, reduced-motion behavior, and narrow layout checks.

Recommended fix: Add an accessibility checklist and Playwright checks for focus order, nav labels/tooltips, route lane keyboard selection, dialog focus trapping, reduced motion, and minimum contrast in status pills.

## Backend Hardening Roadmap

### Immediate Release Blockers

1. Fix backend test failures in route objective DTOs and planning service tests.
2. Add tenant scope to dispatch events, optimizer event history, optimization job lifecycle records, and all timeline endpoints.
3. Authenticate and organization-scope dispatch/tracking WebSocket gateways.
4. Rewrite auto-dispatch to process one organization at a time with a service actor.
5. Resolve high-severity `npm audit --omit=dev` findings or document a specific compensating-control exception with owner and date.

### Auth, Config, And Runtime

1. Keep `STRICT_ENV_VALIDATION` mandatory in staging/production and expand readiness to prove WorkOS, Stripe, Postmark, Twilio, R2, Redis, and database are configured when required.
2. Gate Swagger and GraphQL playground outside local development.
3. Enable CSP through Helmet and test map tile/font/connect-src requirements.
4. Make request body logging opt-in only and scrub operational PII such as names, addresses, phone, email, route notes, and proof metadata.
5. Move production browser sessions away from localStorage bearer tokens.

### Dispatch Workflow

1. Split `dispatch.service.ts` into bounded services with tests around route creation, optimization, move/reorder, reroute, event logging, and response presentation.
2. Make organization context required in service methods, not optional.
3. Treat optimizer fallback as degraded output that cannot look like a normal optimized route.
4. Add audit events for every route mutation with organization, actor, request ID, source, before/after values, and affected jobs/stops.
5. Add multi-tenant integration tests for route create, move-stop, reorder, timeline, optimizer events, and route-run detail.

### Routing Service

1. Make `/optimize` the canonical production path.
2. Require internal service auth or network isolation for routing-service.
3. Deprecate or protect `/route` and `/route/global`.
4. Make solver time limit and strategy configurable.
5. Add tests for `speed`, `distance`, and `balanced` objectives, especially dropped-work behavior and urgent/high penalties.

### Provider And Billing Resilience

1. Keep local provider fallbacks local-only.
2. Make Stripe absence fail readiness in staging/production instead of only producing a disabled catalog.
3. Add entitlement enforcement tests for seats, branding, API/webhook access, and analytics.
4. Add provider retry/outbox tests for notifications, webhooks, and proof storage.

## Frontend Hardening Roadmap

### API And Session Layer

1. Keep `frontend/src/services/api.ts` as the barrel, but continue moving normalization into typed service modules.
2. Replace broad `any` socket/API payloads with shared contracts from `shared/contracts`.
3. Add a production-safe session model that does not depend on localStorage bearer tokens.
4. Keep demo/preview mode local-only, with automated tests that prove production builds reject `VITE_AUTH_BYPASS` and `VITE_MOCK_PREVIEW`.

### Realtime Layer

1. Send auth/session data during socket connection only after backend supports it.
2. Subscribe to organization-specific channels, not global rooms.
3. Replace 500ms type/route dedupe with event IDs or server sequence numbers.
4. Add reconnect recovery that refetches route board state after socket reconnect.
5. Add tests for duplicate suppression, missed events, route updates, and org isolation.

### UI System Enforcement

1. Consolidate `designTokens.ts` and `tokens.ts`.
2. Consolidate duplicate `StatusPill` components.
3. Move page-local color, radius, border, and shadow choices into shared primitives.
4. Add visual regression snapshots for the core dispatcher pages.
5. Add a lightweight static check for hardcoded colors in page components.

### Preview And Demo Mode

1. Keep `scripts/demo-preview-server.mjs` as the durable local demo entrypoint.
2. Ensure direct links to `/routing`, `/dispatch`, `/exceptions`, `/tracking`, and `/settings` work without localhost API attempts in preview mode.
3. Separate demo auth token storage from real auth token storage.
4. Add tests for "preview never contacts live API" on core pages.

## UI/UX Improvement Roadmap

### Routing And Dispatch

1. Preserve the current map-first pattern. It is the best part of the latest UI work.
2. Make route lanes, selected route, map highlight, and inspector state come from one view model.
3. Add visible states for editable, read-only, locked, dropped, optimized, degraded, and publish-ready.
4. Make drag/drop affordances explicit without adding visual clutter: slim drop zones, cursor states, and inline warnings for disallowed moves.
5. Keep map brightness high enough for street names and vehicle context, with no topography over map tiles.

### Dashboard

1. Move closer to a command center: map, urgent queue, route health, and jobs waiting should be visible above the fold.
2. Reduce passive KPI-only blocks.
3. Make each module answer "what should the dispatcher do next?"

### Shell And Brand

1. The black/copper sidebar is a strong brand direction. Extend it through command bars and inspectors without making work panels too dark to scan.
2. Keep topography as atmosphere, not decoration. It should animate subtly, freeze under `prefers-reduced-motion`, and never sit above content or map tiles.
3. Keep the sidebar collapsed by default, but ensure icons have tooltips, accessible names, and consistent active indicators.

### Accessibility And Responsiveness

1. Add keyboard routes through nav, command bars, route lane selection, route stop actions, and modals.
2. Add focus-visible styling that fits the copper theme.
3. Run laptop, widescreen, and narrow Playwright screenshots for every UI pass.
4. Add reduced-motion and contrast checks to acceptance criteria.

## Test And Release Gates Before GA

### Must Pass

1. `npm run build`
2. `npm test --workspace=backend`
3. `npm test --workspace=frontend`
4. Routing-service tests in an isolated Python environment
5. `npm audit --omit=dev` with no unresolved high/critical vulnerabilities
6. Frontend and backend lint gates
7. Playwright UI audit screenshots for dispatcher, driver, and public tracking
8. Multi-tenant backend integration tests for dispatch, tracking, route plans, API keys, webhooks, and public API
9. Preview/demo tests proving local bypass cannot run in staging/production
10. Restore/rollback drill documentation

### Must Not Ship With

1. Global Socket.IO broadcasts for tenant data.
2. Unauthenticated driver location socket ingest.
3. Unscoped dispatch event timelines or optimizer lifecycle records.
4. Auto-dispatch worker that mixes organizations.
5. Production sourcemaps exposed by default.
6. Swagger/docs open by default in production.
7. Backend tests red.
8. High-severity production dependency audit findings without an explicit accepted-risk record.

## Recommended Next Pass Order

1. **Backend release-blocker pass:** fix backend tests, socket auth/org rooms, dispatch event org scope, and auto-dispatch org isolation.
2. **Production hardening pass:** CSP, Swagger gating, sourcemap policy, request logging policy, dependency upgrades.
3. **Routing-service verification pass:** Python test environment, objective behavior tests, legacy endpoint decision.
4. **Frontend system pass:** consolidate tokens/status pills, add static hardcoded-color check, add Playwright workflow tests.
5. **UX polish pass:** dashboard command-center density, route/dispatch drag/drop acceptance states, accessibility and responsive QA.
