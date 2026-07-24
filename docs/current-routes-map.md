# Trovan Current Routes Map

Updated: 2026-06-09

This maps the current React routes to the prototype-aligned operator modules. Public marketing and driver routes remain compatible and are not part of the first operator-shell visual pass.

| Current path | Current screen | Data/API source | Prototype destination | Notes |
|---|---|---|---|---|
| `/dashboard` | Operations dashboard | Jobs, routes, drivers, vehicles, dispatch board queries | Dashboard | Visual shell and shared theme migrated; deeper report cards remain iterative. |
| `/routing` | Routing workspace | Planner, jobs, fleet, route-run handoff APIs | Routing | Keep optimizer, blocker, publish, drag/drop, and route readiness behavior intact. |
| `/planning` | Routing workspace alias | Same as `/routing` | Routing | Compatibility alias remains. |
| `/dispatch` | Dispatch board | Route-run board/detail/action APIs | Dispatch | Existing API-backed sent-to-driver flow remains the execution source of truth. |
| `/tracking` | Tracking overview | Tracking overview/readiness/statistics APIs | Tracking | Prototype map-first visual pass follows shared theme; telemetry hardening remains later. |
| `/jobs` | Jobs queue | Jobs/customers APIs, import/create/update mutations | Jobs | Solid table header and shared theme applied; constraint intake remains the route-day hardening priority. |
| `/customers` | Customers page | Customers API | Customers | Preserved as first-class planning/customer constraints surface. |
| `/drivers` | Drivers page | Fleet drivers API | Drivers | Preserved for dispatch eligibility and current vehicle state. |
| `/vehicles` | Vehicles page | Fleet vehicles API | Vehicles | Preserved for capacity/equipment/readiness fields. |
| `/pod/*` | Proof of Delivery overview | Dispatch board route runs and route-run stops | Proof of Delivery | New first-class route. Shows proof-required stops and links to route-run detail. |
| `/route-runs/:id` | Route-run detail | Route-run detail, messages, proof artifacts, timeline APIs | Dispatch/POD detail | Remains the action surface for proof review and route execution detail. |
| `/exceptions` | Exceptions center | Exceptions and dispatch APIs | Exceptions | Preserved as first-class route-day blocker/action surface. |
| `/analytics` | Analytics page | Analytics/audit/reporting APIs | Reports | URL remains; shell label is now Reports. |
| `/settings` | Settings page | Org/admin/platform APIs | Settings | Preserved for integrations, users, notifications, API keys, and launch config. |
| `/driver` | Driver workspace | Driver manifest and route-run APIs | Driver mobile | Kept outside first operator-shell redesign. |
| `/driver/route-runs/:id` | Driver route execution | Driver stop/proof/message APIs | Driver proof flow | Kept outside first operator-shell redesign. |
| `/track/:token` | Public tracking | Public tracking token API | Public tracking | Compatibility preserved. |
