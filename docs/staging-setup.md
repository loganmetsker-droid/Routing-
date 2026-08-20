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
- Geocoding: `GEOCODING_PROVIDER=mapbox`, `GEOCODING_API_KEY`
- Monitoring: `ERROR_MONITORING_WEBHOOK_URL`, `ERROR_MONITORING_WEBHOOK_TOKEN`, `ERROR_MONITORING_TEST_READBACK_URL`, `ERROR_MONITORING_TEST_ACK_URL`. The disposable receiver must support lookup by the `eventId` query parameter and acknowledgement by POST; the acknowledgement URL may contain an `{eventId}` placeholder.
- Sensitive fields: `ACCESS_CODE_ENCRYPTION_KEY`, `ACCESS_CODE_KEY_VERSION`
- Stripe test mode: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_LAUNCH`, `STRIPE_PRICE_SCALE`, `STRIPE_ALLOW_TEST_EXERCISE=true`. The gate rejects live keys, verifies the canonical $399/$899 monthly prices, creates a sales-assisted `send_invoice` subscription, schedules period-end cancellation, simulates a decline, completes a test refund, and removes the synthetic customer/subscription.
- Postmark: `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`, `LEAD_INTAKE_EMAIL`, `LEAD_INTAKE_FROM_EMAIL`, `POSTMARK_WEBHOOK_USERNAME`, `POSTMARK_WEBHOOK_PASSWORD`, `POSTMARK_BOUNCE_HASH_KEY`; the protected GitHub staging environment also needs `POSTMARK_BOUNCE_WEBHOOK_URL`. Configure that URL as Postmark's bounce hook with the same Basic-auth username/password. Strict smoke proves the operator message reaches a `Delivered` event and a synthetic soft bounce is authenticated, persisted with a hashed recipient, and routed to monitoring.
- R2: `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`

## Required routing-service values

- `ROUTING_SERVICE_INTERNAL_TOKEN`
- `ROUTING_MATRIX_PROVIDER=osrm`
- `ROUTING_MATRIX_BASE_URL`, `ROUTING_MATRIX_PROVIDER_LABEL`, `ROUTING_MATRIX_TOKEN`
- `ROUTING_MATRIX_ALLOW_FALLBACK=false`
- `TROVAN_SOLVER_VERSION`

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

The GitHub environment must contain the provider deployment credentials, the environment's frontend/backend/routing URLs, a dispatcher auth token, an OWNER/ADMIN token for a genuinely different organization (`STAGING_SECOND_ORG_AUTH_TOKEN`), a separate driver auth token, an already-expired staging JWT (`STAGING_EXPIRED_AUTH_TOKEN`), WorkOS hosted/test credentials, Mapbox and contracted matrix credentials, metrics/routing/monitoring/encryption secrets, Stripe test credentials, an outbound-webhook receiver, Postmark credentials, and R2 credentials. `scripts/launch-env-status.mjs` reports missing names without printing values. The two organization tokens must resolve to distinct organization IDs; strict smoke creates a scoped API key, proves the other organization cannot list or revoke it, and confirms the primary key remains usable. The expired JWT must have a valid staging signature and an `exp` claim in the past; it is used only to prove the hosted expiry path rejects stale sessions.

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

Acceptance requires the exact release SHA in frontend metadata plus backend and routing health, 200 responses from runtime and health checks, a 200 readiness response only when every pilot-critical dependency is available, road-network optimizer provenance with no fallback, authenticated dispatcher and driver workflows, tenant denial, a record created before WorkOS logout and read back through a newly authenticated browser session, lead persistence plus Postmark delivery/bounce readback, proof-file persistence plus byte-verified R2 delete/restore/re-read, webhook/API-key/Socket.IO security, Stripe test procedures, protected metrics, and `sitemap.xml` returned as XML. SMS is intentionally outside the pilot gate.
