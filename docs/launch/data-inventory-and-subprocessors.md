# Pilot Data Inventory and Subprocessors

Status: engineering inventory; owner/legal approval required before accepting customer route data.

## Data inventory

| Data | Purpose | Typical sensitivity | Primary system | Deletion/export check |
| --- | --- | --- | --- | --- |
| Organization and user identity | Authentication, tenant access, audit | Business identity | WorkOS, Postgres | Verify WorkOS and application deletion/export together |
| Customer and recipient details | Plan routes and deliver | Personal/contact data | Postgres | Measure export/deletion completion in staging |
| Addresses and coordinates | Routing, dispatch, tracking | Location data | Postgres, routing service | Confirm route cascade and backup expiry |
| Driver/vehicle data | Assignment and execution | Workforce/asset data | Postgres | Confirm tenant-scoped export/deletion |
| Site instructions and access codes | Complete authorized stops | Sensitive premises data | Postgres | Access codes use AES-256-GCM field encryption; verify key rotation and deletion |
| Route, stop, status, and telemetry | Operate and audit delivery | Operational/location data | Postgres, Redis | Redis is transient; measure Postgres retention |
| Proof files and exports | Prove delivery | May contain personal data | Cloudflare R2 | Verify deletion, versioning, and lifecycle expiry |
| Leads and support requests | Sales/support follow-up | Contact and message data | Postgres, Postmark | Verify operator readback, closure, and deletion |
| API keys, sessions, webhook metadata | Secure integrations | Security metadata | Postgres, WorkOS | Keys stored hashed; verify revocation and audit retention |
| Billing records | Invoice and subscription operations | Financial metadata | Stripe, Postgres | Follow accounting and signed pilot obligations |
| Logs, metrics, audit events | Reliability and security | Identifiers/metadata | Render and configured observability | Measure provider retention; confirm redaction |

Never place secret values, full authorization headers, passwords, raw API keys, or Stripe/WorkOS/Postmark/R2 credentials in logs, reports, support messages, or this inventory.

## Subprocessors

| Provider | Pilot function | Data category |
| --- | --- | --- |
| Render | Backend, routing service, Postgres, Redis, runtime logs | Application and operational data |
| Cloudflare | Frontend delivery and R2 proof-file storage | Web request metadata and proof files |
| WorkOS | Authentication and session lifecycle | User identity and session metadata |
| Postmark | Lead, support, and operational email | Email addresses and message content |
| Stripe | Manually approved invoices/subscriptions | Billing and customer account metadata |
| Mapbox | Hosted address geocoding | Addresses and returned coordinates |
| Contracted OSRM-compatible provider | Road-network travel-time and distance matrices | Coordinates and route-query metadata |
| Error-monitoring receiver (provider pending) | Redacted application failure alerts | Release, error, user/organization identifiers, and request metadata |
| GitHub | Source, CI/CD, deployment evidence | Source and engineering metadata; no customer route data intended |

Twilio/SMS is disabled and is not a pilot subprocessor.

## Required measurements before publication

The restore drill must establish actual Postgres backup retention and restore behavior. The R2 recovery check must establish object version/lifecycle behavior. Render log retention, first-party audit/funnel retention, error-monitor retention, customer export timing, customer deletion timing, and backup-expiry timing must then be copied into approved privacy, retention, support, and pilot agreement wording. Name the contracted routing and error-monitoring providers before approval. Do not publish guessed periods.

Approval:

- Owner:
- Legal/privacy reviewer:
- Date:
- Measured configuration evidence:
