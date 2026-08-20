import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
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

function createHarness(existing: MarketingLead | null = null) {
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
    find: vi.fn(async () => []),
  } as unknown as Repository<MarketingLead>;
  const config = {
    get: vi.fn(() => undefined),
  } as unknown as ConfigService;
  return { service: new MarketingLeadsService(repository, config), repository, save };
}

describe('MarketingLeadsService', () => {
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
});
