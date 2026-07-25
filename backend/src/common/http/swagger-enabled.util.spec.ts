import {
  getSwaggerServers,
  isSwaggerEnabled,
} from './swagger-enabled.util';

describe('isSwaggerEnabled', () => {
  it('defaults to enabled when NODE_ENV is not production', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'test' })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'staging' })).toBe(true);
    expect(isSwaggerEnabled({})).toBe(true);
  });

  it('defaults to disabled when NODE_ENV is production', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('supports explicit enable/disable via SWAGGER_ENABLED', () => {
    expect(
      isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }),
    ).toBe(true);
    expect(
      isSwaggerEnabled({ NODE_ENV: 'development', SWAGGER_ENABLED: '0' }),
    ).toBe(false);
  });
});

describe('getSwaggerServers', () => {
  it('advertises only the real local server by default in development', () => {
    expect(getSwaggerServers({ NODE_ENV: 'development', PORT: '3100' })).toEqual([
      {
        url: 'http://localhost:3100',
        description: 'Local Development',
      },
    ]);
  });

  it('does not advertise a fake server when hosted URL configuration is absent', () => {
    expect(getSwaggerServers({ NODE_ENV: 'staging' })).toEqual([]);
    expect(getSwaggerServers({ NODE_ENV: 'production' })).toEqual([]);
  });

  it('normalizes an explicitly configured HTTPS server', () => {
    expect(
      getSwaggerServers({
        NODE_ENV: 'production',
        SWAGGER_PUBLIC_SERVER_URL: 'https://api.trytrovan.com/',
      }),
    ).toEqual([
      {
        url: 'https://api.trytrovan.com',
        description: 'Configured API',
      },
    ]);
  });

  it('rejects unsafe or ambiguous hosted server URLs', () => {
    expect(() =>
      getSwaggerServers({
        NODE_ENV: 'production',
        SWAGGER_PUBLIC_SERVER_URL: 'http://api.trytrovan.com',
      }),
    ).toThrow(/must use HTTPS/i);
    expect(() =>
      getSwaggerServers({
        NODE_ENV: 'production',
        SWAGGER_PUBLIC_SERVER_URL:
          'https://user:password@api.trytrovan.com?token=secret',
      }),
    ).toThrow(/cannot contain credentials/i);
    expect(() =>
      getSwaggerServers({
        NODE_ENV: 'production',
        SWAGGER_PUBLIC_SERVER_URL: 'not-a-url',
      }),
    ).toThrow(/valid absolute URL/i);
  });
});
