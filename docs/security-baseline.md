# Security Baseline

## Auth model
- NestJS is the canonical application edge.
- Auth uses Trovan JWT bearer tokens for authenticated API access.
- WorkOS AuthKit is the preferred managed identity provider in staging and production.
- Local admin password login is a development-only fallback and should be disabled outside local/dev unless there is an explicit break-glass requirement.
- Stripe webhooks remain public only for signed webhook verification.

## Roles
- `OWNER`: full administrative control.
- `ADMIN`: operational administration and dispatch control.
- `DISPATCHER`: route planning, assignment, publish, and dispatch mutations.
- `DRIVER`: execution-only lifecycle actions such as starting or completing assigned routes.
- `VIEWER`: read-only operational visibility.

## Secrets handling
- Production secrets must come from environment variables only.
- `JWT_SECRET` must be set outside local development.
- WorkOS secrets must never be exposed to the frontend:
  - `WORKOS_API_KEY`
  - `WORKOS_CLIENT_ID`
  - `WORKOS_REDIRECT_URI`
  - `WORKOS_LOGOUT_REDIRECT_URI`
- Database TLS behavior must be configured explicitly; self-signed certificates require `DB_SSL_ALLOW_SELF_SIGNED=true`.
- Stripe webhook verification requires configured Stripe secrets and raw request body support.

## Logging and audit
- Every request should carry an `X-Request-ID`; the backend generates one when absent.
- Request logs must be structured and redact sensitive fields such as passwords, tokens, emails, phone numbers, and auth headers.
- Session and platform administration must be auditable:
  - session revocation
  - API key creation and revocation
  - webhook endpoint creation, pause/resume, secret rotation, and replay actions
- Dispatch mutations should emit audit-friendly dispatch events with aggregate type, aggregate id, actor id, event type, and payload.

## Environment expectations
- `CORS_ORIGINS` must be explicitly configured in staging and production.
- `TYPEORM_SYNCHRONIZE=true` is allowed only in local/dev/test environments.
- The legacy Express backend is disabled unless `LEGACY_SERVER_ENABLED=true`.
- Routing service and backend should run with separate dev, staging, and prod configuration sets.
- `AUTH_PROVIDER=workos` is expected in staging and production.
- `ALLOW_LOCAL_AUTH=false` is expected in staging and production.
- Staging and production readiness should degrade or fail when WorkOS or storage are missing.

## Known gaps
- Audit coverage exists for route lifecycle and assignment, but broader cross-module audit coverage is still incomplete.
- Rate limiting is globally enabled, but endpoint-specific policy tuning still needs production calibration.
- Dependency vulnerabilities remain in the workspace and need a dedicated upgrade pass.
- Backup/restore automation exists as scripts and runbooks, but restore drills still need scheduled execution evidence.
- Provider provisioning still depends on real environment credentials for WorkOS, Stripe, Postmark, Twilio, and R2.
