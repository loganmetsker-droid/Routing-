# Trovan Prototype UI Migration Plan

Updated: 2026-06-09

## Current Slice Implemented

- Ported the prototype copper/navy/light/dark tokens into the existing MUI theme layer.
- Updated shared panels, status pills, table headers, and shell surfaces to use prototype-aligned tokens.
- Reordered the operator nav to Dashboard, Routing, Dispatch, Tracking, Jobs, Customers, Drivers, Vehicles, Proof of Delivery, Exceptions, Reports, Settings.
- Added `/pod/*` as a first-class Proof of Delivery overview backed by dispatch board route-run stop data.
- Copied prototype map imagery into `frontend/public/prototype-assets/`.
- Added a focused nav contract test so POD and Reports stay addressable.

## Next Implementation Pass

1. Tighten per-screen layouts to match the prototype reference screenshots after the shared shell/theme is stable.
2. Deepen Jobs constraints intake and readiness display.
3. Deepen Routing publish readiness and route lane visualization.
4. Deepen Dispatch lane cards, inspector actions, and future-stop movement proof.
5. Expand POD from route-run stop summary into full detail drawers, artifact previews, exports, failed/missing proof filters, and customer/job links.
6. Wire Tracking, Exceptions, Reports, Customers, Drivers, and Vehicles into route-day source-record drilldowns.

## Acceptance Gates

- `npm run test --workspace=frontend -- src/layout/navConfig.test.ts --run`
- `npm run build --workspace=frontend`
- Playwright smoke for `/dashboard`, `/jobs`, `/routing`, `/dispatch`, `/tracking`, `/pod`, `/exceptions`, `/analytics`, and `/settings`.
- Verify the Jobs table header has a solid background in light mode.
- Verify POD loads from persisted/preview route-run stop data and links to route-run detail.
