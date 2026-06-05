# Trovan Product UI Staging Plan

Generated: 2026-06-04

Scope: actual Trovan routing application UI only. Do not deploy, commit, or stage from this plan without separate user approval.

This plan intentionally excludes the public marketing website, Cloudflare/deploy artifacts, backend/security hardening, generated screenshots, generated audit snapshots, build output, and stale review packets.

## 1. Product UI Files To Include

| File | Current status | Lines added / deleted | Commit? | Affects actual routing app users? | Marketing/public-site only? | Notes |
|---|---:|---:|---:|---:|---:|---|
| `frontend/src/pages/RoutingWorkspacePage.tsx` | Modified | +997 / -390 | Yes | Yes | No | Main dispatcher route-planning workspace refactor: map-first layout, route-day metrics, blocker-aware actions, tab state, density, lane drawer, map modes, route inspector wiring, and dense/setup scenarios. |
| `frontend/src/pages/routing-workspace/RoutingWorkspaceComponents.tsx` | Untracked new file | +1575 / -0 | Yes | Yes | No | Extracted real app UI components: summary bar, left-panel tabs, tab-specific filters, density toggle, compact rows, lane editor drawer, route inspector, and search/filter helpers. |
| `frontend/src/pages/routing-workspace/densePlannerScenario.ts` | Untracked new file | +215 / -0 | Yes | Yes, local stress/test scenario | No | Dense route-day fixture for product UI stress testing: 8 routes, 120 routed stops, 12 unassigned jobs, 8 vehicles, locked/late-risk/exception data. Not for marketing screenshots. |
| `frontend/src/components/maps/MultiRouteMap.tsx` | Modified | +358 / -35 | Yes | Yes | No | Actual app map decluttering: zoom-aware render levels, selected/all/density/exceptions display modes, route clusters, marker budget, exception markers, selected route emphasis, muted unrelated routes. |
| `frontend/src/features/dispatch/utils/opsMapData.ts` | Modified | +46 / -4 | Yes | Yes | No | Supplies route-map stop metadata for lock, exception, late-risk, blocking, priority/status, and vehicle-start geometry used by the product map. |
| `frontend/src/services/plannerApi.ts` | Modified | +58 / -11 | Yes | Yes | No | Preview/planner data support for realistic route lanes and API response unwrapping. Product-app behavior, not marketing copy. |
| `frontend/src/services/roadRouteGeometry.ts` | Untracked new file | +58 / -0 | Yes | Yes | No | Road-following route geometry helper imported by the routing workspace. Include with the workspace source so the build remains complete. |

## 2. Product Tests / Audit Files To Include

| File | Current status | Lines added / deleted | Commit? | Affects actual routing app users? | Marketing/public-site only? | Notes |
|---|---:|---:|---:|---:|---:|---|
| `e2e/product-ui.spec.ts` | Untracked new file | +279 / -0 | Yes | No direct runtime effect | No | Product Playwright coverage for tabs, tab-specific filters, density, lane drawer states, route focus, map modes, compact identity, blocker-aware actions, miles/date semantics, and dense map decluttering. |
| `scripts/product-ui-audit.mjs` | Untracked new file | +451 / -0 | Yes | No direct runtime effect | No | Product-only audit gate for the real routing workspace, including map dominance, tab stacking, compact rows, km/date/action blockers, selected-route decluttering, marker budget, clusters, and exception visibility. |
| `frontend/src/services/roadRouteGeometry.test.ts` | Untracked new file | +65 / -0 | Yes | No direct runtime effect | No | Unit tests for the road route geometry helper. |

## 3. Generated Artifacts To Exclude

| Path | Commit? | Affects actual routing app users? | Marketing/public-site only? | Notes |
|---|---:|---:|---:|---|
| `.artifacts/product-ui-refactor/**` | No | No | No | Product review screenshots only. Share as evidence, but do not commit by default. |
| `.artifacts/ui-audit/**` | No | No | No | Historical/generated screenshots. |
| `.artifacts/trovan-actual-routing-ui/**` | No | No | No | Historical route screenshots/videos. |
| `.artifacts/live-backups/**` | No | No | No | Deployment backups. Never mix with product UI staging. |
| `.artifacts/dev/**` | No | No | No | Local server logs/PIDs. |
| `audit/product-ui-audit.json` | No by default | No | No | Generated audit output. Attach/share separately if needed. |
| `audit/product-ui-audit.md` | No by default | No | No | Generated audit output. Attach/share separately if needed. |
| `audit/**` marketing outputs | No | No | Yes | Generated marketing audit artifacts. |
| `.tmp/**` | No | No | No | Playwright temporary output. |
| `frontend/dist/**` | No | No | No | Build output. |
| `playwright-report*/**`, traces, videos, screenshots | No | No | No | Debug-only generated artifacts. |
| `PRODUCT_UI_REFACTOR_REPORT.md` | No by default | No | No | Review report with screenshots/test notes. Keep out of code staging unless the user explicitly wants reports committed. |
| `PRODUCT_UI_COMMIT_PLAN.md` | No by default | No | No | This staging plan. Useful locally; commit only if the user wants review docs in the branch. |
| `PRODUCT_UI_COMMIT_DIFF.md`, `REVIEW_DIFF_SUMMARY.md`, `GENERATED_ARTIFACTS_TO_EXCLUDE.md` | No by default | No | No | Review/cleanup artifacts from prior passes. |

## 4. Marketing / Public-Site Files To Exclude

| File / Path | Commit in product UI pass? | Affects actual routing app users? | Marketing/public-site only? | Notes |
|---|---:|---:|---:|---|
| `frontend/src/pages/PublicLaunchPage.tsx` | No | No | Yes | Public marketing page work, explicitly out of scope now. |
| `frontend/src/pages/public-site/**` | No | No | Yes | Public site module. |
| `frontend/public/marketing/**` | No | No | Yes | Marketing screenshot/assets. |
| `e2e/launch-audit.spec.ts` | No | No | Yes | Public launch audit. |
| `scripts/marketing-site-audit.mjs` | No | No | Yes | Marketing audit script. |
| `scripts/assert-marketing-audit-artifacts.mjs` | No | No | Yes | Marketing artifact assertion script. |
| `scripts/capture-marketing-screenshots.ts` | No | No | Yes | Marketing screenshot capture script. |
| `frontend/index.html` | No | No | Yes | Public metadata/favicon changes. |
| `frontend/public/sw.js` | No | Maybe | Maybe | Public/service-worker work from earlier passes. Keep out of this product-only staging set. |
| `frontend/src/App.tsx` | No for this pass | Maybe | Maybe | Contains public route work. Only include later after a separate route-wiring review. |
| `frontend/src/layout/AppShell.tsx`, `frontend/src/layout/navConfig.ts`, `frontend/src/main.tsx`, `frontend/src/vite-env.d.ts`, `frontend/vite.config.ts`, `frontend/package.json` | No for this pass | Maybe | Maybe | App shell/tooling changes from earlier passes. They are not required for the current routing workspace staging set. |

## 5. Backend / Security Files To Exclude

| File / Path | Commit in product UI pass? | Affects actual routing app users? | Marketing/public-site only? | Notes |
|---|---:|---:|---:|---|
| `backend/**` | No | Maybe | No | Backend/security/planning work from earlier passes. Do not mix with product UI refactor. |
| `backend/src/schema.gql` | No | Maybe | No | Backend generated/schema output from earlier work. |
| `SECURITY_HARDENING_REPORT.md` | No | No | No | Security report from an earlier pass. |
| `render.yaml` | No | Maybe | No | Deploy/config work, not product UI. |
| `scripts/launch-env-status.mjs`, `scripts/optimizer-smoke.mjs`, `scripts/mvp-launch-next-step.mjs` | No | No direct runtime effect | No | Launch/backend/ops scripts from earlier passes. |
| `docs/launch/**`, `docs/mvp-launch-operator.md` | No | No | Maybe | Launch docs, not actual routing UI. |

## 6. Ambiguous Files Requiring User Approval

| File | Recommended handling | Why ambiguous |
|---|---|---|
| `package.json` | Stage only the `audit:product-ui` script hunk, or leave unstaged and run `node scripts/product-ui-audit.mjs` directly. | The file currently also contains marketing and MVP launch script additions (`audit:marketing`, `capture:marketing-screenshots`, `launch:mvp-next`) that should not enter a product-only commit unless separately approved. |
| `.gitignore` | Include only if the user wants a cleanup hunk for `.artifacts/` and `.codex/`; otherwise leave unstaged. | Useful for excluding generated artifacts, but it is repo hygiene rather than routing UI behavior. |
| `frontend/src/components/maps/mapPresentation.tsx` | Leave unstaged unless map overlay z-index is confirmed necessary for the real app screenshots. | Actual app map helper, but the change is a one-line presentation tweak from earlier visual passes. |
| `frontend/src/theme/designTokens.ts` | Leave unstaged unless the route palette/font change is approved as part of product UI. | Includes brand/font and route-color token changes that may affect public and app surfaces. |
| `frontend/src/components/maps/opsRouteMapUtils.ts` or other shared map helpers if they become dirty later | Review before staging. | Shared map helpers can affect dispatch/tracking beyond the planning page. |
| `PRODUCT_UI_REFACTOR_REPORT.md` and this plan | Do not include by default; include only if the review packet should live in git. | They are useful review artifacts, not runtime/test code. |

## Recommended Product-Only Staging List

Stage these exact files for the product UI code/test/audit set:

```text
frontend/src/pages/RoutingWorkspacePage.tsx
frontend/src/pages/routing-workspace/RoutingWorkspaceComponents.tsx
frontend/src/pages/routing-workspace/densePlannerScenario.ts
frontend/src/components/maps/MultiRouteMap.tsx
frontend/src/features/dispatch/utils/opsMapData.ts
frontend/src/services/plannerApi.ts
frontend/src/services/roadRouteGeometry.ts
frontend/src/services/roadRouteGeometry.test.ts
e2e/product-ui.spec.ts
scripts/product-ui-audit.mjs
```

Optional partial hunk only, not whole-file staging:

```text
package.json    # only "audit:product-ui": "node scripts/product-ui-audit.mjs"
```

Do not stage `audit/**`, `.artifacts/**`, `frontend/dist/**`, marketing/public-site files, backend/security files, or launch/deploy files for this product-only pass.
