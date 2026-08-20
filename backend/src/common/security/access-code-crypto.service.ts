import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { JobRoutingRequirements } from '@shared/contracts';

export type EncryptedAccessCode = {
  version: 1;
  keyVersion: string;
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
};

type ProtectedSiteRequirements = NonNullable<JobRoutingRequirements['site']> & {
  accessCodeEncrypted?: EncryptedAccessCode | null;
  accessCodeConfigured?: boolean | null;
};

type ProtectedRoutingRequirements = JobRoutingRequirements & {
  site?: ProtectedSiteRequirements | null;
};

function cloneRequirements(
  requirements?: JobRoutingRequirements | null,
): ProtectedRoutingRequirements | undefined {
  if (!requirements) return undefined;
  return JSON.parse(JSON.stringify(requirements)) as ProtectedRoutingRequirements;
}

export function parseAccessCodeKey(value: string) {
  const trimmed = value.trim();
  const key = /^[a-f0-9]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, 'hex')
    : Buffer.from(trimmed, 'base64');
  if (key.length !== 32) {
    throw new Error('ACCESS_CODE_ENCRYPTION_KEY must encode exactly 32 bytes');
  }
  return key;
}

export function encryptAccessCode(
  plaintext: string,
  key: Buffer,
  keyVersion: string,
): EncryptedAccessCode {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return {
    version: 1,
    keyVersion,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptAccessCode(envelope: EncryptedAccessCode, key: Buffer) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

@Injectable()
export class AccessCodeCryptoService {
  constructor(private readonly config: ConfigService) {}

  private getKey() {
    const configured = this.config.get<string>('ACCESS_CODE_ENCRYPTION_KEY', '');
    return configured.trim() ? parseAccessCodeKey(configured) : null;
  }

  protect(
    requirements?: JobRoutingRequirements | null,
  ): JobRoutingRequirements | undefined {
    const protectedRequirements = cloneRequirements(requirements);
    const site = protectedRequirements?.site;
    const plaintext = site?.accessCode?.trim();
    if (!protectedRequirements || !site || !plaintext) return protectedRequirements;
    const key = this.getKey();
    if (!key) {
      throw new ServiceUnavailableException(
        'Secure access-code storage is not configured.',
      );
    }
    site.accessCodeEncrypted = encryptAccessCode(
      plaintext,
      key,
      this.config.get('ACCESS_CODE_KEY_VERSION', 'v1'),
    );
    site.accessCodeConfigured = true;
    delete site.accessCode;
    return protectedRequirements;
  }

  reveal(requirements?: JobRoutingRequirements | null) {
    const site = (requirements?.site || null) as ProtectedSiteRequirements | null;
    if (site?.accessCode?.trim()) return site.accessCode.trim();
    if (!site?.accessCodeEncrypted) return null;
    const key = this.getKey();
    if (!key) return null;
    return decryptAccessCode(site.accessCodeEncrypted, key);
  }

  mask(requirements?: JobRoutingRequirements | null): JobRoutingRequirements | undefined {
    const masked = cloneRequirements(requirements);
    const site = masked?.site;
    if (!masked || !site) return masked;
    site.accessCodeConfigured = Boolean(
      site.accessCodeConfigured || site.accessCodeEncrypted || site.accessCode,
    );
    delete site.accessCodeEncrypted;
    delete site.accessCode;
    return masked;
  }
}
