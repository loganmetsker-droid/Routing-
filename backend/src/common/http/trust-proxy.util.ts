export type TrustProxySetting = boolean | number;

const TRUE_VALUES = new Set(['true', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', 'no', 'off']);
const MAX_TRUST_PROXY_HOPS = 10;

export function parseTrustProxySetting(
  env: NodeJS.ProcessEnv = process.env,
): TrustProxySetting | undefined {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();
  if (/^\d+$/.test(normalized)) {
    const parsed = Number.parseInt(normalized, 10);
    if (parsed <= 0) return false;
    return Math.min(parsed, MAX_TRUST_PROXY_HOPS);
  }
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  return undefined;
}

export function configureTrustProxy(
  app: {
    set?: (setting: string, value: unknown) => unknown;
    getHttpAdapter?: () => { getInstance?: () => { set?: (setting: string, value: unknown) => unknown } };
  },
  env: NodeJS.ProcessEnv = process.env,
): TrustProxySetting | undefined {
  const setting = parseTrustProxySetting(env);
  if (setting === undefined) return undefined;

  if (typeof app.set === 'function') {
    app.set('trust proxy', setting);
    return setting;
  }

  const http = app.getHttpAdapter?.();
  const instance = http?.getInstance?.();
  if (typeof instance?.set === 'function') {
    instance.set('trust proxy', setting);
    return setting;
  }

  return undefined;
}
