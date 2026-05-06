# Launch Readiness

Date: 2026-05-06
Scope: `/Users/logan/Desktop/Routing`

## Status

The application is closer to launch: backend/frontend tests pass, the workspace build passes, the JavaScript dependency audit is clean, Socket.IO tenant boundaries are hardened, and Render backend env guardrails are now declared.

This is not a public-launch approval yet. The remaining blockers are environment, deployment, routing-service verification, and final staging smoke evidence.

## Verified Checks

Run with:

```sh
export PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH"
```

Passed on 2026-05-06:

- `npm run test --workspace=backend` (`34` files, `117` tests)
- `npm run test --workspace=frontend -- --run` (`6` files, `8` tests)
- `npm run build --workspaces`
- `npm audit --workspaces --audit-level=moderate`
- `npm audit --workspaces --omit=dev --audit-level=moderate`
- `npm run check:backend-deps`
- `git diff --check`

Still blocked locally:

- `python3 -m pytest routing-service/tests` because the active Python does not have `pytest` installed. Before launch, run this in a Python environment compatible with `routing-service/requirements.txt` and `ortools==9.8.3296`.

## Launch Blockers

- Configure and verify production Render env vars: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, WorkOS redirect/logout URLs, `FRONTEND_URL`, `CORS_ORIGINS`, `METRICS_TOKEN`, Stripe/Postmark/Twilio/R2 values for enabled features.
- Decide and configure frontend hosting. `render.yaml` currently declares the backend service only.
- Verify the routing-service test suite and optimizer smoke path in a compatible Python environment or container.
- Run a staging smoke with real WorkOS login, authenticated Socket.IO connection, dispatch route creation, public tracking, billing readiness, webhook delivery/replay, and `/health/readiness`.
- Choose a production dependency reproducibility strategy. The repo currently ignores `package-lock.json`; public launch should use a tracked lockfile or exact deploy artifact strategy.
- Decide whether outbound webhooks need a customer-domain allowlist plus DNS/IP private-address blocking before public self-serve use.

## Go / No-Go

Go for private staging hardening and pilot demos after production-like env is populated.

No-go for public launch until frontend hosting, routing-service verification, production secrets, staging smoke, and dependency reproducibility are closed.

## Next Work Order

1. Configure Render/staging env and frontend deploy target.
2. Verify routing-service in a Python 3.11/3.12 environment or container.
3. Run the staging smoke suite and record evidence.
4. Close webhook DNS/IP allowlist if webhooks are customer-configurable at launch.
5. Start AI/chat only after the launch gates above are green or explicitly deferred.
