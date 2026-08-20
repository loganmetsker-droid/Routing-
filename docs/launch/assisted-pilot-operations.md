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
- Render failure notification and authenticated scheduled health smoke
- Outbound-webhook test receiver with signature, replay, response cap, redirect, DNS, and private-network rejection evidence
- Mapbox geocoding with representative address accuracy and bounded-failure evidence
- Contracted road-matrix service with representative urban/suburban benchmarks and solution provenance showing no fallback
- Error-monitoring receiver with a redacted backend exception, authenticated frontend exception, alert delivery, and acknowledgement

DMARC may remain in monitoring for the pilot. Move to quarantine only after at least two weeks of clean aggregate reports.

## Pilot funnel and event ownership

Trovan records first-party audit events for login, job import, route-draft generation, route publication, dispatch, proof capture, lead submission, and scheduled cancellation. The launch owner owns weekly funnel review and removal of synthetic/test events. These records are operational evidence, not a consent-free third-party behavioral analytics feed. Set and approve the audit retention period before accepting customer data; until then, do not publish conversion or adoption claims based on the events.

## Sensitive access-code operations

- Generate the encryption key in an approved secret manager; never place it in source, logs, evidence, or support messages.
- Before hosted pilot data is accepted, run `npm run jobs:encrypt-access-codes --workspace=backend` once against staging and verify normal job APIs expose only `accessCodeConfigured` while the assigned driver's authenticated manifest can reveal the code.
- Production backfill additionally requires `ALLOW_PRODUCTION_ACCESS_CODE_BACKFILL=true` and explicit launch-owner approval.
- Rotation requires decrypting and re-encrypting every envelope before retiring the old key; changing the environment key alone will make existing codes unreadable.

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

Production promotion also requires `LAUNCH_GATE_EVIDENCE_JSON` in the protected GitHub production environment. It must name the exact release SHA, contain non-local HTTPS evidence links, be no more than 30 days old, and explicitly record successful Postgres restore, R2 recovery, rollback, alert acknowledgement, incident, Stripe billing, Postmark delivery/bounce exercises plus repository-security, privacy/retention, subprocessor, pilot-agreement, and launch-owner approvals. `npm run release:verify-launch-evidence -- <file> <sha>` validates the record without printing credentials.

Start from `docs/launch/launch-gate-evidence.example.json`; do not put credentials, customer data, or private evidence contents in the manifest.

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
