export function isSwaggerEnabled(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (configured) {
    return ['1', 'true', 'yes', 'on'].includes(configured);
  }

  return (env.NODE_ENV || 'development') !== 'production';
}

export type SwaggerServer = {
  url: string;
  description: string;
};

function isLocalHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase());
}

export function getSwaggerServers(
  env: NodeJS.ProcessEnv = process.env,
): SwaggerServer[] {
  const nodeEnv = (env.NODE_ENV || 'development').trim().toLowerCase();
  const servers: SwaggerServer[] = [];

  if (['development', 'test'].includes(nodeEnv)) {
    const port = env.PORT || env.BACKEND_PORT || '3000';
    servers.push({
      url: `http://localhost:${port}`,
      description: 'Local Development',
    });
  }

  const configuredUrl = env.SWAGGER_PUBLIC_SERVER_URL?.trim();
  if (!configuredUrl) {
    return servers;
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error('SWAGGER_PUBLIC_SERVER_URL must be a valid absolute URL');
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      'SWAGGER_PUBLIC_SERVER_URL cannot contain credentials, a query, or a fragment',
    );
  }

  const localHttp =
    parsed.protocol === 'http:' &&
    isLocalHostname(parsed.hostname) &&
    ['development', 'test'].includes(nodeEnv);
  if (parsed.protocol !== 'https:' && !localHttp) {
    throw new Error(
      'SWAGGER_PUBLIC_SERVER_URL must use HTTPS outside local development',
    );
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const normalizedUrl = parsed.toString().replace(/\/$/, '');
  if (!servers.some((server) => server.url === normalizedUrl)) {
    servers.push({
      url: normalizedUrl,
      description: 'Configured API',
    });
  }

  return servers;
}
