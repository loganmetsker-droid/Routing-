import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { PostmarkBounceDto } from './dto/postmark-bounce.dto';
import type { PostmarkBounceEvent } from './entities/postmark-bounce-event.entity';
import {
  parseBasicAuthorization,
  PostmarkEventsService,
} from './postmark-events.service';

const bounce: PostmarkBounceDto = {
  RecordType: 'Bounce',
  ID: 42,
  Type: 'SoftBounce',
  TypeCode: 409,
  Name: 'Soft bounce',
  MessageID: 'message-1',
  MessageStream: 'outbound',
  Email: 'operator@example.com',
  BouncedAt: '2026-08-06T12:00:00.000Z',
  Inactive: false,
  Metadata: {},
};

function harness() {
  const create = vi.fn((value) => value);
  const repository = {
    findOne: vi.fn().mockResolvedValue(null),
    create,
    save: vi.fn(async (value) => ({
      id: 'bounce-1',
      createdAt: new Date(),
      ...value,
    })),
    find: vi.fn().mockResolvedValue([]),
  } as unknown as Repository<PostmarkBounceEvent>;
  const values = new Map([
    ['POSTMARK_WEBHOOK_USERNAME', 'postmark'],
    ['POSTMARK_WEBHOOK_PASSWORD', 'webhook-secret'],
    ['POSTMARK_BOUNCE_HASH_KEY', 'hash-key'],
  ]);
  const config = {
    get: vi.fn((name: string, fallback?: string) => values.get(name) ?? fallback),
  } as unknown as ConfigService;
  const monitoring = { capture: vi.fn() };
  return {
    repository,
    create,
    monitoring,
    service: new PostmarkEventsService(repository, config, monitoring as never),
  };
}

describe('PostmarkEventsService', () => {
  it('parses bounded basic authorization', () => {
    expect(
      parseBasicAuthorization(`Basic ${Buffer.from('postmark:secret').toString('base64')}`),
    ).toEqual({ username: 'postmark', password: 'secret' });
    expect(parseBasicAuthorization('Bearer token')).toBeNull();
  });

  it('requires the configured webhook credentials', () => {
    const { service } = harness();
    expect(() => service.assertAuthorized('Basic invalid')).toThrow(
      'Invalid Postmark webhook credentials',
    );
    expect(() =>
      service.assertAuthorized(
        `Basic ${Buffer.from('postmark:webhook-secret').toString('base64')}`,
      ),
    ).not.toThrow();
  });

  it('persists a hashed bounce receipt and emits a redacted alert', async () => {
    const { service, repository, create, monitoring } = harness();
    const result = await service.recordBounce(bounce);
    expect(result.duplicate).toBe(false);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'message-1',
        bounceType: 'SoftBounce',
        recipientHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    const persisted = create.mock.calls[0][0];
    expect(persisted).not.toHaveProperty('Email');
    expect(persisted).not.toHaveProperty('recipientEmail');
    expect(monitoring.capture).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'PostmarkBounce' }),
    );
  });

  it('treats a concurrent unique insert as an idempotent duplicate', async () => {
    const { service, repository, monitoring } = harness();
    const duplicate = {
      id: 'bounce-existing',
      providerBounceId: '42',
      messageId: 'message-1',
    } as PostmarkBounceEvent;
    vi.mocked(repository.save).mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    );
    vi.mocked(repository.findOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(duplicate);

    const result = await service.recordBounce(bounce);

    expect(result).toEqual({ event: duplicate, duplicate: true });
    expect(monitoring.capture).not.toHaveBeenCalled();
  });
});
