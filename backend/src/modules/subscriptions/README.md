# Assisted-Pilot Billing

Trovan's pilot release uses Stripe invoices/subscriptions created by an approved operator. Public card entry and automatic entitlement changes are disabled.

## Canonical plans

Database enum keys remain unchanged:

| Internal key | Public name | Price | Activation |
| --- | --- | --- | --- |
| `starter` | Launch | $399/month | Manual approval |
| `professional` | Scale | $899/month | Manual approval |
| `enterprise` | Enterprise | Custom | Signed order form |

The catalog lives in `shared/contracts/index.ts` and is consumed by the backend and frontend. Do not duplicate prices in UI code.

## Configuration

```bash
SELF_SERVE_BILLING_ENABLED=false
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_LAUNCH=price_...
STRIPE_PRICE_SCALE=price_...
```

`SELF_SERVE_BILLING_ENABLED` must remain `false` for the assisted-pilot release. While it is false, `POST /subscriptions/subscribe` returns HTTP 403. Enterprise has no public price ID.

## Approved pilot procedure

1. Approve the customer and execute the pilot order form.
2. Create the Stripe customer, invoice, or subscription in the Stripe dashboard using the matching Launch or Scale price.
3. Record the Stripe identifiers through the protected operator workflow.
4. Verify the signed agreement, payment state, organization, plan, seats, and access before enabling the customer.
5. Exercise successful payment, failed payment, period-end cancellation, and refund handling in Stripe test mode before production.

Cancellation is effective at the current billing-period end. Refunds follow the signed pilot agreement.

## Webhook events

- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Webhook signature verification is mandatory. Keep all Stripe secrets in the provider or deployment secret store and never in source control or chat.
