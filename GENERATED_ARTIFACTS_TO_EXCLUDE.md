# Generated Artifacts To Exclude

Generated: 2026-06-02

Purpose: keep generated screenshots, dist files, temporary reports, and stale assets out of commits unless explicitly intended.

## Do Not Commit By Default

| Path | Approx size / count | Reason |
|---|---:|---|
| `frontend/dist/` | ~14 MB, 65 files | Build output; already ignored |
| `audit/screenshots/` | ~90 MB | Generated Playwright screenshot evidence |
| `audit/marketing-captures/` | ~1.2 MB | Generated capture intermediates |
| `audit/marketing-audit.json` | ~758 lines | Generated audit report |
| `audit/marketing-audit.md` | ~61 lines | Generated audit report |
| `audit/product-ui-audit.json` | generated | Generated product UI audit report |
| `audit/product-ui-audit.md` | generated | Generated product UI audit report |
| `.artifacts/product-ui-refactor/` | ~4 MB | Generated product UI screenshot evidence |
| Playwright traces/videos/reports | varies | Test output, not source |
| Coverage output | varies | Test output, not source |
| Temporary `/tmp/trovan-*` files | varies | Local review artifacts only |

## Consider Adding To `.gitignore`

```gitignore
audit/screenshots/
audit/marketing-captures/
audit/marketing-audit.json
audit/marketing-audit.md
audit/product-ui-audit.json
audit/product-ui-audit.md
.artifacts/
playwright-report/
test-results/
coverage/
```

`frontend/dist/` is already covered by the existing generic `dist/` ignore.

## Public Marketing Assets: Commit Only If Referenced

These are production assets, not temporary audit files, but they are binary and should be pruned before commit:

- `frontend/public/marketing/dispatch-board.png`
- `frontend/public/marketing/driver-workspace.png`
- `frontend/public/marketing/hero-route-command-center-v2.avif`
- `frontend/public/marketing/hero-route-command-center-v2.png`
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

## Stale Or Risky Asset

- `frontend/public/marketing/hero-route-command-center.png`
  - Recommendation: remove before commit if not referenced.
  - Reason: final audit expects `hero-route-command-center-v2.*` and no old hero references.

## Review Packet Location

The last manually prepared review packet was copied to:

```text
/tmp/trovan-final-artifacts/
```

That folder is outside the repo and should remain outside commits.
