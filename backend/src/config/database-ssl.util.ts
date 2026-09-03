import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

type DatabaseSslOptions = false | {
  rejectUnauthorized: boolean;
  ca?: string;
};

function databaseHost(databaseUrl: string) {
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function findBundledSupabaseCa() {
  const candidates = [
    join(process.cwd(), 'certs', 'supabase-prod-ca-2021.crt'),
    join(process.cwd(), 'backend', 'certs', 'supabase-prod-ca-2021.crt'),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

export function resolveDatabaseSsl(options: {
  allowSelfSigned?: boolean;
  caPath?: string;
  databaseUrl?: string;
  nodeEnv?: string;
}): DatabaseSslOptions {
  const databaseUrl = options.databaseUrl || '';
  const host = databaseHost(databaseUrl);
  const useSsl =
    options.nodeEnv === 'production' ||
    databaseUrl.includes('railway.app') ||
    databaseUrl.includes('rlwy.net') ||
    databaseUrl.includes('render.com') ||
    host.endsWith('.supabase.co') ||
    host.endsWith('.pooler.supabase.com');

  if (!useSsl) return false;
  if (options.allowSelfSigned) return { rejectUnauthorized: false };

  const configuredCaPath = options.caPath?.trim();
  const caPath = configuredCaPath
    ? resolve(configuredCaPath)
    : host.endsWith('.pooler.supabase.com') || host.endsWith('.supabase.co')
      ? findBundledSupabaseCa()
      : undefined;

  return {
    rejectUnauthorized: true,
    ...(caPath ? { ca: readFileSync(caPath, 'utf8') } : {}),
  };
}
