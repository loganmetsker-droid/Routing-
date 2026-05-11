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

  // GraphQL Playground
  playground: ['development', 'test'].includes(
    configService.get('NODE_ENV') || 'development',
  ),
  introspection: ['development', 'test'].includes(
    configService.get('NODE_ENV') || 'development',
  ),

  // Context - include request for auth
  context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),


  // Format errors for production
  formatError: (error) => {
    if (configService.get('NODE_ENV') === 'production') {
      // Don't expose internal errors in production
      return {
        message: error.message,
        locations: error.locations,
        path: error.path,
      };
    }
    return error;
  },

  // CORS


  // Subscriptions (for real-time features)
  subscriptions: {
    'graphql-ws': true,
    'subscriptions-transport-ws': false, // Deprecated
  },
});
