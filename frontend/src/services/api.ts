/**
 * REST API service for routing backend integration
 * Endpoints: /api/jobs, /api/dispatch/routes, /api/vehicles, /api/drivers
 */

const API_BASE_URL = (import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '').replace(/\/api$/, '');

interface Job {
  id: string;
  customerName: string;
  deliveryAddress: string;
  pickupAddress?: string;
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
  driverId?: string;
  status: string;
  totalDistance?: number;
  totalDuration?: number;
  optimizedStops?: Array<{
    jobId: string;
    sequence: number;
    address: string;
  }>;
  estimatedCapacity?: number;
  optimizedAt?: string;
  createdAt?: string;
  dispatchedAt?: string;
  completedAt?: string;
}

// Jobs API
export const createJob = async (job: Omit<Job, 'id'>): Promise<{ job: Job }> => {
  const response = await fetch(`${API_BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  });
  if (!response.ok) throw new Error('Failed to create job');
  return response.json();
};

// Sanitize job data to ensure required fields
const sanitizeJob = (job: any): Job => ({
  id: job.id || `job-${Date.now()}-${Math.random()}`,
  customerName: job.customerName || 'Unknown Customer',
  deliveryAddress: job.deliveryAddress || 'Unknown Address',
  pickupAddress: job.pickupAddress,
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
    const response = await fetch(`${API_BASE_URL}/api/jobs`);
    if (!response.ok) return [];
    const data = await response.json();
    const rawJobs = Array.isArray(data) ? data : data.jobs || [];
    return rawJobs.map(sanitizeJob);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
};

export const updateJobStatus = async (id: string, status: string, assignedRouteId?: string): Promise<{ job: Job }> => {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, assignedRouteId }),
  });
  if (!response.ok) throw new Error('Failed to update job');
  return response.json();
};

export const updateJob = async (id: string, updates: Partial<Job>): Promise<{ job: Job }> => {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update job');
  return response.json();
};

// Routes API
export const generateRoute = async (vehicleId: string, jobIds: string[]): Promise<{ route: Route }> => {
  const response = await fetch(`${API_BASE_URL}/api/dispatch/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleId, jobIds }),
  });
  if (!response.ok) throw new Error('Failed to generate route');
  return response.json();
};

export const generateGlobalRoute = async (vehicleIds: string[], jobIds: string[]): Promise<Route[]> => {
  const response = await fetch(`${API_BASE_URL}/api/dispatch/routes/global`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleIds, jobIds }),
  });
  if (!response.ok) throw new Error('Failed to generate global routes');
  const data = await response.json();
  return Array.isArray(data) ? data : data.routes || [];
};

// Sanitize route data to ensure required fields
const sanitizeRoute = (route: any): Route => ({
  id: route.id || `route-${Date.now()}-${Math.random()}`,
  vehicleId: route.vehicleId || 'unknown-vehicle',
  jobIds: Array.isArray(route.jobIds) ? route.jobIds : [],
  driverId: route.driverId,
  status: route.status || 'planned',
  totalDistance: route.totalDistance || route.totalDistanceKm,
  totalDuration: route.totalDuration || route.totalDurationMinutes,
  optimizedStops: route.optimizedStops,
  estimatedCapacity: route.estimatedCapacity,
  optimizedAt: route.optimizedAt,
  createdAt: route.createdAt,
  dispatchedAt: route.dispatchedAt,
  completedAt: route.completedAt,
});

export const getRoutes = async (): Promise<Route[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dispatch/routes`);
    if (!response.ok) return [];
    const data = await response.json();
    const rawRoutes = Array.isArray(data) ? data : data.routes || [];
    return rawRoutes.map(sanitizeRoute);
  } catch (error) {
    console.error('Error fetching routes:', error);
    return [];
  }
};

export const assignDriverToRoute = async (routeId: string, driverId: string): Promise<{ route: Route }> => {
  const response = await fetch(`${API_BASE_URL}/api/dispatch/routes/${routeId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverId }),
  });
  if (!response.ok) throw new Error('Failed to assign driver');
  return response.json();
};

export const updateRouteStatus = async (routeId: string, status: string): Promise<{ route: Route }> => {
  const response = await fetch(`${API_BASE_URL}/api/dispatch/routes/${routeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Failed to update route');
  return response.json();
};

export const updateRoute = async (routeId: string, updates: Partial<Route>): Promise<{ route: Route }> => {
  const response = await fetch(`${API_BASE_URL}/api/dispatch/routes/${routeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update route');
  return response.json();
};

export const reorderRouteStops = async (routeId: string, newJobOrder: string[]): Promise<{ route: Route }> => {
  const response = await fetch(`${API_BASE_URL}/api/dispatch/routes/${routeId}/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newJobOrder }),
  });
  if (!response.ok) throw new Error('Failed to reorder route stops');
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
    const response = await fetch(`${API_BASE_URL}/api/vehicles`);
    if (!response.ok) return [];
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
    const response = await fetch(`${API_BASE_URL}/api/drivers`);
    if (!response.ok) return [];
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
