import { describe, expect, it, vi } from 'vitest';
import { AuditService, normalizeAuditLogLimit } from './audit.service';

function createQueryBuilder() {
  return {
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([]),
  };
}

function createService(queryBuilder = createQueryBuilder()) {
  const repository = {
    createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    create: vi.fn((value) => value),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const configService = {
    get: vi.fn(),
  };
  return {
    service: new AuditService(repository as any, configService as any),
    queryBuilder,
  };
}

describe('normalizeAuditLogLimit', () => {
  it('falls back for non-finite limits', () => {
    expect(normalizeAuditLogLimit(Number.NaN)).toBe(100);
    expect(normalizeAuditLogLimit(Number.POSITIVE_INFINITY)).toBe(100);
  });

  it('clamps limits to a bounded positive range', () => {
    expect(normalizeAuditLogLimit(-10)).toBe(1);
    expect(normalizeAuditLogLimit(2.8)).toBe(2);
    expect(normalizeAuditLogLimit(10_000)).toBe(500);
  });
});

describe('AuditService', () => {
  it('uses a normalized limit for persisted audit queries', async () => {
    const { service, queryBuilder } = createService();

    await service.listPersisted({ limit: 10_000 });

    expect(queryBuilder.limit).toHaveBeenCalledWith(500);
  });
});
