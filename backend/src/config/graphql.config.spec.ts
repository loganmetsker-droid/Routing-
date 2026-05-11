import { describe, expect, it } from 'vitest';
import { isGraphqlEnabled } from './graphql.config';

describe('GraphQL launch gating', () => {
  it('enables GraphQL by default in development and test', () => {
    expect(isGraphqlEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isGraphqlEnabled({ NODE_ENV: 'test' })).toBe(true);
  });

  it('disables GraphQL by default in staging and production', () => {
    expect(isGraphqlEnabled({ NODE_ENV: 'staging' })).toBe(false);
    expect(isGraphqlEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('requires an explicit opt-in outside development', () => {
    expect(
      isGraphqlEnabled({ NODE_ENV: 'production', GRAPHQL_ENABLED: 'true' }),
    ).toBe(true);
    expect(
      isGraphqlEnabled({ NODE_ENV: 'staging', GRAPHQL_ENABLED: 'false' }),
    ).toBe(false);
  });
});
