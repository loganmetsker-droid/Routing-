import { describe, expect, it } from 'vitest';
import {
  buildInlineContentDisposition,
  sanitizeContentDispositionFilename,
} from './content-disposition.util';

describe('content-disposition filename utilities', () => {
  it('sanitizes directory traversal and control characters', () => {
    const name = sanitizeContentDispositionFilename(
      'folder/..\\evil\r\nname".pdf',
      { fallback: 'fallback' },
    );
    expect(name).toBe('evilname.pdf');
    expect(name).not.toMatch(/[\r\n]/);
    expect(name).not.toContain('"');
  });

  it('falls back when empty or only dots', () => {
    expect(sanitizeContentDispositionFilename('', { fallback: 'x' })).toBe('x');
    expect(sanitizeContentDispositionFilename('..', { fallback: 'x' })).toBe('x');
    expect(sanitizeContentDispositionFilename('.', { fallback: 'x' })).toBe('x');
  });

  it('builds a quoted inline content-disposition header', () => {
    const header = buildInlineContentDisposition('hello\r\nworld.pdf');
    expect(header).toBe('inline; filename="helloworld.pdf"');
    expect(header).not.toMatch(/[\r\n]/);
  });
});
