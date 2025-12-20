/**
 * DTOs for communication with Python routing-service
 */

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
  error?: string;
}
