import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';

function runtimeSummary(overrides: Record<string, unknown> = {}) {
  return {
    startedAt: new Date().toISOString(),
    envSource: 'test',
    nodeEnv: 'production',
    authMode: 'workos',
    queue: { mode: 'redis', required: true },
    worker: {
      mode: 'embedded',
      state: 'idle',
      registeredAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      lastRunStartedAt: null,
      lastRunCompletedAt: null,
      lastRunDurationMs: null,
      lastFailure: null,
    },
    optimization: { mode: 'service' },
    storage: { mode: 'r2', configured: true },
    database: {
      source: 'DATABASE_URL',
      host: 'db',
      port: 5432,
      database: 'trovan',
    },
    integrations: {
      workos: { configured: true },
      stripe: { configured: true },
      postmark: { configured: true },
      leadIntake: {
        persistenceConfigured: true,
        operatorNotificationConfigured: true,
      },
      twilio: { configured: false },
      storage: { configured: true, mode: 'r2' },
    },
    ...overrides,
  };
}

function createController(summary = runtimeSummary()) {
  const config = new Map<string, string>([
    ['NODE_ENV', 'production'],
    ['QUEUE_REQUIRED', 'true'],
    ['REDIS_URL', 'redis://redis:6379'],
    ['ROUTING_SERVICE_URL', 'https://routing.example.test'],
  ]);
  return new HealthController(
    {} as never,
    { pingCheck: vi.fn().mockResolvedValue({ database: { status: 'up' } }) } as never,
    {} as never,
    {} as never,
    { get: (key: string, fallback?: string) => config.get(key) ?? fallback } as ConfigService,
    { getSummary: () => summary } as never,
    {
      getQueueStatus: vi.fn().mockResolvedValue({
        queueEnabled: true,
        waiting: [],
        counts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
      }),
    } as never,
    {
      getOverview: vi.fn().mockResolvedValue({ controls: { emailReady: true } }),
      checkReadiness: vi.fn().mockResolvedValue({
        configured: true,
        status: 'up',
        providerStatus: 200,
      }),
    } as never,
    { getOverview: vi.fn().mockResolvedValue({ controls: {} }) } as never,
    {
      checkReadiness: vi.fn().mockResolvedValue({
        configured: true,
        status: 'up',
        providerStatus: 200,
      }),
    } as never,
    {
      checkReadiness: vi.fn().mockResolvedValue({
        configured: true,
        mode: 'r2',
        status: 'up',
        providerStatus: 404,
      }),
    } as never,
  );
}

describe('HealthController readiness', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 200 when every assisted-pilot dependency is ready', async () => {
    const response = { status: vi.fn() };
    const result = await createController().readiness(response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(result.status).toBe('ok');
    expect(result.missingCritical).toEqual([]);
  });

  it('returns 503 when the hosted worker has no current heartbeat', async () => {
    const summary = runtimeSummary({
      worker: {
        ...runtimeSummary().worker,
        heartbeatAt: null,
      },
    });
    const response = { status: vi.fn() };
    const result = await createController(summary).readiness(response as never);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result.status).toBe('error');
    expect(result.missingCritical).toContain('worker');
  });

  it('returns 503 when a configured pilot provider is unreachable', async () => {
    const controller = createController();
    (
      controller as unknown as {
        workosService: { checkReadiness: ReturnType<typeof vi.fn> };
      }
    ).workosService.checkReadiness = vi.fn().mockResolvedValue({
      configured: true,
      status: 'down',
      providerStatus: 401,
    });
    const response = { status: vi.fn() };
    const result = await controller.readiness(response as never);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result.missingCritical).toContain('workos');
  });
});
