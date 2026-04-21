# Provider Outage Runbook

## Detection

- External routing/optimization/storage provider health degrades.
- Requests time out or fail repeatedly.

## First Checks

1. Provider status page or synthetic check.
2. Internal error/timeout rate.
3. Whether manual fallback path is available.

## Immediate Triage

1. Enter degraded mode.
2. Avoid blocking manual dispatch operations.
3. Disable or annotate provider-dependent features if needed.

## Recovery Steps

1. Retry with bounded backoff.
2. Switch to fallback/manual path.
3. Resume normal mode only after dependency stabilizes.

## Verification

- dependency check passes
- queue/job throughput normalizes
- operator UI no longer reports degraded status

## Escalation Threshold

- Escalate if provider outage blocks route optimization or exports for operationally significant duration.

## Restore vs Forward-Fix

- Forward-fix via fallback or retry.
- Restore not usually applicable unless internal persistence was impacted.
