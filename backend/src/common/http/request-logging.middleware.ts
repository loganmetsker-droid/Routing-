import { Logger } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithContext } from './request-context.middleware';

const logger = new Logger('HttpRequest');
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'authorization',
  'customerPhone',
  'customerEmail',
  'phone',
  'email',
  'supportEmail',
  'supportPhone',
  'stripeSignature',
  'paymentMethodId',
  'cardNumber',
  'cvv',
  'secret',
]);

function sanitizePath(path: string) {
  return path.replace(
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi,
    ':uuid',
  );
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key)) {
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

function sanitizeBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  if (Array.isArray(body)) {
    return body.map((item) => sanitizeValue('body', item));
  }

  return sanitizeValue('body', body);
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
        body: sanitizeBody(req.body),
      }),
    );
  });

  next();
}
