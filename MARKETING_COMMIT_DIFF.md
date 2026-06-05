# Marketing Commit Diff

Generated: 2026-06-02

Purpose: isolate the public marketing website work from the actual routing application UI refactor.

## Suggested Commit Scope

Commit this group only if the public Trovan marketing-site pass is still wanted.

## Candidate Files

| File | Status | Added | Deleted | Commit? | Actual routing app users? | Marketing/public-site only? |
|---|---|---:|---:|---|---|---|
| `frontend/index.html` | modified | 1 | 1 | Yes | No | Yes |
| `frontend/src/pages/PublicLaunchPage.tsx` | modified | 2 | 914 | Yes | No | Yes |
| `frontend/src/pages/public-site/PublicSite.tsx` | untracked | 3492 | 0 | Yes, after review | No | Yes |
| `frontend/src/pages/public-site/publicSiteData.ts` | untracked | 485 | 0 | Yes, after review | No | Yes |
| `frontend/src/pages/public-site/publicSiteData.test.ts` | untracked | 75 | 0 | Yes | No | Yes/test |
| `frontend/public/_headers` | untracked | 7 | 0 | Yes if deploying static headers | No | Mostly public-site deploy behavior |

## Related But Not Marketing-Only

| File | Why it is related | Commit here? |
|---|---|---|
| `frontend/src/App.tsx` | Wires public routes to `PublicLaunchPage`, but also changes protected app redirect behavior | No, review with app-routing/product changes |
| `e2e/launch-audit.spec.ts` | Contains public launch and screenshot-frame checks | Better in test/audit commit |
| `scripts/marketing-site-audit.mjs` | Marketing audit gate | Better in test/audit commit |
| `scripts/assert-marketing-audit-artifacts.mjs` | Marketing artifact assertion gate | Better in test/audit commit |

## Marketing Assets To Include Only If Referenced

These live in `frontend/public/marketing/` and are production public-site media, not temporary audit output.

- `dispatch-board.png`
- `driver-workspace.png`
- `hero-route-command-center-v2.avif`
- `hero-route-command-center-v2.png`
- `proof-workspace.png`
- `public-launch.png`
- `routing-multistop-workspace-dotted.png`
- `routing-multistop-workspace.png`
- `routing-workspace-dotted.png`
- `routing-workspace.png`
- `tracking-workspace.png`
- `trovan-route-day-demo.mp4`
- `trovan-route-rebalance-demo.mp4`
- `trovan-route-rebalance-poster.png`

## Exclude From Marketing Commit Unless Still Used

- `frontend/public/marketing/hero-route-command-center.png`
  - Reason: this is the stale old hero asset. The final audit expects v2 references.

## Commit Message Suggestion

```bash
git commit -m "feat: add Trovan public marketing site"
```

## Notes

- Do not mix this with `RoutingWorkspacePage.tsx` product UI changes.
- Do not include `audit/screenshots/`, `audit/marketing-captures/`, `frontend/dist/`, Playwright traces, or generated audit reports in this commit.
