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

export function sanitizePath(path: string) {
  const withoutQuery = path.split('?')[0]?.split('#')[0] ?? path;
  return withoutQuery.replace(
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi,
    ':uuid',
  );
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

export function sanitizeValue(key: string, value: unknown): unknown {
  if (isSensitiveKey(key)) {
    return '[REDACTED]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    next[entryKey] = sanitizeValue(entryKey, entryValue);
  }
  return next;
}

export function sanitizeBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  if (Array.isArray(body)) {
    return body.map((item) => sanitizeValue('body', item));
  }

  return sanitizeValue('body', body);
}

export function shouldLogRequestBody(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.LOG_REQUEST_BODIES?.trim().toLowerCase();
  if (configured) {
    return ['1', 'true', 'yes', 'on'].includes(configured);
  }

  return env.NODE_ENV !== 'production';
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
