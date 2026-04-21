# Degraded Service Runbook

## Detection

- `/health/runtime` reports degraded queue/worker/optimization status.
- Optimization jobs remain queued or running too long.
- External routing provider becomes unavailable.

## First Checks

1. Queue mode and worker heartbeat.
2. Oldest queued job age.
3. Routing/optimization dependency reachability.

## Immediate Triage

1. Mark routing/optimization features degraded in operator communication.
2. Keep manual route/dispatch flows available where possible.
3. Restart worker if heartbeat is stale.

## Recovery Steps

1. Restore Redis or worker reachability.
2. Retry failed/stuck jobs idempotently.
3. Confirm optimization status transitions resume.

## Verification

- queue backlog declines
- worker heartbeat updates
- new optimization jobs transition normally

## Escalation Threshold

- Escalate if degraded mode blocks dispatch operations for more than 15 minutes.

## Restore vs Forward-Fix

- Forward-fix provider and queue issues first.
- Restore only if data/state was damaged.
