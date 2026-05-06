import { describe, expect, it } from 'vitest';
import {
  checkOutboundWebhookResolvedUrl,
  checkOutboundWebhookUrl,
} from './outbound-webhook-url.util';

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

  it('blocks hosts outside the strict allowlist when configured', () => {
    const result = checkOutboundWebhookUrl('https://webhooks.example.com/hook', {
      NODE_ENV: 'production',
      WEBHOOK_ALLOWED_HOSTS: 'hooks.customer.example',
    });
    expect(result.allowed).toBe(false);
  });

  it('allows wildcard allowlisted hosts in strict environments', () => {
    expect(
      checkOutboundWebhookUrl('https://tenant.customer-hooks.example/hook', {
        NODE_ENV: 'production',
        WEBHOOK_ALLOWED_HOSTS: '*.customer-hooks.example',
      }),
    ).toEqual({
      allowed: true,
      normalizedUrl: 'https://tenant.customer-hooks.example/hook',
    });
  });

  it('blocks DNS names that resolve to private addresses in strict environments', async () => {
    const result = await checkOutboundWebhookResolvedUrl(
      'https://hooks.example.com/hook',
      { NODE_ENV: 'production' },
      async () => [{ address: '10.0.0.25', family: 4 }],
    );
    expect(result.allowed).toBe(false);
  });

  it('allows DNS names that resolve to public addresses in strict environments', async () => {
    const result = await checkOutboundWebhookResolvedUrl(
      'https://hooks.example.com/hook',
      { NODE_ENV: 'production' },
      async () => [{ address: '198.51.100.10', family: 4 }],
    );
    expect(result.allowed).toBe(true);
  });
});
