import { isIP } from 'net';

function isStrictEnvironment(env: NodeJS.ProcessEnv): boolean {
  const nodeEnv = String(env.NODE_ENV || 'development').toLowerCase();
  return !['development', 'test'].includes(nodeEnv);
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  return false;
}

export type OutboundWebhookUrlCheck =
  | { allowed: true; normalizedUrl: string }
  | { allowed: false; reason: string };

export function checkOutboundWebhookUrl(
  rawUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): OutboundWebhookUrlCheck {
  const value = String(rawUrl || '').trim();
  if (!value) return { allowed: false, reason: 'Webhook URL is required' };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { allowed: false, reason: 'Webhook URL must be a valid URL' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) {
    return { allowed: false, reason: 'Webhook URL must include a hostname' };
  }

  if (!isStrictEnvironment(env)) {
    return { allowed: true, normalizedUrl: parsed.toString() };
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return {
      allowed: false,
      reason: 'Webhook URL cannot target localhost in this environment',
    };
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isPrivateIpv4(hostname)) {
    return {
      allowed: false,
      reason: 'Webhook URL cannot target private IP ranges in this environment',
    };
  }
  if (ipVersion === 6 && isPrivateIpv6(hostname)) {
    return {
      allowed: false,
      reason: 'Webhook URL cannot target private IP ranges in this environment',
    };
  }

  return { allowed: true, normalizedUrl: parsed.toString() };
}
