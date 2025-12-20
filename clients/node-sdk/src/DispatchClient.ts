/**
 * Dispatch client for assigning routes and managing dispatches
 */

import { BaseClient } from './BaseClient';
import { Dispatch, RouteAssignment, SDKConfig } from './types';

export interface CreateDispatchOptions {
  routeId: string;
  driverId: string;
  vehicleId: string;
  scheduledStart: string;
  notes?: string;
}

export interface ListDispatchesOptions {
  driverId?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  date?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateDispatchStatusOptions {
  status: 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export class DispatchClient extends BaseClient {
  constructor(config: SDKConfig) {
    super(config);
  }

  /**
   * Assign multiple routes to drivers
   *
   * @example
   * ```typescript
   * const result = await dispatch.assignRoutes([
   *   { routeId: 'route-1', driverId: 'driver-1' },
   *   { routeId: 'route-2', driverId: 'driver-2' },
   * ]);
   * console.log(`Assigned ${result.dispatches.length} routes`);
   * ```
   */
  async assignRoutes(
    assignments: RouteAssignment[],
    autoNotify: boolean = true
  ): Promise<{ dispatches: Dispatch[] }> {
    const payload = {
      assignments,
      autoNotify,
    };

    return this.post<{ dispatches: Dispatch[] }>('dispatches/assign', payload);
  }

  /**
   * Create a new dispatch assignment
   */
  async createDispatch(options: CreateDispatchOptions): Promise<Dispatch> {
    const payload = {
      routeId: options.routeId,
      driverId: options.driverId,
      vehicleId: options.vehicleId,
      scheduledStart: options.scheduledStart,
      ...(options.notes && { notes: options.notes }),
    };

    return this.post<Dispatch>('dispatches', payload);
  }

  /**
   * Get dispatch details by ID
   */
  async getDispatch(dispatchId: string): Promise<Dispatch> {
    return this.get<Dispatch>(`dispatches/${dispatchId}`);
  }

  /**
   * List dispatches with optional filters
   */
  async listDispatches(options: ListDispatchesOptions = {}): Promise<Dispatch[]> {
    const params = {
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
      ...(options.driverId && { driverId: options.driverId }),
      ...(options.status && { status: options.status }),
      ...(options.date && { date: options.date }),
    };

    const response = await this.get<{ dispatches: Dispatch[] }>(
      'dispatches',
      params
    );
    return response.dispatches;
  }

  /**
   * Update dispatch status
   */
  async updateDispatchStatus(
    dispatchId: string,
    options: UpdateDispatchStatusOptions
  ): Promise<Dispatch> {
    const payload = {
      status: options.status,
      ...(options.notes && { notes: options.notes }),
    };

    return this.put<Dispatch>(`dispatches/${dispatchId}/status`, payload);
  }

  /**
   * Cancel a dispatch
   */
  async cancelDispatch(
    dispatchId: string,
    reason?: string
  ): Promise<Dispatch> {
    const payload = reason ? { reason } : {};
    return this.post<Dispatch>(`dispatches/${dispatchId}/cancel`, payload);
  }

  /**
   * Get driver's schedule for a date range
   */
  async getDriverSchedule(
    driverId: string,
    startDate: string,
    endDate: string
  ): Promise<Dispatch[]> {
    const params = {
      driverId,
      startDate,
      endDate,
    };

    const response = await this.get<{ schedule: Dispatch[] }>(
      'dispatches/schedule',
      params
    );
    return response.schedule;
  }
}
