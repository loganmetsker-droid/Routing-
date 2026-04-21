# Database Outage Runbook

## Detection

- `/health` fails on `database`.
- backend logs show DB connection errors.
- writes/read endpoints fail broadly.

## First Checks

1. DB host/port from startup log.
2. Credential source from env/config.
3. DB service/provider status.
4. Connection saturation or resource exhaustion.

## Immediate Triage

1. Verify network reachability from app host.
2. Verify DB process/provider is healthy.
3. Confirm credentials have not drifted.

## Recovery Steps

1. Restore DB availability.
2. Restart backend only after DB is reachable.
3. Re-run health checks and smoke tests.

## Verification

- DB ping succeeds
- `/health` returns ok
- create/read workflow succeeds

## Escalation Threshold

- Escalate immediately if outage exceeds SLA or corruption is suspected.

## Restore vs Forward-Fix

- Forward-fix for connectivity/config issues.
- Restore for corruption, unrecoverable data loss, or failed storage layer.
