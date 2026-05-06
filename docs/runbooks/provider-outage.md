# Provider Outage Runbook

## Detection

- External routing/optimization/storage provider health degrades.
- Requests time out or fail repeatedly.
- Stripe, WorkOS, Postmark, Twilio, Redis, R2, or webhook receiver probes fail in staging or production smoke.

## First Checks

1. Provider status page or synthetic check.
2. Internal error/timeout rate.
3. Targeted provider smoke:

   ```sh
   npm run smoke:staging
   ROUTING_SERVICE_URL="$STAGING_ROUTING_SERVICE_URL" npm run smoke:optimizer
   ```

4. Whether manual fallback path is available.

## Immediate Triage

1. Enter degraded mode.
2. Avoid blocking manual dispatch operations.
3. Disable or annotate provider-dependent features if needed.
4. Hide billing, invitation, notification, or webhook self-serve UI if the provider-backed flow cannot complete safely.

## Recovery Steps

1. Retry with bounded backoff.
2. Switch to fallback/manual path.
3. Resume normal mode only after dependency stabilizes.

## Verification

- dependency check passes
- queue/job throughput normalizes
- operator UI no longer reports degraded status
- provider-specific smoke check passes before re-enabling the self-serve surface

## Escalation Threshold

- Escalate if provider outage blocks route optimization or exports for operationally significant duration.

## Restore vs Forward-Fix

- Forward-fix via fallback or retry.
- Restore not usually applicable unless internal persistence was impacted.
