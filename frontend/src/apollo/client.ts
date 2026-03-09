import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const API_BASE_URL = (import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || `${API_BASE_URL}/graphql`,
});

// Auth link to add JWT token to headers
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('authToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
