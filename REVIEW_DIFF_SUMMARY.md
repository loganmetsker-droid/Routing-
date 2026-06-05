# Review Diff Summary

Generated: 2026-06-02

This is a review-only summary of the current working tree in `/Users/logan/Desktop/Routing`. No deployment was performed.

## Commands Run

- `git diff --stat`
- `git diff --name-only`
- `git diff -- frontend/src`
  - Full output saved locally to `/tmp/trovan_git_diff_frontend_src.patch`
  - Output length: 3,254 lines
- `git diff -- frontend/src/pages/RoutingWorkspacePage.tsx`
  - Full output saved locally to `/tmp/trovan_git_diff_routing_workspace.patch`
  - Output length: 1,324 lines
- `git status --short`

## Top-Level Read

- Tracked diff: 53 files, 3,037 insertions, 1,260 deletions.
- Untracked generated/media footprint is much larger than the tracked source diff.
- `audit/` is about 91 MB, mostly generated Playwright screenshots.
- `frontend/public/marketing/` is about 10 MB of public-site media assets.
- `frontend/dist/` is ignored, about 14 MB, 65 files.

## 1. Actual Product App UI Changes

This group includes actual product app/runtime changes. Some are not UI, but they affect protected app routes, backend behavior, preview/session behavior, routing, security, or app shell behavior.

Summary:

| Files | Lines added | Lines deleted | Should commit? | Affects actual routing app users? | Marketing/public-site only? |
|---:|---:|---:|---|---|---|
| 47 | 2,993 | 320 | Review carefully before commit; do not bundle blindly with marketing-only work | Yes | No |

Files changed:

- `.gitignore` (+2/-0)
  - Adds `.artifacts/` and `.codex/`.
  - Should commit: yes, if these are intended local-only folders.
- `SECURITY_HARDENING_REPORT.md` (+723/-0)
  - Product/security documentation.
  - Should commit: maybe, but review separately from website work.
- Backend/runtime/security files:
  - `backend/src/common/api/api-exception.filter.ts` (+22/-2)
  - `backend/src/common/http/content-disposition.util.ts` (+7/-0)
  - `backend/src/common/http/cors-origin.util.ts` (+34/-3)
  - `backend/src/common/http/metrics-auth.util.ts` (+13/-4)
  - `backend/src/common/http/outbound-webhook-url.util.ts` (+12/-0)
  - `backend/src/common/http/request-context.middleware.ts` (+23/-4)
  - `backend/src/common/http/request-logging.middleware.ts` (+62/-8)
  - `backend/src/common/websocket/socket-auth.util.ts` (+9/-2)
  - `backend/src/main.ts` (+4/-0)
  - `backend/src/modules/auth/strategies/jwt.strategy.ts` (+33/-2)
  - `backend/src/modules/dispatch/dispatch.service.ts` (+6/-1)
  - `backend/src/modules/dispatch/route-runs.controller.ts` (+4/-3)
  - `backend/src/modules/dispatch/route-runs.service.ts` (+18/-2)
  - `backend/src/modules/jobs/jobs.processor.ts` (+15/-8)
  - `backend/src/modules/planning/planning.service.ts` (+75/-20)
  - `backend/src/modules/platform/api-key-auth.guard.ts` (+17/-7)
  - `backend/src/modules/subscriptions/subscriptions.controller.ts` (+8/-3)
  - `backend/src/schema.gql` (+0/-6)
  - Should commit: only after backend-focused review and tests. These are not marketing-only.
- New backend utility/docs files:
  - `backend/src/common/files/proof-file.util.ts` (+90/-0, untracked)
  - `backend/src/common/http/trust-proxy.util.ts` (+48/-0, untracked)
  - `backend/src/common/logging/bull-job-log.util.ts` (+34/-0, untracked)
  - `backend/src/common/routing/optimize-request-log.util.ts` (+78/-0, untracked)
  - `docs/launch/mvp-seed-dataset.json` (+119/-0, untracked)
  - `docs/mvp-launch-operator.md` (+54/-0, untracked)
  - `docs/superpowers/plans/2026-05-20-trovan-fleetio-inspired-public-shell.md` (+83/-0, untracked)
  - Should commit: maybe, but they are outside the public-site review scope and should not be swept into a website-only commit without review.
- App shell, routing, login, map, preview, and planner files:
  - `frontend/package.json` (+1/-1)
  - `frontend/public/sw.js` (+14/-2)
  - `frontend/src/App.tsx` (+22/-3)
  - `frontend/src/components/maps/MultiRouteMap.tsx` (+16/-13)
  - `frontend/src/components/maps/mapPresentation.tsx` (+1/-1)
  - `frontend/src/features/dispatch/utils/opsMapData.ts` (+16/-4)
  - `frontend/src/layout/AppShell.tsx` (+2/-0)
  - `frontend/src/layout/navConfig.ts` (+2/-2)
  - `frontend/src/main.tsx` (+25/-1)
  - `frontend/src/pages/LoginPage.tsx` (+55/-14)
  - `frontend/src/pages/RoutingWorkspacePage.tsx` (+826/-182)
  - `frontend/src/services/api.preview.ts` (+275/-5)
  - `frontend/src/services/api.session.ts` (+9/-1)
  - `frontend/src/services/plannerApi.ts` (+58/-11)
  - `frontend/src/services/roadRouteGeometry.ts` (+58/-0, untracked)
  - `frontend/src/theme/designTokens.ts` (+9/-2)
  - `frontend/src/vite-env.d.ts` (+4/-0)
  - `frontend/vite.config.ts` (+2/-1)
  - `package.json` (+3/-0)
  - `render.yaml` (+2/-2)
  - Should commit: only after deciding these product-app changes belong in the same branch. `RoutingWorkspacePage.tsx` especially affects the actual planning workspace and should get product UI review.

Product-user impact notes:

- `frontend/src/App.tsx` changes public/protected routing and redirects authenticated users to `/dashboard`.
- `frontend/src/pages/RoutingWorkspacePage.tsx` adds marketing capture mode, seeded route data, route density/focus UI, route movement state, date/distance formatting, and road-route geometry integration. This can affect real planner users if not carefully isolated.
- `frontend/src/components/maps/MultiRouteMap.tsx` changes real map line thickness, dashed lines, marker sizing, and route fitting behavior.
- Backend/security changes may affect API behavior, auth, logging, CORS, request context, webhooks, metrics, planning, dispatch, and subscriptions.

## 2. Public Marketing Website Changes

Summary:

| Files | Lines added | Lines deleted | Should commit? | Affects actual routing app users? | Marketing/public-site only? |
|---:|---:|---:|---|---|---|
| 5 | 3,987 | 915 | Yes, if this website pass is accepted | Mostly no, except route registration in `App.tsx` is in group 1 | Yes |

Files changed:

- `frontend/index.html` (+1/-1)
- `frontend/src/pages/PublicLaunchPage.tsx` (+2/-914)
- `frontend/public/_headers` (+7/-0, untracked)
- `frontend/src/pages/public-site/PublicSite.tsx` (+3,492/-0, untracked)
- `frontend/src/pages/public-site/publicSiteData.ts` (+485/-0, untracked)

Change meaning:

- The old large `PublicLaunchPage.tsx` appears to have been collapsed into a wrapper while the real public site moved into `frontend/src/pages/public-site/`.
- This is a cleaner architecture for the public marketing site, but it is a large untracked new module and should be reviewed before commit.
- These files should affect public marketing pages, not logged-in app workflows, except where routes are wired through `frontend/src/App.tsx`.

## 3. Test/Audit Script Changes

Summary:

| Files | Lines added | Lines deleted | Should commit? | Affects actual routing app users? | Marketing/public-site only? |
|---:|---:|---:|---|---|---|
| 28 | 2,373 | 25 | Mostly yes for tests/scripts that prove intended behavior; review backend specs separately | No direct runtime effect | Mostly test/audit, some backend-focused |

Files changed:

- Existing tracked tests/scripts:
  - `backend/src/common/http/content-disposition.util.spec.ts` (+7/-0)
  - `backend/src/common/http/cors-origin.util.spec.ts` (+43/-1)
  - `backend/src/common/http/metrics-auth.util.spec.ts` (+16/-0)
  - `backend/src/common/http/outbound-webhook-url.util.spec.ts` (+14/-0)
  - `backend/src/common/http/request-logging.middleware.spec.ts` (+65/-0)
  - `backend/src/common/websocket/socket-auth.util.spec.ts` (+24/-0)
  - `backend/src/modules/dispatch/route-runs.service.spec.ts` (+29/-0)
  - `backend/src/modules/planning/planning.service.spec.ts` (+16/-2)
  - `e2e/launch-audit.spec.ts` (+330/-20)
  - `frontend/src/services/api.preview.test.ts` (+27/-0)
  - `scripts/launch-env-status.mjs` (+7/-1)
  - `scripts/optimizer-smoke.mjs` (+27/-1)
- New untracked tests/config/scripts:
  - `backend/src/common/api/api-exception.filter.spec.ts` (+69/-0)
  - `backend/src/common/files/proof-file.util.spec.ts` (+48/-0)
  - `backend/src/common/http/request-context.middleware.spec.ts` (+45/-0)
  - `backend/src/common/http/trust-proxy.util.spec.ts` (+50/-0)
  - `backend/src/common/logging/bull-job-log.util.spec.ts` (+32/-0)
  - `backend/src/common/routing/optimize-request-log.util.spec.ts` (+64/-0)
  - `backend/src/modules/auth/strategies/jwt.strategy.spec.ts` (+40/-0)
  - `backend/src/modules/platform/api-key-auth.guard.spec.ts` (+109/-0)
  - `backend/src/modules/subscriptions/subscriptions.controller.spec.ts` (+56/-0)
  - `frontend/eslint.config.js` (+51/-0)
  - `frontend/src/pages/public-site/publicSiteData.test.ts` (+75/-0)
  - `frontend/src/services/roadRouteGeometry.test.ts` (+65/-0)
  - `scripts/assert-marketing-audit-artifacts.mjs` (+187/-0)
  - `scripts/capture-marketing-screenshots.ts` (+176/-0)
  - `scripts/marketing-site-audit.mjs` (+474/-0)
  - `scripts/mvp-launch-next-step.mjs` (+227/-0)

Commit guidance:

- Commit `scripts/assert-marketing-audit-artifacts.mjs` and `scripts/marketing-site-audit.mjs` if the public-site audit gate is part of the workflow.
- Commit `e2e/launch-audit.spec.ts` if the public launch checks are expected to run in CI or local QA.
- Commit `scripts/capture-marketing-screenshots.ts` only if future screenshot capture should be reproducible.
- Backend test files should be reviewed with the backend/security changes rather than bundled blindly into a marketing-only commit.

## 4. Generated Screenshots/Assets

Summary:

| Files | Text lines added | Binary files | Approx size | Should commit? | Affects actual routing app users? | Marketing/public-site only? |
|---:|---:|---:|---:|---|---|---|
| 95 | 128 | 94 | ~95 MB | Split: commit curated public assets only; do not commit audit screenshots/captures | No runtime effect unless referenced as public assets | Yes |

Generated audit/capture files that should generally not be committed:

- `audit/screenshots/` (about 90 MB)
  - 63 generated route screenshots for desktop, tablet, and mobile.
  - Recommendation: do not commit. Add `audit/screenshots/` to `.gitignore` if these are only local QA artifacts.
- `audit/marketing-captures/` (about 1.2 MB)
  - AVIF/PNG captures plus `manifest.json`.
  - Recommendation: do not commit unless the capture manifest is intentionally part of the repo; otherwise ignore.

Curated public marketing media assets:

- `frontend/public/marketing/dispatch-board.png`
- `frontend/public/marketing/driver-workspace.png`
- `frontend/public/marketing/hero-route-command-center-v2.avif`
- `frontend/public/marketing/hero-route-command-center-v2.png`
- `frontend/public/marketing/hero-route-command-center.png`
- `frontend/public/marketing/proof-workspace.png`
- `frontend/public/marketing/public-launch.png`
- `frontend/public/marketing/routing-multistop-workspace-dotted.png`
- `frontend/public/marketing/routing-multistop-workspace.png`
- `frontend/public/marketing/routing-workspace-dotted.png`
- `frontend/public/marketing/routing-workspace.png`
- `frontend/public/marketing/tracking-workspace.png`
- `frontend/public/marketing/trovan-route-day-demo.mp4`
- `frontend/public/marketing/trovan-route-rebalance-demo.mp4`
- `frontend/public/marketing/trovan-route-rebalance-poster.png`

Commit guidance:

- Commit only the curated assets actually referenced by the public website.
- Strongly consider removing `frontend/public/marketing/hero-route-command-center.png` if the final audit requires no stale old hero reference and the site no longer uses it.
- The two MP4 files should be committed only if they are intentionally used by the marketing site and file size is acceptable.

## 5. Generated Audit Reports

Summary:

| Files | Lines added | Lines deleted | Should commit? | Affects actual routing app users? | Marketing/public-site only? |
|---:|---:|---:|---|---|---|
| 2 | 819 | 0 | Usually no; commit only if this repo intentionally stores review evidence | No | Yes |

Files changed:

- `audit/marketing-audit.json` (+758/-0, untracked)
- `audit/marketing-audit.md` (+61/-0, untracked)

Commit guidance:

- These are generated reports from the last local production-build audit.
- Keep as review artifacts outside the commit unless the team wants audit snapshots versioned.
- Recommended `.gitignore` additions if not versioning reports:
  - `audit/marketing-audit.json`
  - `audit/marketing-audit.md`

## 6. Build/Dist/Generated Files That Should Not Be Committed

Summary:

| Files | Lines added/deleted | Should commit? | Affects actual routing app users? | Marketing/public-site only? |
|---:|---|---|---|---|
| 65 ignored files under `frontend/dist/` | Not in git diff | No | No source effect | Build output only |

Files/folders observed:

- `frontend/dist/` is ignored and currently about 14 MB.
- No tracked `frontend/dist` files appear in `git status --short`.

Commit guidance:

- Do not commit `frontend/dist/`.
- Current `.gitignore` already ignores generic `dist/`, which covers `frontend/dist/`.
- If any build output later appears as untracked, add the exact generated path to `.gitignore`.

## Recommendations Before Commit

1. Split the work into separate commits or branches:
   - Public marketing site source.
   - Actual product app/planning workspace changes.
   - Backend/security/runtime changes.
   - Tests and audit scripts.
   - Curated marketing assets.
2. Do not commit generated audit screenshots:
   - `audit/screenshots/`
   - `audit/marketing-captures/`
3. Do not commit generated audit reports unless intentionally storing evidence:
   - `audit/marketing-audit.json`
   - `audit/marketing-audit.md`
4. Review whether `frontend/public/marketing/hero-route-command-center.png` should be removed. It is the old hero asset and should not be needed if the v2 hero is final.
5. Keep `frontend/public/marketing/` assets only if they are referenced by the site and are acceptable to version as binary media.
6. Treat `frontend/src/pages/RoutingWorkspacePage.tsx` as a real app change, not a marketing-only change. It touches the actual planning UI and should be reviewed with product-app expectations.
7. Treat backend/security changes as a separate review track from the website. They are meaningful runtime changes and should not be hidden inside a public-site commit.

## Raw Command Output Locations

- `/tmp/trovan_git_diff_stat.txt`
- `/tmp/trovan_git_diff_name_only.txt`
- `/tmp/trovan_git_diff_frontend_src.patch`
- `/tmp/trovan_git_diff_routing_workspace.patch`
- `/tmp/trovan_git_status_short.txt`
- `/tmp/trovan_git_diff_numstat.txt`
- `/tmp/trovan_untracked_files.txt`
- `/tmp/trovan_generated_status.txt`
