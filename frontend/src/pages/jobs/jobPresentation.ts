import type {
  DriverRecord,
  JobRecord,
  PlannerRoutePlanGroup,
  PlannerRoutePlanStop,
  VehicleRecord,
} from '../../services/api.types';

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return isValidDate(date) ? date : null;
};

export function getJobRoute(
  job: Pick<JobRecord, 'id' | 'assignedRouteId'>,
  routes: PlannerRoutePlanGroup[],
  stops: PlannerRoutePlanStop[],
) {
  if (job.assignedRouteId) {
    const directRoute = routes.find((route) => route.id === job.assignedRouteId);
    if (directRoute) return directRoute;
  }
  const stop = stops.find((candidate) => candidate.jobId === job.id);
  return stop ? routes.find((route) => route.id === stop.routePlanGroupId) || null : null;
}

export function getJobDriver(
  route: Pick<PlannerRoutePlanGroup, 'driverId'> | null | undefined,
  drivers: DriverRecord[],
) {
  if (!route?.driverId) return null;
  return drivers.find((driver) => driver.id === route.driverId) || null;
}

export function getJobVehicle(
  job: Pick<JobRecord, 'assignedVehicleId'>,
  route: Pick<PlannerRoutePlanGroup, 'vehicleId'> | null | undefined,
  vehicles: VehicleRecord[],
) {
  const vehicleId = job.assignedVehicleId || route?.vehicleId;
  if (!vehicleId) return null;
  return vehicles.find((vehicle) => vehicle.id === vehicleId) || null;
}

export function formatJobWindow(
  job: Pick<JobRecord, 'timeWindow' | 'timeWindowStart' | 'timeWindowEnd'>,
) {
  const start = parseDate(job.timeWindow?.start || job.timeWindowStart);
  const end = parseDate(job.timeWindow?.end || job.timeWindowEnd);
  if (!start && !end) return 'Window pending';
  if (start && end) {
    const sameDay = start.toDateString() === end.toDateString();
    return `${timeFormatter.format(start)} - ${timeFormatter.format(end)}${sameDay ? '' : ` ${dateFormatter.format(end)}`}`;
  }
  return start ? `After ${timeFormatter.format(start)}` : `Before ${timeFormatter.format(end as Date)}`;
}

export function formatJobEta(
  route: Pick<PlannerRoutePlanGroup, 'id'> | null | undefined,
  job: Pick<JobRecord, 'id' | 'status'>,
  stops: PlannerRoutePlanStop[],
) {
  if (String(job.status || '').toLowerCase() === 'completed') return 'Completed';
  const stop = route
    ? stops.find((candidate) => candidate.routePlanGroupId === route.id && candidate.jobId === job.id)
    : stops.find((candidate) => candidate.jobId === job.id);
  const arrival = parseDate(stop?.plannedArrival);
  return arrival ? timeFormatter.format(arrival) : 'Pending';
}

export function formatPersonName(driver: DriverRecord | null | undefined) {
  if (!driver) return 'Unassigned';
  return [driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.id;
}

export function formatVehicleName(vehicle: VehicleRecord | null | undefined) {
  if (!vehicle) return 'Unassigned';
  const label = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return vehicle.licensePlate ? `${vehicle.licensePlate}${label ? ` - ${label}` : ''}` : label || vehicle.id;
}
