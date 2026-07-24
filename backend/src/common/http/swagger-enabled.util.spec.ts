import { isSwaggerEnabled } from './swagger-enabled.util';

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
