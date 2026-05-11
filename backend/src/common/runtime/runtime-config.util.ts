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

export function getMissingRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
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
