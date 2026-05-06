import { describe, expect, it } from 'vitest';
import { checkOutboundWebhookUrl } from './outbound-webhook-url.util';

describe('checkOutboundWebhookUrl', () => {
  it('allows normal URLs in strict environments', () => {
    expect(
      checkOutboundWebhookUrl('https://webhooks.example.com/hook', {
        NODE_ENV: 'production',
      }),
    ).toEqual({
      allowed: true,
      normalizedUrl: 'https://webhooks.example.com/hook',
    });
  });

  it('blocks localhost in strict environments', () => {
    const result = checkOutboundWebhookUrl('https://localhost/hook', {
      NODE_ENV: 'production',
    });
    expect(result.allowed).toBe(false);
  });

  it('blocks private IPv4 addresses in strict environments', () => {
    const result = checkOutboundWebhookUrl('https://192.168.1.2/hook', {
      NODE_ENV: 'production',
    });
    expect(result.allowed).toBe(false);
  });

  it('blocks loopback IPv6 in strict environments', () => {
    const result = checkOutboundWebhookUrl('https://[::1]/hook', {
      NODE_ENV: 'production',
    });
    expect(result.allowed).toBe(false);
  });

  it('does not enforce private-network blocks in development', () => {
    expect(
      checkOutboundWebhookUrl('https://localhost/hook', {
        NODE_ENV: 'development',
      }),
    ).toEqual({
      allowed: true,
      normalizedUrl: 'https://localhost/hook',
    });
  });
});

