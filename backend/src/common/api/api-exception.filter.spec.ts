import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter';

function createHost(args: {
  request: any;
  response: { status: (code: number) => any; json: (body: unknown) => any };
}) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => args.request,
      getResponse: () => args.response,
    }),
  } as any;
}

describe('ApiExceptionFilter', () => {
  it('sanitizes paths in unhandled error logs', () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined as any);

    const filter = new ApiExceptionFilter();
    const response = {
      status: vi.fn(() => response),
      json: vi.fn(),
    };
    const request = {
      method: 'GET',
      originalUrl: '/public/tracking/someOpaqueToken123?with=query',
      requestId: 'req_1',
      headers: {},
    };

    filter.catch(new Error('boom'), createHost({ request, response }));

    const logged = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(logged).toContain('/public/tracking/:token');
    expect(logged).not.toContain('someOpaqueToken123');

    errorSpy.mockRestore();
  });

  it('does not trust raw x-request-id headers when requestId is missing', () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined as any);

    const filter = new ApiExceptionFilter();
    const response = {
      status: vi.fn(() => response),
      json: vi.fn(),
    };
    const request = {
      method: 'GET',
      originalUrl: '/health',
      headers: { 'x-request-id': 'evil\ninjected' },
    };

    filter.catch(new Error('boom'), createHost({ request, response }));

    const logged = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(logged).not.toContain('evil');
    expect(logged).not.toContain('\n');

    errorSpy.mockRestore();
  });
});
