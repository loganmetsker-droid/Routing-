import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runStripeAssistedPilotExercise,
  validatePilotPrice,
} from './stripe-assisted-pilot-smoke.mjs';

function price(id, amount) {
  return {
    id,
    active: true,
    currency: 'usd',
    unit_amount: amount,
    recurring: { interval: 'month', interval_count: 1 },
  };
}

test('validates the canonical Launch and Scale monthly prices', () => {
  assert.deepEqual(validatePilotPrice(price('launch', 39_900), 39_900, 'Launch'), []);
  assert.ok(
    validatePilotPrice(price('scale', 1_000), 89_900, 'Scale').some((issue) =>
      issue.includes('89900'),
    ),
  );
});

test('exercises assisted invoicing, decline, cancellation, refund, and cleanup', async () => {
  const calls = [];
  const stripe = {
    prices: {
      retrieve: async (id) =>
        id === 'price_launch' ? price(id, 39_900) : price(id, 89_900),
    },
    customers: {
      create: async () => ({ id: 'cus_smoke' }),
      del: async (id) => calls.push(['customer.del', id]),
    },
    subscriptions: {
      create: async () => ({ id: 'sub_smoke', collection_method: 'send_invoice' }),
      update: async () => ({ cancel_at_period_end: true }),
      cancel: async (id) => calls.push(['subscription.cancel', id]),
    },
    paymentIntents: {
      create: async (input) => {
        if (input.payment_method === 'pm_card_visa_chargeDeclined') {
          const error = new Error('declined');
          error.code = 'card_declined';
          throw error;
        }
        return { status: 'succeeded', latest_charge: 'ch_smoke' };
      },
    },
    refunds: {
      create: async () => ({ id: 're_smoke', status: 'succeeded' }),
    },
  };

  const result = await runStripeAssistedPilotExercise(stripe, {
    secretKey: 'sk_test_example',
    allowExercise: true,
    launchPriceId: 'price_launch',
    scalePriceId: 'price_scale',
  });
  assert.equal(result.assistedInvoiceMode, true);
  assert.equal(result.failedPaymentExercised, true);
  assert.equal(result.periodEndCancellationExercised, true);
  assert.equal(result.refundExercised, true);
  assert.deepEqual(calls, [
    ['subscription.cancel', 'sub_smoke'],
    ['customer.del', 'cus_smoke'],
  ]);
});

test('refuses live keys and requires explicit test-exercise authorization', async () => {
  const stripe = {};
  await assert.rejects(
    runStripeAssistedPilotExercise(stripe, {
      secretKey: 'sk_live_nope',
      allowExercise: true,
    }),
    /sk_test_/,
  );
  await assert.rejects(
    runStripeAssistedPilotExercise(stripe, {
      secretKey: 'sk_test_example',
      allowExercise: false,
    }),
    /STRIPE_ALLOW_TEST_EXERCISE/,
  );
});
