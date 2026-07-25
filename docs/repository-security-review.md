# Repository Security Review

Date: 2026-07-24

Scope: Trovan assisted-pilot release candidate, including tracked Git history,
JavaScript/TypeScript application code, Python routing code, dependencies,
authentication and tenant boundaries, webhooks, uploads, public endpoints, and
operator-only controls.

Status: **local source and dependency checks green; hosted security exercises
remain required before production promotion**

## Automated release gates

- Gitleaks scans the complete Git history on every release pull request.
- The Gitleaks configuration extends the default rule set. Its three exceptions
  require both an exact test/example path and an exact non-secret fixture shape.
- CodeQL runs the `security-extended` query suite against
  `javascript-typescript` and `python` on every release pull request.
- Full-tree and production dependency audits reject high or critical
  advisories.
- The full build, lint, unit, migration, and Playwright gates run in the same
  release workflow.

The security tools are pinned to reviewed immutable action commits. Updating a
tool version requires a new release pull request and a green replacement run.

## Evidence-backed application controls

- WorkOS is the hosted identity provider; local password auth is disabled in
  staging and production.
- Organization access is checked server-side for protected reads and writes.
- API keys are stored hashed, can be revoked, and are organization-scoped.
- Webhook signatures, replay records, redirect handling, response-size bounds,
  and private-network/SSRF rejection have direct backend test coverage.
- Stripe webhook processing requires configured secrets and verified raw-body
  signatures; public self-serve subscription creation is disabled for the
  pilot.
- Socket.IO connections and public tracking access have explicit
  authorization/token boundaries.
- Proof uploads use authenticated, tenant-scoped object access with bounded
  file validation.
- Request logging excludes authorization values and redacts public tracking
  tokens, contact data, and request bodies by default in production.
- Metrics and operator lead-management paths require separate protected access.

## Manual review checklist

- [x] No high-confidence secret finding in tracked history after adjudicating
  exact fake test/example fixtures.
- [x] Zero critical/high production dependency advisory.
- [x] Zero critical/high full dependency-tree advisory.
- [x] Direct tests cover tenant denial, API-key lifecycle, webhook
  signature/replay/SSRF, Socket.IO authorization, and public tracking.
- [x] Review the latest CodeQL pull-request results and close every critical or
  high alert.
- [ ] Run the hosted two-organization denial and fresh-session persistence
  exercises.
- [ ] Run hosted API-key, webhook receiver, Socket.IO, public tracking, and R2
  proof exercises against the immutable staging SHA.
- [ ] Confirm Render, Cloudflare, WorkOS, Postmark, Stripe, R2, and GitHub
  operator access uses MFA and least-privilege roles.
- [ ] Record credential rotation ownership and the incident-time rotation
  procedure without storing any secret values.

## Promotion rule

This review is not production approval. Production promotion remains blocked
until the exact staging SHA has green CodeQL results, every hosted security
exercise passes, all critical/high findings are closed, recovery and rollback
drills pass, and owner/legal approvals are recorded.

## CodeQL remediation record

The first `security-extended` scan found nine high and one medium alert. The
replacement scan for commit `bd13ab1045d90136ae464e8704ef69c8d63b833f`
closed all ten:

- request-body sanitization now creates inert own properties rather than
  dynamically assigning attacker-controlled keys;
- bearer parsing is bounded and linear-time;
- API keys use a dedicated HMAC secret, required in hosted environments;
- preview API-key and webhook secrets use cryptographic randomness;
- the local bootstrap writes generated secret files atomically with owner-only
  permissions;
- routing logs no longer include user-controlled objective text;
- test URL matching no longer relies on an unanchored regular expression;
- local preview JSON normalizes reflected dates, escapes markup-significant
  characters, and returns restrictive security headers.

The PR CodeQL check completed successfully with no remaining alert summary.
The exact final candidate must retain that green result.
