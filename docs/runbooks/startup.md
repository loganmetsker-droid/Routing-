# Startup Runbook

## Detection

- Desktop wrapper shows startup failure screen.
- `scripts/start_stable.sh` exits non-zero.
- `/health/ping` or `/health/runtime` does not return healthy data.

## First Checks

1. Confirm env source in `~/.trovan-routing/logs/start-stable.log`.
2. Confirm DB target host/port logged at startup.
3. Confirm backend and frontend PIDs were created.
4. Confirm `backend/.env` exists and matches the config matrix.

## Immediate Triage

1. Run:
   - `bash scripts/start_stable.sh`
   - `bash scripts/healthcheck.sh`
2. Inspect:
   - `~/.trovan-routing/logs/start-stable.log`
   - `~/.trovan-routing/logs/backend.log`
   - `~/.trovan-routing/logs/frontend.log`
3. If Redis is required, verify Redis host/port reachability.

## Recovery Steps

1. Fix env/config mismatch first.
2. Restore DB/Redis reachability if unavailable.
3. Restart using the stable startup script only.
4. Re-run health check.

## Verification

- `/health/ping` returns 200.
- `/health` returns `status=ok`.
- `/health/runtime` reports expected queue/worker mode.
- frontend reachable at the expected URL.
- desktop opens only after these pass.

## Escalation Threshold

- Escalate after 15 minutes of unresolved startup failure.
- Escalate immediately if startup succeeds but smoke tests fail.

## Restore vs Forward-Fix

- Forward-fix for config/runtime issues.
- Restore only if data corruption is involved.
