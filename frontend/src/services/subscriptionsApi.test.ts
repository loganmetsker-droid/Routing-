import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBillingOverview } from './subscriptionsApi';

describe('subscriptionsApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes billing overview payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            generatedAt: '2026-04-21T18:00:00.000Z',
            stripeConfigured: true,
            billingContactEmail: 'billing@example.com',
            activeSubscription: {
              id: 'sub-1',
              userId: 'user-1',
              stripeCustomerId: 'cus_123',
              stripeSubscriptionId: 'sub_123',
              plan: 'professional',
              status: 'active',
            },
            subscriptions: [
              {
                id: 'sub-1',
                userId: 'user-1',
                stripeCustomerId: 'cus_123',
                stripeSubscriptionId: 'sub_123',
                plan: 'professional',
                status: 'active',
              },
            ],
            plans: [
              {
                plan: 'starter',
                label: 'Starter',
                monthlyPriceUsd: 149,
                dispatcherSeats: 3,
                features: ['Dispatcher workspace'],
                stripePriceConfigured: true,
              },
            ],
            controls: {
              invoiceAutomationReady: true,
              failedPaymentHandlingReady: true,
              webhookConfigured: true,
            },
            recommendations: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: () => 'token-123',
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    });

    const overview = await getBillingOverview();

    expect(overview.stripeConfigured).toBe(true);
    expect(overview.activeSubscription?.plan).toBe('professional');
    expect(overview.plans[0].monthlyPriceUsd).toBe(149);
    expect(overview.controls.webhookConfigured).toBe(true);
  });
});
