import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const createRepository = <T extends Record<string, unknown>>(initial: T[] = []) => {
    const items = [...initial];
    return {
      count: jest.fn(async () => 0),
      create: jest.fn((value: T) => ({
        id: `delivery-${items.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value,
      })),
      find: jest.fn(async () => [...items]),
      findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        items.find((item) =>
          Object.entries(where).every(([key, value]) => item[key] === value),
        ) || null,
      ),
      save: jest.fn(async (value: T) => value),
    } as any;
  };

  const createConfig = (values: Record<string, string> = {}) => ({
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  }) as any;

  it('returns bounded pilot-safe notification defaults with SMS disabled', async () => {
    const organizations = createRepository([{
      id: 'org-1',
      settings: {
        notifications: {
          smsEnabled: true,
          onTheWayMinutesBefore: 999,
          completionVarianceThresholdMeters: 1,
        },
      },
    }]);
    const service = new NotificationsService(
      createRepository(),
      createRepository(),
      createRepository(),
      organizations,
      createConfig({ SMS_NOTIFICATIONS_ENABLED: 'false' }),
    );

    await expect(service.getCustomerNotificationPolicy('org-1')).resolves.toMatchObject({
      emailEnabled: true,
      smsEnabled: false,
      scheduledEnabled: true,
      onTheWayEnabled: true,
      onTheWayMinutesBefore: 180,
      onTheWayRequirePreviousCompletion: true,
      completionEnabled: true,
      failureEnabled: true,
      completionVarianceThresholdMeters: 25,
    });
  });

  it('tenant-scopes recipients and reuses existing one-time delivery records', async () => {
    const existingEmail = {
      id: 'delivery-email',
      organizationId: 'org-1',
      routeId: 'route-1',
      jobId: 'job-1',
      eventType: 'en_route',
      channel: 'EMAIL',
    };
    const existingSms = {
      id: 'delivery-sms',
      organizationId: 'org-1',
      routeId: 'route-1',
      jobId: 'job-1',
      eventType: 'en_route',
      channel: 'SMS',
    };
    const deliveries = createRepository([existingEmail, existingSms]);
    const jobs = createRepository([{
      id: 'job-1',
      organizationId: 'org-1',
      customerId: 'customer-1',
      customerEmail: 'customer@example.com',
      customerPhone: '+15555550100',
    }]);
    const customers = createRepository([{
      id: 'customer-1',
      organizationId: 'org-1',
      email: 'customer@example.com',
      phone: '+15555550100',
    }]);
    const organizations = createRepository([{
      id: 'org-1',
      name: 'Acme Fleet',
      settings: { notifications: { emailEnabled: true } },
    }]);
    const service = new NotificationsService(
      deliveries,
      jobs,
      customers,
      organizations,
      createConfig(),
    );

    const result = await service.notifyCustomer({
      organizationId: 'org-1',
      routeId: 'route-1',
      routeRunStopId: 'stop-1',
      jobId: 'job-1',
      eventType: 'en_route',
    });

    expect(jobs.findOne).toHaveBeenCalledWith({
      where: { id: 'job-1', organizationId: 'org-1' },
    });
    expect(customers.findOne).toHaveBeenCalledWith({
      where: { id: 'customer-1', organizationId: 'org-1' },
    });
    expect(result).toEqual([existingEmail, existingSms]);
    expect(deliveries.save).not.toHaveBeenCalled();
  });

  it('records disabled event types as skipped without contacting providers', async () => {
    const deliveries = createRepository();
    const service = new NotificationsService(
      deliveries,
      createRepository([{
        id: 'job-1',
        organizationId: 'org-1',
        customerEmail: 'customer@example.com',
      }]),
      createRepository(),
      createRepository([{
        id: 'org-1',
        name: 'Acme Fleet',
        settings: { notifications: { scheduledEnabled: false } },
      }]),
      createConfig({ POSTMARK_SERVER_TOKEN: 'configured-for-test' }),
    );

    const result = await service.notifyCustomer({
      organizationId: 'org-1',
      routeId: 'route-1',
      jobId: 'job-1',
      eventType: 'assignment',
    });

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        channel: 'EMAIL',
        status: 'SKIPPED',
        failureReason: 'assignment notifications are disabled',
      }),
      expect.objectContaining({
        channel: 'SMS',
        status: 'SKIPPED',
        failureReason: 'assignment notifications are disabled',
      }),
    ]));
    expect(deliveries.save).toHaveBeenCalledTimes(2);
  });
});
