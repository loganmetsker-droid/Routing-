# Stripe Subscription Integration

## Overview
This module handles subscription management using Stripe for the Routing & Dispatch SaaS platform.

## Features
- Create subscriptions with payment methods
- Handle recurring billing
- Process webhook events (payment succeeded/failed)
- Cancel subscriptions
- Track subscription status per user

## Environment Variables
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

## API Endpoints

### POST /subscriptions/subscribe
Create a new subscription for a user.

**Request Body:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "plan": "professional",
  "paymentMethodId": "pm_card_..."
}
```

**Response:**
```json
{
  "subscription": {
    "id": "uuid",
    "userId": "uuid",
    "stripeCustomerId": "cus_...",
    "stripeSubscriptionId": "sub_...",
    "plan": "professional",
    "status": "active",
    "currentPeriodStart": "2025-01-01T00:00:00Z",
    "currentPeriodEnd": "2025-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  },
  "clientSecret": "pi_...secret..."
}
```

### GET /subscriptions/customers/:userId/subscriptions
Get all subscriptions for a customer.

**Response:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "plan": "professional",
    "status": "active",
    "currentPeriodEnd": "2025-02-01T00:00:00Z"
  }
]
```

### GET /subscriptions/:id
Get subscription details by ID.

### POST /subscriptions/:id/cancel
Cancel a subscription at period end.

### POST /subscriptions/webhook
Handle Stripe webhook events (signature verified).

## Webhook Events Handled

- `invoice.payment_succeeded` - Updates subscription to active
- `invoice.payment_failed` - Updates subscription to past_due
- `customer.subscription.updated` - Syncs subscription data
- `customer.subscription.deleted` - Marks subscription as canceled

## Database Schema

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_customer_id VARCHAR NOT NULL,
  stripe_subscription_id VARCHAR NOT NULL,
  plan VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Example

### Frontend Integration (React)
```typescript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_...');

function SubscribeForm() {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cardElement = elements.getElement(CardElement);
    const { paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    const response = await fetch('/subscriptions/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'current-user-id',
        email: 'user@example.com',
        plan: 'professional',
        paymentMethodId: paymentMethod.id,
      }),
    });

    const { subscription, clientSecret } = await response.json();

    // Confirm payment if needed
    const { error } = await stripe.confirmCardPayment(clientSecret);

    if (error) {
      console.error('Payment failed:', error);
    } else {
      console.log('Subscription active!');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit">Subscribe</button>
    </form>
  );
}
```

## Testing Webhooks Locally

1. Install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe
```

2. Login and forward webhooks:
```bash
stripe login
stripe listen --forward-to localhost:3000/subscriptions/webhook
```

3. Trigger test events:
```bash
stripe trigger payment_intent.succeeded
stripe trigger invoice.payment_failed
```

## Subscription Plans

- **Starter**: Basic routing and dispatch features
- **Professional**: Advanced optimization, unlimited vehicles
- **Enterprise**: Custom integrations, dedicated support

## Security Notes

- Webhook signature verification is mandatory
- Stripe API keys should never be committed to version control
- Use environment-specific keys (test vs production)
- Implement rate limiting on subscription endpoints
