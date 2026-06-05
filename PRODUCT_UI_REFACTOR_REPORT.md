# Trovan Product UI Refactor Report

Generated: 2026-06-03

Scope: actual routing application UI only, focused on `/routing`, `RoutingWorkspacePage.tsx`, routing-workspace components, `MultiRouteMap.tsx`, product UI tests, and the product UI audit gate. Public marketing pages, homepage screenshots, pricing, demo, legal, and deployment are intentionally excluded.

## What Changed

- Reworked route-day metrics so dense plans read as operational totals instead of mixed labels: `132 total jobs`, `120 routed`, `12 unassigned`, `8 routes`, `3 open exceptions`.
- Made primary actions blocker-aware:
  - no draft: `Generate route draft`
  - unassigned jobs: `Resolve unassigned`
  - blocking exceptions: `Review exceptions`
  - clean draft: `Publish plan`
  - secondary/tertiary: `Reoptimize plan`, `Save draft`
- Matched route-readiness status and inspector next action to the same blocker logic, so blocker states do not show `Draft ready` or `Publish plan`.
- Kept the left panel as real tabs: `Jobs`, `Routes`, `Vehicles`, with tab-specific search and filters instead of job filters appearing on every tab.
- Added route filters for `Ready`, `Needs driver`, `Needs vehicle`, `Has exceptions`, and `Has unassigned`.
- Added vehicle filters for available, assigned, capacity issue, driver missing.
- Improved compact stop rows so every row still shows stop order, customer/stop identity, city, status, and protected/exception indicators without repeated `Lock` text.
- Tightened compact row grids so narrow non-selected route lanes do not overlap text.
- Added map display modes: `Selected route`, `All routes`, `Route density`, `Exceptions only`.
- Updated selected-route map focus so the selected route line/pins stay clear while unrelated dense routes are simplified/muted.
- Added zoom-aware dense map decluttering with `overview`, `context`, and `detail` render levels.
- Added route cluster markers for dense overview states so unrelated routes summarize as route/count badges instead of overlapping normal stop markers.
- Added a low-zoom marker budget: dense overview screens keep individual markers under `40` normal/important visible stops, while exception and late-risk markers remain visible above clusters.
- Updated `Selected route`, `All routes`, `Route density`, and `Exceptions only` modes so low-zoom dense route days cluster normal stops and preserve high-priority issue markers.
- Simplified the route-readiness inspector into an operational summary plus issue cards for unassigned jobs, missing assignments, blocking exceptions, and late-risk stops.
- Renamed lane drawer state controls to `Collapsed`, `Expanded`, `Full screen`; collapsed state now has one clear action: `Expand route lanes`.
- Standardized Denver demo/product scenarios on miles and readable dates like `Jun 3, 2026`.
- Added a clean product scenario for publish-ready QA and a dense product scenario for 8 routes / 120 routed stops / 12 unassigned jobs.

## Files Changed

| File | Purpose | Affects actual routing app users? | Marketing-only? |
|---|---|---:|---:|
| `frontend/src/pages/RoutingWorkspacePage.tsx` | Main routing workspace state, metrics, action logic, filters, map mode wiring, scenario wiring | Yes | No |
| `frontend/src/pages/routing-workspace/RoutingWorkspaceComponents.tsx` | Shared product components for summary, tabs, filters, compact rows, lane drawer, inspector | Yes | No |
| `frontend/src/pages/routing-workspace/densePlannerScenario.ts` | Deterministic product stress/clean scenarios for local QA | Local/test route only | No |
| `frontend/src/components/maps/MultiRouteMap.tsx` | Selected-route emphasis, simplified unrelated routes, map display mode behavior | Yes | No |
| `frontend/src/features/dispatch/utils/opsMapData.ts` | Carries route exception metadata into the map model | Yes | No |
| `e2e/product-ui.spec.ts` | Product-only Playwright coverage for the routing workspace | No runtime effect | No |
| `scripts/product-ui-audit.mjs` | Product UI audit gate against the built routing workspace | No runtime effect | No |
| `PRODUCT_UI_REFACTOR_REPORT.md` | Review report and screenshot/test evidence | No | No |

## Screenshots

Fresh screenshots were captured from the production-built local app served at `http://127.0.0.1:5190`. These are generated review artifacts and should not be committed by default.

![Routing app after desktop](/Users/logan/Desktop/Routing/.artifacts/product-ui-refactor/20260603-product-cleanup/routing-app-after-desktop.png)

![Routing app compact mode](/Users/logan/Desktop/Routing/.artifacts/product-ui-refactor/20260603-product-cleanup/routing-app-after-compact.png)

![Routing app selected route focus](/Users/logan/Desktop/Routing/.artifacts/product-ui-refactor/20260603-product-cleanup/routing-app-after-selected-route-focus.png)

![Routing app lane editor collapsed](/Users/logan/Desktop/Routing/.artifacts/product-ui-refactor/20260603-product-cleanup/routing-app-after-lane-editor-collapsed.png)

![Dense route day, 120 stops, compact mode](/Users/logan/Desktop/Routing/.artifacts/product-ui-refactor/20260603-product-cleanup/routing-app-dense-120-stops-compact.png)

![Dense route day, selected route decluttered](/Users/logan/Desktop/Routing/.artifacts/product-ui-refactor/20260603-product-cleanup/routing-app-dense-120-stops-selected-route-declustered.png)

![Dense route day, route density mode](/Users/logan/Desktop/Routing/.artifacts/product-ui-refactor/20260603-product-cleanup/routing-app-dense-120-stops-route-density.png)

![Dense route day, all routes clustered](/Users/logan/Desktop/Routing/.artifacts/product-ui-refactor/20260603-product-cleanup/routing-app-dense-120-stops-all-routes-clustered.png)

![Dense route day, exceptions only](/Users/logan/Desktop/Routing/.artifacts/product-ui-refactor/20260603-product-cleanup/routing-app-dense-120-stops-exceptions-only.png)

Screenshots are `2880x2000` PNG captures from a `1440x1000` viewport at device scale factor `2`.

## Dense Map Decluttering Rules

- Dense route day: `60+` visible stops.
- Very dense route day: `100+` visible stops.
- Low zoom marker budget: maximum `40` individual stop markers in overview mode.
- Render levels:
  - `overview`: low zoom, route density, exceptions-only, or very dense selected/all-routes views.
  - `context`: medium zoom with sampled start/end and important stops where appropriate.
  - `detail`: high zoom, where selected/detail stops can render individually.
- Selected-route mode:
  - selected route line and selected route stops stay visible.
  - unrelated normal stops become route cluster markers.
  - unrelated exceptions and late-risk markers remain visible.
- Route density mode:
  - normal stop markers are hidden.
  - routes summarize as count clusters.
  - issue markers render above clusters.
- All-routes mode:
  - dense low-zoom views cluster normal stops instead of drawing all 120 stops.
  - high zoom can return to individual stop detail.
- Exceptions-only mode:
  - normal stop markers are hidden.
  - exception and late-risk markers remain visible.

## Product UI Audit

Command:

```sh
PRODUCT_UI_BASE_URL=http://127.0.0.1:5190 npm run audit:product-ui
```

Result: passed.

Audit evidence:

- Route: `/routing?scenario=dense-route-day&serviceDate=2026-06-03`
- Findings: `0`
- Map panel area: `410400`
- Left filter panel area: `52532`
- Inspector area: `68660`
- Reports:
  - `/Users/logan/Desktop/Routing/audit/product-ui-audit.md`
  - `/Users/logan/Desktop/Routing/audit/product-ui-audit.json`

The audit now fails if route-day metrics are semantically inconsistent, `Publish plan` appears as primary while unassigned jobs or blocking exceptions remain, `Draft ready` appears while blockers remain, compact rows omit customer/stop identity, job filters appear as the Routes tab body, selected-route map mode leaves unrelated routes visually dominant, dense selected/all-routes views render normal unrelated stop clouds, route clusters are missing, issue markers disappear, blur/filter-heavy marker styling appears, the inspector uses repeated mini-card clutter or explainer copy, Denver data uses kilometers, dates are inconsistent, or `Lock` text repeats across compact rows.

## Tests Run

```sh
npm run lint --workspace=frontend
```

Result: passed.

```sh
npm run test --workspace=frontend -- --run
```

Result: passed, `9` test files and `21` tests.

```sh
npm run build --workspace=frontend
```

Result: passed.

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5189 PLAYWRIGHT_FRONTEND_PORT=5189 PLAYWRIGHT_MOCK_API_PORT=3093 PLAYWRIGHT_OUTPUT_DIR=.tmp/playwright-product-ui npm run test:e2e -- --project=chromium e2e/product-ui.spec.ts
```

Result: passed, `8` product UI tests.

```sh
node --check scripts/product-ui-audit.mjs
```

Result: passed.

```sh
PRODUCT_UI_BASE_URL=http://127.0.0.1:5190 npm run audit:product-ui
```

Result: passed.

## Remaining Limitations

- Compact mode is row-based, but dense route lanes still render all route stops. Add virtualization before relying on 100+ visible stops in production.
- Drag/reorder behavior is preserved, but full cross-lane drag automation is still not covered. Add a stable DnD regression test next.
- Dense map decluttering is route-level clustering, not true screen-grid clustering or spiderfy. Add grid clustering/spiderfy if overlapping same-address stops become common.
- Route-level “blocking exception” data currently comes from plan/group warnings in the deterministic scenario. Backend exception severity should eventually drive publish blocking.
- Full-screen lane editing is tested for entry state; exit behavior remains a manual QA item.

## Recommended Next Phase

- Add virtualized compact lane rows.
- Add stable Playwright drag/reorder coverage.
- Add true screen-grid clustering and marker spiderfy/offset for overlapping high-zoom stops.
- Persist operator preferences for density, map mode, and lane drawer state.
- Add route-level exception severity from backend data.
- Add keyboard shortcuts for map mode and lane drawer state changes.
