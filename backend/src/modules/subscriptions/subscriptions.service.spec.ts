import { ConfigService } from '@nestjs/config';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  function createRepo(initial: any[] = []) {
    let items = [...initial];
    return {
      create: (value: any) => ({ ...value }),
      save: async (value: any) => {
        const index = items.findIndex((item) => item.id === value.id);
        if (index >= 0) {
          items[index] = { ...items[index], ...value };
        } else {
          items.push(value);
        }
        return value;
      },
      find: async ({ where }: any = {}) =>
        items.filter((item) =>
          !where
            ? true
            : Object.entries(where).every(([key, expected]) => item[key] === expected),
        ),
      findOne: async ({ where }: any = {}) =>
        items.find((item) =>
          !where
            ? true
            : Object.entries(where).every(([key, expected]) => item[key] === expected),
        ) || null,
    } as any;
  }

  function createService(subscriptionRepo: any, config: ConfigService, webhookRepo = createRepo()) {
    return new SubscriptionsService(subscriptionRepo, webhookRepo, config);
  }

  it('reports billing readiness truthfully when Stripe is not configured', async () => {
    const repo = createRepo([
      {
        id: 'sub-1',
        userId: 'user-1',
        organizationId: 'org-1',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        plan: SubscriptionPlan.PROFESSIONAL,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
      },
    ]);
    const config = {
      get: (key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return undefined;
        if (key === 'STRIPE_WEBHOOK_SECRET') return undefined;
        return undefined;
      },
    } as ConfigService;

    const service = createService(repo, config);
    const plans = service.getPlanCatalog();
    const overview = await service.getBillingOverview({
      userId: 'user-1',
      email: 'owner@example.com',
      organizationId: 'org-1',
    });

    expect(plans.stripeConfigured).toBe(false);
    expect(plans.plans).toHaveLength(3);
    expect(overview.stripeConfigured).toBe(false);
    expect(overview.activeSubscription?.id).toBe('sub-1');
    expect(overview.recommendations[0]).toContain('Configure STRIPE_SECRET_KEY');
  });

  it('keeps subscription reads scoped to the actor organization', async () => {
    const repo = createRepo([
      {
        id: 'sub-org-1',
        userId: 'user-1',
        organizationId: 'org-1',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'stripe_sub_123',
        plan: SubscriptionPlan.PROFESSIONAL,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
      },
      {
        id: 'sub-org-2',
        userId: 'user-1',
        organizationId: 'org-2',
        stripeCustomerId: 'cus_456',
        stripeSubscriptionId: 'stripe_sub_456',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
      },
    ]);
    const config = {
      get: () => undefined,
    } as unknown as ConfigService;
    const service = createService(repo, config);

    const subscriptions = await service.getCustomerSubscriptions('user-1', 'org-1');
    const visibleSubscription = await service.getSubscription('sub-org-1', 'org-1');

    expect(subscriptions.map((subscription) => subscription.id)).toEqual([
      'sub-org-1',
    ]);
    expect(visibleSubscription.id).toBe('sub-org-1');
    await expect(service.getSubscription('sub-org-2', 'org-1')).rejects.toThrow(
      'Subscription sub-org-2 not found',
    );
  });

  it('records processed Stripe webhook IDs and ignores duplicates', async () => {
    const subscriptionRepo = createRepo([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        stripeSubscriptionId: 'stripe_sub_123',
        status: SubscriptionStatus.PAST_DUE,
      },
    ]);
    const webhookRepo = createRepo();
    const config = {
      get: (key: string) => (key === 'STRIPE_SECRET_KEY' ? 'sk_test_configured' : undefined),
    } as ConfigService;
    const service = createService(subscriptionRepo, config, webhookRepo);

    await service.handleWebhookEvent({
      id: 'evt_123',
      type: 'invoice.payment_succeeded',
      livemode: false,
      data: { object: { subscription: 'stripe_sub_123' } },
    } as any);
    await service.handleWebhookEvent({
      id: 'evt_123',
      type: 'invoice.payment_succeeded',
      livemode: false,
      data: { object: { subscription: 'stripe_sub_123' } },
    } as any);

    const subscription = await subscriptionRepo.findOne({
      where: { stripeSubscriptionId: 'stripe_sub_123' },
    });
    const webhookEvents = await webhookRepo.find();

    expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(webhookEvents).toHaveLength(1);
    expect(webhookEvents[0].processedAt).toBeInstanceOf(Date);
  });
});
