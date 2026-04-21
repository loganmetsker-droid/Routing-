export type OptimizationJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DispatchAssignmentSnapshot {
  routeId: string;
  driverId?: string | null;
  vehicleId?: string | null;
  status: 'pending' | 'confirmed' | 'reassigned' | 'cancelled';
}
