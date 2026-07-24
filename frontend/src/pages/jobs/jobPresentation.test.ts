import { describe, expect, it } from 'vitest';
import {
  formatJobEta,
  formatJobWindow,
  getJobDriver,
  getJobRoute,
  getJobVehicle,
} from './jobPresentation';
import type { DriverRecord, JobRecord, PlannerRoutePlanGroup, PlannerRoutePlanStop, VehicleRecord } from '../../services/api.types';

const job = {
  id: 'job-1',
  customerName: 'Acme Corp',
  deliveryAddress: '123 Market St',
  priority: 'high',
  status: 'assigned',
  assignedRouteId: 'route-1',
  assignedVehicleId: 'veh-direct',
  timeWindowStart: '2026-06-10T14:00:00',
  timeWindowEnd: '2026-06-10T16:00:00',
} satisfies JobRecord;

const route = {
  id: 'route-1',
  routePlanId: 'plan-1',
  groupIndex: 0,
  label: 'R-1001',
  driverId: 'driver-1',
  vehicleId: 'veh-route',
} satisfies PlannerRoutePlanGroup;

const stops = [
  {
    id: 'stop-1',
    routePlanId: 'plan-1',
    routePlanGroupId: 'route-1',
    jobId: 'job-1',
    jobStopId: 'job-stop-1',
    stopSequence: 1,
    isLocked: false,
    plannedArrival: '2026-06-10T14:42:00',
  },
] satisfies PlannerRoutePlanStop[];

const drivers = [
  {
    id: 'driver-1',
    firstName: 'Sarah',
    lastName: 'Johnson',
    licenseNumber: 'TX-1',
    status: 'ACTIVE',
  },
] satisfies DriverRecord[];

const vehicles = [
  { id: 'veh-route', make: 'Ford', model: 'Transit', licensePlate: 'DEN-112', status: 'available' },
  { id: 'veh-direct', make: 'Chevy', model: 'Express', licensePlate: 'DEN-220', status: 'available' },
] satisfies VehicleRecord[];

describe('jobPresentation', () => {
  it('derives route, driver, vehicle, window, and eta without job-level driver state', () => {
    const derivedRoute = getJobRoute(job, [route], stops);

    expect(derivedRoute?.id).toBe('route-1');
    expect(getJobDriver(derivedRoute, drivers)?.lastName).toBe('Johnson');
    expect(getJobVehicle(job, derivedRoute, vehicles)?.licensePlate).toBe('DEN-220');
    expect(formatJobWindow(job)).toContain('2:00 PM');
    expect(formatJobWindow(job)).toContain('4:00 PM');
    expect(formatJobEta(derivedRoute, job, stops)).toContain('2:42 PM');
  });

  it('falls back to route vehicle when the job does not carry a direct vehicle assignment', () => {
    const jobWithoutVehicle = { ...job, assignedVehicleId: null };
    const derivedRoute = getJobRoute(jobWithoutVehicle, [route], stops);

    expect(getJobVehicle(jobWithoutVehicle, derivedRoute, vehicles)?.licensePlate).toBe('DEN-112');
  });
});
