import { describe, expect, it } from 'vitest';
import { sanitizeSessionContext } from './session-context.util';

describe('sanitizeSessionContext', () => {
  it('returns null fields when context is missing', () => {
    expect(sanitizeSessionContext()).toEqual({ userAgent: null, ipAddress: null });
  });

  it('trims and strips control characters', () => {
    const result = sanitizeSessionContext({
      userAgent: ' \nMozilla/5.0\r ',
      ipAddress: '\t127.0.0.1\u0000',
    });
    expect(result).toEqual({ userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' });
  });

  it('clamps oversized values', () => {
    const userAgent = 'a'.repeat(2000);
    const ipAddress = 'b'.repeat(200);
    const result = sanitizeSessionContext({ userAgent, ipAddress });
    expect(result.userAgent?.length).toBe(1024);
    expect(result.ipAddress?.length).toBe(128);
  });

  it('treats empty or whitespace-only strings as null', () => {
    expect(sanitizeSessionContext({ userAgent: '   ', ipAddress: '' })).toEqual({
      userAgent: null,
      ipAddress: null,
    });
  });
});
