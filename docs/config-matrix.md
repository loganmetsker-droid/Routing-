# Trovan Routing Config Matrix

This file is the canonical environment/config reference for local, dev, staging, and production.

## Environment Modes

| Variable | Local / Dev | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | `development` | `staging` or `production` | `production` | Controls logging and strictness. |
| `STRICT_ENV_VALIDATION` | `false` by default | `true` | `true` | Fail fast on missing required config. |
| `QUEUE_REQUIRED` | `false` unless validating Redis locally | `true` | `true` | If `true`, startup and health require queue visibility. |
| `ENABLE_SCHEDULER` | `0` by default | `1` if embedded worker used | `1` if embedded worker used | Dedicated worker is intentionally deferred. |

## Backend Core

| Variable | Required Local | Required Hosted | Purpose |
| --- | --- | --- | --- |
| `PORT` | Yes | Yes | Backend listen port. |
| `HOST` | Yes | Yes | Bind address. |
| `FRONTEND_URL` | Yes | Yes | CORS origin allowlist source. |
| `JWT_SECRET` | Yes | Yes | JWT signing secret. Must not use local default outside local/dev. |
| `JWT_EXPIRES_IN` | Yes | Yes | Session TTL. |

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

## Frontend

| Variable | Local / Preview | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `VITE_REST_API_URL` | Yes | Yes | Yes | Backend API base URL. |
| `VITE_API_URL` | Optional alias | Optional alias | Optional alias | |
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

## Runtime Visibility

Stable startup and backend logs must expose the following non-secret summary:

- env source
- DB host/port/database name
- auth mode
- queue mode
- optimization mode
- storage mode

No secrets, passwords, or tokens should be written to logs.
