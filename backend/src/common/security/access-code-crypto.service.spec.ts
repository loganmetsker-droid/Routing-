import { describe, expect, it, vi } from 'vitest';
import { AccessCodeCryptoService } from './access-code-crypto.service';

function service() {
  const key = Buffer.alloc(32, 7).toString('base64');
  return new AccessCodeCryptoService({
    get: vi.fn((name: string, fallback?: string) =>
      name === 'ACCESS_CODE_ENCRYPTION_KEY'
        ? key
        : name === 'ACCESS_CODE_KEY_VERSION'
          ? 'pilot-v1'
          : fallback,
    ),
  } as any);
}

describe('access-code field encryption', () => {
  it('stores no plaintext and decrypts for the driver workflow', () => {
    const crypto = service();
    const protectedRequirements = crypto.protect({
      site: { accessCode: '4827', accessCodeRequired: true },
    }) as any;

    expect(JSON.stringify(protectedRequirements)).not.toContain('4827');
    expect(protectedRequirements.site.accessCodeEncrypted.algorithm).toBe('aes-256-gcm');
    expect(crypto.reveal(protectedRequirements)).toBe('4827');
  });

  it('masks encryption material from normal operator responses', () => {
    const crypto = service();
    const protectedRequirements = crypto.protect({ site: { accessCode: '4827' } });
    const masked = crypto.mask(protectedRequirements) as any;

    expect(masked.site.accessCodeConfigured).toBe(true);
    expect(masked.site.accessCode).toBeUndefined();
    expect(masked.site.accessCodeEncrypted).toBeUndefined();
  });
});
