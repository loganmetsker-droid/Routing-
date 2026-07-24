import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { graphqlConfig, isGraphqlEnabled } from './graphql.config';

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

  it('does not expose unused websocket subscription protocols', () => {
    const config = graphqlConfig({
      get: (key: string) => key === 'NODE_ENV' ? 'development' : undefined,
    } as ConfigService);

    expect(config.subscriptions).toEqual({
      'graphql-ws': false,
      'subscriptions-transport-ws': false,
    });
    expect(config.playground).toBe(false);
  });

  it('redacts internal production error messages', () => {
    const config = graphqlConfig({
      get: (key: string) => key === 'NODE_ENV' ? 'production' : undefined,
    } as ConfigService);
    const formatError = config.formatError;

    expect(formatError?.({
      message: 'database connection string leaked',
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    } as never)).toMatchObject({
      message: 'Internal server error',
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  });
});
