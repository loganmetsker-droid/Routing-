# Immutable Release Runbook

## Release candidate

Start from the local safety snapshot. The candidate may contain application code, migrations, configuration, required public assets, tests, and runbooks only. Do not include `.tmp`, screenshots, traces, audit captures, test results, local databases, or generated reports other than the canonical launch-audit report.

## Local gate

```sh
npm ci
git diff --check
npm audit --omit=dev --audit-level=high
npm run build
npm run lint --workspace=frontend
npm run test --workspace=backend
npm run test --workspace=frontend -- --run
python3.11 -m pip install -r routing-service/requirements-dev.txt
python3.11 -m pytest routing-service/tests
npm run test:e2e -- --project=chromium
```

Run the isolated driver workflow three consecutive times before the full Playwright command. CI repeats the complete gate and applies migrations to an empty Postgres database.

## Staging deployment

1. Select a full 40-character SHA that passed **Trovan Release Gate**.
2. Run **Promote Trovan Release** with `target=staging`.
3. The workflow records current Cloudflare and Render versions, deploys Render at the exact SHA, deploys the Cloudflare staging worker, and runs hosted smoke.
4. Save the workflow artifact and record the SHA in the release checklist.
5. Complete the restore, R2 recovery, rollback, alert, security, billing, privacy, and legal gates.

Database migrations run in Render's pre-deploy step. A failed migration must prevent the backend version from becoming healthy. The application start command never runs migrations.

## Production promotion

1. Require approval on the protected GitHub `production` environment.
2. Promote the exact SHA proven in staging.
3. Verify readiness, WorkOS login/logout, lead capture and Postmark delivery, XML sitemap content type, release bundle hash, and absence of preview flags.
4. Close the synthetic lead and remove test customer records.
5. Retain the captured previous Cloudflare and Render versions as rollback targets.

Do not enable public checkout, SMS, a free trial, or automated entitlements for this release.

## Failure

Stop promotion when any release, hosted, operations, security, or legal gate fails. For schema-compatible failures, redeploy the recorded previous Cloudflare and Render versions. Restore the database only for corruption or a destructive migration and follow `backup-restore.md` and `rollback.md`.
