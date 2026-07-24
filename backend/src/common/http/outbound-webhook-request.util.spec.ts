import { describe, expect, it } from 'vitest';
import { createOutboundWebhookFetchInit } from './outbound-webhook-request.util';

describe('createOutboundWebhookFetchInit', () => {
  it('forces redirect=manual and sets webhook headers', () => {
    const init = createOutboundWebhookFetchInit(
      {
        eventType: 'job.created',
        signature: 'abc123',
        timestamp: '1715112097000',
        requestId: 'req-1',
      },
      '{"ok":true}',
    );

    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(init.body).toBe('{"ok":true}');
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'user-agent': 'trovan-webhooks/1.0',
      'x-trovan-event': 'job.created',
      'x-trovan-signature': 'abc123',
      'x-trovan-timestamp': '1715112097000',
      'x-request-id': 'req-1',
    });
  });

  it('passes the AbortSignal through', () => {
    const controller = new AbortController();
    const init = createOutboundWebhookFetchInit(
      {
        eventType: 'job.created',
        signature: 'abc123',
        timestamp: '1715112097000',
        requestId: 'req-1',
      },
      '{"ok":true}',
      controller.signal,
    );

    expect(init.signal).toBe(controller.signal);
  });
});
