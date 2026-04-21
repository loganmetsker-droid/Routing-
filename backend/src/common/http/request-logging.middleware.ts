import { Logger } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithContext } from './request-context.middleware';

const logger = new Logger('HttpRequest');

function sanitizePath(path: string) {
  return path.replace(
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi,
    ':uuid',
  );
}

function sanitizeBody(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }

  const redacted = { ...(body as Record<string, unknown>) };
  for (const key of [
    'password',
    'token',
    'accessToken',
    'authorization',
    'customerPhone',
    'customerEmail',
    'phone',
    'email',
  ]) {
    if (key in redacted) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
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
