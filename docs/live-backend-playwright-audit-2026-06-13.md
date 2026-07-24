# Live Backend Playwright Audit - 2026-06-13

## Scope

Audited the migrated operator UI against `http://trovan.localhost:5194` with a real local admin JWT so the app did not enter localhost preview mode. Backend API was `http://127.0.0.1:3000`.

## Verification Commands

- `npm run test --workspace=frontend -- trackingApi.test.ts --run`
- `npm run lint --workspace=frontend`
- `npm run build --workspace=frontend`
- `node /tmp/trovan-live-real-data-audit.mjs`
- `node /tmp/trovan-live-click-audit-sequential.mjs`

## Backend Data Reality

Current local database row counts:

| Table | Count |
| --- | ---: |
| jobs | 30 |
| job_stops | 30 |
| drivers | 3 |
| vehicles | 3 |
| customers | 0 |
| routes | 0 |
| route_assignments | 0 |
| route_run_stops | 0 |
| route_run_messages | 0 |
| exceptions | 0 |
| proof_artifacts | 0 |
| telemetry | 0 |

This means Jobs, Drivers, and Vehicles have real live data. Customers, Dispatch route runs, POD, Exceptions, Tracking telemetry, and route execution screens are correctly showing empty/zero states because the backend tables are empty.

## Page Load Results

All main tabs loaded with live auth, no preview flag, no failed API responses, no console/page runtime errors, and no page-level horizontal overflow at desktop or mobile audit sizes.

| Page | Live API Calls | Preview Mode | Runtime Errors | Bad API Responses | Horizontal Overflow |
| --- | ---: | --- | ---: | ---: | --- |
| Dashboard | 12 | No | 0 | 0 | No |
| Dispatch | 12 | No | 0 | 0 | No |
| Routing | 10 | No | 0 | 0 | No |
| Jobs | 11 | No | 0 | 0 | No |
| Customers | 11 | No | 0 | 0 | No |
| Drivers | 8 | No | 0 | 0 | No |
| Vehicles | 7 | No | 0 | 0 | No |
| Tracking | 12 | No | 0 | 0 | No |
| Proof of Delivery | 10 | No | 0 | 0 | No |
| Exceptions | 9 | No | 0 | 0 | No |
| Reports / Analytics | 7 | No | 0 | 0 | No |
| Settings | 22 | No | 0 | 0 | No |

## Fix Applied During Audit

Settings previously crashed because `/api/tracking/readiness` returns the standard API envelope `{ data, meta, error }`, while `trackingApi.ts` consumed it as a top-level readiness object. Fixed by adding `normalizeTrackingReadiness` and unwrapping the envelope before Settings reads telemetry counts.

## Button Probe Results

- Buttons discovered: 196
- Non-destructive controls clicked successfully: 103
- Mutating/destructive controls intentionally skipped: 5
- Runtime/API errors during sequential click pass: 0

Targeted recheck cleared the controls that initially failed due audit ordering or auth-rate limiting:

- Dashboard: `All Routes`, `Layers`, `View all`, `View all routes`, `View details`
- Drivers: `Edit`, `View route`
- Vehicles: `Edit`

Remaining no-effect controls are not crashes, but should be reviewed:

- Date buttons such as `Jun 12, 2026` render as buttons but do not open a date picker.
- Routing unassigned job row clicks do not visibly select or stage a row.
- Routing map mode buttons (`Selected route`, `All routes`, `Route density`, `Exceptions only`) can show no visible change when there are no live routes/planner groups.
- Some vehicle type filters can show no visible change when the filtered result set is already effectively empty or unchanged.

## Data Hookup Findings

### Live-backed

- Dashboard metrics read from `useJobsQuery`, `useRoutesQuery`, `useDriversQuery`, `useVehiclesQuery`, and `useDispatchBoardQuery`.
- Jobs table and inspector read from `useJobsQuery`, `useCustomersQuery`, `usePlannerQuery`, `useDriversQuery`, and `useVehiclesQuery`.
- Dispatch reads from dispatch board/routes, jobs, drivers, vehicles, and route-run mutation APIs.
- Routing reads jobs, vehicles, drivers, planner state, and publish readiness APIs.
- Tracking reads live telemetry overview/readiness and subscribes to tracking socket events.
- POD reads dispatch board, route runs/stops, proof artifacts, drivers, and vehicles.
- Exceptions reads exception and route-run APIs.
- Reports reads analytics overview API.
- Settings reads auth/org/platform/billing/audit/notification/tracking APIs.

### Empty Because Backend Data Is Empty

- Dispatch board has no route runs.
- Tracking has no telemetry.
- POD has no proof artifacts.
- Exceptions has no exception records.
- Customers has no customer records.
- Route summaries/planned routes are empty because `routes` and `route_assignments` are empty.

### Still Demo/Scenario Capable

`RoutingWorkspacePage.tsx` still contains query-param-only local scenarios such as `?scenario=dense-route-day`, `?scenario=clean-route-day`, and other marketing/testing captures. They do not run on normal `/routing`, but they are still present in code and can intentionally seed local scenario data when those URLs are used.

## Map Findings

- Jobs inspector uses a real Leaflet `MapContainer` when job coordinates are present.
- Tracking uses real Leaflet maps when telemetry exists; current backend has zero telemetry, so it shows the honest offline state.
- Dashboard, Dispatch, and Routing all pass route data into shared route map components, but with zero live routes/route-runs the audited DOM had no Leaflet container on those screens.
- No screenshot image maps were detected in the live page pass.

## Audit Artifacts

- Full live page audit JSON: `/tmp/trovan-live-real-audit-1781325858558/audit.json`
- Full live page audit Markdown: `/tmp/trovan-live-real-audit-1781325858558/audit.md`
- Sequential button audit JSON: `/tmp/trovan-live-click-audit-1781326452728/click-audit.json`
- Sequential button audit Markdown: `/tmp/trovan-live-click-audit-1781326452728/click-audit.md`

## Recommended Next Fixes

1. Convert inert date buttons into a real date picker or plain display text.
2. Make routing unassigned job row clicks visibly select/stage the job.
3. Disable or explain routing map mode toggles when there are no live routes.
4. Seed or create real route runs, exceptions, proof artifacts, customers, and telemetry if the demo needs those screens to show non-empty real backend data.
5. Consider removing marketing scenario query routes from normal operator builds, or label them explicitly as scenario-only.
