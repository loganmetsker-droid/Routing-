/**
 * REST API service for routing backend integration
 * Endpoints: /api/jobs, /api/dispatch/routes, /api/vehicles, /api/drivers
 */

const API_BASE_URL = (import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '').replace(/\/api$/, '');
const AUTH_TOKEN_KEY = 'authToken';

interface Job {
  id: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress: string;
  pickupAddress?: string;
  deliveryAddressStructured?: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    zip: string;
  };
  timeWindow?: { start: string; end: string };
  priority?: string;
  status: string;
  assignedRouteId?: string;
  assignedVehicleId?: string;
  stopSequence?: number;
  createdAt?: string;
}

interface Route {
  id: string;
  vehicleId: string;
  jobIds: string[];
  driverId?: string | null;
  status: string;
  totalDistance?: number;
  totalDuration?: number;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  optimizedStops?: Array<{
    jobId: string;
    sequence: number;
    address: string;
  }>;
  routeData?: any;
  dataQuality?: 'live' | 'degraded' | 'simulated';
  optimizationStatus?: 'optimized' | 'degraded' | 'failed';
  planningWarnings?: string[];
  droppedJobIds?: string[];
  plannerDiagnostics?: Record<string, any>;
  workflowStatus?: string;
  simulated?: boolean;
  rerouteState?: string | null;
  pendingRerouteRequestId?: string | null;
  exceptionCategory?: string | null;
  constraintPackId?: string | null;
  estimatedCapacity?: number;
  optimizedAt?: string;
  createdAt?: string;
  dispatchedAt?: string;
  completedAt?: string;
}

export type OptimizerHealth = {
  status: 'healthy' | 'degraded' | 'unavailable';
  circuitOpen: boolean;
  consecutiveFailures: number;
  lastCheckedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  message?: string;
};

export type OptimizerEvent = {
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  fallbackUsed: boolean;
  timestamp: string;
};

export type DispatchTimelineEvent = {
  id: string;
  routeId?: string | null;
  source: 'optimizer' | 'reroute' | 'workflow' | 'system';
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  payload?: Record<string, any> | null;
  reasonCode?: string | null;
  action?: string | null;
  actor?: string | null;
  packId?: string | null;
  createdAt: string;
};

export type RerouteConstraintDiagnostics = {
  feasible: boolean;
  reasonCodes: string[];
  infeasibleJobReasonCodes: Record<string, string[]>;
  impactedJobIds: string[];
  impactedStopIds: string[];
  capacityConflicts: Array<{
    metric: 'weight_kg' | 'volume_m3';
    demand: number;
    capacity: number;
    overBy: number;
  }>;
  timeWindowViolations: Array<{
    jobId: string;
    eta: string;
    windowStart: string;
    windowEnd: string;
    latenessMinutes: number;
  }>;
  skillMismatches: Array<{
    jobId: string;
    requiredSkills: string[];
    availableSkills: string[];
  }>;
  warnings: string[];
  selectedPackId?: string | null;
  packDiagnostics?: Array<{
    packId: string;
    feasible: boolean;
    reasonCodes: string[];
    warnings: string[];
    details?: Record<string, any>;
  }>;
  feasibilityScore?: number;
  conflictSummary?: {
    critical: number;
    major: number;
    minor: number;
    total: number;
  };
};

export type ReroutePreviewAlternative = {
  action: string;
  label: string;
  summary: string;
  feasible: boolean;
  score: number;
  rank: number;
  rationale: string;
  tradeoffs: string[];
};

export type ReroutePreview = {
  beforeSnapshot: Record<string, any>;
  afterSnapshot: Record<string, any>;
  impactSummary: Record<string, any>;
  impliedDataQuality: 'live' | 'degraded' | 'simulated';
  impliedOptimizationStatus: 'optimized' | 'degraded' | 'failed';
  impliedWorkflowStatus: string;
  dispatchBlocked: boolean;
  constraintDiagnostics: RerouteConstraintDiagnostics;
  alternatives: ReroutePreviewAlternative[];
  feasibilitySummary?: {
    score: number;
    feasible: boolean;
    rationale: string;
  };
};

export type RerouteRequest = {
  id: string;
  routeId: string;
  exceptionCategory: string;
  action: string;
  status: 'requested' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  reason: string;
  requestPayload?: Record<string, any> | null;
  beforeSnapshot?: Record<string, any> | null;
  afterSnapshot?: Record<string, any> | null;
  impactSummary?: Record<string, any> | null;
  plannerDiagnostics?: Record<string, any> | null;
  requesterId?: string | null;
  reviewerId?: string | null;
  reviewNote?: string | null;
  appliedBy?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  appliedAt?: string | null;
  createdAt?: string;
};

type ApiRequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export type LoginResponse = {
  accessToken: string;
  expiresIn: string;
  user: AuthUser;
};

export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  defaultAddress?: string;
  defaultAddressStructured?: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    zip: string;
  };
  [key: string]: any;
};

const getAuthToken = (): string | null => localStorage.getItem(AUTH_TOKEN_KEY);
let latestOptimizerHealth: OptimizerHealth | null = null;

export const setAuthToken = (token: string | null) => {
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const isAuthenticated = () => Boolean(getAuthToken());

const resolveErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    return data?.message || data?.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const apiFetch = async (path: string, options: ApiRequestOptions = {}) => {
  const { skipAuth, headers, ...rest } = options;
  const token = getAuthToken();
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!skipAuth && token) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) {
      clearAuthSession();
    }
    throw new Error(await resolveErrorMessage(response));
  }

  return response;
};

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (data?.accessToken) {
    setAuthToken(data.accessToken);
  }
  return data;
};

export const getSession = async (): Promise<{ user: AuthUser }> => {
  const response = await apiFetch('/api/auth/me');
  return response.json();
};

export const validateSession = async (): Promise<boolean> => {
  if (!isAuthenticated()) return false;
  try {
    await getSession();
    return true;
  } catch {
    clearAuthSession();
    return false;
  }
};

export const getCustomers = async (): Promise<Customer[]> => {
  try {
    const response = await apiFetch('/api/customers');
    const data = await response.json();
    return Array.isArray(data) ? data : data.customers || [];
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
};

// Jobs API
export const createJob = async (job: Omit<Job, 'id'>): Promise<{ job: Job }> => {
  const response = await apiFetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(job),
  });
  return response.json();
};

// Sanitize job data to ensure required fields
const sanitizeJob = (job: any): Job => ({
  id: job.id || `job-${Date.now()}-${Math.random()}`,
  customerId: job.customerId,
  customerName: job.customerName || 'Unknown Customer',
  customerPhone: job.customerPhone,
  customerEmail: job.customerEmail,
  deliveryAddress: job.deliveryAddress || 'Unknown Address',
  pickupAddress: job.pickupAddress,
  deliveryAddressStructured: job.deliveryAddressStructured,
  timeWindow: job.timeWindow,
  priority: job.priority,
  status: job.status || 'pending',
  assignedRouteId: job.assignedRouteId,
  assignedVehicleId: job.assignedVehicleId,
  stopSequence: job.stopSequence,
  createdAt: job.createdAt,
});

export const getJobs = async (): Promise<Job[]> => {
  try {
    const response = await apiFetch('/api/jobs');
    const data = await response.json();
    const rawJobs = Array.isArray(data) ? data : data.jobs || [];
    return rawJobs.map(sanitizeJob);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
};

export const updateJobStatus = async (id: string, status: string, assignedRouteId?: string): Promise<{ job: Job }> => {
  const response = await apiFetch(`/api/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, assignedRouteId }),
  });
  return response.json();
};

export const updateJob = async (id: string, updates: Partial<Job>): Promise<{ job: Job }> => {
  const response = await apiFetch(`/api/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return response.json();
};

// Routes API
export const generateRoute = async (vehicleId: string, jobIds: string[]): Promise<{ route: Route }> => {
  const response = await apiFetch('/api/dispatch/routes', {
    method: 'POST',
    body: JSON.stringify({ vehicleId, jobIds }),
  });
  return response.json();
};

export const generateGlobalRoute = async (vehicleIds: string[], jobIds: string[]): Promise<Route[]> => {
  const response = await apiFetch('/api/dispatch/routes/global', {
    method: 'POST',
    body: JSON.stringify({ vehicleIds, jobIds }),
  });
  const data = await response.json();
  return Array.isArray(data) ? data : data.routes || [];
};

// Sanitize route data to ensure required fields
const sanitizeRoute = (route: any): Route => {
  const derivedStops = Array.isArray(route.optimizedStops)
    ? route.optimizedStops
    : Array.isArray(route.routeData?.route)
      ? route.routeData.route.map((stop: any, idx: number) => ({
          jobId: stop.job_id || stop.jobId,
          sequence: stop.sequence ?? idx,
          address: stop.address || '',
        }))
      : undefined;

  const routeData = route.routeData || {};
  const rawDataQuality = route.dataQuality || routeData.data_quality || (routeData.is_fallback ? 'simulated' : 'live');
  const dataQuality: Route['dataQuality'] =
    rawDataQuality === 'degraded' || rawDataQuality === 'simulated' ? rawDataQuality : 'live';
  const rawOptimizationStatus =
    route.optimizationStatus || routeData.optimization_status || (routeData.is_fallback ? 'degraded' : 'optimized');
  const optimizationStatus: Route['optimizationStatus'] =
    rawOptimizationStatus === 'degraded' || rawOptimizationStatus === 'failed'
      ? rawOptimizationStatus
      : 'optimized';
  const planningWarnings = route.planningWarnings || routeData.warnings || [];
  const droppedJobIds = route.droppedJobIds || routeData.dropped_jobs || [];
  const plannerDiagnostics = route.plannerDiagnostics || routeData.planner_diagnostics || {};

  return {
    id: route.id || `route-${Date.now()}-${Math.random()}`,
    vehicleId: route.vehicleId || 'unknown-vehicle',
    jobIds: Array.isArray(route.jobIds) ? route.jobIds : [],
    driverId: route.driverId,
    status: route.status || 'planned',
    totalDistance: route.totalDistance ?? route.totalDistanceKm,
    totalDuration: route.totalDuration ?? route.totalDurationMinutes,
    totalDistanceKm: route.totalDistanceKm,
    totalDurationMinutes: route.totalDurationMinutes,
    optimizedStops: derivedStops,
    routeData: route.routeData,
    dataQuality,
    optimizationStatus,
    planningWarnings,
    droppedJobIds,
    plannerDiagnostics,
    workflowStatus: route.workflowStatus || route.status || 'planned',
    simulated: route.simulated ?? dataQuality === 'simulated',
    rerouteState: route.rerouteState ?? routeData.reroute_state ?? null,
    pendingRerouteRequestId:
      route.pendingRerouteRequestId ?? routeData.pending_reroute_request_id ?? null,
    exceptionCategory: route.exceptionCategory ?? routeData.exception_category ?? null,
    constraintPackId: route.constraintPackId ?? routeData.constraint_pack_id ?? null,
    estimatedCapacity: route.estimatedCapacity,
    optimizedAt: route.optimizedAt,
    createdAt: route.createdAt,
    dispatchedAt: route.dispatchedAt,
    completedAt: route.completedAt,
  };
};

export const getRoutes = async (): Promise<Route[]> => {
  try {
    const response = await apiFetch('/api/dispatch/routes');
    const data = await response.json();
    if (data?.optimizerHealth) {
      latestOptimizerHealth = data.optimizerHealth;
    }
    const rawRoutes = Array.isArray(data) ? data : data.routes || [];
    return rawRoutes.map(sanitizeRoute);
  } catch (error) {
    console.error('Error fetching routes:', error);
    return [];
  }
};

export const getDispatchOptimizerHealth = async (): Promise<OptimizerHealth | null> => {
  try {
    const response = await apiFetch('/api/dispatch/optimizer/health');
    const data = await response.json();
    if (data?.status) {
      latestOptimizerHealth = data;
      return data as OptimizerHealth;
    }
    return latestOptimizerHealth;
  } catch (error) {
    console.error('Error fetching optimizer health:', error);
    return latestOptimizerHealth;
  }
};

export const getDispatchOptimizerEvents = async (
  limit = 20,
): Promise<OptimizerEvent[]> => {
  try {
    const response = await apiFetch(`/api/dispatch/optimizer/events?limit=${limit}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.events || [];
  } catch (error) {
    console.error('Error fetching optimizer events:', error);
    return [];
  }
};

export const getDispatchTimeline = async (
  params: {
    routeId?: string;
    limit?: number;
    reasonCode?: string;
    action?: string;
    actor?: string;
    source?: 'optimizer' | 'reroute' | 'workflow' | 'system';
    before?: string;
    packId?: string;
  } = {},
): Promise<DispatchTimelineEvent[]> => {
  try {
    const search = new URLSearchParams();
    if (params.routeId) search.set('routeId', params.routeId);
    if (params.limit) search.set('limit', String(params.limit));
    if (params.reasonCode) search.set('reasonCode', params.reasonCode);
    if (params.action) search.set('action', params.action);
    if (params.actor) search.set('actor', params.actor);
    if (params.source) search.set('source', params.source);
    if (params.before) search.set('before', params.before);
    if (params.packId) search.set('packId', params.packId);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const response = await apiFetch(`/api/dispatch/timeline${suffix}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.events || [];
  } catch (error) {
    console.error('Error fetching dispatch timeline:', error);
    return [];
  }
};

export const requestReroute = async (
  routeId: string,
  payload: {
    exceptionCategory: string;
    action: string;
    reason: string;
    requesterId?: string;
    requestPayload?: Record<string, any>;
    plannerDiagnostics?: Record<string, any>;
  },
): Promise<{ rerouteRequest: RerouteRequest; route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/request`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return {
    rerouteRequest: data.rerouteRequest,
    route: sanitizeRoute(data.route || {}),
  };
};

export const approveReroute = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return {
    rerouteRequest: data.rerouteRequest,
    route: sanitizeRoute(data.route || {}),
  };
};

export const rejectReroute = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return {
    rerouteRequest: data.rerouteRequest,
    route: sanitizeRoute(data.route || {}),
  };
};

export const applyReroute = async (
  routeId: string,
  requestId: string,
  payload: {
    appliedBy?: string;
    appliedPayload?: Record<string, any>;
    overrideRequested?: boolean;
    overrideReason?: string;
    overrideActor?: string;
    overrideActorRole?: string;
  } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/${requestId}/apply`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return {
    rerouteRequest: data.rerouteRequest,
    route: sanitizeRoute(data.route || {}),
  };
};

export const getRerouteHistory = async (
  routeId: string,
): Promise<RerouteRequest[]> => {
  try {
    const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/history`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.rerouteRequests || [];
  } catch (error) {
    console.error('Error fetching reroute history:', error);
    return [];
  }
};

export const previewReroute = async (
  routeId: string,
  payload: { action: string; payload?: Record<string, any> },
): Promise<ReroutePreview | null> => {
  try {
    const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/preview`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return (data.preview || null) as ReroutePreview | null;
  } catch (error) {
    console.error('Error previewing reroute:', error);
    return null;
  }
};

export const assignDriverToRoute = async (routeId: string, driverId: string): Promise<{ route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ driverId }),
  });
  return response.json();
};

export const updateRouteStatus = async (routeId: string, status: string): Promise<{ route: Route }> => {
  const normalizedStatus = status === 'dispatched' ? 'in_progress' : status;

  if (normalizedStatus === 'in_progress') {
    return startRoute(routeId);
  }
  if (normalizedStatus === 'completed') {
    return completeRoute(routeId);
  }
  if (normalizedStatus === 'cancelled') {
    return cancelRoute(routeId);
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: normalizedStatus }),
  });
  return response.json();
};

export const startRoute = async (routeId: string): Promise<{ route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/start`, {
    method: 'PATCH',
  });
  return response.json();
};

export const completeRoute = async (routeId: string): Promise<{ route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/complete`, {
    method: 'PATCH',
  });
  return response.json();
};

export const cancelRoute = async (routeId: string): Promise<{ route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/cancel`, {
    method: 'PATCH',
  });
  return response.json();
};

export const updateRoute = async (routeId: string, updates: Partial<Route>): Promise<{ route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return response.json();
};

export const reorderRouteStops = async (routeId: string, newJobOrder: string[]): Promise<{ route: Route }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ newJobOrder }),
  });
  return response.json();
};

// Vehicles & Drivers API
const sanitizeVehicle = (vehicle: any) => ({
  ...vehicle,
  id: vehicle.id || `vehicle-${Date.now()}-${Math.random()}`,
  status: vehicle.status || 'UNKNOWN',
});

const sanitizeDriver = (driver: any) => ({
  ...driver,
  id: driver.id || `driver-${Date.now()}-${Math.random()}`,
  status: driver.status || 'UNKNOWN',
});

export const getVehicles = async (): Promise<any[]> => {
  try {
    const response = await apiFetch('/api/vehicles');
    const data = await response.json();
    const rawVehicles = Array.isArray(data) ? data : data.vehicles || [];
    return rawVehicles.map(sanitizeVehicle);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return [];
  }
};

export const getDrivers = async (): Promise<any[]> => {
  try {
    const response = await apiFetch('/api/drivers');
    const data = await response.json();
    const rawDrivers = Array.isArray(data) ? data : data.drivers || [];
    return rawDrivers.map(sanitizeDriver);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return [];
  }
};

// SSE for real-time updates
export const connectSSE = (onMessage: (data: any) => void): EventSource => {
  const eventSource = new EventSource(`${API_BASE_URL}/stream-route`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('SSE parse error:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
  };

  return eventSource;
};
