import { unwrapApiData } from '@shared/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import { isPreview } from './api.preview';
import {
  type BillingOverviewRecord,
  type BillingPlanRecord,
  type BillingSubscriptionRecord,
  isRecord,
} from './api.types';
import { queryKeys } from './queryKeys';

const normalizeSubscription = (value: unknown): BillingSubscriptionRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `subscription-${Math.random().toString(36).slice(2, 8)}`,
    userId: typeof record.userId === 'string' ? record.userId : 'unknown',
    stripeCustomerId:
      typeof record.stripeCustomerId === 'string'
        ? record.stripeCustomerId
        : 'unknown',
    stripeSubscriptionId:
      typeof record.stripeSubscriptionId === 'string'
        ? record.stripeSubscriptionId
        : 'unknown',
    plan: typeof record.plan === 'string' ? record.plan : 'starter',
    status: typeof record.status === 'string' ? record.status : 'incomplete',
    currentPeriodStart:
      typeof record.currentPeriodStart === 'string'
        ? record.currentPeriodStart
        : undefined,
    currentPeriodEnd:
      typeof record.currentPeriodEnd === 'string'
        ? record.currentPeriodEnd
        : undefined,
    cancelAtPeriodEnd: Boolean(record.cancelAtPeriodEnd),
    canceledAt:
      typeof record.canceledAt === 'string' ? record.canceledAt : null,
  };
};

const normalizePlan = (value: unknown): BillingPlanRecord => {
  const record = isRecord(value) ? value : {};
  return {
    plan: typeof record.plan === 'string' ? record.plan : 'starter',
    label: typeof record.label === 'string' ? record.label : 'Plan',
    monthlyPriceUsd: Number(record.monthlyPriceUsd || 0),
    dispatcherSeats: Number(record.dispatcherSeats || 0),
    features: Array.isArray(record.features)
      ? record.features.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    stripePriceConfigured: Boolean(record.stripePriceConfigured),
  };
};

const normalizeBillingOverview = (value: unknown): BillingOverviewRecord => {
  const record = isRecord(value) ? value : {};
  const controls = isRecord(record.controls) ? record.controls : {};
  return {
    generatedAt:
      typeof record.generatedAt === 'string'
        ? record.generatedAt
        : new Date().toISOString(),
    stripeConfigured: Boolean(record.stripeConfigured),
    organizationId:
      typeof record.organizationId === 'string' ? record.organizationId : null,
    billingContactEmail:
      typeof record.billingContactEmail === 'string'
        ? record.billingContactEmail
        : null,
    activeSubscription: record.activeSubscription
      ? normalizeSubscription(record.activeSubscription)
      : null,
    subscriptions: Array.isArray(record.subscriptions)
      ? record.subscriptions.map(normalizeSubscription)
      : [],
    plans: Array.isArray(record.plans)
      ? record.plans.map(normalizePlan)
      : [],
    controls: {
      invoiceAutomationReady: Boolean(controls.invoiceAutomationReady),
      failedPaymentHandlingReady: Boolean(controls.failedPaymentHandlingReady),
      webhookConfigured: Boolean(controls.webhookConfigured),
    },
    recommendations: Array.isArray(record.recommendations)
      ? record.recommendations.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
  };
};

export const getBillingOverview = async (): Promise<BillingOverviewRecord> => {
  if (isPreview()) {
    return {
      generatedAt: new Date().toISOString(),
      stripeConfigured: false,
      organizationId: 'preview-org',
      billingContactEmail: 'billing@trovan.local',
      activeSubscription: null,
      subscriptions: [],
      plans: [
        {
          plan: 'starter',
          label: 'Starter',
          monthlyPriceUsd: 149,
          dispatcherSeats: 3,
          features: [
            'Dispatcher workspace',
            'Driver PWA',
            'Public tracking',
            'Core analytics',
          ],
          stripePriceConfigured: false,
        },
        {
          plan: 'professional',
          label: 'Professional',
          monthlyPriceUsd: 399,
          dispatcherSeats: 15,
          features: [
            'Advanced analytics',
            'Exception workflows',
            'Operational audit history',
            'Priority support',
          ],
          stripePriceConfigured: false,
        },
        {
          plan: 'enterprise',
          label: 'Enterprise',
          monthlyPriceUsd: 999,
          dispatcherSeats: 999,
          features: [
            'SSO-ready posture',
            'Branding controls',
            'Security visibility',
            'Enterprise support',
          ],
          stripePriceConfigured: false,
        },
      ],
      controls: {
        invoiceAutomationReady: false,
        failedPaymentHandlingReady: false,
        webhookConfigured: false,
      },
      recommendations: [
        'Configure Stripe before enabling self-serve billing.',
      ],
    };
  }

  const response = await apiFetch('/api/subscriptions/overview');
  return normalizeBillingOverview(
    unwrapApiData<unknown>(await response.json()),
  );
};

export const useBillingOverviewQuery = () =>
  useQuery({
    queryKey: queryKeys.billingOverview,
    queryFn: getBillingOverview,
  });
