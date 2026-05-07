# Hosted Staging Setup

This is the launch staging setup packet for the `codex/route-optimization-objectives` release candidate.

## Render Blueprint

Use the repository `loganmetsker-droid/Routing-` and the branch `codex/route-optimization-objectives` until PR #2 is merged.

The blueprint now declares:

- `trovan-backend`
- `trovan-frontend`
- `trovan-routing-service`
- `trovan-postgres`
- `trovan-redis`

The backend receives `DATABASE_URL` from `trovan-postgres`, `REDIS_URL` from `trovan-redis`, `ROUTING_SERVICE_HOSTPORT` from `trovan-routing-service`, and a generated `JWT_SECRET`.

## Render Dashboard Creation

If a Render API token is not available locally, create the Blueprint from the Render Dashboard:

1. Open Render Dashboard > New > Blueprint.
2. Connect `loganmetsker-droid/Routing-`.
3. Use branch `codex/route-optimization-objectives` until PR #2 is merged.
4. Confirm Render detects the root `render.yaml`.
5. Review the planned resources and confirm the services/database/key-value names match this document.
6. Enter every `sync: false` value when Render prompts during initial Blueprint creation.
7. After creation, open each service's Environment page and confirm no staging-only value is blank.

Important: Render prompts for `sync: false` values during initial Blueprint creation. If a secret is added later or skipped during creation, add it manually in the service dashboard.

## Required Dashboard Values

Render will still require these values because they must not be committed:

### Backend

- `FRONTEND_URL`
- `CORS_ORIGINS`
- `METRICS_TOKEN`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_REDIRECT_URI`
- `WORKOS_LOGOUT_REDIRECT_URI`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PROFESSIONAL`
- `STRIPE_PRICE_ENTERPRISE`
- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`

### Routing Service

- `CORS_ORIGINS`

### Frontend

- `VITE_REST_API_URL`
- `VITE_API_URL`
- `VITE_WS_URL`

Do not set `VITE_AUTH_BYPASS` or `VITE_MOCK_PREVIEW` in staging.

## Expected URL Shape

After Render creates the services, the default URLs should look like:

```sh
STAGING_FRONTEND_URL="https://trovan-frontend.onrender.com"
STAGING_BACKEND_URL="https://trovan-backend.onrender.com"
STAGING_ROUTING_SERVICE_URL="https://trovan-routing-service.onrender.com"
```

Use the actual Render service URLs if Render adds suffixes.

## Smoke Commands

Run with the local Node binary first on `PATH`:

```sh
export PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH"

export STAGING_FRONTEND_URL="https://<frontend-host>"
export STAGING_BACKEND_URL="https://<backend-host>"
export STAGING_ROUTING_SERVICE_URL="https://<routing-service-host>"
export LAUNCH_AUDIT_API_URL="$STAGING_BACKEND_URL"
export PLAYWRIGHT_BASE_URL="$STAGING_FRONTEND_URL"
export PLAYWRIGHT_SKIP_WEBSERVER=true
export LAUNCH_AUDIT_STRICT_OPTIMIZER=true

npm run launch:env-status
npm run smoke:staging
ROUTING_SERVICE_URL="$STAGING_ROUTING_SERVICE_URL" npm run smoke:optimizer
npm run launch:audit
```

The full staging smoke needs local-only env values for provider checks:

```sh
export WORKOS_TEST_EMAIL="[not committed]"
export WORKOS_TEST_PASSWORD="[not committed]"
export METRICS_TOKEN="[same value as Render backend]"
export STAGING_AUTH_TOKEN="[JWT from a staging WorkOS/local test session]"
export STRIPE_SECRET_KEY="[Stripe test key]"
export STRIPE_WEBHOOK_SECRET="[Stripe staging webhook secret]"
export STAGING_WEBHOOK_RECEIVER_URL="[test receiver URL]"
export POSTMARK_SERVER_TOKEN="[Postmark sandbox/server token]"
export POSTMARK_FROM_EMAIL="[Postmark verified sandbox sender]"
export TWILIO_ACCOUNT_SID="[Twilio test account SID]"
export TWILIO_AUTH_TOKEN="[Twilio test auth token]"
export TWILIO_FROM_NUMBER="[Twilio test sender number]"
export R2_BUCKET="[R2 test bucket]"
export R2_ACCESS_KEY_ID="[R2 test access key id]"
export R2_SECRET_ACCESS_KEY="[R2 test secret access key]"
export R2_ENDPOINT="[R2 endpoint URL]"
```

## Acceptance

Public launch stays no-go until:

- backend `/health`, `/health/runtime`, and `/health/readiness` pass in hosted staging
- routing-service `/health` and `/optimize` pass in hosted staging
- `npm run smoke:staging` passes without partial mode
- staging Playwright audit passes with strict optimizer mode
- WorkOS, Stripe, Redis, storage, email/SMS, webhooks, API keys, Socket.IO, metrics token, CORS, and public tracking are proven against hosted staging
