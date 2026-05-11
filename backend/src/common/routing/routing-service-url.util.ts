type ConfigReader = {
  get<T = string>(key: string): T | undefined;
};

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function normalizeAndValidateRoutingServiceBaseUrl(
  value: string,
  sourceLabel: string,
) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (CONTROL_CHARS.test(trimmed)) {
    throw new Error(`${sourceLabel} contains control characters`);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${sourceLabel} must be an absolute http(s) URL`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `${sourceLabel} must use http or https (received ${url.protocol})`,
    );
  }

  if (url.username || url.password) {
    throw new Error(`${sourceLabel} must not include credentials`);
  }

  url.search = '';
  url.hash = '';

  return normalizeBaseUrl(url.toString());
}

export function resolveRoutingServiceUrl(configService: ConfigReader): string {
  const routingServiceUrl = configService.get<string>('ROUTING_SERVICE_URL');
  if (routingServiceUrl && routingServiceUrl.trim()) {
    return normalizeAndValidateRoutingServiceBaseUrl(
      routingServiceUrl,
      'ROUTING_SERVICE_URL',
    );
  }

  const legacyProviderUrl = configService.get<string>('ROUTING_PROVIDER_URL');
  if (legacyProviderUrl && legacyProviderUrl.trim()) {
    return normalizeAndValidateRoutingServiceBaseUrl(
      legacyProviderUrl,
      'ROUTING_PROVIDER_URL',
    );
  }

  const hostport = configService.get<string>('ROUTING_SERVICE_HOSTPORT');
  if (hostport && hostport.trim()) {
    const scheme =
      configService.get<string>('ROUTING_SERVICE_SCHEME') || 'http';
    const normalizedScheme = scheme.trim().toLowerCase();
    if (normalizedScheme !== 'http' && normalizedScheme !== 'https') {
      throw new Error(
        `ROUTING_SERVICE_SCHEME must be http or https (received ${scheme})`,
      );
    }
    const normalizedHostport = hostport.trim().replace(/^https?:\/\//i, '');
    return normalizeAndValidateRoutingServiceBaseUrl(
      `${normalizedScheme}://${normalizedHostport}`,
      'ROUTING_SERVICE_HOSTPORT',
    );
  }

  return 'http://localhost:8000';
}

export function routingServiceAuthHeaders(
  configService: ConfigReader,
): Record<string, string> {
  const token = configService.get<string>('ROUTING_SERVICE_INTERNAL_TOKEN')?.trim();
  return token ? { 'x-routing-service-token': token } : {};
}
