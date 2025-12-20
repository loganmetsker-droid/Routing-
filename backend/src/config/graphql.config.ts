import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

export const graphqlConfig = (
  configService: ConfigService,
): ApolloDriverConfig => ({
  // Auto-generate schema file
  autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
  sortSchema: true,

  // GraphQL Playground
  playground: configService.get('NODE_ENV') !== 'production',
  introspection: configService.get('NODE_ENV') !== 'production',

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
