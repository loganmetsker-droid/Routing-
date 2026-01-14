/**
 * REST API service for routing backend integration
 * Endpoints: /api/jobs, /api/routes, /api/vehicles, /api/drivers
 */

const API_BASE_URL = import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Job {
  id?: string;
  customerName: string;
  deliveryAddress: string;
  timeWindow?: { start: string; end: string };
  priority?: string;
  status?: string;
  assignedRouteId?: string;
  assignedVehicleId?: string;
  stopSequence?: number;
  createdAt?: string;
}

interface Route {
  id?: string;
  vehicleId: string;
  jobIds: string[];
  driverId?: string;
  status?: string;
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

export const getJobs = async (): Promise<{ jobs: Job[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/jobs`);
  if (!response.ok) throw new Error('Failed to fetch jobs');
  return response.json();
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
  const response = await fetch(`${API_BASE_URL}/api/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleId, jobIds }),
  });
  if (!response.ok) throw new Error('Failed to generate route');
  return response.json();
};

export const getRoutes = async (): Promise<{ routes: Route[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/routes`);
  if (!response.ok) throw new Error('Failed to fetch routes');
  return response.json();
};

export const assignDriverToRoute = async (routeId: string, driverId: string): Promise<{ route: Route }> => {
  const response = await fetch(`${API_BASE_URL}/api/routes/${routeId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverId }),
  });
  if (!response.ok) throw new Error('Failed to assign driver');
  return response.json();
};

export const updateRouteStatus = async (routeId: string, status: string): Promise<{ route: Route }> => {
  const response = await fetch(`${API_BASE_URL}/api/routes/${routeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Failed to update route');
  return response.json();
};

export const updateRoute = async (routeId: string, updates: Partial<Route>): Promise<{ route: Route }> => {
  const response = await fetch(`${API_BASE_URL}/api/routes/${routeId}`, {
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
export const getVehicles = async (): Promise<{ vehicles: any[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/vehicles`);
  if (!response.ok) throw new Error('Failed to fetch vehicles');
  return response.json();
};

export const getDrivers = async (): Promise<{ drivers: any[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/drivers`);
  if (!response.ok) throw new Error('Failed to fetch drivers');
  return response.json();
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
