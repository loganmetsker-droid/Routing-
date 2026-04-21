# Deploy Runbook

## Detection

- Planned release or deploy request.

## First Checks

1. Confirm latest backup exists.
2. Confirm staging is healthy.
3. Confirm smoke suite passes in staging.

## Immediate Triage Steps

1. Deploy backend artifact.
2. Apply migrations using the approved migration workflow.
3. Deploy worker/runtime changes if queue behavior changed.
4. Deploy frontend artifact.

## Verification

- `/health/ping`
- `/health`
- `/health/runtime`
- smoke suite pass artifact
- no queue lag spike

## Escalation Threshold

- Escalate if staging fails smoke tests.
- Escalate if production health fails after deploy.

## Restore vs Forward-Fix

- Roll back frontend/backend artifact first if schema-compatible.
- Restore database only for destructive or corrupting failures.
