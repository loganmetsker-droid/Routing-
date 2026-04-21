# Trovan UI Hardening Audit

Date: 2026-03-25

## Build blockers fixed

- `frontend/src/pages/Dashboard.tsx`
  - normalized the quick-action button radius usage to the shared Trovan shell tokens
  - retained the already-correct unused stop placeholder form in the route preview mapper
- `frontend/src/pages/JobsPageEnhancedV2.tsx`
  - removed the duplicate local `Customer` interface
  - switched the page to the shared `Customer` type exported by `frontend/src/services/api.ts`
- `frontend/src/types/dispatch.ts`
  - added optional `eta?: string` to `DispatchRoute` so tracking and route map consumers use the shared route model consistently

## Pages audited

- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/DispatchUnifiedV2.tsx`
- `frontend/src/pages/TrackingEnhanced.tsx`
- `frontend/src/pages/JobsPageEnhancedV2.tsx`
- `frontend/src/pages/CustomersPage.tsx`
- `frontend/src/pages/DriversPage.tsx`
- `frontend/src/pages/VehiclesPage.tsx`

## Local overrides removed or normalized

- `Dashboard`
  - aligned the quick-action surface and route summary card radii to shared shell tokens
  - aligned quick-action button radii to the shared rectangular scale
- `CustomersPage`
  - replaced the table wrapper's local shadow suppression and ad hoc radius with a shared border + token radius treatment
  - replaced hardcoded `grey.100` header fill with `action.hover` so it follows the active theme better
- `DriversPage`
  - same table wrapper normalization as Customers
  - same table header background normalization
- `VehiclesPage`
  - replaced the stronger card hover shadow with shared Trovan soft/hover elevations
  - aligned vehicle icon panel radius/background to the shared surface rhythm

## Remaining visual debt intentionally deferred

- `DispatchUnifiedV2.tsx` still contains a number of page-local panel styles, but many are already token-backed and not currently breaking the shell
- `TrackingEnhanced.tsx` still has some local map and alert spacing rules; they are not currently causing build or obvious layout issues
- `JobsPageEnhancedV2.tsx` still contains several page-local surface styles, but they are internally consistent and not the worst source of token drift compared with the audited data tables and vehicle cards
- the frontend build still emits a large chunk warning from Vite; that is a bundling optimization task, not a UI hardening blocker
