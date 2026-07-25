# Trovan Routing Config Matrix

This file is the canonical environment/config reference for local, dev, staging, and production.

## Environment Modes

| Variable | Local / Dev | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | `development` | `staging` or `production` | `production` | Controls logging and strictness. |
| `STRICT_ENV_VALIDATION` | `false` by default | `true` | `true` | Fail fast on missing required config. |
| `QUEUE_REQUIRED` | `false` unless validating Redis locally | `true` | `true` | If `true`, startup and health require queue visibility. |
| `ENABLE_SCHEDULER` | `0` by default | `1` if embedded worker used | `1` if embedded worker used | Dedicated worker is intentionally deferred. |
| `SWAGGER_ENABLED` | Optional | `false` unless explicitly needed | `false` unless explicitly needed | Production docs surface is opt-in. |
| `SWAGGER_PUBLIC_SERVER_URL` | Optional | Required if Swagger is exposed | Required if Swagger is exposed | HTTPS API origin advertised by OpenAPI; omitted docs never publish a placeholder server. |
| `METRICS_TOKEN` | Optional | Required unless protected upstream | Required unless protected upstream | Protects `/api/metrics`. |
| `LAUNCH_PROFILE` | Optional | `assisted-pilot` | `assisted-pilot` | Documents the approved commercial posture. |
| `SELF_SERVE_BILLING_ENABLED` | `false` | `false` | `false` | Must remain false until self-serve GA gates pass. |
| `SMS_NOTIFICATIONS_ENABLED` | `false` | `false` | `false` | SMS is deferred from the pilot release. |
| `NOTIFICATION_MAX_ATTEMPTS` | `3` | `3` | `3` | Caps delivery attempts for failures with a confirmed retry-safe provider response. |
| `NOTIFICATION_RETRY_BASE_SECONDS` | `60` | `60` | `60` | Base delay for bounded exponential notification retries. |

## Backend Core

| Variable | Required Local | Required Hosted | Purpose |
| --- | --- | --- | --- |
| `PORT` | Yes | Yes | Backend listen port. |
| `HOST` | Yes | Yes | Bind address. |
| `FRONTEND_URL` | Yes | Yes | CORS origin allowlist source. |
| `JWT_SECRET` | Yes | Yes | JWT signing secret. Must not use local default outside local/dev. |
| `API_KEY_HASH_SECRET` | Yes | Yes | Dedicated HMAC secret for API-key verification. Must differ from `JWT_SECRET`; rotate API keys if this value changes. |
| `JWT_EXPIRES_IN` | Yes | Yes | Session TTL. |
| `AUTH_SESSION_ENFORCEMENT` | Optional | Yes | Keeps HTTP JWTs tied to non-revoked application sessions. |
| `ROUTING_SERVICE_URL` | Optional | Yes, unless `ROUTING_SERVICE_HOSTPORT` is provided | Full optimizer service URL, for example `https://optimizer.example.com`. |
| `ROUTING_SERVICE_HOSTPORT` | Optional | Render Blueprint managed | Internal Render host and port for the optimizer service. Backend converts this to `http://host:port` when `ROUTING_SERVICE_URL` is unset. |
| `ROUTING_SERVICE_SCHEME` | Optional | Optional | Defaults to `http` for private service traffic. |

## Database

Use one of the following:

1. `DATABASE_URL`
2. Split vars: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`

| Variable | Local | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Optional | Preferred | Preferred | Best for managed Postgres. |
| `DATABASE_HOST` | Allowed | Allowed | Allowed | Use only if not using `DATABASE_URL`. |
| `DATABASE_PORT` | Allowed | Allowed | Allowed | Defaults are local-only. |
| `DATABASE_NAME` | Allowed | Allowed | Allowed | |
| `DATABASE_USER` | Allowed | Allowed | Allowed | |
| `DATABASE_PASSWORD` | Allowed | Allowed | Allowed | |
| `DB_POOL_SIZE` | Optional | Recommended | Recommended | Tune by environment. |

## Queue / Worker

| Variable | Local | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `REDIS_URL` | Optional | Preferred | Preferred | Managed Redis preferred in hosted envs. |
| `REDIS_HOST` | Optional | Allowed | Allowed | Use only if `REDIS_URL` absent. |
| `REDIS_PORT` | Optional | Allowed | Allowed | |
| `REDIS_PASSWORD` | Optional | Allowed | Allowed | |
| `QUEUE_REQUIRED` | Optional | Required | Required | Health/startup enforces queue visibility when true. |
| `OPTIMIZATION_MODE` | `embedded` | `embedded` or `service` | `embedded` or `service` | Current repo remains embedded-first. |

## Webhooks

| Variable | Local | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `WEBHOOK_MAX_RESPONSE_BODY_BYTES` | Optional, defaults to `65536` | Recommended | Recommended | Caps persisted outbound webhook response bodies. |
| `WEBHOOK_ALLOWED_HOSTS` | Optional | Recommended if self-serve webhooks launch | Recommended if self-serve webhooks launch | Comma-separated exact hosts or wildcard hosts like `*.customer-hooks.example`. When set in strict envs, all webhook targets must match. |

Strict staging/production webhook validation blocks localhost, raw private IP targets, and DNS names that resolve to private network ranges before save and again before delivery/replay.

## Frontend

| Variable | Local / Preview | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `VITE_REST_API_URL` | Yes | Yes | Yes | Backend API base URL. |
| `VITE_API_URL` | Optional alias | Optional alias | Optional alias | |
| `VITE_WS_URL` | Optional | Yes when sockets are enabled | Yes when sockets are enabled | Socket.IO base URL. |
| `VITE_ENABLE_SOCKETS` | Optional | `true` | `true` | Can be set `false` only for local/mock preview. |
| `VITE_API_TIMEOUT_MS` | `12000` default | `8000` | `8000` | Bounds auth-config and API waits so login can show a retry state. |
| `VITE_AUTH_BYPASS` | Allowed only for preview/local | Forbidden | Forbidden | Local-only shortcut. |
| `VITE_MOCK_PREVIEW` | Allowed only for preview/local | Forbidden | Forbidden | Local-only shortcut. |

## Auth Rules

- Local preview may use `VITE_AUTH_BYPASS=true`.
- Staging and production must use real backend auth.
- `AUTH_ADMIN_*` values are local bootstrap credentials unless explicitly overridden for a non-user-facing admin flow.

## Storage / Reports

| Variable | Local | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `STORAGE_MODE` | `local` | `local` or `object` | `object` preferred | Exports/uploads/reports. |
| `STORAGE_PATH` | Optional | Optional | Optional | For local filesystem storage. |
| `R2_BUCKET` | Optional | Required | Required | Pilot proof-file object storage. |
| `R2_ACCESS_KEY_ID` | Optional | Required | Required | Secret-store only. |
| `R2_SECRET_ACCESS_KEY` | Optional | Required | Required | Secret-store only. |
| `R2_ENDPOINT` | Optional | Required | Required | Environment-specific R2 endpoint. |

## Assisted-pilot providers

| Variable | Staging | Production | Notes |
| --- | --- | --- | --- |
| `WORKOS_CLIENT_ID`, `WORKOS_API_KEY` | Required | Required | WorkOS authentication; include redirect/logout URLs. |
| `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL` | Required | Required | Email is launch-critical. Sender authentication and bounce alerts are operational gates. |
| `NOTIFICATION_MAX_ATTEMPTS`, `NOTIFICATION_RETRY_BASE_SECONDS` | `3`, `60` | `3`, `60` | Only known retry-safe HTTP failures are retried. Timeouts and ambiguous outcomes require operator review to avoid duplicate customer messages. |
| `LEAD_INTAKE_EMAIL`, `LEAD_INTAKE_FROM_EMAIL` | Required | Required | Operator destination and verified sender for lead intake. |
| `LEAD_INTAKE_OPERATOR_EMAILS` | Required | Required | Comma-separated authenticated platform-operator accounts. Customer organization admins are denied global lead readback. |
| `LEAD_NOTIFICATION_MAX_ATTEMPTS`, `LEAD_NOTIFICATION_RETRY_BASE_SECONDS` | `3`, `60` | `3`, `60` | Bounded lead-email retry for confirmed transient provider responses. Ambiguous outcomes remain in the operator inbox for manual review. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Test mode | Live after approval | Operator-created invoices/subscriptions only. |
| `STRIPE_PRICE_LAUNCH`, `STRIPE_PRICE_SCALE` | Required | Required | $399/month and $899/month. Enterprise is custom. |

Twilio variables are not required for assisted-pilot readiness. `SMS_NOTIFICATIONS_ENABLED` must remain false.

## Runtime Visibility

Stable startup and backend logs must expose the following non-secret summary:

- env source
- DB host/port/database name
- auth mode
- queue mode
- optimization mode
- storage mode

No secrets, passwords, or tokens should be written to logs.

## Scheduled production monitor

The GitHub `Trovan Production Monitor` workflow requires:

| GitHub setting | Kind | Purpose |
| --- | --- | --- |
| `PRODUCTION_FRONTEND_URL` | Actions variable | Public Cloudflare origin checked by the scheduled smoke. |
| `PRODUCTION_BACKEND_URL` | Actions variable | Render API origin checked by the scheduled smoke. |
| `PRODUCTION_AUTH_TOKEN` | Actions secret | Revocable operator smoke identity used only for `/api/auth/me`. |
| `PRODUCTION_METRICS_TOKEN` | Actions secret | Dedicated read token used only for `/api/metrics`. |

Rotate the two smoke tokens independently of customer sessions. A missing or expired token must fail the scheduled monitor instead of silently degrading it to public-only checks.
