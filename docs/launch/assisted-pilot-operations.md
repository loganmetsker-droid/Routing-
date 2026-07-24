# Assisted-Pilot Operations Gate

Status: evidence required before the first paid onboarding.

## Ownership and support

- Launch owner: **Logan Metsker**
- Support target: best effort, initial response within one business day
- Uptime: no contractual SLA
- Notifications: email and in-app only; SMS disabled
- Escalation: the launch owner owns acknowledgement, customer communication, rollback, and incident closure

If the legal owner name or operator contact differs, correct this document before production promotion.

## Provider setup evidence

- WorkOS redirect/logout URLs, test user, session expiry, logout, and revocation
- Postmark verified sender, SPF/DKIM, operator reply-to, delivery activity, bounce webhook/alert, and acknowledgement
- R2 bucket access, proof upload/download, persistence after deployment, recovery/versioning check
- Stripe test-mode Launch/Scale prices, signed-order-form workflow, invoice/subscription, failed payment, period-end cancellation, and refund procedure
- Render failure notification and authenticated scheduled health smoke. Configure the dedicated `PRODUCTION_AUTH_TOKEN` and `PRODUCTION_METRICS_TOKEN` GitHub Actions secrets; either missing or expired token intentionally fails the monitor.
- Outbound-webhook test receiver with signature, replay, response cap, redirect, DNS, and private-network rejection evidence

DMARC may remain in monitoring for the pilot. Move to quarantine only after at least two weeks of clean aggregate reports.

## Exercises

Record date, operator, release SHA, result, evidence link, and follow-up for each:

| Exercise | Required result |
| --- | --- |
| Postgres restore | Backup restores into an isolated database; readiness and tenant tests pass |
| R2 recovery | A representative proof object is recovered and byte-verified |
| Rollback | Prior Cloudflare and Render versions restore every health and smoke check |
| Alert | Render/health/Postmark alert reaches the launch owner and is acknowledged |
| Incident | Owner follows triage, customer communication, rollback, and closure runbooks |

## Promotion record

Do not mark a gate complete without retained evidence.

- Release SHA:
- Previous Cloudflare version:
- Previous Render backend version:
- Previous Render routing version:
- Local gate:
- Hosted staging gate:
- Restore/R2 gate:
- Rollback/alert gate:
- Security review:
- Privacy/legal approval:
- Launch owner approval:
