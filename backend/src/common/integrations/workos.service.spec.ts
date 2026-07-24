import { ConfigService } from '@nestjs/config';
import { WorkosService } from './workos.service';

function config(values: Record<string, string>) {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
    getOrThrow: (key: string) => {
      if (!values[key]) throw new Error(`${key} is missing`);
      return values[key];
    },
  } as ConfigService;
}

describe('WorkosService readiness', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports missing when WorkOS credentials are incomplete', async () => {
    const service = new WorkosService(config({}));

    await expect(service.checkReadiness()).resolves.toEqual({
      configured: false,
      status: 'missing',
    });
  });

  it('reports provider authentication failures as down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    const service = new WorkosService(
      config({
        WORKOS_API_KEY: 'sk_test_readiness',
        WORKOS_CLIENT_ID: 'client_test_readiness',
      }),
    );

    await expect(service.checkReadiness()).resolves.toEqual({
      configured: true,
      status: 'down',
      providerStatus: 401,
    });
  });
});
