# Trovan Feature Inventory

Updated: 2026-06-09

| Feature area | Current build-out | Current source | Prototype destination | Migration risk |
|---|---|---|---|---|
| Dashboard | Real metrics from jobs, routes, fleet, and dispatch board | `Dashboard.tsx` | Dashboard | Low; visual polish is mostly shared theme/cards. |
| Jobs intake | Real queue, create/import/update, saved views, filters, readiness fields | `JobsPageEnhancedV2.tsx`, jobs API | Jobs | Medium; constraint intake must keep growing beyond visual migration. |
| Routing planner | Real route-day workspace with optimizer states, blockers, manual edits, publish | `RoutingWorkspacePage.tsx` | Routing | High; preserve optimizer/publish semantics while changing layout. |
| Dispatch execution | API-backed route runs, assignment, dispatch note, readiness blockers, move stops | `DispatchBoardOpsPage.tsx`, route-run APIs | Dispatch | High; this is route-day critical and must keep reload persistence. |
| Proof of Delivery | Driver proof capture and route-run detail proof review exist; overview was missing | Driver pages, `RouteRunDetailPage.tsx`, route-run APIs | Proof of Delivery | Medium; first-class `/pod` now summarizes required proof stops from existing board data. |
| Exceptions | Dedicated queue and route-day blocker handling | `ExceptionsQueuePage.tsx`, exceptions APIs | Exceptions | High; exceptions must remain visible across routing, dispatch, POD, and reports. |
| Tracking | Tracking overview and public token route exist | `TrackingEnhanced.tsx`, `PublicTrackingPage.tsx` | Tracking | Medium; real/stale telemetry proof remains a later hardening item. |
| Drivers | Fleet driver management exists | `DriversPage.tsx`, fleet APIs | Drivers | Medium; dispatch eligibility/current vehicle fields need ongoing depth. |
| Vehicles | Fleet vehicle management exists | `VehiclesPage.tsx`, fleet APIs | Vehicles | Medium; dimensions/capacity/equipment need to feed optimizer readiness. |
| Customers | Customer records exist | `CustomersPage.tsx`, customers API | Customers | Medium; site constraints and recurring delivery rules need route-planner integration. |
| Reports | Analytics page exists under `/analytics` | `AnalyticsPage.tsx` | Reports | Medium; drilldowns to source records remain the 10/10 target. |
| Settings | Admin/settings page exists | `SettingsPage.tsx` | Settings | Medium; production auth, notifications, webhooks, billing, and launch config need hardening. |
| Driver mobile | Driver-only workspace and route execution flow exist | `DriverWorkspacePage.tsx`, `DriverRouteRunPage.tsx` | Driver proof flow | High; kept separate from operator-shell migration to avoid breaking mobile execution. |
