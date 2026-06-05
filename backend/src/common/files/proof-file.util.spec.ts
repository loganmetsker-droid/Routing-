import { describe, expect, it } from 'vitest';
import {
  detectProofUploadMimeType,
  getSafeProofDownloadContentType,
  resolveProofUploadMimeType,
} from './proof-file.util';

describe('proof-file utilities', () => {
  it('detects common proof file signatures', () => {
    expect(detectProofUploadMimeType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe(
      'image/jpeg',
    );
    expect(
      detectProofUploadMimeType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      ),
    ).toBe('image/png');
    expect(
      detectProofUploadMimeType(
        Buffer.concat([
          Buffer.from('RIFF', 'ascii'),
          Buffer.from([0x00, 0x00, 0x00, 0x00]),
          Buffer.from('WEBP', 'ascii'),
        ]),
      ),
    ).toBe('image/webp');
    expect(detectProofUploadMimeType(Buffer.from('%PDF-1.7', 'ascii'))).toBe(
      'application/pdf',
    );
  });

  it('resolves octet-stream uploads from detected signatures', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(resolveProofUploadMimeType('application/octet-stream', png)).toBe('image/png');
    expect(resolveProofUploadMimeType(undefined, png)).toBe('image/png');
  });

  it('rejects mismatched or unsupported mime types', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(resolveProofUploadMimeType('text/html', png)).toBeNull();
    expect(resolveProofUploadMimeType('image/jpeg', png)).toBeNull();
  });

  it('forces proof downloads to octet-stream', () => {
    expect(getSafeProofDownloadContentType()).toBe('application/octet-stream');
  });
});

