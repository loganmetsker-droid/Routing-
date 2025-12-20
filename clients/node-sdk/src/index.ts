/**
 * Routing & Dispatch SDK for Node.js/TypeScript
 */

export { RoutingClient } from './RoutingClient';
export { DispatchClient } from './DispatchClient';
export { BaseClient } from './BaseClient';

export {
  RoutingDispatchError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from './errors';

export type {
  SDKConfig,
  Location,
  Route,
  Dispatch,
  RouteAssignment,
  DistanceCalculation,
  PaginatedResponse,
  ErrorResponse,
} from './types';

export type { PlanRouteOptions, ListRoutesOptions } from './RoutingClient';
export type {
  CreateDispatchOptions,
  ListDispatchesOptions,
  UpdateDispatchStatusOptions,
} from './DispatchClient';
