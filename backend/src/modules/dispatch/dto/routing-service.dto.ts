/**
 * DTOs for communication with Python routing-service
 */

export type DataQuality = 'live' | 'degraded' | 'simulated';
export type OptimizationStatus = 'optimized' | 'degraded' | 'failed';

export interface OptimizerHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  circuitOpen: boolean;
  consecutiveFailures: number;
  lastCheckedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  message?: string;
}

export interface OptimizerEvent {
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  fallbackUsed: boolean;
  timestamp: string;
}

export class RoutingServiceRequest {
  vehicle_id: string;
  job_ids: string[];
}

export class JobInRoute {
  job_id: string;
  sequence: number;
  location: {
    latitude: number;
    longitude: number;
  };
  estimated_arrival: string;
  time_window_start: string;
  time_window_end: string;
  priority: number;
}

export class RoutingServiceResponse {
  success: boolean;
  route: JobInRoute[];
  total_distance_km: number;
  total_duration_minutes: number;
  num_jobs: number;
  vehicle_start_location: {
    latitude: number;
    longitude: number;
  };
  polyline?: any; // Optional polyline from routing service
  error?: string;
  optimization_status?: OptimizationStatus;
  data_quality?: DataQuality;
  is_fallback?: boolean;
  fallback_reason?: string;
  warnings?: string[];
  dropped_jobs?: string[];
  planner_diagnostics?: Record<string, any>;
}

export class GlobalRoutingServiceRequest {
  vehicle_ids: string[];
  job_ids: string[];
}

export class RouteInfo {
  route: JobInRoute[];
  total_distance_km: number;
  total_duration_minutes: number;
  num_jobs: number;
  vehicle_start_location: {
    latitude: number;
    longitude: number;
  };
  data_quality?: DataQuality;
  optimization_status?: OptimizationStatus;
  warnings?: string[];
  dropped_jobs?: string[];
  planner_diagnostics?: Record<string, any>;
}

export class GlobalRoutingServiceResponse {
  success: boolean;
  routes: Record<string, RouteInfo>;
  unassigned_jobs: string[];
  error?: string;
  optimization_status?: OptimizationStatus;
  data_quality?: DataQuality;
  is_fallback?: boolean;
  fallback_reason?: string;
  warnings?: string[];
  planner_diagnostics?: Record<string, any>;
}

export class OptimizeVehicleInput {
  id: string;
  start_lat: number;
  start_lng: number;
  end_lat?: number;
  end_lng?: number;
  capacity_volume: number;
  max_route_minutes: number;
}

export class OptimizeStopInput {
  id: string;
  lat: number;
  lng: number;
  service_minutes: number;
  tw_start?: string;
  tw_end?: string;
  priority: number;
  volume: number;
  locked_vehicle_id?: string | null;
}

export class OptimizeRequest {
  plan_date: string;
  depot_id?: string | null;
  vehicles: OptimizeVehicleInput[];
  stops: OptimizeStopInput[];
}

export class OptimizeRouteStopOutput {
  stop_id: string;
  sequence: number;
  eta?: string;
}

export class OptimizeRouteOutput {
  vehicle_id: string;
  ordered_stops: OptimizeRouteStopOutput[];
  total_distance_m: number;
  total_duration_s: number;
}

export class OptimizeResponse {
  routes: OptimizeRouteOutput[];
  unassigned_stop_ids: string[];
  warnings: string[];
}
