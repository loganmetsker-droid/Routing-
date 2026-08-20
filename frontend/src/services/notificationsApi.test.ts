import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNotificationsOverview } from './notificationsApi';

describe('notificationsApi pilot defaults', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps SMS visibly disabled in preview while email remains ready', async () => {
    vi.stubGlobal('window', {
      location: { hostname: '127.0.0.1', search: '' },
      __TROVAN_LOCAL_DEMO_PREVIEW__: true,
    } as unknown as Window & typeof globalThis);

    await expect(getNotificationsOverview()).resolves.toMatchObject({
      emailProvider: 'postmark-preview',
      smsProvider: 'disabled',
      controls: {
        emailReady: true,
        smsReady: false,
      },
    });
  });
});
