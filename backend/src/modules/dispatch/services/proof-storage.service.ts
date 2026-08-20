import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'crypto';
import { createReadStream, type ReadStream } from 'fs';
import { mkdir, stat, writeFile } from 'fs/promises';
import { isAbsolute, join, relative, resolve } from 'path';

export type ProofFileInput = {
  organizationId?: string | null;
  routeRunStopId: string;
  type: 'BOL' | 'DOCUMENT';
  originalName: string;
  mimeType?: string | null;
  buffer: Buffer;
};

export type StoredProofFile = {
  uri: string;
  metadata: {
    storageProvider: 'local' | 'r2';
    storageKey: string;
    storageBucket?: string;
    originalName: string;
    mimeType: string;
    size: number;
    checksumSha256: string;
  };
};

export type ProofFileDownload = {
  body: Buffer | ReadStream;
  contentType: string;
  filename: string;
  size?: number;
};

type R2StorageConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

@Injectable()
export class ProofStorageService {
  private get localRoot() {
    return resolve(
      process.env.PROOF_STORAGE_DIR ||
        process.env.LOCAL_STORAGE_DIR ||
        join(process.cwd(), '.local-storage', 'proof-artifacts'),
    );
  }

  private get r2Config() {
    const endpoint = process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET;
    const accessKeyId =
      process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      return null;
    }
    return {
      endpoint: endpoint.replace(/\/+$/, ''),
      bucket,
      accessKeyId,
      secretAccessKey,
    };
  }

  async saveProofFile(input: ProofFileInput): Promise<StoredProofFile> {
    if (!input.buffer?.length) {
      throw new BadRequestException('Proof upload file is empty');
    }

    const originalName = sanitizeFilename(input.originalName || 'proof-file');
    const mimeType = input.mimeType || 'application/octet-stream';
    const checksumSha256 = sha256(input.buffer);
    const storageKey = [
      input.organizationId || 'unscoped',
      input.routeRunStopId,
      `${Date.now()}-${randomUUID()}-${originalName}`,
    ].join('/');

    const r2Config = this.r2Config;
    if (r2Config) {
      await this.putR2Object(r2Config, storageKey, input.buffer, mimeType);
      return {
        uri: `r2://${r2Config.bucket}/${storageKey}`,
        metadata: {
          storageProvider: 'r2',
          storageBucket: r2Config.bucket,
          storageKey,
          originalName,
          mimeType,
          size: input.buffer.length,
          checksumSha256,
        },
      };
    }

    const filePath = this.localPathForKey(storageKey);
    await mkdir(resolve(filePath, '..'), { recursive: true });
    await writeFile(filePath, input.buffer);
    return {
      uri: `local-proof://${storageKey}`,
      metadata: {
        storageProvider: 'local',
        storageKey,
        originalName,
        mimeType,
        size: input.buffer.length,
        checksumSha256,
      },
    };
  }

  async readProofFile(
    uri: string,
    metadata: Record<string, unknown> = {},
  ): Promise<ProofFileDownload> {
    const filename =
      typeof metadata.originalName === 'string'
        ? sanitizeFilename(metadata.originalName)
        : 'proof-file';
    const contentType =
      typeof metadata.mimeType === 'string'
        ? metadata.mimeType
        : 'application/octet-stream';

    if (uri.startsWith('local-proof://')) {
      const storageKey = uri.replace(/^local-proof:\/\//, '');
      const filePath = this.localPathForKey(storageKey);
      const info = await stat(filePath).catch(() => null);
      if (!info) {
        throw new BadRequestException('Proof file is not available on local storage');
      }
      return {
        body: createReadStream(filePath),
        contentType,
        filename,
        size: info.size,
      };
    }

    if (uri.startsWith('r2://')) {
      const r2Config = this.r2Config;
      if (!r2Config) {
        throw new BadRequestException('R2 proof storage is not configured');
      }
      const storageKey = uri.replace(`r2://${r2Config.bucket}/`, '');
      const body = await this.getR2Object(r2Config, storageKey);
      return {
        body,
        contentType,
        filename,
        size: body.length,
      };
    }

    throw new BadRequestException('Proof artifact does not reference a stored file');
  }

  async checkR2Availability() {
    const config = this.r2Config;
    if (!config) return false;
    const endpoint = new URL(config.endpoint);
    const url = new URL(
      `/${encodeURIComponent(config.bucket)}?list-type=2&max-keys=1`,
      endpoint.origin,
    );
    const payloadHash = sha256(Buffer.alloc(0));
    const headers = this.signR2Request(config, 'GET', url, payloadHash);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(3_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private localPathForKey(storageKey: string) {
    const root = this.localRoot;
    const filePath = resolve(root, storageKey);
    const relativePath = relative(root, filePath);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new BadRequestException('Invalid proof storage key');
    }
    return filePath;
  }

  private async putR2Object(
    config: R2StorageConfig,
    storageKey: string,
    body: Buffer,
    mimeType: string,
  ) {
    const url = buildR2Url(config.endpoint, config.bucket, storageKey);
    const payloadHash = sha256(body);
    const headers = this.signR2Request(config, 'PUT', url, payloadHash, {
      'content-type': mimeType,
    });
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body,
    });
    if (!response.ok) {
      throw new BadRequestException(`R2 proof upload failed with ${response.status}`);
    }
  }

  private async getR2Object(
    config: R2StorageConfig,
    storageKey: string,
  ) {
    const url = buildR2Url(config.endpoint, config.bucket, storageKey);
    const payloadHash = sha256(Buffer.alloc(0));
    const headers = this.signR2Request(config, 'GET', url, payloadHash);
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      throw new BadRequestException(`R2 proof download failed with ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private signR2Request(
    config: R2StorageConfig,
    method: 'GET' | 'PUT',
    url: URL,
    payloadHash: string,
    extraHeaders: Record<string, string> = {},
  ) {
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...extraHeaders,
    };
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames
      .map((name) => `${name}:${headers[name].trim()}\n`)
      .join('');
    const signedHeaders = signedHeaderNames.join(';');
    const canonicalRequest = [
      method,
      url.pathname,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256(Buffer.from(canonicalRequest)),
    ].join('\n');
    const signature = hmac(
      hmac(
        hmac(
          hmac(Buffer.from(`AWS4${config.secretAccessKey}`), dateStamp),
          'auto',
        ),
        's3',
      ),
      'aws4_request',
    );
    const authorizationSignature = createHmac('sha256', signature)
      .update(stringToSign)
      .digest('hex');

    return {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${authorizationSignature}`,
    };
  }
}

function sanitizeFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 160) || 'proof-file'
  );
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function buildR2Url(endpoint: string, bucket: string, storageKey: string) {
  const endpointUrl = new URL(endpoint);
  const encodedKey = storageKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return new URL(`/${encodeURIComponent(bucket)}/${encodedKey}`, endpointUrl.origin);
}
