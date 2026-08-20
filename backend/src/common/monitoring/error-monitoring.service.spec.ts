import { describe, expect, it, vi } from 'vitest';
import { ErrorMonitoringService, sanitizeErrorText } from './error-monitoring.service';

describe('error monitoring redaction', () => {
  it('redacts contact details and bearer-shaped tokens', () => {
    const sanitized = sanitizeErrorText(
      'customer@example.com 303-555-0100 eyJabcdefghij.abcdefghijk.abcdefghijkl',
    );
    expect(sanitized).not.toContain('customer@example.com');
    expect(sanitized).not.toContain('303-555-0100');
    expect(sanitized).not.toContain('eyJabcdefghij');
  });

  it('returns the correlation id sent to the external receiver', async () => {
    const config = {
      get: vi.fn((name: string, fallback?: string) => {
        if (name === 'ERROR_MONITORING_WEBHOOK_URL') {
          return 'https://monitoring.example.test/events';
        }
        return fallback;
      }),
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 202 }));
    const service = new ErrorMonitoringService(config as any);
    const eventId = service.capture({
      source: 'backend',
      message: 'Synthetic test',
    });

    expect(eventId).toMatch(/^[0-9a-f-]{36}$/);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.eventId).toBe(eventId);
    fetchMock.mockRestore();
  });
});
