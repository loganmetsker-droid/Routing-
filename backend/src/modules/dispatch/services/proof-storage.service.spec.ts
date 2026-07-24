import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ProofStorageService } from './proof-storage.service';

describe('ProofStorageService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects storage keys that resolve outside the configured local root', () => {
    const originalDir = process.env.PROOF_STORAGE_DIR;
    const sandboxDir = mkdtempSync(join(tmpdir(), 'routing-proof-storage-'));
    try {
      process.env.PROOF_STORAGE_DIR = join(sandboxDir, 'proof');

      const service = new ProofStorageService();
      expect(() => (service as any).localPathForKey('../proof2/secret.txt')).toThrow(
        'Invalid proof storage key',
      );
    } finally {
      process.env.PROOF_STORAGE_DIR = originalDir;
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('accepts storage keys inside the configured local root', () => {
    const originalDir = process.env.PROOF_STORAGE_DIR;
    const sandboxDir = mkdtempSync(join(tmpdir(), 'routing-proof-storage-'));
    try {
      process.env.PROOF_STORAGE_DIR = join(sandboxDir, 'proof');

      const service = new ProofStorageService();
      const filePath = (service as any).localPathForKey('org/stop/file.txt');
      expect(filePath).toContain(join(sandboxDir, 'proof'));
    } finally {
      process.env.PROOF_STORAGE_DIR = originalDir;
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('treats an authenticated missing probe object as available R2 storage', async () => {
    const previous = {
      mode: process.env.STORAGE_MODE,
      endpoint: process.env.R2_ENDPOINT,
      bucket: process.env.R2_BUCKET,
      accessKey: process.env.R2_ACCESS_KEY_ID,
      secretKey: process.env.R2_SECRET_ACCESS_KEY,
    };
    try {
      process.env.STORAGE_MODE = 'r2';
      process.env.R2_ENDPOINT = 'https://r2.example.test';
      process.env.R2_BUCKET = 'trovan-proof';
      process.env.R2_ACCESS_KEY_ID = 'test-access-key';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 404 }),
      );

      await expect(new ProofStorageService().checkReadiness()).resolves.toEqual({
        configured: true,
        mode: 'r2',
        status: 'up',
        providerStatus: 404,
      });
    } finally {
      process.env.STORAGE_MODE = previous.mode;
      process.env.R2_ENDPOINT = previous.endpoint;
      process.env.R2_BUCKET = previous.bucket;
      process.env.R2_ACCESS_KEY_ID = previous.accessKey;
      process.env.R2_SECRET_ACCESS_KEY = previous.secretKey;
    }
  });

  it('reports rejected R2 credentials as down', async () => {
    const previous = {
      mode: process.env.STORAGE_MODE,
      endpoint: process.env.R2_ENDPOINT,
      bucket: process.env.R2_BUCKET,
      accessKey: process.env.R2_ACCESS_KEY_ID,
      secretKey: process.env.R2_SECRET_ACCESS_KEY,
    };
    try {
      process.env.STORAGE_MODE = 'r2';
      process.env.R2_ENDPOINT = 'https://r2.example.test';
      process.env.R2_BUCKET = 'trovan-proof';
      process.env.R2_ACCESS_KEY_ID = 'test-access-key';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 403 }),
      );

      await expect(new ProofStorageService().checkReadiness()).resolves.toMatchObject({
        configured: true,
        mode: 'r2',
        status: 'down',
        providerStatus: 403,
      });
    } finally {
      process.env.STORAGE_MODE = previous.mode;
      process.env.R2_ENDPOINT = previous.endpoint;
      process.env.R2_BUCKET = previous.bucket;
      process.env.R2_ACCESS_KEY_ID = previous.accessKey;
      process.env.R2_SECRET_ACCESS_KEY = previous.secretKey;
    }
  });
});
