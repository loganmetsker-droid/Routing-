# Routing MVP Launch Operator

This is the one-step-at-a-time operator guide for the MVP launch pass.

## Launch Defaults

- Hosting: all Render services from `render.yaml`.
- Branch/commit: use the immutable assisted-pilot release SHA that passed staging.
- Billing: Stripe test mode first.
- AI claim: use "AI-assisted route optimization" until trained-model evidence is packaged.
- Secrets: keep values in provider dashboards or local shell env only.

## Next-Step Command

Run this anytime to see the next handoff:

```sh
npm run launch:mvp-next
```

For machine-readable status:

```sh
node scripts/mvp-launch-next-step.mjs --json
```

For CI-style failure until all handoffs are configured:

```sh
node scripts/mvp-launch-next-step.mjs --strict
```

## Handoff Order

1. Render staging URLs: frontend, backend, routing-service.
2. Render environment values: backend, frontend, routing-service.
3. WorkOS staging auth.
4. Stripe test billing and webhook.
5. Postmark and R2 sandbox resources. SMS/Twilio is outside assisted-pilot readiness.
6. MVP seed dataset from `docs/launch/mvp-seed-dataset.json`.
7. Hosted optimizer proof.
8. Full staging smoke and launch audit.

## Final Gates

```sh
export PATH="/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin:$PATH"
npm run launch:env-status
npm run staging:smoke
ROUTING_SERVICE_URL="$STAGING_ROUTING_SERVICE_URL" npm run smoke:optimizer
npm run launch:audit
```

Public launch stays blocked until these pass against hosted staging with provider checks enabled.
