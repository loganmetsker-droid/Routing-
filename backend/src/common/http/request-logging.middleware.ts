import { Logger } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithContext } from './request-context.middleware';

const logger = new Logger('HttpRequest');
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'token',
  'authorization',
  'apikey',
  'api_key',
  'phone',
  'email',
  'signature',
  'paymentmethod',
  'payment_method',
  'card',
  'cvv',
  'secret',
  'stripe',
];

const MAX_SANITIZE_DEPTH = 8;
const MAX_SANITIZE_STRING_LENGTH = 2048;
const MAX_SANITIZE_ARRAY_LENGTH = 100;

function isBinaryLike(value: unknown): boolean {
  if (!value) return false;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return true;
  if (value instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(value)) return true;
  return false;
}

export function sanitizePath(path: string) {
  const withoutQuery = path.split('?')[0]?.split('#')[0] ?? path;
  const withoutSensitiveTokens = withoutQuery.replace(
    /(\/public\/tracking\/)[^/]+/gi,
    '$1:token',
  );
  const withoutUuids = withoutSensitiveTokens.replace(
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi,
    ':uuid',
  );

  const looksLikeJwtPathSegment = (segment: string) => {
    if (segment.length < 40) return false;
    const parts = segment.split('.');
    if (parts.length !== 3) return false;
    return parts.every((part) => /^[A-Za-z0-9_-]{10,}$/.test(part));
  };

  return withoutUuids
    .split('/')
    .map((segment) => (looksLikeJwtPathSegment(segment) ? ':jwt' : segment))
    .join('/');
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function isSensitiveKey(key: string) {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

export function sanitizeValue(
  key: string,
  value: unknown,
  depth = 0,
): unknown {
  if (isSensitiveKey(key)) {
    return '[REDACTED]';
  }

  if (isBinaryLike(value)) {
    return '[BINARY]';
  }

  if (typeof value === 'string' && value.length > MAX_SANITIZE_STRING_LENGTH) {
    return '[TRUNCATED]';
  }

  if (Array.isArray(value) && value.length > MAX_SANITIZE_ARRAY_LENGTH) {
    return '[TRUNCATED]';
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      return '[TRUNCATED]';
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item, depth + 1));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(
      ([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryKey, entryValue, depth + 1),
      ],
    ),
  );
}

export function sanitizeBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  if (isBinaryLike(body)) {
    return '[BINARY]';
  }

  if (Array.isArray(body)) {
    return body.map((item) => sanitizeValue('body', item));
  }

  return sanitizeValue('body', body);
}

export function shouldLogRequestBody(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.LOG_REQUEST_BODIES?.trim().toLowerCase();
  if (!configured) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(configured);
}

export function requestLoggingMiddleware(
  req: RequestWithContext,
  res: Response,
  next: NextFunction,
) {
  const startedAt = req.startedAt ?? process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const user = (req as RequestWithContext & { user?: { userId?: string } }).user;

    logger.log(
      JSON.stringify({
        event: 'http_request_completed',
        requestId: req.requestId,
        method: req.method,
        path: sanitizePath(req.originalUrl || req.url),
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        userId: user?.userId || null,
        remoteIp: req.ip,
        body: shouldLogRequestBody() ? sanitizeBody(req.body) : undefined,
      }),
    );
  });

  next();
}
