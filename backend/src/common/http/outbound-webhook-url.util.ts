import { isIP } from 'net';
import { promises as dns } from 'dns';

export type WebhookDnsLookup = (
  hostname: string,
  options: { all: true },
) => Promise<Array<{ address: string; family: number }>>;

export function isStrictWebhookEnvironment(env: NodeJS.ProcessEnv): boolean {
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

export function isPrivateNetworkAddress(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) return isPrivateIpv4(address);
  if (ipVersion === 6) return isPrivateIpv6(address);
  return false;
}

function getAllowedHostPatterns(env: NodeJS.ProcessEnv) {
  return String(env.WEBHOOK_ALLOWED_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function hostnameMatchesPattern(hostname: string, pattern: string) {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return hostname.endsWith(suffix) && hostname !== pattern.slice(2);
  }
  return hostname === pattern;
}

function isAllowedListedHost(hostname: string, env: NodeJS.ProcessEnv) {
  const patterns = getAllowedHostPatterns(env);
  if (patterns.length === 0) {
    return true;
  }
  return patterns.some((pattern) => hostnameMatchesPattern(hostname, pattern));
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

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { allowed: false, reason: 'Webhook URL must use http or https' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) {
    return { allowed: false, reason: 'Webhook URL must include a hostname' };
  }

  if (!isStrictWebhookEnvironment(env)) {
    return { allowed: true, normalizedUrl: parsed.toString() };
  }

  if (parsed.username || parsed.password) {
    return {
      allowed: false,
      reason: 'Webhook URL must not include embedded credentials',
    };
  }

  if (!isAllowedListedHost(hostname, env)) {
    return {
      allowed: false,
      reason: 'Webhook URL host is not in the allowed host list',
    };
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return {
      allowed: false,
      reason: 'Webhook URL cannot target localhost in this environment',
    };
  }

  const ipVersion = isIP(hostname);
  if (isPrivateNetworkAddress(hostname)) {
    return {
      allowed: false,
      reason: 'Webhook URL cannot target private IP ranges in this environment',
    };
  }

  return { allowed: true, normalizedUrl: parsed.toString() };
}

export async function checkOutboundWebhookResolvedUrl(
  rawUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  lookup: WebhookDnsLookup = dns.lookup,
): Promise<OutboundWebhookUrlCheck> {
  const urlCheck = checkOutboundWebhookUrl(rawUrl, env);
  if (urlCheck.allowed === false || !isStrictWebhookEnvironment(env)) {
    return urlCheck;
  }

  const hostname = new URL(urlCheck.normalizedUrl).hostname.toLowerCase();
  if (isIP(hostname)) {
    return urlCheck;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return {
      allowed: false,
      reason: 'Webhook URL hostname could not be resolved',
    };
  }

  if (addresses.length === 0) {
    return {
      allowed: false,
      reason: 'Webhook URL hostname could not be resolved',
    };
  }

  const privateAddress = addresses.find((item) =>
    isPrivateNetworkAddress(item.address),
  );
  if (privateAddress) {
    return {
      allowed: false,
      reason: 'Webhook URL resolves to a private IP range in this environment',
    };
  }

  return urlCheck;
}
