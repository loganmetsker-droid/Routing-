export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ApiErrorCode =
  | 'JOB_VALIDATION_ERROR'
  | 'VEHICLE_NOT_AVAILABLE'
  | 'SOLVER_FAILED'
  | 'ROUTE_NOT_FOUND'
  | 'INVALID_ROUTE_STATE'
  | 'OPTIMIZATION_TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | string;

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

export interface ApiMeta {
  request_id: string;
  timestamp: string;
  warnings: string[];
}

export interface ApiResponse<T> {
  data: T | null;
  meta: ApiMeta;
  error: ApiError | null;
}

export interface ApiListData<T> {
  items: T[];
  total: number;
}

export interface ApiListResponse<T> extends ApiResponse<ApiListData<T>> {}

export type RouteLifecycleState =
  | 'draft'
  | 'simulated'
  | 'optimized'
  | 'approved'
  | 'dispatched'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RouteStatus = RouteLifecycleState;

export type VehicleStatus =
  | 'available'
  | 'in_route'
  | 'maintenance'
  | 'off_duty'
  | 'inactive'
  | 'unknown';

export type JobStatus =
  | 'unscheduled'
  | 'scheduled'
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'archived'
  | 'cancelled'
  | 'failed';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Stop {
  id?: string;
  jobId: string;
  sequence: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  estimatedArrival?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  priority?: JobPriority;
}

export interface Job {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  pickupAddress?: string | null;
  deliveryAddress: string;
  pickupAddressStructured?: Record<string, unknown> | null;
  deliveryAddressStructured?: Record<string, unknown> | null;
  pickupLocation?: Record<string, unknown> | null;
  deliveryLocation?: Record<string, unknown> | null;
  timeWindow?: { start?: string; end?: string } | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  priority: JobPriority | string;
  status: JobStatus | string;
  assignedRouteId?: string | null;
  assignedVehicleId?: string | null;
  stopSequence?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year?: number;
  licensePlate?: string;
  vin?: string | null;
  vehicleType?: string;
  capacityWeightKg?: number | null;
  capacityVolumeM3?: number | null;
  fuelType?: string;
  status: VehicleStatus | string;
  currentLocation?: Record<string, unknown> | null;
  currentOdometerKm?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  status: string;
  currentVehicleId?: string | null;
  currentVehicle?: Vehicle | null;
  certifications?: string[];
  employmentStatus?: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Route {
  id: string;
  vehicleId: string;
  driverId?: string | null;
  jobIds: string[];
  status: RouteStatus | string;
  workflowStatus?: string;
  totalDistanceKm?: number | null;
  totalDurationMinutes?: number | null;
  polyline?: JsonValue | null;
  color?: string | null;
  eta?: string | null;
  jobCount?: number;
  plannedStart?: string | null;
  actualStart?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  routeData?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManualRouteCreationRequest {
  vehicleId: string;
  driverId?: string | null;
  jobIds: string[];
  plannedStart?: string | null;
  notes?: string | null;
}

export interface OptimizationRequest {
  vehicleIds: string[];
  jobIds: string[];
}

export interface AssignmentExplanation {
  assignmentReason: 'closest_vehicle' | 'capacity_match' | 'time_window_match' | 'fallback_assignment' | string;
  warnings: string[];
}

export interface OptimizationResult {
  success: boolean;
  route?: Stop[];
  routes?: Record<string, unknown>;
  total_distance_km?: number;
  total_duration_minutes?: number;
  num_jobs?: number;
  vehicle_start_location?: { latitude: number; longitude: number };
  unassigned_jobs?: string[];
  error?: string | null;
  warnings?: string[];
  dropped_jobs?: string[];
  planner_diagnostics?: Record<string, unknown>;
  assignment_explanations?: AssignmentExplanation[];
}

export interface OptimizationRun {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  input_snapshot: Record<string, unknown>;
  solver_parameters: Record<string, unknown>;
  warnings: string[];
  metrics: Record<string, unknown>;
  result_summary?: Record<string, unknown> | null;
  artifacts?: Record<string, unknown> | null;
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isApiError = (value: unknown): value is ApiError => {
  return isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';
};

export const isApiMeta = (value: unknown): value is ApiMeta => {
  return (
    isRecord(value) &&
    typeof value.request_id === 'string' &&
    typeof value.timestamp === 'string' &&
    Array.isArray(value.warnings)
  );
};

export const isApiEnvelope = <T = unknown>(value: unknown): value is ApiResponse<T> => {
  return isRecord(value) && 'data' in value && 'meta' in value && 'error' in value && isApiMeta(value.meta) && (value.error === null || isApiError(value.error));
};

export const isApiListData = <T = unknown>(value: unknown): value is ApiListData<T> => {
  return isRecord(value) && Array.isArray(value.items) && typeof value.total === 'number';
};

export const unwrapApiData = <T>(payload: unknown): T => {
  if (isApiEnvelope<T>(payload)) {
    return payload.data as T;
  }
  if (isRecord(payload) && 'data' in payload && payload.data !== undefined) {
    return payload.data as T;
  }
  return payload as T;
};

export const unwrapListItems = <T>(payload: unknown, keys: string[] = []): T[] => {
  const data = unwrapApiData<unknown>(payload);
  if (Array.isArray(data)) return data as T[];
  if (isApiListData<T>(data)) return data.items;
  if (isRecord(data)) {
    for (const key of keys) {
      const candidate = data[key];
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }
  return [];
};

export const listEnvelope = <T>(items: T[], meta: ApiMeta): ApiResponse<ApiListData<T>> => ({
  data: { items, total: items.length },
  meta,
  error: null,
});

export const itemEnvelope = <T>(data: T, meta: ApiMeta): ApiResponse<T> => ({
  data,
  meta,
  error: null,
});

export const errorEnvelope = (code: ApiErrorCode, message: string, requestId: string, timestamp = new Date().toISOString()): ApiResponse<null> => ({
  data: null,
  meta: {
    request_id: requestId,
    timestamp,
    warnings: [],
  },
  error: { code, message },
});
