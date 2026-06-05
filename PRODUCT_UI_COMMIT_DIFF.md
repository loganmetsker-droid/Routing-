# Product UI Commit Diff

Generated: 2026-06-02

Purpose: isolate actual Trovan routing/planning app UI work from public marketing work.

## Primary Product UI Target

`frontend/src/pages/RoutingWorkspacePage.tsx`

This file is not marketing-only. It affects the real route planning workspace used by dispatchers/operators.

## Candidate Files

| File | Status | Added | Deleted | Commit? | Actual routing app users? | Marketing/public-site only? |
|---|---|---:|---:|---|---|---|
| `frontend/src/pages/RoutingWorkspacePage.tsx` | modified | 1452 | 276 | Yes, after product UI review | Yes | No |
| `frontend/src/components/maps/MultiRouteMap.tsx` | modified | 47 | 24 | Yes, with UI review | Yes | No |
| `e2e/product-ui.spec.ts` | untracked | 105 | 0 | Yes | No direct runtime effect | No |
| `scripts/product-ui-audit.mjs` | untracked | 221 | 0 | Yes | No direct runtime effect | No |
| `PRODUCT_UI_REFACTOR_REPORT.md` | untracked | 120 | 0 | Yes | No direct runtime effect | No |
| `package.json` | modified | 4 | 0 | Yes, if keeping product audit script | No direct runtime effect | No |
| `frontend/src/components/maps/mapPresentation.tsx` | modified | 1 | 1 | Yes, if needed by app map layering | Yes | No |
| `frontend/src/features/dispatch/utils/opsMapData.ts` | modified | 16 | 4 | Yes, if route geometry/current vehicle start is desired | Yes | No |
| `frontend/src/services/roadRouteGeometry.ts` | untracked | 58 | 0 | Yes, if road-following route geometry is part of app UI | Yes | No |
| `frontend/src/services/roadRouteGeometry.test.ts` | untracked | 65 | 0 | Yes | No direct runtime effect | No |
| `frontend/src/App.tsx` | modified | 22 | 3 | Review carefully | Yes, changes protected route redirects and public route wiring | Mixed |
| `frontend/src/layout/AppShell.tsx` | modified | 2 | 0 | Yes | Yes, accessibility labels | No |
| `frontend/src/layout/navConfig.ts` | modified | 2 | 2 | Review | Yes | No |
| `frontend/src/main.tsx` | modified | 25 | 1 | Review | Yes, app boot/runtime behavior | No |
| `frontend/src/pages/LoginPage.tsx` | modified | 55 | 14 | Review | Yes | No |
| `frontend/src/services/api.preview.ts` | modified | 275 | 5 | Review | Yes, preview/local app data behavior | No |
| `frontend/src/services/api.preview.test.ts` | modified | 27 | 0 | Yes with preview changes | No direct runtime effect | No |
| `frontend/src/services/api.session.ts` | modified | 9 | 1 | Review | Yes | No |
| `frontend/src/services/plannerApi.ts` | modified | 58 | 11 | Review | Yes | No |
| `frontend/src/theme/designTokens.ts` | modified | 9 | 2 | Yes if UI tokens are intentional | Yes | No |
| `frontend/src/vite-env.d.ts` | modified | 4 | 0 | Yes if new env typing is used | Build-time | No |
| `frontend/vite.config.ts` | modified | 2 | 1 | Review | Build/runtime | No |

## Product UI Acceptance Criteria Mapping

| Requirement | Current status before next product pass |
|---|---|
| Left panel tabs: Jobs / Routes / Vehicles | Implemented and covered by `e2e/product-ui.spec.ts` |
| Map largest central workspace | Implemented and verified by `scripts/product-ui-audit.mjs` |
| Collapsible lane editor | Implemented with collapsed/expanded/full-screen states |
| Lane editor full-screen mode | Implemented |
| Comfortable / Compact density toggle | Implemented |
| Compact stop rows instead of cards | Implemented with table-like compact rows |
| Remove repeated `Lock` text | Implemented; stop rows show protected icons and actions moved to selected stop area |
| Selected route focus visible | Implemented in map, lane, and inspector states |
| Right inspector operational overview | Implemented as route readiness data |
| Action hierarchy | Implemented: Publish primary, Reoptimize secondary, Save draft tertiary |
| Search/filter for dense route days | Implemented |
| Route-day summary bar | Implemented |
| Product UI audit gate | Implemented and passed |
| Product UI screenshots/report | Implemented in `PRODUCT_UI_REFACTOR_REPORT.md` |

## Product Commit Message Suggestion

```bash
git commit -m "feat: refactor routing workspace for dense route days"
```

## Notes

- This should be separate from public marketing changes.
- This should be reviewed in the real authenticated/local app route, not inferred from homepage screenshots.
- Generated screenshots for the product report should live outside the repo or in an ignored artifact folder unless explicitly requested.
