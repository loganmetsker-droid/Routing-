type ConfigReader = {
  get<T = string>(key: string): T | undefined;
};

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function resolveRoutingServiceUrl(configService: ConfigReader): string {
  const explicit =
    configService.get<string>('ROUTING_SERVICE_URL') ||
    configService.get<string>('ROUTING_PROVIDER_URL');
  if (explicit && explicit.trim()) {
    return normalizeBaseUrl(explicit);
  }

  const hostport = configService.get<string>('ROUTING_SERVICE_HOSTPORT');
  if (hostport && hostport.trim()) {
    const scheme =
      configService.get<string>('ROUTING_SERVICE_SCHEME') || 'http';
    const normalizedHostport = hostport.trim().replace(/^https?:\/\//i, '');
    return normalizeBaseUrl(`${scheme}://${normalizedHostport}`);
  }

  return 'http://localhost:8000';
}
