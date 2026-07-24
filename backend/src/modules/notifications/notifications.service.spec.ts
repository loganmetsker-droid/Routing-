import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

function createService(values: Record<string, string>) {
  const config = {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as ConfigService;
  return new NotificationsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    config,
  );
}

describe('NotificationsService readiness', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires both the Postmark token and sender', async () => {
    const service = createService({
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
    const service = createService({
      POSTMARK_SERVER_TOKEN: 'postmark-test-token',
      POSTMARK_FROM_EMAIL: 'pilot@example.test',
    });

    await expect(service.checkReadiness()).resolves.toEqual({
      configured: true,
      status: 'up',
      providerStatus: 200,
    });
  });
});
