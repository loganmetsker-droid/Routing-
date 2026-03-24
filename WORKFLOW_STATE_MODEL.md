# Routing Platform Workflow State Model (Sprint 8)

This document defines the canonical operational lifecycle for Jobs and Routes, and how it maps to the currently implemented backend enums for backward compatibility.

## Optimization/Data Quality Contract

Planning and route responses now include explicit optimization metadata:

- `optimizationStatus`: `optimized | degraded | failed`
- `dataQuality`: `live | degraded | simulated`
- `planningWarnings`: warning messages surfaced to dispatch operators
- `droppedJobIds`: infeasible/unassigned jobs from optimization/planning
- `workflowStatus`: UI-facing workflow label (`ready_for_dispatch`, `degraded`, `rerouting`, etc.)

Dispatch API now also exposes optimizer system health:

- `GET /api/dispatch/optimizer/health`
- health fields include `status`, `circuitOpen`, `consecutiveFailures`, and latest success/failure timestamps.
- event model endpoint for fallback/health history:
  - `GET /api/dispatch/optimizer/events` (in-memory model, persistence-ready contract)

## Reroute / Exception Workflow (Sprint 4)

Reroutes are explicit and auditable through request/review/apply flow:

- `POST /api/dispatch/routes/:id/reroute/request`
- `POST /api/dispatch/routes/:id/reroute/:requestId/approve`
- `POST /api/dispatch/routes/:id/reroute/:requestId/reject`
- `POST /api/dispatch/routes/:id/reroute/:requestId/apply`
- `GET /api/dispatch/routes/:id/reroute/history`

Supported exception categories:

- `urgent_insert`
- `vehicle_unavailable`
- `driver_unavailable`
- `missed_time_window`
- `traffic_delay`
- `customer_not_ready`
- `no_show`
- `capacity_issue`

Supported reroute actions:

- `reorder_stops`
- `reassign_stop_to_route`
- `split_route`
- `hold_stop`
- `remove_stop`
- `reassign_driver`

Reroute audit record captures:

- request metadata (category/action/reason/request payload)
- review metadata (approve/reject actor and note)
- apply metadata (applied payload/actor)
- before/after snapshots
- impact summary (stop-order change, dropped/inserted jobs, distance/duration deltas, degraded/simulated implications)
- planner diagnostics payload (per-job infeasibility/diagnostic map)

Dispatch gating rule in UI:

- Dispatch remains blocked while route reroute state is `requested` or `approved` (until applied or rejected), and review gate remains required.

## Persistence & Advanced Actions (Sprint 5)

### Persisted route workflow status

- `routes.workflow_status` persisted enum path added for:
  - `planned`
  - `ready_for_dispatch`
  - `in_progress`
  - `rerouting`
  - `degraded`
  - `completed`
  - `cancelled`
- Migration-safe compatibility remains:
  - legacy `status` is still persisted and used for backward compatibility
  - workflow status is derived/synced from legacy status + reroute/data-quality signals.

### Queryable timeline model

- `dispatch_events` table provides queryable history for:
  - optimizer health/fallback events
  - reroute lifecycle events
  - route workflow transitions
- API read-model:
  - `GET /api/dispatch/timeline?routeId=<uuid>&limit=<n>`
  - `GET /api/dispatch/optimizer/events?limit=<n>`
- Retention strategy:
  - service-level prune by retention window (`DISPATCH_EVENT_RETENTION_DAYS`, default 30).

### Action-specific reroute validation

Each reroute action validates required payload shape before request/apply:

- `reorder_stops`: requires `newJobOrder` with full current route set
- `reassign_stop_to_route`: requires `jobId` in route
- `remove_stop`: requires `jobId` in route
- `hold_stop`: requires `jobId` in route
- `reassign_driver`: requires `driverId`
- `split_route`: requires `splitAtIndex` creating non-empty parent/child segments

### split_route behavior (implemented)

- On apply:
  - parent route split at `splitAtIndex`
  - child route created
  - moved jobs reassigned to child route
  - job `assignedRouteId` updated
  - reroute impact/audit and timeline events recorded

### What-if preview support

- API:
  - `POST /api/dispatch/routes/:id/reroute/preview`
- Preview returns:
  - before/after snapshots
  - distance/duration deltas
  - dropped/inserted job effects
  - implied degraded/simulated implications

## Advanced Constraints & Diagnostics (Sprint 6)

Preview/apply reroute flows now evaluate deterministic operational constraints and return structured diagnostics/reason codes.

### Constraint checks in preview + apply

- vehicle/job capacity:
  - `CAPACITY_WEIGHT_EXCEEDED`
  - `CAPACITY_VOLUME_EXCEEDED`
- time windows + service duration assumptions:
  - `TIME_WINDOW_VIOLATION`
- skills/equipment requirements (payload-driven by job):
  - `SKILL_MISMATCH`
- workflow/route compatibility:
  - `WORKFLOW_INCOMPATIBLE`
  - `TARGET_ROUTE_REQUIRED`
  - `TARGET_ROUTE_NOT_FOUND`
  - `TARGET_ROUTE_INCOMPATIBLE`
- payload/data integrity:
  - `JOB_DATA_MISSING`

### Preview/apply diagnostic payload shape

- `constraintDiagnostics.feasible`
- `constraintDiagnostics.reasonCodes[]`
- `constraintDiagnostics.infeasibleJobReasonCodes{ jobId -> reasonCodes[] }`
- `constraintDiagnostics.impactedJobIds[]`
- `constraintDiagnostics.capacityConflicts[]`
- `constraintDiagnostics.timeWindowViolations[]`
- `constraintDiagnostics.skillMismatches[]`
- `constraintDiagnostics.warnings[]`

### Reroute alternatives surfaced in preview

- `keep_current_route`
- `reorder_only`
- `split_route`
- `move_stop_to_other_route`
- `hold_or_remove_stop`

Alternatives are deterministic hints (not autonomous reroute execution) and include `feasible` flags.

### split_route and reassign consistency hardening

- `split_route` now runs post-split consistency checks for parent/child job sets.
- `reassign_stop_to_route` requires `targetRouteId` and performs explicit move to target route on apply.
- Constraint-failed apply attempts are logged in dispatch timeline (`REROUTE_APPLY_BLOCKED_CONSTRAINTS`).

### Timeline/audit propagation

- Preview generation emits timeline event (`REROUTE_PREVIEW_GENERATED`) with feasibility/reason codes.
- Request/apply audit data stores advanced constraints + alternatives in planner diagnostics.
- Degraded/simulated implications remain explicit through preview/apply and route metadata.

## Vertical Constraint Packs + Override (Sprint 7)

### Pluggable pack framework

- Core pack registry supports registration and selection of deterministic constraint packs.
- Pack interface includes:
  - `id`, `label`
  - `applies(context)` for conditional execution
  - `evaluate(context)` for diagnostics/reason codes/warnings
- Pack diagnostics are merged into core reroute diagnostics without hard-coding vertical rules into generic constraint logic.

### Pack-aware diagnostics contract

- `constraintDiagnostics.selectedPackId`
- `constraintDiagnostics.packDiagnostics[]` with:
  - `packId`
  - `feasible`
  - `reasonCodes[]`
  - `warnings[]`
  - optional `details`

Pack reason-code namespace is string-based and supports vertical prefixes such as:
- `CONCRETE_*` for construction/concrete diagnostics.

### Pilot pack: construction/concrete

Initial pilot pack id:
- `construction_concrete`

Pilot checks (where model data is available):
- concrete pour timing/delay semantics
- required equipment tags vs vehicle equipment tags
- required operator skill tags
- site readiness hooks

Example pilot reason codes:
- `CONCRETE_SITE_NOT_READY`
- `CONCRETE_EQUIPMENT_REQUIRED`
- `CONCRETE_OPERATOR_SKILL_REQUIRED`
- `CONCRETE_POUR_WINDOW_VIOLATION`

### Operator override workflow (audited)

Apply API supports explicit override fields:
- `overrideRequested`
- `overrideReason` (required and validated when override is requested)
- `overrideActor`

Behavior:
- infeasible apply without override remains blocked
- infeasible apply with valid override proceeds and is audited
- timeline records override event with actor/reason/reason-codes
- reroute planner diagnostics store override metadata (`actor`, `reason`, timestamp, blocked reason-codes)

### Timeline querying extensions

Dispatch timeline endpoint supports additional filters/pagination cursor:
- `reasonCode`
- `action`
- `actor`
- `source`
- `before`

This enables richer operational audit/history analysis for reroute and override flows.

## Indexed Timeline + Policy + Scoring (Sprint 8)

### Structured dispatch timeline indexing

`dispatch_events` now supports structured/index-friendly fields in addition to payload:
- `reason_code`
- `action`
- `actor`
- `pack_id`

Timeline query supports:
- `routeId`
- `source`
- `reasonCode`
- `action`
- `actor`
- `packId`
- `before`
- `limit`

Filtering prefers structured fields and retains payload-text fallback for backward compatibility.

### Override policy enforcement matrix

Override apply still requires:
- `overrideRequested=true`
- `overrideReason` (validated minimum detail)
- audited actor/timestamp data

Policy enforcement now adds role/reason-code checks:
- role-aware allow/deny (`admin`, `dispatcher`, `viewer`)
- hard-deny reason codes for unsafe/inconsistent states
- dispatcher-scoped allowed reason-code matrix
- explicit policy denial errors returned by API for UI visibility

### Deterministic feasibility scoring + alternative ranking

Preview/apply diagnostics now include route-level scoring/ranking primitives:
- `feasibilityScore` (0-100 deterministic penalty model)
- `conflictSummary` (`critical`, `major`, `minor`, `total`)
- ranked alternatives with:
  - `rank`
  - `score`
  - `rationale`
  - `tradeoffs`

Scores/ranks are deterministic and derived from:
- reason-code penalty weights
- dropped-job effects
- distance/duration deltas
- known conflict classes

### Diagnostics rendering consistency in touched route consumers

In touched route consumers, diagnostics can now surface richer signals beyond warnings:
- reason-code snippets
- feasibility score/conflict summaries where available
- pack identity context when active

## Canonical Job Lifecycle

Target model:

- `draft` (optional)
- `ready_to_plan`
- `planned`
- `dispatched`
- `in_progress`
- `exception`
- `completed`
- `archived`
- `cancelled`

Current backend mapping (`JobStatus`):

- `draft` -> `unscheduled` (normalized to `pending` in service layer)
- `ready_to_plan` -> `pending`
- `planned` -> `assigned`
- `dispatched` -> `assigned` (pre-start staging)
- `in_progress` -> `in_progress`
- `exception` -> `failed`
- `completed` -> `completed`
- `archived` -> `archived`
- `cancelled` -> `cancelled`

Server-side transition enforcement (normalized statuses):

- `pending` -> `assigned | in_progress | cancelled | archived | failed`
- `assigned` -> `in_progress | cancelled | archived | failed`
- `in_progress` -> `completed | failed | cancelled`
- `completed` -> `archived`
- `failed` -> `pending | assigned | cancelled | archived`
- `cancelled` -> `pending | archived`
- `archived` -> (terminal)

## Canonical Route Lifecycle

Target model:

- `draft`
- `planned`
- `ready_for_dispatch`
- `dispatched`
- `in_progress`
- `rerouting`
- `completed`
- `cancelled`
- `degraded`

Current backend mapping (`RouteStatus`):

- `draft` -> `planned`
- `planned` -> `planned`
- `ready_for_dispatch` -> `assigned` (normalized alias accepted on updates)
- `dispatched` -> `in_progress`
- `in_progress` -> `in_progress`
- `rerouting` -> `in_progress` (normalized alias accepted on updates; represented via `workflowStatus`)
- `degraded` -> `in_progress` + `dataQuality=degraded|simulated` (represented via `workflowStatus`)
- `completed` -> `completed`
- `cancelled` -> `cancelled`

Server-side transition enforcement:

- `planned` -> `assigned | in_progress | cancelled`
- `assigned` -> `planned | in_progress | cancelled`
- `in_progress` -> `completed | cancelled`
- `completed` -> (terminal)
- `cancelled` -> `planned`

Incoming route-status aliases accepted by API updates:

- `ready_for_dispatch` -> `assigned`
- `dispatched` -> `in_progress`
- `rerouting` -> `in_progress`
- `degraded` -> `in_progress`

## Operational Notes

- Legacy enum values `unscheduled` and `scheduled` are normalized in `JobsService` to `pending` and `assigned`.
- Route and job transitions are now validated server-side before updates.
- Legacy `/api/routes` compatibility endpoints remain available but now inherit JWT protection (no longer public).
- Tracking and dispatch UI now label simulated/degraded data states where real telemetry/geometry is unavailable.
- Fallback planner outputs are marked as `optimizationStatus=degraded` and `dataQuality=simulated`.
