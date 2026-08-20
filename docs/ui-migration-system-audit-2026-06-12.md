# UI Migration System Audit - 2026-06-12

## Executive Summary

The migrated operator UI loads across all primary screens and no audited page had page-level horizontal overflow at `1159x863`. The app is visually navigable, the real Leaflet map component is still present, and the route screen survived a 100-interaction route/map click-through pass.

The major product risk is data authenticity in the local app. At `http://127.0.0.1:5194`, the frontend bootstraps `preview-auth-bypass`, which makes most service clients return `api.preview.ts` in-memory seed data instead of calling the backend API. The backend is running, but direct unauthenticated `/api/jobs` returns `401`, and the Playwright audit saw no real backend `/api/...` business requests from the UI. Network entries were Vite module loads such as `/src/features/dispatch/api/routeRunsApi.ts`, not data API calls.

This means the current local demo is mostly "real UI against preview adapters," not "real UI against backend persistence." Some numbers are derived from preview seed records, some are explicitly pending, and a few are hard-coded temporary metrics.

## Audit Method

- Browser automation: Playwright Chromium against `http://127.0.0.1:5194`.
- Screens audited: Dashboard, Dispatch, Routing, Tracking, Jobs, Customers, Drivers, Vehicles, Proof of Delivery, Exceptions, Reports, Settings.
- Viewport: `1159x863`.
- Per screen: loaded route, captured screenshot, checked horizontal overflow, scraped visible controls, clicked safe controls, recorded disabled controls, skipped destructive/external actions.
- Safety: actions like publish, accept risk, destructive cancel/archive/delete, final sends, and dispatch actions were not fired when they could mutate operational state.
- Computer Use note: Computer Use could not control the Codex in-app browser because the app is blocked for safety, so Playwright was used against the same local URL.

Raw evidence:

- JSON: `/tmp/trovan-ui-audit-results.json`
- Screenshots:
  - `/tmp/trovan-audit-dashboard.png`
  - `/tmp/trovan-audit-dispatch.png`
  - `/tmp/trovan-audit-routing.png`
  - `/tmp/trovan-audit-tracking.png`
  - `/tmp/trovan-audit-jobs.png`
  - `/tmp/trovan-audit-customers.png`
  - `/tmp/trovan-audit-drivers.png`
  - `/tmp/trovan-audit-vehicles.png`
  - `/tmp/trovan-audit-proof-of-delivery.png`
  - `/tmp/trovan-audit-exceptions.png`
  - `/tmp/trovan-audit-reports.png`
  - `/tmp/trovan-audit-settings.png`

## Data Authenticity

### Current Local Runtime

The app automatically enables local preview mode on `localhost` / `127.0.0.1` unless `?auth=live` is used.

Relevant code:

- `frontend/src/main.tsx`: sets `authToken = preview-auth-bypass` on local hosts.
- `frontend/src/services/api.session.ts`: treats local preview bootstrap as auth bypass.
- `frontend/src/services/api.preview.ts`: owns the dense seed state for jobs, routes, drivers, vehicles, tracking, and planner data.

### API-backed When Not Preview

These frontend clients have live backend paths, but the local audited runtime short-circuits to preview first:

- Jobs: `frontend/src/services/jobsApi.ts` -> `/api/jobs`
- Customers: `frontend/src/services/customersApi.ts` -> `/api/customers`
- Drivers/vehicles: `frontend/src/services/fleetApi.ts` -> `/api/drivers`, `/api/vehicles`
- Routing/planner: `frontend/src/services/plannerApi.ts` -> `/api/route-plans/...`
- Dispatch/route runs: `frontend/src/features/dispatch/api/routeRunsApi.ts` -> `/api/dispatch/board`, `/api/route-runs/...`
- Tracking: `frontend/src/services/trackingApi.ts` -> `/api/tracking/...`
- Reports: `frontend/src/services/analyticsApi.ts` -> `/api/metrics/overview`

### Derived From Preview Seed

These are not static screenshots, but they are still preview/local seed data in the audited run:

- Dashboard job, route, vehicle, driver, exception counts.
- Dashboard job status chart and route performance rows.
- Dispatch route cards, unassigned jobs, route distances, active route map markers.
- Routing unassigned jobs, route summaries, route lines, stop timeline, planner warning state.
- Jobs table and inspector.
- Tracking vehicle/route map state.
- POD table rows and stop/proof detail.
- Exceptions list and constraint data.
- Customers/vehicles/drivers base lists.

### Temporary Or Hard-coded Values Found

- `frontend/src/pages/Dashboard.tsx`
  - Efficiency & Savings shows `Not tracked` and `Backend metric pending`.
  - ROI is `—`.
- `frontend/src/pages/DriversPage.tsx`
  - `On Break = 12`, `Overtime Risk = 7`, `Compliance Expiring = 9`, `Utilization = 78.4%`.
  - Driver detail score chips include `Safety Score 95`, `On-Time % 98%`, `Completed Stops 48`.
- `frontend/src/services/analyticsApi.ts`
  - Preview reports use `onTimeRate: 94.5`, `proofCaptureRate: 88.2`, `servicedStops: 1`.
- `frontend/src/pages/ProofOfDeliveryPage.tsx`
  - Filter controls use `MockupSelect`.
  - Page size is fixed as `25 per page`.
  - Proof accuracy displays `Not tracked`.
- `frontend/src/services/api.preview.ts`
  - Route warnings include `Simulated planning path used`, which appears in Exceptions and is not operator-friendly.
- `frontend/src/services/customersApi.ts`
  - Customers screen still exposes `seed/API` text in the UI.

## Screen Results

| Screen | Loads | Overflow | Data Source In Local Run | Main Finding |
| --- | --- | ---: | --- | --- |
| Dashboard | Yes | 0px | Preview seed + derived state | Several counts are derived, but savings/ROI are pending/static. |
| Dispatch | Yes | 0px | Preview route-run board | Layout loads; multiple top actions did not show detectable state change. |
| Routing | Yes | 0px | Preview planner | Route/map/timeline work visually; several optimizer buttons do not visibly act. |
| Tracking | Yes | 0px | Preview tracking snapshot | Map loads; map toggles not DOM-detectable. |
| Jobs | Yes | 0px | Preview jobs/customers/routes | Main layout works; row action menus did not show detectable state change. |
| Customers | Yes | 0px | Local customer preview store | `seed/API` copy remains; filters/segments mostly no-op. |
| Drivers | Yes | 0px | Preview fleet store + hard-coded metrics | Metric tiles and detail stats include temporary values. |
| Vehicles | Yes | 0px | Preview fleet store | Add/edit UI opens; some filters/tabs are visual only. |
| POD | Yes | 0px | Preview route-run stops/proofs | Filters are mockup controls and do not filter. |
| Exceptions | Yes | 0px | Preview dispatch exceptions | Simulated warning copy is still exposed. |
| Reports | Yes | 0px | Preview analytics adapter | Overview comes from preview analytics, including hard-coded rates. |
| Settings | Yes | 0px | Mixed preview platform/org adapters | Tabs navigate; data is preview/local unless live auth is used. |

## Button / Control Audit

Totals from initial visible controls:

- Controls inventoried: 331
- Clicked and detected state/URL/menu/dialog change: 215
- Clicked with no obvious DOM state change: 109
- Disabled: 4
- Skipped as destructive/external: 3
- Route/map click-through: 100 completed non-destructive interactions

Important no-obvious-effect controls:

- Dashboard: `All Routes`, `Layers`. Map zoom/layer buttons were clicked but the DOM-based audit cannot prove visual tile changes.
- Dispatch: `Dispatch All (1)`, `Send Updates`, `Reassign`, `Auto-refresh on`, `Reset filters`. `Accept Risk` was skipped as safety-sensitive.
- Routing: `Optimize Routes`, `Auto Assign`, `Rebalance`, `Save draft`, `Filters`, `Reoptimize`, several stop cards.
- Jobs: `Import CSV` did not show a visible dialog in headless audit; row action buttons for individual jobs did not show detectable menus. `Batch Assign`, `Archive`, and `Cancel` were disabled with zero selected jobs.
- Customers: segment chips, `Clear`, `Save View`, `Industry`, `Status`, and `More Filters` did not show detectable state change. `Import` was skipped as external/file-system oriented.
- POD: `More Filters`, `Reset`, `Apply Filters` did not show filtering behavior.
- Exceptions: `Acknowledge` was disabled; `Resolve` skipped as state-changing. `Open route` did not visibly navigate in the audit.

## Console / Runtime Findings

No fatal render errors were observed. The console had high warning volume:

- React Router v7 future warnings: 674 total. These are noise, not product failures.
- MUI select warnings: 198 total.
  - `driver-carl-3` and `driver-anna-2` are selected values that are not in the driver select options.
  - This is a real data-shape bug between preview route driver IDs and driver option IDs.

## 100 Route Interaction Pass

Completed 100 non-destructive route/map interactions on `/routing`.

Controls exercised included route view modes, map style toggles, route labels, route summary labels, and reoptimization controls. Initial attempts to hit `Collapsed`/`Expanded` missed when those controls were not visible in the current state, then the pass was topped up with visible route/map controls.

This proves the current route screen can survive repeated route interaction, but it does not prove 100 distinct backend route records exist. Current seed route count is much smaller than 100.

## Top Fixes Needed

1. Add a real backend/demo mode switch.
   - The local app should make it obvious whether it is using preview adapters or real backend persistence.
   - For a true backend demo, local `127.0.0.1` should not silently force `preview-auth-bypass`.

2. Remove hard-coded temporary metrics.
   - Replace driver metrics, reports preview rates, POD mock filters, and dashboard savings/ROI placeholders with real derived backend/seed values or honest empty states.

3. Make no-op controls real or disable them.
   - Highest priority: Dispatch top actions, Routing optimizer buttons, Jobs row actions/import, POD filters, Customers filters/segments.

4. Fix driver ID mismatch warnings.
   - Route/run driver IDs and driver option IDs need the same identity model.

5. Replace operator-hostile copy.
   - `Simulated planning path used` and `seed/API` labels should not appear in the operator UI.

6. Add acceptance tests for authenticity.
   - Tests should assert that production/live mode calls `/api/...` endpoints and that preview-only workflows are explicitly labeled or unavailable.
