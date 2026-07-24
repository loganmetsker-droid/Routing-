# Assisted-Pilot Hosted Staging

Staging mirrors the production topology: Cloudflare serves the frontend; Render hosts Postgres, Redis, the Nest backend, and the routing service. Automatic provider deploys are disabled. `.github/workflows/release.yml` deploys an explicit 40-character commit SHA.

## Provisioning

1. Create the Render Blueprint from `render.yaml`. It provisions `trovan-postgres`, `trovan-redis`, `trovan-backend`, and `trovan-routing-service`.
2. Create protected GitHub `staging` and `production` environments. Production requires a human approval.
3. Configure Cloudflare credentials and URLs in the matching GitHub environment.
4. Configure every `sync: false` Render value. Keep secret values in Render or GitHub, never in source control.
5. Run **Promote Trovan Release** with `target=staging` and the exact SHA that passed CI.
6. Promote the same SHA to production only after the staging, operations, legal, and security gates are signed off.

## Required backend values

- URLs/security: `FRONTEND_URL`, `CORS_ORIGINS`, `METRICS_TOKEN`, `ROUTING_SERVICE_INTERNAL_TOKEN`
- WorkOS: `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_REDIRECT_URI`, `WORKOS_LOGOUT_REDIRECT_URI`
- Stripe test mode: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_LAUNCH`, `STRIPE_PRICE_SCALE`
- Postmark: `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`, `LEAD_INTAKE_EMAIL`, `LEAD_INTAKE_FROM_EMAIL`
- R2: `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`

The Blueprint supplies the database, Redis, routing host, and generated JWT secret. Keep:

```text
SELF_SERVE_BILLING_ENABLED=false
SMS_NOTIFICATIONS_ENABLED=false
LAUNCH_PROFILE=assisted-pilot
QUEUE_REQUIRED=true
STRICT_ENV_VALIDATION=true
```

Do not set `VITE_AUTH_BYPASS` or `VITE_MOCK_PREVIEW` in any hosted environment.

## Protected release environment

The GitHub environment must contain the provider deployment credentials, the environment's frontend/backend/routing URLs, a dispatcher auth token, a separate driver auth token, a WorkOS test account, metrics and routing tokens, Stripe test credentials, an outbound-webhook receiver, Postmark credentials, and R2 credentials. `scripts/launch-env-status.mjs` reports missing names without printing values.

## Verification

```sh
export STAGING_FRONTEND_URL="https://<cloudflare-staging-host>"
export STAGING_BACKEND_URL="https://<render-backend-host>"
export STAGING_ROUTING_SERVICE_URL="https://<render-routing-host>"
export PLAYWRIGHT_BASE_URL="$STAGING_FRONTEND_URL"
export PLAYWRIGHT_SKIP_WEBSERVER=true
export LAUNCH_AUDIT_API_URL="$STAGING_BACKEND_URL"
export LAUNCH_AUDIT_STRICT_OPTIMIZER=true

npm run launch:env-status
npm run staging:smoke
ROUTING_SERVICE_URL="$STAGING_ROUTING_SERVICE_URL" npm run smoke:optimizer
npm run test:e2e -- --project=chromium
```

Acceptance requires 200 responses from runtime and health checks, a 200 readiness response only when every pilot-critical dependency is available, authenticated dispatcher and driver workflows, tenant denial, lead persistence/delivery, proof-file persistence, webhook/API-key/Socket.IO security, Stripe test procedures, and `sitemap.xml` returned as XML. SMS is intentionally outside the pilot gate.
