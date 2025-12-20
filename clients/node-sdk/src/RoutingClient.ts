/**
 * Routing client for route planning and optimization
 */

import { BaseClient } from './BaseClient';
import { Route, Location, DistanceCalculation, SDKConfig } from './types';

export interface PlanRouteOptions {
  vehicleId: string;
  jobIds: string[];
  optimize?: boolean;
  startLocation?: Location;
  endLocation?: Location;
}

export interface ListRoutesOptions {
  vehicleId?: string;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  limit?: number;
  offset?: number;
}

export class RoutingClient extends BaseClient {
  constructor(config: SDKConfig) {
    super(config);
  }

  /**
   * Plan an optimized route for a vehicle with given jobs
   *
   * @example
   * ```typescript
   * const route = await routing.planRoute({
   *   vehicleId: 'vehicle-123',
   *   jobIds: ['job-1', 'job-2', 'job-3']
   * });
   * console.log(`Total distance: ${route.totalDistance}km`);
   * ```
   */
  async planRoute(options: PlanRouteOptions): Promise<Route> {
    const payload = {
      vehicleId: options.vehicleId,
      jobIds: options.jobIds,
      optimize: options.optimize ?? true,
      ...(options.startLocation && { startLocation: options.startLocation }),
      ...(options.endLocation && { endLocation: options.endLocation }),
    };

    return this.post<Route>('routes/plan', payload);
  }

  /**
   * Get route details by ID
   */
  async getRoute(routeId: string): Promise<Route> {
    return this.get<Route>(`routes/${routeId}`);
  }

  /**
   * List routes with optional filters
   */
  async listRoutes(options: ListRoutesOptions = {}): Promise<Route[]> {
    const params = {
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
      ...(options.vehicleId && { vehicleId: options.vehicleId }),
      ...(options.status && { status: options.status }),
    };

    const response = await this.get<{ routes: Route[] }>('routes', params);
    return response.routes;
  }

  /**
   * Re-optimize an existing route
   */
  async optimizeRoute(routeId: string): Promise<Route> {
    return this.post<Route>(`routes/${routeId}/optimize`);
  }

  /**
   * Calculate distance and duration between points
   */
  async calculateDistance(options: {
    origin: Location;
    destination: Location;
    waypoints?: Location[];
  }): Promise<DistanceCalculation> {
    const payload = {
      origin: options.origin,
      destination: options.destination,
      ...(options.waypoints && { waypoints: options.waypoints }),
    };

    return this.post<DistanceCalculation>('routes/calculate-distance', payload);
  }

  /**
   * Delete a route
   */
  async deleteRoute(routeId: string): Promise<void> {
    await this.delete(`routes/${routeId}`);
  }
}
