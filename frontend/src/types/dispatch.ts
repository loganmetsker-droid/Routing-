export interface DispatchJob {
  id: string;
  customerName: string;
  deliveryAddress?: string;
  pickupAddress?: string;
  deliveryLocation?: { lat: number; lng: number };
  pickupLocation?: { lat: number; lng: number };
  timeWindowStart?: string;
  timeWindowEnd?: string;
  estimatedDuration?: number;
  status: string;
  priority?: string;
  assignedRouteId?: string | null;
  assignedVehicleId?: string;
  stopSequence?: number;
  createdAt?: string;
  completedAt?: string;
}

export interface DispatchOptimizedStop {
  jobId: string;
  sequence: number;
  address: string;
  estimatedArrival?: string;
  distanceFromPrevious?: number;
}

export interface DispatchRoute {
  id: string;
  vehicleId?: string;
  driverId?: string | null;
  jobIds?: string[];
  status?: string;
  totalDistance?: number;
  totalDuration?: number;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  estimatedCapacity?: number;
  optimizedStops?: DispatchOptimizedStop[];
  optimizedAt?: string;
  currentLocation?: [number, number];
  completedStops?: number;
  totalStops?: number;
  estimatedTimeRemaining?: number;
  eta?: string;
  path?: [number, number][];
  routeData?: Record<string, unknown>;
  dataQuality?: 'live' | 'degraded' | 'simulated';
  optimizationStatus?: 'optimized' | 'degraded' | 'failed';
  planningWarnings?: string[];
  droppedJobIds?: string[];
  plannerDiagnostics?: Record<string, unknown>;
  workflowStatus?: string;
  simulated?: boolean;
  rerouteState?: string | null;
  pendingRerouteRequestId?: string | null;
  exceptionCategory?: string | null;
  constraintPackId?: string | null;
}

export interface DispatchVehicle {
  id: string;
  make?: string;
  model?: string;
  licensePlate?: string;
  vehicleType?: string;
  currentLocation?: { lat: number; lng: number } | null;
  status: string;
  capacity?: number;
}

export interface DispatchDriver {
  id: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  currentHours?: number;
  maxHours?: number;
}

export interface DispatchPlannerSelection {
  selectedJobIds: string[];
  source?: 'jobs' | 'dispatch';
  createdAt?: number;
}

export const DISPATCH_PLANNER_SELECTION_KEY = 'dispatchPlannerSelection';
