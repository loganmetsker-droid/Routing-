import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export type RequestWithContext = Request & {
  requestId?: string;
  startedAt?: bigint;
};

const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID_SAFE_PATTERN = /^[A-Za-z0-9._:-]+$/;

function normalizeRequestIdHeader(value: unknown): string | null {
  const candidate =
    typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? value.find((entry) => typeof entry === 'string')
        : null;

  if (!candidate) return null;

  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!REQUEST_ID_SAFE_PATTERN.test(trimmed)) return null;

  return trimmed;
}

export function requestContextMiddleware(
  req: RequestWithContext,
  res: Response,
  next: NextFunction,
) {
  const incomingRequestId = normalizeRequestIdHeader(req.headers['x-request-id']);
  const requestId =
    incomingRequestId && incomingRequestId.length > 0 ? incomingRequestId : randomUUID();

  req.requestId = requestId;
  req.startedAt = process.hrtime.bigint();
  res.setHeader('x-request-id', requestId);
  next();
}
