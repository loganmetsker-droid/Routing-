import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformService } from './platform.service';

function repositoryMock() {
  return {
    count: vi.fn(),
    create: vi.fn((value) => value),
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(),
  };
}

describe('PlatformService', () => {
  let apiKeys: ReturnType<typeof repositoryMock>;
  let webhookEndpoints: ReturnType<typeof repositoryMock>;
  let webhookDeliveries: ReturnType<typeof repositoryMock>;
  let service: PlatformService;

  beforeEach(() => {
    apiKeys = repositoryMock();
    webhookEndpoints = repositoryMock();
    webhookDeliveries = repositoryMock();
    const config = {
      get: vi.fn((key: string, fallback?: string) =>
        key === 'API_KEY_HASH_SECRET'
          ? 'unit-test-api-key-hash-secret'
          : fallback,
      ),
    } as unknown as ConfigService;
    service = new PlatformService(
      apiKeys as never,
      webhookEndpoints as never,
      webhookDeliveries as never,
      config,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a one-time API key secret with normalized unique scopes', async () => {
    apiKeys.save.mockImplementation(async (value) => ({
      id: 'key-1',
      createdAt: new Date('2026-07-24T12:00:00Z'),
      updatedAt: new Date('2026-07-24T12:00:00Z'),
      revokedAt: null,
      lastUsedAt: null,
      ...value,
    }));

    const result = await service.createApiKey(
      'org-a',
      { name: '  Dispatch sync  ', scopes: ['JOBS:READ', 'jobs:read', ''] },
      'user-a',
    );

    expect(result.secret).toMatch(/^trovan_[a-f0-9]{10}_[a-f0-9]{48}$/);
    expect(result.apiKey).toMatchObject({
      organizationId: 'org-a',
      name: 'Dispatch sync',
      scopes: ['jobs:read'],
      createdByUserId: 'user-a',
    });
    expect(result.apiKey).not.toHaveProperty('keyHash');
  });

  it('authenticates the generated key, updates last use, and rejects altered or revoked keys', async () => {
    let stored: Record<string, any> | null = null;
    apiKeys.save.mockImplementation(async (value) => {
      stored = {
        id: 'key-1',
        createdAt: new Date('2026-07-24T12:00:00Z'),
        updatedAt: new Date('2026-07-24T12:00:00Z'),
        revokedAt: null,
        lastUsedAt: null,
        ...value,
      };
      return stored;
    });
    apiKeys.findOne.mockImplementation(async ({ where }) => {
      if (!stored || where.prefix !== stored.prefix) return null;
      return stored;
    });

    const created = await service.createApiKey('org-a', { name: 'Sync' }, 'user-a');
    await expect(service.authenticateApiKey(`${created.secret}bad`)).resolves.toBeNull();
    await expect(service.authenticateApiKey(created.secret)).resolves.toMatchObject({
      id: 'key-1',
      organizationId: 'org-a',
    });
    expect(stored?.lastUsedAt).toBeInstanceOf(Date);

    if (stored) stored.revokedAt = new Date();
    await expect(service.authenticateApiKey(created.secret)).resolves.toBeNull();
  });

  it('scopes revocation and replay lookups to the current organization', async () => {
    apiKeys.findOne.mockResolvedValue(null);
    await expect(service.revokeApiKey('key-from-org-b', 'org-a')).rejects.toThrow(
      new NotFoundException('API key not found: key-from-org-b'),
    );
    expect(apiKeys.findOne).toHaveBeenCalledWith({
      where: { id: 'key-from-org-b', organizationId: 'org-a' },
    });

    webhookDeliveries.findOne.mockResolvedValue(null);
    await expect(
      service.replayWebhookDelivery('org-a', 'delivery-from-org-b'),
    ).rejects.toThrow(
      new NotFoundException(
        'Webhook delivery not found: delivery-from-org-b',
      ),
    );
    expect(webhookDeliveries.findOne).toHaveBeenCalledWith({
      where: { id: 'delivery-from-org-b', organizationId: 'org-a' },
    });
  });

  it('rejects private webhook destinations before persisting them', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(
      service.createWebhookEndpoint('org-a', {
        name: 'Internal target',
        url: 'http://127.0.0.1:3000/hooks',
        subscribedEvents: ['route.completed'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(webhookEndpoints.save).not.toHaveBeenCalled();
  });

  it('does not create deliveries when no active endpoint subscribes to an event', async () => {
    webhookEndpoints.find.mockResolvedValue([
      {
        id: 'endpoint-1',
        organizationId: 'org-a',
        status: 'ACTIVE',
        subscribedEvents: ['job.created'],
      },
    ]);

    await expect(
      service.dispatchWebhookEvent({
        organizationId: 'org-a',
        eventType: 'route.completed',
        payload: { routeId: 'route-1' },
      }),
    ).resolves.toEqual({ delivered: 0, skipped: 0, failed: 0 });
    expect(webhookDeliveries.save).not.toHaveBeenCalled();
  });
});
