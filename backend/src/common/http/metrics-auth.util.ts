import { timingSafeEqual } from 'crypto';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

function extractBearerToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = /^bearer\s+(.+)$/i.exec(trimmed);
  return (match?.[1] ?? trimmed).trim();
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export function isMetricsTokenConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.METRICS_TOKEN?.trim());
}

export function extractMetricsToken(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const authorization = firstHeaderValue(headers['authorization']);
  if (authorization) {
    const token = extractBearerToken(authorization);
    if (token) return token;
  }

  const metricsToken = firstHeaderValue(headers['x-metrics-token']);
  return metricsToken?.trim() || undefined;
}

export function isMetricsRequestAuthorized(
  headers: Record<string, string | string[] | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): { authorized: boolean; tokenRequired: boolean } {
  const expected = env.METRICS_TOKEN?.trim();
  if (!expected) {
    return { authorized: true, tokenRequired: false };
  }

  const presented = extractMetricsToken(headers);
  if (!presented) {
    return { authorized: false, tokenRequired: true };
  }

  return {
    authorized: timingSafeEqualStrings(presented, expected),
    tokenRequired: true,
  };
}

