# Routing SaaS Canonical Spec + API Contract + Event Model + 30-Day Build Schedule

This document turns the routing-only architecture into a build-ready artifact that Codex tasks can reference directly.

---

## 1) Canonical Domain Model (v1)

### Design invariants
- Every tenant-owned table includes `tenant_id`.
- No write endpoint ships without idempotency support.
- All business-critical state transitions emit append-only audit events.
- Solver output is **draft** until explicitly published.
- Route publication creates an immutable route version.

### Core entities

#### `tenants`
- `id` (uuid, pk)
- `name` (text)
- `status` (enum: active, suspended)
- `created_at`, `updated_at`

#### `users`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk tenants.id)
- `email` (citext)
- `display_name` (text)
- `is_active` (bool)
- `created_at`, `updated_at`

#### `roles`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `name` (enum/string: admin, dispatcher, viewer, driver_manager)
- `created_at`, `updated_at`

#### `drivers`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `external_ref` (text, nullable)
- `name` (text)
- `phone` (text)
- `status` (enum: offline, available, on_route)
- `created_at`, `updated_at`

#### `vehicles`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `name` (text)
- `capacity_weight`, `capacity_volume` (numeric)
- `status` (enum: available, maintenance, unavailable)
- `created_at`, `updated_at`

#### `jobs`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `external_ref` (text)
- `customer_name`, `customer_phone` (text)
- `address_raw` (text)
- `lat`, `lng` (numeric, nullable)
- `service_time_seconds` (int)
- `priority` (int)
- `status` (enum: pending, validated, assigned, completed, failed)
- `created_at`, `updated_at`

#### `job_time_windows`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `job_id` (uuid, fk jobs.id)
- `window_start`, `window_end` (timestamptz)

#### `routes`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `route_number` (text)
- `version` (int)
- `status` (enum: draft, published, started, completed, canceled)
- `driver_id` (uuid, fk drivers.id, nullable)
- `vehicle_id` (uuid, fk vehicles.id, nullable)
- `planned_start_at`, `planned_end_at` (timestamptz)
- `published_at` (timestamptz, nullable)
- `created_at`, `updated_at`

#### `route_stops`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `route_id` (uuid, fk routes.id)
- `job_id` (uuid, fk jobs.id)
- `sequence` (int)
- `eta` (timestamptz)
- `status` (enum: planned, arrived, completed, failed, skipped)

#### `assignments`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `route_id` (uuid, fk)
- `driver_id` (uuid, fk)
- `vehicle_id` (uuid, fk)
- `assigned_by` (uuid, fk users.id)
- `assigned_at` (timestamptz)

#### `telemetry_points`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `driver_id` (uuid, fk)
- `route_id` (uuid, fk, nullable)
- `lat`, `lng` (numeric)
- `speed_kph` (numeric, nullable)
- `recorded_at` (timestamptz)

#### `proofs_of_delivery`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `stop_id` (uuid, fk route_stops.id)
- `photo_url` (text, nullable)
- `signature_url` (text, nullable)
- `notes` (text, nullable)
- `captured_at` (timestamptz)

#### `notifications`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `channel` (enum: sms, push, email)
- `recipient` (text)
- `template_key` (text)
- `status` (enum: pending, sent, failed)
- `provider_message_id` (text, nullable)
- `sent_at` (timestamptz, nullable)

#### `exceptions`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `route_id` (uuid, fk, nullable)
- `stop_id` (uuid, fk, nullable)
- `type` (enum: delay, customer_unavailable, failed_delivery, vehicle_breakdown)
- `status` (enum: open, resolved)
- `details` (jsonb)
- `created_at`, `resolved_at`

#### `idempotency_keys`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `key` (text)
- `request_hash` (text)
- `response_status` (int)
- `response_body` (jsonb)
- `created_at`

#### `audit_events`
- `id` (uuid, pk)
- `tenant_id` (uuid, fk)
- `event_name` (text)
- `entity_type` (text)
- `entity_id` (uuid)
- `actor_user_id` (uuid, nullable)
- `metadata` (jsonb)
- `occurred_at` (timestamptz)

---

## 2) Canonical API Contract (v1)

### Conventions
- Prefix all routes with `/v1`.
- Tenant derived from auth context (no free-form tenant override).
- Mutating operations accept `Idempotency-Key` header.
- All responses include `request_id` for traceability.

### Auth + tenant
- `POST /v1/auth/login`
- `GET /v1/auth/me`

### Jobs
- `POST /v1/jobs`
- `GET /v1/jobs`
- `GET /v1/jobs/{job_id}`
- `PATCH /v1/jobs/{job_id}`
- `POST /v1/jobs/import-csv`
- `POST /v1/jobs/{job_id}/validate`

### Drivers + vehicles
- `POST /v1/drivers`, `GET /v1/drivers`, `PATCH /v1/drivers/{driver_id}`
- `POST /v1/vehicles`, `GET /v1/vehicles`, `PATCH /v1/vehicles/{vehicle_id}`

### Routing
- `POST /v1/routing/solve` (creates draft route set)
- `POST /v1/routes/{route_id}/replan`
- `POST /v1/routes/{route_id}/publish`
- `GET /v1/routes`
- `GET /v1/routes/{route_id}`

### Dispatch execution
- `POST /v1/routes/{route_id}/assign`
- `POST /v1/routes/{route_id}/start`
- `POST /v1/stops/{stop_id}/arrive`
- `POST /v1/stops/{stop_id}/complete`
- `POST /v1/stops/{stop_id}/fail`

### Driver telemetry + POD
- `POST /v1/telemetry/heartbeat`
- `POST /v1/stops/{stop_id}/pod`

### Exceptions + notifications
- `POST /v1/exceptions`
- `POST /v1/exceptions/{exception_id}/resolve`
- `GET /v1/notifications`

---

## 3) Canonical Event Names (append-only)

- `job.created`
- `job.updated`
- `job.validated`
- `job.geocoded`
- `job.assigned`
- `job.unassigned`
- `route.planned`
- `route.replanned`
- `route.published`
- `route.started`
- `route.completed`
- `stop.arrived`
- `stop.completed`
- `stop.failed`
- `pod.captured`
- `exception.created`
- `exception.resolved`
- `notification.sent`

Event envelope:
```json
{
  "event_id": "uuid",
  "event_name": "route.published",
  "tenant_id": "uuid",
  "entity_type": "route",
  "entity_id": "uuid",
  "actor_user_id": "uuid-or-null",
  "occurred_at": "2026-04-03T12:00:00Z",
  "metadata": {}
}
```

---

## 4) 30-Day Execution Schedule (Routing SaaS Only)

### Week 1: Foundation + control plane
- Day 1: Monorepo folders + base tooling + local boot script.
- Day 2: Postgres + Redis wiring + migration framework.
- Day 3: Tenant auth middleware + RBAC skeleton.
- Day 4: Health, smoke tests, structured logging.
- Day 5: Backup + restore scripts and CI pipeline.

### Week 2: Job intake + clean backlog
- Day 6: Job schema + CRUD + list filters.
- Day 7: Idempotency middleware for writes.
- Day 8: CSV import endpoint + parsing.
- Day 9: Validation + dedupe + low-confidence address flagging.
- Day 10: Geocoding async worker + retry handling.

### Week 3: Dispatcher + routing v1
- Day 11: Dispatcher shell (backlog, route list, detail panel).
- Day 12: Map/table dual view + keyboard-first interactions.
- Day 13: Assign/reassign workflows + undo support.
- Day 14: OR-Tools solve endpoint (VRPTW baseline).
- Day 15: Draft/publish route workflow + route versioning.

### Week 4: Driver execution + realtime ops
- Day 16: Driver Today + stop detail flow (Flutter).
- Day 17: Start/arrive/complete transitions + optimistic sync.
- Day 18: POD capture + offline queue.
- Day 19: Telemetry heartbeat + ETA recalculation.
- Day 20: Exception handling + reassignment actions.

### Final hardening sprint (Days 21-30)
- Day 21-22: Notification templates + delivery logs + retry paths.
- Day 23-24: Tenant settings, usage metering, billing events.
- Day 25-26: KPI dashboards + audit log viewer.
- Day 27: Security pass (MFA admin, rate limits, secret rotation checks).
- Day 28: Backup/restore drill + incident runbook walk-through.
- Day 29: Full E2E smoke run + solver/notification failure simulations.
- Day 30: Pilot-readiness checklist and cut RC1.

---

## 5) Copy-Paste Codex Prompt Pack (ordered)

1. **Repo scaffold**
   - “Create a monorepo structure with `apps/web`, `apps/mobile`, `apps/api`, `apps/worker`, plus `services`, `packages`, `docs`, and `infra`. Add root scripts so one command boots local dev.”

2. **Schema + migrations**
   - “Implement migrations for tenants, users, roles, drivers, vehicles, jobs, job_time_windows, routes, route_stops, assignments, idempotency_keys, and audit_events with tenant_id on every tenant-owned table.”

3. **Tenant auth + RBAC**
   - “Implement tenant-aware auth middleware and RBAC (admin, dispatcher, viewer). Add tests that reject cross-tenant access attempts.”

4. **Jobs + idempotency**
   - “Build job CRUD endpoints with idempotency key support for all writes and emit audit events on create/update.”

5. **CSV import**
   - “Add CSV job import with row-level validation, dedupe by external reference + address hash, and a clear import error report.”

6. **Dispatcher shell**
   - “Create a dispatcher web shell with unassigned backlog, route list, and route detail panel. Ensure keyboard accessibility for core actions.”

7. **Assignments UI/API**
   - “Add assign/reassign APIs and dispatcher actions with undo support and audit events for each state transition.”

8. **Routing service contract**
   - “Build `/v1/routing/solve` contract and OR-Tools VRPTW baseline solver with timeout behavior that returns best feasible draft solution.”

9. **Publish flow**
   - “Add route draft vs published separation, route versioning, and `route.published` events. Prevent driver app from seeing unpublished routes.”

10. **Driver core app**
   - “Implement Flutter Today screen, stop detail, and start/arrive/complete transitions with offline queue and sync indicator.”

11. **POD + telemetry**
   - “Add proof-of-delivery upload flow and telemetry heartbeat ingestion with ETA recalculation + late-risk flags.”

12. **Ops hardening**
   - “Add backup/restore scripts, smoke tests, CI checks, and failure simulation tests for solver timeout and notification retry paths.”

---

## 6) Definition of Done Gates (must pass)

- Tenant isolation tests pass for all protected endpoints.
- Idempotency tests pass for all external write endpoints.
- Route publish gating enforced (draft not visible to driver app).
- Audit events emitted for all critical transitions.
- Backup/restore drill completed in non-local environment.
- Dispatcher core workflow executable without spreadsheet fallback.

