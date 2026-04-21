# Worker / Queue Stuck Runbook

## Detection

- `/health/runtime` shows stale worker heartbeat.
- queue backlog or oldest queued age grows.
- optimization jobs remain `queued` or `running`.

## First Checks

1. Redis reachable.
2. Worker heartbeat timestamp.
3. Failed job count.
4. Recent worker log errors.

## Immediate Triage

1. Restart embedded or dedicated worker path.
2. Inspect poisoned jobs.
3. Retry idempotent jobs only.

## Recovery Steps

1. Restore queue connectivity.
2. Confirm worker heartbeat resumes.
3. Drain queue backlog safely.

## Verification

- heartbeat updates
- queue counts normalize
- optimization lifecycle progresses

## Escalation Threshold

- Escalate if the queue remains stuck after one controlled restart/retry cycle.

## Restore vs Forward-Fix

- Forward-fix worker or queue path first.
- Restore only if queue persistence/data state was damaged.
