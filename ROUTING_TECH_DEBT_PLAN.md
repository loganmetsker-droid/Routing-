# Routing Tech Debt Reduction Plan

## Goals
- Make production routing behavior predictable across frontend (Vercel) and backend (Render).
- Remove API contract drift between UI calls and backend endpoints.
- Eliminate duplicate/dead routing stacks and deployment confusion.

## Phase 1: Contract Stabilization (Now)
- Standardize backend REST paths to `/api/*` via Nest global prefix + controller paths without duplicated `api/`.
- Keep response shape backward compatible (`{ jobs }`, `{ routes }`, `{ drivers }`, `{ vehicles }`).
- Keep legacy payload compatibility for current UI (archive flags, missing job time windows).
- Add SPA rewrite fallback for Vercel so deep links resolve to `index.html`.
- Normalize frontend API base URLs to prevent `/api/api/*` failures.

## Phase 2: Runtime Consolidation (Next)
- Pick one backend runtime (Nest) as the only production path.
- Decommission or archive legacy `backend/server.js` and `backend/api/index.ts` after parity checks.
- Remove duplicated deployment docs that conflict (Vercel backend vs Render backend instructions).

## Phase 3: API Client Refactor
- Replace per-page `fetch` duplication with a single typed API client layer.
- Centralize endpoint building and response normalization.
- Add request/response schema checks (zod or class-validator at boundary).

## Phase 4: Reliability and Security
- Restore role-based guards with real auth wiring (currently permissive for compatibility).
- Replace wildcard WebSocket/SSE CORS with explicit frontend origin allowlist.
- Add health checks for DB + queue + routing dependencies.

## Phase 5: Test and Deploy Guardrails
- Add integration tests for key routes:
  - `/api/jobs` create/update/archive
  - `/api/dispatch/routes` create/assign/reorder
  - `/api/drivers`, `/api/vehicles`, `/api/customers` CRUD basics
- Add end-to-end smoke tests for Vercel frontend against Render staging backend.
- Require passing build + smoke before `main` deploy.

## Deployment Topology
- Frontend: Vercel (`frontend/`)
- Backend: Render (`backend/`)
- Database: Render PostgreSQL (`DATABASE_URL`)
- Optional queue: Redis (`REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`)

## Immediate Follow-ups
1. Run full local build/tests with Node 20+ and npm available.
2. Deploy backend to Render and verify `/health` and `/stream-route`.
3. Deploy/redeploy frontend on Vercel with correct env vars.
4. Run post-deploy smoke on live URLs and capture regressions.
