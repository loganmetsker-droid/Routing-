import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

function repositoryMock() {
  return {
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn((value) => ({ ...value })),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (value) => ({ id: `delivery-${Math.random()}`, ...value })),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
}

function createService(values: Record<string, string> = {}) {
  const config = {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as ConfigService;
  const deliveries = repositoryMock();
  const jobs = repositoryMock();
  const customers = repositoryMock();
  const organizations = repositoryMock();
  const service = new NotificationsService(
    deliveries as never,
    jobs as never,
    customers as never,
    organizations as never,
    config,
  );
  return {
    service,
    deliveries,
    jobs,
    customers,
    organizations,
  };
}

describe('NotificationsService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires both the Postmark token and sender', async () => {
    const { service } = createService({
      POSTMARK_SERVER_TOKEN: 'postmark-test-token',
    });

    await expect(service.checkReadiness()).resolves.toEqual({
      configured: false,
      status: 'missing',
    });
  });

  it('reports a successful Postmark server probe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
    const { service } = createService({
      POSTMARK_SERVER_TOKEN: 'postmark-test-token',
      POSTMARK_FROM_EMAIL: 'pilot@example.test',
    });

    await expect(service.checkReadiness()).resolves.toEqual({
      configured: true,
      status: 'up',
      providerStatus: 200,
    });
  });

  it('sends email through Postmark, applies reply-to branding, and keeps SMS skipped', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ MessageID: 'postmark-message-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const context = createService({
      POSTMARK_SERVER_TOKEN: 'postmark-test-token',
      POSTMARK_FROM_EMAIL: 'updates@example.test',
      SMS_NOTIFICATIONS_ENABLED: 'false',
    });
    context.jobs.findOne.mockResolvedValue({
      id: 'job-a',
      organizationId: 'org-a',
      customerEmail: ' Customer@Example.com ',
      customerPhone: '+15550100',
      customerId: null,
    });
    context.organizations.findOne.mockResolvedValue({
      id: 'org-a',
      name: 'Acme Fleet',
      settings: {
        branding: {
          brandName: 'Acme Delivery',
          supportEmail: 'support@example.test',
        },
        notifications: {
          emailEnabled: true,
          smsEnabled: true,
          replyToEmail: 'dispatch@example.test',
        },
      },
    });

    const result = await context.service.notifyCustomer({
      organizationId: 'org-a',
      routeId: 'route-a',
      jobId: 'job-a',
      eventType: 'en_route',
      trackingUrl: 'https://track.example.test/a',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      channel: 'EMAIL',
      recipient: 'customer@example.com',
      provider: 'postmark',
      status: 'SENT',
      providerMessageId: 'postmark-message-1',
    });
    expect(result[1]).toMatchObject({
      channel: 'SMS',
      status: 'SKIPPED',
      failureReason: 'SMS notifications are disabled',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      From: 'updates@example.test',
      To: 'customer@example.com',
      ReplyTo: 'dispatch@example.test',
    });
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('persists a failed Postmark attempt for operator readback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({ Message: 'Sender signature missing' }),
      }),
    );
    const context = createService({
      POSTMARK_SERVER_TOKEN: 'postmark-test-token',
      POSTMARK_FROM_EMAIL: 'updates@example.test',
    });
    context.jobs.findOne.mockResolvedValue({
      id: 'job-a',
      organizationId: 'org-a',
      customerEmail: 'customer@example.com',
    });
    context.organizations.findOne.mockResolvedValue({
      id: 'org-a',
      name: 'Acme Fleet',
      settings: { notifications: { emailEnabled: true } },
    });

    const result = await context.service.notifyCustomer({
      organizationId: 'org-a',
      jobId: 'job-a',
      eventType: 'failed_delivery',
      reason: 'Customer unavailable',
    });

    expect(result[0]).toMatchObject({
      channel: 'EMAIL',
      provider: 'postmark',
      status: 'FAILED',
      failureReason: 'Sender signature missing',
      attempts: 1,
      nextAttemptAt: null,
      metadata: {
        retryable: false,
        outcomeUnknown: false,
        providerStatus: 422,
      },
    });
    expect(context.deliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'EMAIL',
        status: 'FAILED',
      }),
    );
  });

  it('records a bounded Postmark timeout as a failed delivery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')),
    );
    const context = createService({
      POSTMARK_SERVER_TOKEN: 'postmark-test-token',
      POSTMARK_FROM_EMAIL: 'updates@example.test',
    });
    context.jobs.findOne.mockResolvedValue({
      id: 'job-a',
      organizationId: 'org-a',
      customerEmail: 'customer@example.com',
    });
    context.organizations.findOne.mockResolvedValue({
      id: 'org-a',
      name: 'Acme Fleet',
      settings: { notifications: { emailEnabled: true } },
    });

    const result = await context.service.notifyCustomer({
      organizationId: 'org-a',
      jobId: 'job-a',
      eventType: 'eta_updated',
    });

    expect(result[0]).toMatchObject({
      channel: 'EMAIL',
      provider: 'postmark',
      status: 'FAILED',
      failureReason: 'Postmark request timed out',
      attempts: 1,
      nextAttemptAt: null,
      metadata: {
        retryable: false,
        outcomeUnknown: true,
        providerStatus: null,
      },
    });
  });

  it('uses one durable reservation for repeated notification events', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ MessageID: 'postmark-message-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const context = createService({
      POSTMARK_SERVER_TOKEN: 'postmark-test-token',
      POSTMARK_FROM_EMAIL: 'updates@example.test',
    });
    context.jobs.findOne.mockResolvedValue({
      id: 'job-a',
      organizationId: 'org-a',
      customerEmail: 'customer@example.com',
    });
    context.organizations.findOne.mockResolvedValue({
      id: 'org-a',
      name: 'Acme Fleet',
      settings: { notifications: { emailEnabled: true } },
    });

    const stored = new Map<string, Record<string, unknown>>();
    context.deliveries.save.mockImplementation(async (value) => {
      if (!value.id) {
        if (stored.has(value.idempotencyKey)) {
          throw Object.assign(new Error('duplicate'), { code: '23505' });
        }
        value.id = `delivery-${stored.size + 1}`;
      }
      stored.set(value.idempotencyKey, value);
      return value;
    });
    context.deliveries.findOne.mockImplementation(async ({ where }) => {
      return stored.get(where.idempotencyKey) || null;
    });

    const input = {
      organizationId: 'org-a',
      routeId: 'route-a',
      routeRunStopId: 'stop-a',
      jobId: 'job-a',
      eventType: 'en_route' as const,
      trackingUrl: 'https://track.example.test/token-a',
    };
    const first = await context.service.notifyCustomer(input);
    const repeated = await context.service.notifyCustomer({
      ...input,
      trackingUrl: 'https://track.example.test/token-b',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(repeated.map((delivery) => delivery.id)).toEqual(
      first.map((delivery) => delivery.id),
    );
    expect(repeated[0]).toMatchObject({
      status: 'SENT',
      attempts: 1,
      providerMessageId: 'postmark-message-1',
    });
  });

  it('retries known transient provider failures and stops after success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({ Message: 'Provider unavailable' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ MessageID: 'postmark-message-2' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const context = createService({
      POSTMARK_SERVER_TOKEN: 'postmark-test-token',
      POSTMARK_FROM_EMAIL: 'updates@example.test',
      NOTIFICATION_RETRY_BASE_SECONDS: '5',
    });
    context.jobs.findOne.mockResolvedValue({
      id: 'job-a',
      organizationId: 'org-a',
      customerEmail: 'customer@example.com',
    });
    context.organizations.findOne.mockResolvedValue({
      id: 'org-a',
      name: 'Acme Fleet',
      settings: { notifications: { emailEnabled: true } },
    });

    const initial = await context.service.notifyCustomer({
      organizationId: 'org-a',
      routeRunStopId: 'stop-a',
      jobId: 'job-a',
      eventType: 'arriving_soon',
    });
    const failed = initial[0];
    expect(failed).toMatchObject({
      status: 'FAILED',
      attempts: 1,
      metadata: {
        retryable: true,
        outcomeUnknown: false,
        providerStatus: 503,
      },
    });
    expect(failed.nextAttemptAt).toBeInstanceOf(Date);

    failed.nextAttemptAt = new Date(Date.now() - 1_000);
    context.deliveries.find.mockResolvedValue([failed]);
    context.deliveries.findOne.mockImplementation(async ({ where }) => ({
      ...failed,
      status: 'PENDING',
      nextAttemptAt: null,
      attemptToken: where.attemptToken,
    }));

    await expect(context.service.retryDueDeliveries()).resolves.toEqual({
      attempted: 1,
      sent: 1,
      failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(context.deliveries.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'SENT',
        attempts: 2,
        nextAttemptAt: null,
        providerMessageId: 'postmark-message-2',
      }),
    );
  });

  it('scopes job and customer lookups to the notification organization', async () => {
    const context = createService({
      POSTMARK_SERVER_TOKEN: 'postmark-test-token',
      POSTMARK_FROM_EMAIL: 'updates@example.test',
    });

    const result = await context.service.notifyCustomer({
      organizationId: 'org-a',
      jobId: 'job-from-org-b',
      customerId: 'customer-from-org-b',
      eventType: 'assignment',
    });

    expect(context.jobs.findOne).toHaveBeenCalledWith({
      where: { id: 'job-from-org-b', organizationId: 'org-a' },
    });
    expect(context.customers.findOne).toHaveBeenCalledWith({
      where: { id: 'customer-from-org-b', organizationId: 'org-a' },
    });
    expect(result).toEqual([
      expect.objectContaining({
        channel: 'EMAIL',
        status: 'SKIPPED',
        failureReason: 'Missing email recipient',
      }),
      expect.objectContaining({
        channel: 'SMS',
        status: 'SKIPPED',
        failureReason: 'SMS notifications are disabled',
      }),
    ]);
  });
});
