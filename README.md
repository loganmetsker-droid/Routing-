# Routing

Routing is a REST-first routing and dispatch workspace with a React frontend, a NestJS backend, shared request/response contracts, and a dedicated routing-service for optimization workloads.

## Canonical Architecture

- `frontend/`: Vite + React operator UI. The runtime data path is REST plus React Query.
- `backend/`: NestJS API for auth, jobs, fleet, dispatch, route plans, tracking, and route-run execution.
- `shared/contracts/`: shared payload contracts used by the frontend service layer.
- `routing-service/`: optimization and routing worker service.

Frontend runtime notes:

- `frontend/src/services/api.ts` is a barrel only.
- Preview/mock data is isolated in `frontend/src/services/api.preview.ts`.
- Apollo and legacy route aliases are intentionally removed from the live app path.
- The premium product slice now includes:
  - dispatcher analytics backed by `/api/metrics/overview`
  - a dedicated driver workspace at `/driver`
  - public branded tracking links at `/track/:token`
  - installable PWA manifest and service worker assets in `frontend/public/`

Backend runtime notes:

- Canonical dispatch endpoints live under `/api/dispatch/*`.
- `/api/auth/*` now exposes:
  - managed auth configuration truth at `GET /api/auth/config`
  - WorkOS AuthKit redirect bootstrapping at `GET /api/auth/workos/authorize-url`
  - provider callback exchange at `POST /api/auth/workos/callback`
  - session/device inventory at `GET /api/auth/sessions`
- The legacy `/api/routes` compatibility controller has been removed.
- Dispatch event logging, optimizer health, route presentation, and route versioning helpers are split into focused services under `backend/src/modules/dispatch/services/`.
- GraphQL is still enabled as a backend compatibility surface, but the frontend does not depend on it.
- Organization admin settings now live under `organizations.settings.*` and are managed through `/api/organizations/current/settings`.
- Team membership and invite administration now live under:
  - `GET /api/organizations/current/members`
  - `GET /api/organizations/current/invitations`
  - `POST /api/organizations/current/invitations`
- Route-run share links and the public tracking payload are served by:
  - `POST /api/route-runs/:id/share-link`
  - `GET /api/public/tracking/:token`
- Driver execution manifests are served by `GET /api/driver/manifest`.
- External API and webhook admin surfaces are now live under `/api/platform/*`.

## Quick Start

1. Install workspace dependencies from the repo root.

```bash
npm install
```

2. Run the backend.

```bash
cd backend
npm run dev
```

3. Run the frontend in a separate terminal.

```bash
cd frontend
npm run dev
```

Optional:

- Run `routing-service/` if you want live optimization instead of fallback behavior.
- Set `VITE_AUTH_BYPASS=true` for local preview mode.
- Run `npm run bootstrap:local` to generate `backend/.env.local` with a fresh JWT secret and local runtime guidance.
- Use `npm run smoke:local` from the repo root to confirm backend/frontend health endpoints and local Postgres reachability.
- For managed auth, configure `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, and `WORKOS_REDIRECT_URI`.
- For live customer comms, configure Postmark and Twilio.
- For self-serve billing, configure Stripe keys and price IDs.
- For proof storage outside local dev, configure the R2 variables in `backend/.env.local.example`.

Admin surfaces now available in the live UI:

- `/settings` now manages:
  - organization branding, notification defaults, retention policy, and WorkOS identity linkage
  - session/device revocation
  - organization members and invitations
  - scoped API keys
  - webhook endpoints, signing-secret rotation, and failed-delivery replay
- `/analytics` shows live operational KPIs from `/api/metrics/overview`.
- `/driver` shows the driver manifest workspace.
- `/track/:token` renders the branded public delivery tracking portal.
- `/auth/callback` completes the WorkOS AuthKit redirect flow.

## Build And Test

From the repo root:

```bash
npm install
cd frontend && npm run build
cd ../backend && npm run build
npm test
```

Useful docs:

- `SETUP_DATABASE.md`
- `TESTING_GUIDE.md`
- `TROUBLESHOOTING.md`
- `OSRM_SETUP.md`
- `docs/security-baseline.md`
- `docs/restore-routing-system.md`

## Current Cleanup Direction

- Shared REST contracts in `shared/contracts` are the frontend source of truth.
- Preview mode is supported, but isolated from live transport modules.
- Legacy UI aliases and the legacy REST routes controller are retired.
- Dispatch orchestration is being split into maintainable domain services instead of one append-only class.
