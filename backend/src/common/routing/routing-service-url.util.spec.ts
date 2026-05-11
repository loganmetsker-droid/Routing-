import { describe, expect, it } from 'vitest';
import {
  resolveRoutingServiceUrl,
  routingServiceAuthHeaders,
} from './routing-service-url.util';

describe('routing service config helpers', () => {
  it('includes the internal routing-service auth header when configured', () => {
    const config = {
      get: <T = string>(key: string): T | undefined =>
        (key === 'ROUTING_SERVICE_INTERNAL_TOKEN' ? 'internal-token' : undefined) as T,
    };

    expect(routingServiceAuthHeaders(config)).toEqual({
      'x-routing-service-token': 'internal-token',
    });
  });

  it('omits the internal auth header when no token is configured', () => {
    const config = { get: () => undefined };

    expect(routingServiceAuthHeaders(config)).toEqual({});
  });

  it('still resolves the default local routing service URL', () => {
    const config = { get: () => undefined };

    expect(resolveRoutingServiceUrl(config)).toBe('http://localhost:8000');
  });

  it('rejects non-http(s) explicit routing URLs', () => {
    const config = {
      get: <T = string>(key: string): T | undefined =>
        (key === 'ROUTING_SERVICE_URL' ? 'ftp://example.com' : undefined) as T,
    };

    expect(() => resolveRoutingServiceUrl(config)).toThrow(/http or https/i);
  });

  it('rejects routing URLs that include credentials', () => {
    const config = {
      get: <T = string>(key: string): T | undefined =>
        (key === 'ROUTING_SERVICE_URL'
          ? 'http://user:pass@example.com'
          : undefined) as T,
    };

    expect(() => resolveRoutingServiceUrl(config)).toThrow(/credentials/i);
  });

  it('strips query/hash fragments from configured URLs', () => {
    const config = {
      get: <T = string>(key: string): T | undefined =>
        (key === 'ROUTING_SERVICE_URL'
          ? 'https://optimizer.example.com/base?token=leak#frag'
          : undefined) as T,
    };

    expect(resolveRoutingServiceUrl(config)).toBe(
      'https://optimizer.example.com/base',
    );
  });

  it('rejects invalid hostport scheme overrides', () => {
    const config = {
      get: <T = string>(key: string): T | undefined =>
        ({
          ROUTING_SERVICE_HOSTPORT: 'optimizer:8000',
          ROUTING_SERVICE_SCHEME: 'file',
        } as any)[key] as T,
    };

    expect(() => resolveRoutingServiceUrl(config)).toThrow(/scheme/i);
  });
});
