# Dispatch SaaS Foundation Blueprint

This blueprint defines the target architecture and product surface that the versioned phases are meant to deliver.

## Product Direction

Build a focused dispatch planning and execution product first.

Do not build:

- A generalized multi-industry routing platform
- An enterprise fleet suite
- A research-grade optimization engine

Build:

- A narrow dispatch planning tool
- A stable heuristic optimizer
- Strong dispatcher manual control
- Execution tracking
- Exception handling
- Basic SaaS foundations

## Recommended Architecture

Use a modular monolith.

Why:

- Faster delivery
- Lower operational overhead
- Easier schema evolution
- Easier refactoring while the product is still changing

## Proposed Top-Level Layout

```text
apps/
  web/
  api/

packages/
  domain/
  optimizer/
  validation/
  ui/

infra/
  migrations/
  seeds/
  scripts/
  docker/
```

## Backend Module Boundaries

```text
api/src/modules/
  auth/
  organizations/
  users/
  depots/
  drivers/
  vehicles/
  jobs/
  planning/
  route-plans/
  route-runs/
  assignments/
  optimizer/
  dispatch/
  exceptions/
  proofs/
  audit/
  admin/
  realtime/
```

## Data Model Summary

Core entities:

- `organizations`
- `users`
- `organization_memberships`
- `depots`
- `drivers`
- `vehicles`
- `jobs`
- `job_stops`
- `route_plans`
- `route_plan_stops`
- `route_runs`
- `route_run_stops`
- `route_assignments`
- `stop_events`
- `exceptions`
- `proof_artifacts`
- `audit_logs`

Core principles:

- Every business record belongs to an organization
- Planning is separate from execution
- Jobs are not stops
- Assignments are explicit
- Events and audits are append-only where appropriate

## API Style

Use REST for now.

Prefer:

- Query endpoints for read models
- Command endpoints for mutations and workflow actions
- Organization-scoped handlers
- Validated input on every write

Avoid:

- Controller-heavy business logic
- Frontend-shaped database models
- Raw optimizer JSON endpoints exposed to the UI

## Key Endpoints

Auth and org:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /organizations`
- `GET /organizations/current`
- `PATCH /organizations/current`

Setup data:

- `GET /depots`
- `POST /depots`
- `GET /drivers`
- `POST /drivers`
- `GET /vehicles`
- `POST /vehicles`

Jobs:

- `GET /jobs`
- `POST /jobs`
- `POST /jobs/import`
- `POST /jobs/:id/stops`
- `PATCH /job-stops/:id`

Planning:

- `GET /planner?serviceDate=YYYY-MM-DD`
- `POST /route-plans`
- `POST /route-plans/:id/generate-draft`
- `POST /route-plans/:id/reoptimize`
- `POST /route-plans/:id/publish`
- `POST /route-plans/:id/stops/reorder`
- `POST /route-plans/:id/stops/move`
- `POST /route-plans/:id/stops/lock`
- `POST /route-plans/:id/stops/unlock`

Dispatch and execution:

- `GET /dispatch/board?serviceDate=YYYY-MM-DD`
- `GET /route-runs`
- `GET /route-runs/:id`
- `POST /route-runs/:id/dispatch`
- `POST /route-runs/:id/start`
- `POST /route-runs/:id/complete`
- `POST /route-runs/:id/reassign`
- `POST /route-run-stops/:id/mark-en-route`
- `POST /route-run-stops/:id/mark-arrived`
- `POST /route-run-stops/:id/mark-serviced`
- `POST /route-run-stops/:id/mark-failed`

Exceptions and audit:

- `GET /exceptions`
- `POST /exceptions`
- `POST /exceptions/:id/acknowledge`
- `POST /exceptions/:id/resolve`
- `GET /audit`
- `GET /route-runs/:id/timeline`
- `GET /route-run-stops/:id/timeline`

## Realtime Rules

The database is the source of truth.

Realtime should only broadcast changes derived from durable writes:

- `planner.updated`
- `route-plan.updated`
- `route-run.updated`
- `route-run-stop.updated`
- `exception.created`
- `exception.updated`
- `assignment.updated`

## Screen Inventory

Priority order:

1. Login and auth
2. Organization setup
3. Data setup for depots, drivers, vehicles
4. Jobs intake
5. Planning workspace
6. Route detail editor
7. Dispatch board
8. Route run detail
9. Exceptions queue
10. Job detail
11. Reporting and activity
12. Settings and admin
13. Minimal driver view later

## First Two Core Screens

Planning workspace:

- Left: unassigned jobs
- Center: route cards
- Right: route detail and ordered stops
- Optional synchronized map

Dispatch board:

- All route runs for the day
- Status by route
- Exception count
- Late or at-risk indicators
- Route progress
- Assignment issues

## Current Repo Implication

This repo already contains useful modules for `auth`, `drivers`, `vehicles`, `jobs`, `dispatch`, `tracking`, and subscriptions. The main architectural shift is not to split into microservices, but to re-shape the monolith around:

- Planning vs execution separation
- Tenant and audit boundaries
- Manual dispatcher control
- Narrow optimizer responsibilities
