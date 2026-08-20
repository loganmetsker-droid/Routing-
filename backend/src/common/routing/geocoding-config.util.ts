export type GeocodingProvider = 'disabled' | 'mapbox' | 'nominatim';

export function isHostedGeocodingRuntime(env: NodeJS.ProcessEnv = process.env) {
  return ['production', 'staging'].includes(env.NODE_ENV || '');
}

export function getGeocodingProvider(env: NodeJS.ProcessEnv = process.env): GeocodingProvider {
  const configured = String(env.GEOCODING_PROVIDER || 'disabled').trim().toLowerCase();
  if (configured === 'mapbox') return 'mapbox';
  if (configured === 'nominatim' || configured === 'osm') return 'nominatim';
  return 'disabled';
}

export function getMissingGeocodingConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!isHostedGeocodingRuntime(env)) return [];
  const missing: string[] = [];
  if (getGeocodingProvider(env) !== 'mapbox') {
    missing.push('GEOCODING_PROVIDER=mapbox');
  }
  if (!String(env.GEOCODING_API_KEY || '').trim()) {
    missing.push('GEOCODING_API_KEY');
  }
  return missing;
}

export function buildGeocodingRequest(
  address: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const provider = getGeocodingProvider(env);
  if (provider === 'mapbox') {
    const baseUrl = String(
      env.GEOCODING_BASE_URL ||
        'https://api.mapbox.com/geocoding/v5/mapbox.places',
    ).replace(/\/$/, '');
    const url = new URL(`${baseUrl}/${encodeURIComponent(address)}.json`);
    url.searchParams.set('access_token', String(env.GEOCODING_API_KEY || ''));
    url.searchParams.set('limit', '1');
    url.searchParams.set('country', env.GEOCODING_COUNTRY || 'us');
    url.searchParams.set('types', 'address,place,postcode');
    return { provider, url, headers: { Accept: 'application/json' } };
  }

  if (provider === 'nominatim' && !isHostedGeocodingRuntime(env)) {
    const baseUrl = String(
      env.GEOCODING_BASE_URL || 'https://nominatim.openstreetmap.org/search',
    );
    const url = new URL(baseUrl);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', env.GEOCODING_COUNTRY || 'us');
    url.searchParams.set('q', address);
    return {
      provider,
      url,
      headers: {
        Accept: 'application/json',
        'User-Agent':
          env.GEOCODING_USER_AGENT ||
          'TrovanDispatch/1.0 (local route planning geocoder)',
      },
    };
  }

  return null;
}

export function coordinateFromGeocodingResponse(
  provider: Exclude<GeocodingProvider, 'disabled'>,
  payload: unknown,
) {
  if (provider === 'mapbox') {
    const feature = (
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { features?: unknown[] }).features)
    )
      ? (payload as { features: Array<{ center?: unknown[] }> }).features[0]
      : undefined;
    const center = Array.isArray(feature?.center) ? feature.center : [];
    return { lat: center[1], lng: center[0] };
  }

  const best = Array.isArray(payload) ? payload[0] : undefined;
  return best && typeof best === 'object'
    ? {
        lat: (best as Record<string, unknown>).lat,
        lng:
          (best as Record<string, unknown>).lon ??
          (best as Record<string, unknown>).lng,
      }
    : {};
}
