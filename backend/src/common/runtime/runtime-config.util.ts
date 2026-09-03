import { getMissingGeocodingConfig } from '../routing/geocoding-config.util';
import { parseAccessCodeKey } from '../security/access-code-crypto.service';

export function isStrictRuntime(
  env: Partial<Pick<NodeJS.ProcessEnv, 'STRICT_ENV_VALIDATION' | 'NODE_ENV'>> = process.env,
) {
  return (
    String(env.STRICT_ENV_VALIDATION || 'false') === 'true' ||
    !['development', 'test'].includes(env.NODE_ENV || 'development')
  );
}

export function hasDatabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.DATABASE_URL ||
      (env.DATABASE_HOST &&
        env.DATABASE_PORT &&
        env.DATABASE_NAME &&
        env.DATABASE_USER &&
        env.DATABASE_PASSWORD),
  );
}

export function hasQueueConfig(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.REDIS_URL || env.REDIS_HOST);
}

export function getMissingCoreRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const missing: string[] = [];
  if (!env.JWT_SECRET) {
    missing.push('JWT_SECRET');
  }
  if (
    ['production', 'staging'].includes(env.NODE_ENV || '') &&
    !(env.CORS_ORIGINS || env.CORS_ORIGIN || env.FRONTEND_URL)
  ) {
    missing.push('CORS_ORIGINS or CORS_ORIGIN or FRONTEND_URL');
  }
  if (!hasDatabaseConfig(env)) {
    missing.push(
      'DATABASE_URL or DATABASE_HOST/DATABASE_PORT/DATABASE_NAME/DATABASE_USER/DATABASE_PASSWORD',
    );
  }
  if (String(env.QUEUE_REQUIRED || 'false') === 'true' && !hasQueueConfig(env)) {
    missing.push('REDIS_URL or REDIS_HOST');
  }
  if (
    ['production', 'staging'].includes(env.NODE_ENV || '') &&
    !String(env.METRICS_TOKEN || '').trim()
  ) {
    missing.push('METRICS_TOKEN');
  }
  if (
    ['production', 'staging'].includes(env.NODE_ENV || '') &&
    !String(env.ROUTING_SERVICE_INTERNAL_TOKEN || '').trim()
  ) {
    missing.push('ROUTING_SERVICE_INTERNAL_TOKEN');
  }

  return missing;
}

export function getMissingPilotIntegrationConfig(
  env: NodeJS.ProcessEnv = process.env,
) {
  const missing: string[] = [];
  if (
    ['production', 'staging'].includes(env.NODE_ENV || '') &&
    !String(env.ERROR_MONITORING_WEBHOOK_URL || '').trim()
  ) {
    missing.push('ERROR_MONITORING_WEBHOOK_URL');
  }
  if (['production', 'staging'].includes(env.NODE_ENV || '')) {
    const postmarkRequirements = [
      'POSTMARK_SERVER_TOKEN',
      'POSTMARK_FROM_EMAIL',
      'LEAD_INTAKE_EMAIL',
      'LEAD_INTAKE_FROM_EMAIL',
      'POSTMARK_WEBHOOK_USERNAME',
      'POSTMARK_WEBHOOK_PASSWORD',
    ];
    for (const name of postmarkRequirements) {
      if (!String(env[name] || '').trim()) missing.push(name);
    }
    if (String(env.POSTMARK_BOUNCE_HASH_KEY || '').length < 32) {
      missing.push('POSTMARK_BOUNCE_HASH_KEY (at least 32 characters)');
    }
  }
  if (['production', 'staging'].includes(env.NODE_ENV || '')) {
    try {
      parseAccessCodeKey(String(env.ACCESS_CODE_ENCRYPTION_KEY || ''));
    } catch {
      missing.push(
        'ACCESS_CODE_ENCRYPTION_KEY (32-byte base64 or 64-char hex)',
      );
    }
  }
  missing.push(...getMissingGeocodingConfig(env));

  return missing;
}

export function getMissingRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  return [
    ...getMissingCoreRuntimeConfig(env),
    ...getMissingPilotIntegrationConfig(env),
  ];
}

export function requiresCompletePilotConfig(
  env: Partial<Pick<NodeJS.ProcessEnv, 'REQUIRE_COMPLETE_PILOT_CONFIG'>> =
    process.env,
) {
  return String(env.REQUIRE_COMPLETE_PILOT_CONFIG || 'false') === 'true';
}
