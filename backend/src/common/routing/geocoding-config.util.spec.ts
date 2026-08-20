import { describe, expect, it } from 'vitest';
import {
  buildGeocodingRequest,
  coordinateFromGeocodingResponse,
  getMissingGeocodingConfig,
} from './geocoding-config.util';

describe('geocoding provider configuration', () => {
  it('requires contracted geocoding in hosted environments', () => {
    expect(getMissingGeocodingConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv))
      .toEqual(['GEOCODING_PROVIDER=mapbox', 'GEOCODING_API_KEY']);
  });

  it('builds a bounded Mapbox geocoding request', () => {
    const request = buildGeocodingRequest('100 Main St, Denver, CO', {
      NODE_ENV: 'production',
      GEOCODING_PROVIDER: 'mapbox',
      GEOCODING_API_KEY: 'configured',
    } as NodeJS.ProcessEnv);

    expect(request?.provider).toBe('mapbox');
    expect(request?.url.hostname).toBe('api.mapbox.com');
    expect(request?.url.searchParams.get('limit')).toBe('1');
    expect(request?.url.searchParams.get('access_token')).toBe('configured');
  });

  it('parses Mapbox longitude and latitude ordering', () => {
    expect(coordinateFromGeocodingResponse('mapbox', {
      features: [{ center: [-104.9903, 39.7392] }],
    })).toEqual({ lat: 39.7392, lng: -104.9903 });
  });

  it('does not permit Nominatim in hosted environments', () => {
    expect(buildGeocodingRequest('100 Main St', {
      NODE_ENV: 'staging',
      GEOCODING_PROVIDER: 'nominatim',
    } as NodeJS.ProcessEnv)).toBeNull();
  });
});
