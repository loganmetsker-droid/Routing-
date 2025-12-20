/**
 * Common types used across the SDK
 */

export interface Location {
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  vehicleId: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  totalDistance: number;
  totalDuration: number;
  waypoints: Location[];
  jobs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Dispatch {
  id: string;
  routeId: string;
  driverId: string;
  vehicleId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  scheduledStart: string;
  actualStart?: string;
  actualEnd?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RouteAssignment {
  routeId: string;
  driverId: string;
}

export interface DistanceCalculation {
  distance: number;
  duration: number;
  route: Location[];
}

export interface SDKConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ErrorResponse {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
