import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ProofStorageService } from './proof-storage.service';

describe('ProofStorageService', () => {
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
});
