import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

export function isGraphqlEnabled(
  env: Partial<Pick<NodeJS.ProcessEnv, 'GRAPHQL_ENABLED' | 'NODE_ENV'>> = process.env,
) {
  const explicit = String(env.GRAPHQL_ENABLED || '').trim().toLowerCase();
  if (explicit) {
    return explicit === 'true' || explicit === '1';
  }

  return ['development', 'test'].includes(env.NODE_ENV || 'development');
}

export const graphqlConfig = (
  configService: ConfigService,
): ApolloDriverConfig => ({
  // Auto-generate schema file
  // In production: use in-memory (read-only FS)
  // In development: write to file for inspection
  autoSchemaFile: configService.get('NODE_ENV') === 'production'
    ? true
    : join(process.cwd(), 'src/schema.gql'),
  sortSchema: true,

  // The legacy Playground plugin bundled by @nestjs/apollo targets Apollo 4,
  // while this service runs Apollo 5. Keep it disabled; GraphQL requests and
  // development introspection remain available without loading that plugin.
  playground: false,
  introspection: ['development', 'test'].includes(
    configService.get('NODE_ENV') || 'development',
  ),

  // Context - include request for auth
  context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),


  // Format errors for production
  formatError: (error) => {
    if (configService.get('NODE_ENV') === 'production') {
      const code = error.extensions?.code;
      return {
        message:
          code === 'INTERNAL_SERVER_ERROR'
            ? 'Internal server error'
            : error.message,
        locations: error.locations,
        path: error.path,
        extensions: code ? { code } : undefined,
      };
    }
    return error;
  },

  // CORS


  // This service has no GraphQL subscription resolvers. Keep both protocols
  // disabled so enabling the compatibility API does not open an unused socket.
  subscriptions: {
    'graphql-ws': false,
    'subscriptions-transport-ws': false,
  },
});
