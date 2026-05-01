export function isSwaggerEnabled(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (configured) {
    return ['1', 'true', 'yes', 'on'].includes(configured);
  }

  return (env.NODE_ENV || 'development') !== 'production';
}

