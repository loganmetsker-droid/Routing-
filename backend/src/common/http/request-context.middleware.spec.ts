import { vi } from 'vitest';
import { requestContextMiddleware } from './request-context.middleware';

describe('requestContextMiddleware', () => {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function runWithHeader(value: unknown) {
    const req = { headers: { 'x-request-id': value } } as any;
    const res = { setHeader: vi.fn() } as any;
    const next = vi.fn();

    requestContextMiddleware(req, res, next);

    return { req, res, next };
  }

  it('uses a valid incoming x-request-id and echoes it back', () => {
    const { req, res, next } = runWithHeader('req-1_abc.123');
    expect(req.requestId).toBe('req-1_abc.123');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-1_abc.123');
    expect(next).toHaveBeenCalled();
  });

  it('generates a UUID when the incoming x-request-id is overly long', () => {
    const { req, res } = runWithHeader('a'.repeat(200));
    expect(req.requestId).toMatch(uuidPattern);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.requestId);
  });

  it('generates a UUID when the incoming x-request-id contains unsafe characters', () => {
    const { req } = runWithHeader('req-1\ninjected');
    expect(req.requestId).toMatch(uuidPattern);
  });

  it('generates a UUID when the incoming x-request-id is blank', () => {
    const { req } = runWithHeader('   ');
    expect(req.requestId).toMatch(uuidPattern);
  });

  it('accepts the first string value when x-request-id is an array', () => {
    const { req } = runWithHeader(['  req-2  ', 'req-3']);
    expect(req.requestId).toBe('req-2');
  });
});
