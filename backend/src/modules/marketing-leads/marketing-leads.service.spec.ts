import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import type { MarketingLead } from './entities/marketing-lead.entity';
import { MarketingLeadsService } from './marketing-leads.service';

const validLead: CreateMarketingLeadDto = {
  name: 'Jordan Lee',
  workEmail: 'jordan@example.com',
  company: 'Example Logistics',
  fleetSize: '16–35',
  exactFleetSize: 24,
  requestType: 'Book demo',
  notes: 'Interested in dispatch and proof workflows.',
  source: 'trytrovan.com',
  pagePath: '/pricing',
};

function createHarness(
  existing: MarketingLead | null = null,
  configValues: Record<string, string> = {},
  dueLeads: MarketingLead[] = [],
) {
  const save = vi.fn(async (lead: MarketingLead) => {
    lead.id ||= 'lead-1';
    lead.createdAt ||= new Date('2026-07-10T20:00:00.000Z');
    lead.updatedAt ||= lead.createdAt;
    return lead;
  });
  const repository = {
    findOne: vi.fn(async () => existing),
    create: vi.fn((input) => ({ ...input }) as MarketingLead),
    save,
    find: vi.fn(async () => dueLeads),
    update: vi.fn(async () => ({ affected: 1 })),
  } as unknown as Repository<MarketingLead>;
  const config = {
    get: vi.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  return { service: new MarketingLeadsService(repository, config), repository, save };
}

describe('MarketingLeadsService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists a validated lead before marking unconfigured notification delivery as skipped', async () => {
    const { service, repository, save } = createHarness();

    const result = await service.create(validLead);

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      workEmail: 'jordan@example.com',
      exactFleetSize: 24,
      status: 'new',
      notificationStatus: 'pending',
    }));
    expect(save).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      id: 'lead-1',
      duplicate: false,
      notificationStatus: 'skipped',
    });
  });

  it('deduplicates repeated submissions from the same email during the safety window', async () => {
    const existing = {
      id: 'lead-existing',
      workEmail: validLead.workEmail,
      notificationStatus: 'sent',
    } as MarketingLead;
    const { service, repository, save } = createHarness(existing);

    const result = await service.create(validLead);

    expect(repository.create).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'lead-existing',
      duplicate: true,
      notificationStatus: 'sent',
    });
  });

  it('quietly accepts honeypot submissions without writing them', async () => {
    const { service, repository, save } = createHarness();

    const result = await service.create({ ...validLead, website: 'https://spam.example' });

    expect(repository.findOne).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'accepted',
      duplicate: false,
      notificationStatus: 'skipped',
    });
  });

  it('fails global lead readback closed outside the platform-operator allowlist', () => {
    const { service } = createHarness(null, {
      LEAD_INTAKE_OPERATOR_EMAILS:
        'owner@trytrovan.com, launch@trytrovan.com',
    });

    expect(service.hasOperatorAccess(' OWNER@TRYTROVAN.COM ')).toBe(true);
    expect(service.hasOperatorAccess('customer-admin@example.com')).toBe(false);
    expect(() =>
      service.assertOperatorAccess('customer-admin@example.com'),
    ).toThrow('Platform operator access required');
  });

  it('records a successful Postmark attempt before reporting delivery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    const { service, save } = createHarness(null, {
      POSTMARK_SERVER_TOKEN: 'postmark-token',
      LEAD_INTAKE_FROM_EMAIL: 'leads@trytrovan.com',
      LEAD_INTAKE_EMAIL: 'operator@trytrovan.com',
    });

    const result = await service.create(validLead);
    const savedLead = save.mock.calls.at(-1)?.[0];

    expect(result.notificationStatus).toBe('sent');
    expect(savedLead).toEqual(
      expect.objectContaining({
        notificationStatus: 'sent',
        notificationAttempts: 1,
        notificationError: null,
        nextNotificationAttemptAt: null,
      }),
    );
    expect(savedLead?.lastNotificationAttemptAt).toBeInstanceOf(Date);
  });

  it('schedules only confirmed transient Postmark failures for bounded retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    );
    const { service, save } = createHarness(null, {
      POSTMARK_SERVER_TOKEN: 'postmark-token',
      LEAD_INTAKE_FROM_EMAIL: 'leads@trytrovan.com',
      LEAD_INTAKE_EMAIL: 'operator@trytrovan.com',
      LEAD_NOTIFICATION_MAX_ATTEMPTS: '3',
      LEAD_NOTIFICATION_RETRY_BASE_SECONDS: '1',
    });

    const result = await service.create(validLead);
    const savedLead = save.mock.calls.at(-1)?.[0];

    expect(result.notificationStatus).toBe('failed');
    expect(savedLead?.notificationError).toBe(
      'Postmark returned 503; retry scheduled',
    );
    expect(savedLead?.nextNotificationAttemptAt).toBeInstanceOf(Date);
  });

  it('requires operator review after an ambiguous network outcome', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('socket reset');
      }),
    );
    const { service, save } = createHarness(null, {
      POSTMARK_SERVER_TOKEN: 'postmark-token',
      LEAD_INTAKE_FROM_EMAIL: 'leads@trytrovan.com',
      LEAD_INTAKE_EMAIL: 'operator@trytrovan.com',
    });

    const result = await service.create(validLead);
    const savedLead = save.mock.calls.at(-1)?.[0];

    expect(result.notificationStatus).toBe('failed');
    expect(savedLead?.notificationError).toContain('outcome is uncertain');
    expect(savedLead?.nextNotificationAttemptAt).toBeNull();
  });

  it('retries due lead notifications and reports the outcome', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
    const dueLead = {
      id: 'lead-due',
      ...validLead,
      status: 'new',
      notificationStatus: 'failed',
      notificationAttempts: 1,
      nextNotificationAttemptAt: new Date(Date.now() - 1000),
    } as MarketingLead;
    const { service, repository } = createHarness(
      null,
      {
        POSTMARK_SERVER_TOKEN: 'postmark-token',
        LEAD_INTAKE_FROM_EMAIL: 'leads@trytrovan.com',
        LEAD_INTAKE_EMAIL: 'operator@trytrovan.com',
      },
      [dueLead],
    );

    await expect(service.retryDueOperatorNotifications()).resolves.toEqual({
      attempted: 1,
      sent: 1,
      failed: 0,
    });
    expect(dueLead.notificationAttempts).toBe(2);
    expect(dueLead.notificationStatus).toBe('sent');
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lead-due',
        notificationStatus: 'failed',
      }),
      expect.objectContaining({
        notificationStatus: 'pending',
        nextNotificationAttemptAt: null,
      }),
    );
  });

  it('rejects a manual retry when another worker already claimed the lead', async () => {
    const existing = {
      id: 'lead-contended',
      notificationStatus: 'failed',
      notificationAttempts: 1,
    } as MarketingLead;
    const { service, repository } = createHarness(existing, {
      POSTMARK_SERVER_TOKEN: 'postmark-token',
      LEAD_INTAKE_FROM_EMAIL: 'leads@trytrovan.com',
      LEAD_INTAKE_EMAIL: 'operator@trytrovan.com',
    });
    vi.mocked(repository.update).mockResolvedValueOnce({
      affected: 0,
      generatedMaps: [],
      raw: [],
    });

    await expect(
      service.retryOperatorNotification(existing.id),
    ).rejects.toThrow('state changed; refresh before retrying');
  });
});
