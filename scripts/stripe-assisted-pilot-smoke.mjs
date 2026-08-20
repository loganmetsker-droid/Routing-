import Stripe from 'stripe';

export function validatePilotPrice(price, expectedAmount, label) {
  const issues = [];
  if (!price?.active) issues.push(`${label} price is not active`);
  if (price?.currency !== 'usd') issues.push(`${label} price must use USD`);
  if (price?.unit_amount !== expectedAmount) {
    issues.push(`${label} price must be ${expectedAmount} cents`);
  }
  if (price?.recurring?.interval !== 'month' || price?.recurring?.interval_count !== 1) {
    issues.push(`${label} price must recur monthly`);
  }
  return issues;
}

export async function runStripeAssistedPilotExercise(stripe, config) {
  if (!String(config.secretKey || '').startsWith('sk_test_')) {
    throw new Error('Stripe launch exercise requires an sk_test_ key');
  }
  if (config.allowExercise !== true) {
    throw new Error('STRIPE_ALLOW_TEST_EXERCISE=true is required');
  }

  const launchPrice = await stripe.prices.retrieve(config.launchPriceId);
  const scalePrice = await stripe.prices.retrieve(config.scalePriceId);
  const priceIssues = [
    ...validatePilotPrice(launchPrice, 39_900, 'Launch'),
    ...validatePilotPrice(scalePrice, 89_900, 'Scale'),
  ];
  if (priceIssues.length) throw new Error(priceIssues.join('; '));

  const marker = `trovan-launch-smoke-${Date.now()}`;
  let customerId = null;
  let subscriptionId = null;
  let refundId = null;
  try {
    const customer = await stripe.customers.create({
      email: `${marker}@example.com`,
      name: 'Trovan assisted-pilot staging exercise',
      metadata: { trovanLaunchSmoke: marker },
    });
    customerId = customer.id;

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: config.launchPriceId }],
      collection_method: 'send_invoice',
      days_until_due: 30,
      metadata: {
        trovanLaunchSmoke: marker,
        billingMode: 'assisted_pilot',
      },
    });
    subscriptionId = subscription.id;
    if (subscription.collection_method !== 'send_invoice') {
      throw new Error('assisted subscription was not created in send_invoice mode');
    }

    const scheduledCancellation = await stripe.subscriptions.update(
      subscription.id,
      { cancel_at_period_end: true },
    );
    if (!scheduledCancellation.cancel_at_period_end) {
      throw new Error('period-end cancellation was not persisted by Stripe');
    }

    let declined = false;
    try {
      await stripe.paymentIntents.create({
        amount: 100,
        currency: 'usd',
        payment_method: 'pm_card_visa_chargeDeclined',
        payment_method_types: ['card'],
        confirm: true,
        description: marker,
        metadata: { trovanLaunchSmoke: marker, scenario: 'failed_payment' },
      });
    } catch (error) {
      const code = error?.code || error?.raw?.code;
      declined = code === 'card_declined';
    }
    if (!declined) throw new Error('Stripe failed-payment scenario did not decline');

    const payment = await stripe.paymentIntents.create({
      amount: 100,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      payment_method_types: ['card'],
      confirm: true,
      description: marker,
      metadata: { trovanLaunchSmoke: marker, scenario: 'refund' },
    });
    if (payment.status !== 'succeeded' || !payment.latest_charge) {
      throw new Error('Stripe refund seed payment did not succeed');
    }
    const refund = await stripe.refunds.create({
      charge:
        typeof payment.latest_charge === 'string'
          ? payment.latest_charge
          : payment.latest_charge.id,
      reason: 'requested_by_customer',
      metadata: { trovanLaunchSmoke: marker },
    });
    refundId = refund.id;
    if (!['succeeded', 'pending'].includes(refund.status)) {
      throw new Error(`Stripe refund entered unexpected status ${refund.status}`);
    }

    return {
      marker,
      customerId,
      subscriptionId,
      refundId,
      prices: {
        launch: launchPrice.id,
        scale: scalePrice.id,
      },
      assistedInvoiceMode: true,
      failedPaymentExercised: true,
      periodEndCancellationExercised: true,
      refundExercised: true,
    };
  } finally {
    if (subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId).catch(() => undefined);
    }
    if (customerId) {
      await stripe.customers.del(customerId).catch(() => undefined);
    }
  }
}

export async function createStripeClientAndRun(config) {
  const stripe = new Stripe(config.secretKey, {
    apiVersion: '2026-02-25.clover',
    timeout: 10_000,
    maxNetworkRetries: 1,
  });
  return runStripeAssistedPilotExercise(stripe, config);
}
