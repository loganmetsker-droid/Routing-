import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOptimizationObjectiveLabel,
  normalizeOptimizationObjective,
  type OptimizationObjective,
} from '@shared/contracts';
import type { DispatchJob } from '../types/dispatch';
import { isPreview, previewState } from './api.preview';
import { apiFetch } from './api.session';
import type {
  JsonRecord,
  PlannerRoutePlan,
  PlannerRoutePlanGroup,
  PlannerRoutePlanStop,
} from './api.types';
import { isRecord } from './api.types';
import { queryKeys } from './queryKeys';

export type {
  PlannerRoutePlan,
  PlannerRoutePlanGroup,
  PlannerRoutePlanStop,
} from './api.types';

type PlannerViewResponse = {
  plan?: PlannerRoutePlan | null;
  groups: PlannerRoutePlanGroup[];
  stops: PlannerRoutePlanStop[];
  unassignedJobs: DispatchJob[];
};

type PlannerMutationResult = {
  routePlan?: PlannerRoutePlan | null;
  plan?: PlannerRoutePlan | null;
  groups: PlannerRoutePlanGroup[];
  stops: PlannerRoutePlanStop[];
  unassignedJobs?: DispatchJob[];
  warnings?: Array<string | JsonRecord>;
};

type PublishRoutePlanResult = {
  ok?: boolean;
  routePlan?: PlannerRoutePlan | null;
  routeRuns?: unknown[];
};

export type { PublishRoutePlanResult };

const PREVIEW_ROUTE_PLAN_ID = 'preview-plan-1';
const previewPlannerLocks = new Map<string, boolean>();
let previewPlannerServiceDate = new Date().toISOString().slice(0, 10);
let previewPlannerObjective: OptimizationObjective = 'balanced';

const previewVehicleColors = ['#B97129', '#59729B', '#6E8B67', '#A45E52'];

const buildPreviewStopId = (routeId: string, jobId: string) => `${routeId}::${jobId}`;

const findPreviewJob = (jobId: string) =>
  previewState.jobs.find((job) => job.id === jobId);

const previewJobCoordinate = (jobId: string) => {
  const job = findPreviewJob(jobId);
  const location = job?.deliveryLocation || job?.pickupLocation;
  if (
    location &&
    typeof location.lat === 'number' &&
    typeof location.lng === 'number'
  ) {
    return location;
  }
  return null;
};

const previewDistanceKm = (
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
) => {
  const latDelta = left.lat - right.lat;
  const lngDelta = left.lng - right.lng;
  return Math.sqrt(latDelta * latDelta + lngDelta * lngDelta) * 111;
};

const previewSpeedBandKph = (distanceKm: number) => {
  if (distanceKm < 2) return 20;
  if (distanceKm < 8) return 30;
  if (distanceKm < 20) return 42;
  return 58;
};

const previewTravelMinutes = (
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
) => {
  const distanceKm = previewDistanceKm(left, right);
  return (distanceKm / previewSpeedBandKph(distanceKm)) * 60;
};

const previewPriorityWeight = (priority?: string) => {
  switch (String(priority || '').toLowerCase()) {
    case 'urgent':
      return 4;
    case 'high':
      return 3;
    case 'normal':
      return 2;
    default:
      return 1;
  }
};

const previewVehicleCoordinate = (vehicleId?: string | null) => {
  const vehicle = previewState.vehicles.find((item) => item.id === vehicleId);
  const location = vehicle?.currentLocation;
  if (
    location &&
    typeof location.lat === 'number' &&
    typeof location.lng === 'number'
  ) {
    return { lat: location.lat, lng: location.lng };
  }
  return { lat: 39.7392, lng: -104.9903 };
};

const rebuildPreviewRouteArtifacts = (routeId: string) => {
  const route = previewState.routes.find((item) => item.id === routeId);
  if (!route) return;

  const jobs = route.jobIds
    .map((jobId) => findPreviewJob(jobId))
    .filter(Boolean) as DispatchJob[];
  const coordinates = jobs
    .map((job) => job.deliveryLocation || job.pickupLocation || null)
    .filter(
      (
        location,
      ): location is NonNullable<DispatchJob['deliveryLocation']> =>
        Boolean(location) &&
        typeof location?.lat === 'number' &&
        typeof location?.lng === 'number',
    );

  route.optimizedStops = jobs.map((job, index) => ({
    jobId: job.id,
    sequence: index + 1,
    address: job.deliveryAddress || job.pickupAddress || 'Address pending',
    location: previewJobCoordinate(job.id)
      ? {
          latitude: Number(previewJobCoordinate(job.id)?.lat || 0),
          longitude: Number(previewJobCoordinate(job.id)?.lng || 0),
        }
      : undefined,
  }));

  const previousRouteData = isRecord(route.routeData) ? route.routeData : {};
  route.routeData = {
    ...previousRouteData,
    planner_diagnostics: {
      objective_used: previewPlannerObjective,
      objective_label: getOptimizationObjectiveLabel(previewPlannerObjective),
    },
    polyline: {
      coordinates: coordinates.map((location) => [location.lng, location.lat]),
    },
    route: jobs.map((job, index) => {
      const location = previewJobCoordinate(job.id);
      return {
        job_id: job.id,
        sequence: index + 1,
        address: job.deliveryAddress || job.pickupAddress || 'Address pending',
        latitude: location?.lat,
        longitude: location?.lng,
      };
    }),
  };
  route.totalDistanceKm = Number((Math.max(route.jobIds.length, 1) * 7.4).toFixed(1));
  route.totalDurationMinutes = route.jobIds.length * 14 + (route.jobIds.length ? 10 : 0);
  route.estimatedCapacity = 900 + route.jobIds.length * 180;
  route.optimizationStatus = 'optimized';
  route.dataQuality = 'simulated';
  route.planningWarnings = route.jobIds.length ? [] : ['No assigned jobs'];
};

const syncPreviewAssignments = () => {
  previewState.jobs.forEach((job) => {
    const owningRoute = previewState.routes.find((route) => route.jobIds.includes(job.id));
    job.assignedRouteId = owningRoute?.id || null;
    if (!job.status || job.status === 'archived') return;
    if (owningRoute) {
      job.status = 'pending';
    }
  });
  previewState.routes.forEach((route) => rebuildPreviewRouteArtifacts(route.id));
};

const buildPreviewPlannerView = (): PlannerViewResponse => {
  syncPreviewAssignments();

  const groups = previewState.routes.map((route, index) => ({
    id: route.id,
    routePlanId: PREVIEW_ROUTE_PLAN_ID,
    groupIndex: index + 1,
    label: `RT-${index + 1}`,
    driverId: route.driverId || undefined,
    vehicleId: route.vehicleId || undefined,
    totalDistanceKm: route.totalDistanceKm || 0,
    totalDurationMinutes: route.totalDurationMinutes || 0,
    serviceTimeMinutes: route.jobIds.length * 8,
    totalWeightKg: route.jobIds.length * 120,
    totalVolumeM3: Number((route.jobIds.length * 0.9).toFixed(1)),
    warnings: route.planningWarnings || [],
  })) satisfies PlannerRoutePlanGroup[];

  const stops = previewState.routes.flatMap((route) =>
    route.jobIds.map((jobId, stopIndex) => {
      const job = findPreviewJob(jobId);
      return {
        id: buildPreviewStopId(route.id, jobId),
        routePlanId: PREVIEW_ROUTE_PLAN_ID,
        routePlanGroupId: route.id,
        jobId,
        jobStopId: `${jobId}-stop`,
        stopSequence: stopIndex + 1,
        isLocked: previewPlannerLocks.get(buildPreviewStopId(route.id, jobId)) || false,
        plannedArrival:
          stopIndex === 0 ? new Date().toISOString() : null,
        plannedDeparture: null,
        metadata: {
          stopType: 'DELIVERY',
          address: job?.deliveryAddress || job?.pickupAddress || 'Address pending',
          color: previewVehicleColors[route.jobIds.length % previewVehicleColors.length],
        },
      } satisfies PlannerRoutePlanStop;
    }),
  );

  return {
    plan: {
      id: PREVIEW_ROUTE_PLAN_ID,
      serviceDate: previewPlannerServiceDate,
      status: 'draft',
      objective: previewPlannerObjective,
      metrics: {
        routeCount: groups.length,
        stopCount: stops.length,
        unassignedJobCount: previewState.jobs.filter((job) => !job.assignedRouteId).length,
      },
      warnings: ['Preview planner uses local seeded routes.'],
    },
    groups,
    stops,
    unassignedJobs: previewState.jobs.filter((job) => !job.assignedRouteId),
  };
};

const normalizePlannerView = (value: unknown): PlannerViewResponse => {
  const data = isRecord(value) ? value : {};
  const rawPlan = (data.plan as PlannerRoutePlan | null | undefined) ?? null;
  return {
    plan: rawPlan
      ? {
          ...rawPlan,
          objective: normalizeOptimizationObjective(rawPlan.objective),
        }
      : null,
    groups: Array.isArray(data.groups)
      ? (data.groups as PlannerRoutePlanGroup[])
      : Array.isArray(data.items)
        ? (data.items as PlannerRoutePlanGroup[])
        : [],
    stops: Array.isArray(data.stops) ? (data.stops as PlannerRoutePlanStop[]) : [],
    unassignedJobs: Array.isArray(data.unassignedJobs)
      ? (data.unassignedJobs as DispatchJob[])
      : [],
  };
};

const parsePreviewStop = (stopId: string) => {
  const [routeId, jobId] = stopId.split('::');
  if (!routeId || !jobId) {
    throw new Error(`Unknown preview stop ${stopId}`);
  }
  return { routeId, jobId };
};

const movePreviewJobBetweenRoutes = (
  sourceRouteId: string,
  targetRouteId: string,
  jobId: string,
  targetSequence = 1,
) => {
  const sourceRoute = previewState.routes.find((route) => route.id === sourceRouteId);
  const targetRoute = previewState.routes.find((route) => route.id === targetRouteId);
  if (!sourceRoute || !targetRoute) {
    throw new Error('Preview route not found');
  }

  sourceRoute.jobIds = sourceRoute.jobIds.filter((candidate) => candidate !== jobId);
  const nextTargetJobs = targetRoute.jobIds.filter((candidate) => candidate !== jobId);
  nextTargetJobs.splice(Math.max(0, targetSequence - 1), 0, jobId);
  targetRoute.jobIds = nextTargetJobs;

  syncPreviewAssignments();
};

type PreviewRouteSeed = {
  id: string;
  vehicleId?: string;
  driverId?: string | null;
  anchor: { lat: number; lng: number };
  jobIds: string[];
  durationMinutes: number;
};

const buildPreviewRouteSeeds = (vehicleIds?: string[]) => {
  const selectedVehicles =
    vehicleIds && vehicleIds.length
      ? previewState.vehicles.filter((vehicle) => vehicleIds.includes(vehicle.id))
      : previewState.vehicles.slice(0, 3);

  return (
    selectedVehicles.length > 0
      ? selectedVehicles.map((vehicle, index) => ({
          id: previewState.routes[index]?.id || `route-preview-${index + 1}`,
          vehicleId: vehicle.id,
          driverId: previewState.drivers[index]?.id || null,
          anchor: previewVehicleCoordinate(vehicle.id),
          jobIds: [] as string[],
          durationMinutes: 0,
        }))
      : [
          {
            id: previewState.routes[0]?.id || 'route-preview-1',
            vehicleId: previewState.vehicles[0]?.id,
            driverId: null,
            anchor: previewVehicleCoordinate(previewState.vehicles[0]?.id),
            jobIds: [] as string[],
            durationMinutes: 0,
          },
        ]
  ) satisfies PreviewRouteSeed[];
};

const assignPreviewJobsByObjective = (
  jobs: DispatchJob[],
  seeds: PreviewRouteSeed[],
  objective: OptimizationObjective,
) => {
  if (!seeds.length) return;

  const orderedJobs = jobs
    .slice()
    .sort((left, right) => {
      const leftLocation =
        left.deliveryLocation || left.pickupLocation || seeds[0].anchor;
      const rightLocation =
        right.deliveryLocation || right.pickupLocation || seeds[0].anchor;
      const leftAnchorDistance = previewDistanceKm(seeds[0].anchor, leftLocation);
      const rightAnchorDistance = previewDistanceKm(seeds[0].anchor, rightLocation);
      const leftWindow =
        new Date(left.timeWindowStart || 0).getTime() || Number.MAX_SAFE_INTEGER;
      const rightWindow =
        new Date(right.timeWindowStart || 0).getTime() || Number.MAX_SAFE_INTEGER;

      if (objective === 'balanced') {
        return (
          previewPriorityWeight(right.priority) - previewPriorityWeight(left.priority) ||
          leftWindow - rightWindow ||
          leftAnchorDistance - rightAnchorDistance
        );
      }

      if (objective === 'speed') {
        return (
          leftWindow - rightWindow ||
          previewTravelMinutes(seeds[0].anchor, leftLocation) -
            previewTravelMinutes(seeds[0].anchor, rightLocation)
        );
      }

      return leftAnchorDistance - rightAnchorDistance || leftWindow - rightWindow;
    });

  orderedJobs.forEach((job) => {
    const location = job.deliveryLocation || job.pickupLocation || seeds[0].anchor;
    const targetSeed = seeds.reduce((best, candidate) => {
      const candidateDistance = previewDistanceKm(candidate.anchor, location);
      const bestDistance = previewDistanceKm(best.anchor, location);
      const candidateScore =
        objective === 'balanced'
          ? candidate.durationMinutes + candidateDistance * 2
          : objective === 'speed'
            ? candidate.durationMinutes + previewTravelMinutes(candidate.anchor, location)
            : candidateDistance + candidate.jobIds.length * 8;
      const bestScore =
        objective === 'balanced'
          ? best.durationMinutes + bestDistance * 2
          : objective === 'speed'
            ? best.durationMinutes + previewTravelMinutes(best.anchor, location)
            : bestDistance + best.jobIds.length * 8;
      return candidateScore < bestScore ? candidate : best;
    }, seeds[0]);

    targetSeed.jobIds.push(job.id);
    targetSeed.durationMinutes +=
      previewTravelMinutes(targetSeed.anchor, location) +
      Number(job.estimatedDuration || 10);
    targetSeed.anchor = {
      lat: Number(location.lat || targetSeed.anchor.lat),
      lng: Number(location.lng || targetSeed.anchor.lng),
    };
  });
};

const generatePreviewDraft = (payload: {
  serviceDate: string;
  objective?: OptimizationObjective | string;
  jobIds?: string[];
  vehicleIds?: string[];
}) => {
  previewPlannerServiceDate = payload.serviceDate;
  previewPlannerObjective = normalizeOptimizationObjective(
    payload.objective || previewPlannerObjective,
  );

  const selectedJobs =
    payload.jobIds && payload.jobIds.length
      ? previewState.jobs.filter((job) => payload.jobIds?.includes(job.id))
      : previewState.jobs.slice();
  const routeSeeds = buildPreviewRouteSeeds(payload.vehicleIds);
  assignPreviewJobsByObjective(selectedJobs, routeSeeds, previewPlannerObjective);

  const nextRoutes = routeSeeds.map((seed, index) => ({
    id: seed.id,
    vehicleId: seed.vehicleId,
    driverId: seed.driverId || null,
    status: 'planned',
    workflowStatus: 'planned',
    jobIds: seed.jobIds,
    dataQuality: 'simulated' as const,
    optimizationStatus: 'optimized' as const,
    routeData: {
      planner_diagnostics: {
        objective_used: previewPlannerObjective,
        objective_label: getOptimizationObjectiveLabel(previewPlannerObjective),
      },
    },
    createdAt: previewState.routes[index]?.createdAt || new Date().toISOString(),
  }));

  previewState.routes.splice(0, previewState.routes.length, ...nextRoutes);
  syncPreviewAssignments();
};

const createPreviewResponse = (): PlannerMutationResult => {
  const view = buildPreviewPlannerView();
  return {
    routePlan: view.plan || null,
    plan: view.plan || null,
    groups: view.groups,
    stops: view.stops,
    unassignedJobs: view.unassignedJobs,
    warnings: view.plan?.warnings,
  };
};

export const getPlanner = async (
  serviceDate: string,
): Promise<PlannerViewResponse> => {
  if (isPreview()) {
    previewPlannerServiceDate = serviceDate || previewPlannerServiceDate;
    return buildPreviewPlannerView();
  }
  const response = await apiFetch(
    `/api/planner?serviceDate=${encodeURIComponent(serviceDate)}`,
  );
  return normalizePlannerView(await response.json());
};

export const generateDraftRoutePlan = async (payload: {
  serviceDate: string;
  depotId?: string;
  objective?: OptimizationObjective | string;
  jobIds?: string[];
  vehicleIds?: string[];
}): Promise<PlannerMutationResult> => {
  if (isPreview()) {
    generatePreviewDraft(payload);
    return createPreviewResponse();
  }
  const response = await apiFetch('/api/route-plans/generate-draft', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizePlannerView(await response.json());
};

export const getRoutePlan = async (
  routePlanId: string,
): Promise<PlannerMutationResult> => {
  if (isPreview()) {
    return createPreviewResponse();
  }
  const response = await apiFetch(`/api/route-plans/${routePlanId}`);
  return normalizePlannerView(await response.json());
};

export const reoptimizeRoutePlan = async (routePlanId: string) => {
  if (isPreview()) {
    generatePreviewDraft({
      serviceDate: previewPlannerServiceDate,
      objective: previewPlannerObjective,
      jobIds: previewState.routes.flatMap((route) => route.jobIds),
      vehicleIds: previewState.routes
        .map((route) => route.vehicleId)
        .filter((value): value is string => Boolean(value)),
    });
    return createPreviewResponse();
  }
  return apiFetch(`/api/route-plans/${routePlanId}/reoptimize`, {
    method: 'POST',
  }).then(async (response) => normalizePlannerView(await response.json()));
};

export const updateRoutePlanGroup = async (
  routePlanId: string,
  groupId: string,
  payload: { driverId?: string; vehicleId?: string },
) => {
  if (isPreview()) {
    const route = previewState.routes.find((item) => item.id === groupId);
    if (!route) {
      throw new Error(`Preview route group not found: ${groupId}`);
    }
    if (payload.driverId !== undefined) {
      route.driverId = payload.driverId || null;
    }
    if (payload.vehicleId !== undefined) {
      route.vehicleId = payload.vehicleId || route.vehicleId || '';
    }
    syncPreviewAssignments();
    return createPreviewResponse();
  }
  return apiFetch(`/api/route-plans/${routePlanId}/groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }).then(async (response) => normalizePlannerView(await response.json()));
};

export const updateRoutePlanStop = async (
  routePlanId: string,
  stopId: string,
  payload: {
    targetGroupId?: string;
    targetSequence?: number;
    isLocked?: boolean;
  },
) => {
  if (isPreview()) {
    const { routeId, jobId } = parsePreviewStop(stopId);
    const nextGroupId = payload.targetGroupId || routeId;
    const nextSequence = payload.targetSequence || 1;
    if (payload.isLocked !== undefined) {
      previewPlannerLocks.set(buildPreviewStopId(routeId, jobId), payload.isLocked);
      if (routeId !== nextGroupId) {
        previewPlannerLocks.set(
          buildPreviewStopId(nextGroupId, jobId),
          payload.isLocked,
        );
      }
    }
    if (routeId !== nextGroupId || payload.targetSequence !== undefined) {
      movePreviewJobBetweenRoutes(routeId, nextGroupId, jobId, nextSequence);
    }
    return createPreviewResponse();
  }
  return apiFetch(`/api/route-plans/${routePlanId}/stops/${stopId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }).then(async (response) => normalizePlannerView(await response.json()));
};

export const publishRoutePlan = async (routePlanId: string) => {
  if (isPreview()) {
    previewState.routes.forEach((route) => {
      route.status = 'assigned';
      route.workflowStatus = 'ready_for_dispatch';
    });
    syncPreviewAssignments();
    return {
      ok: true,
      routePlan: buildPreviewPlannerView().plan,
      routeRuns: previewState.routes,
    } satisfies PublishRoutePlanResult;
  }
  return apiFetch(`/api/route-plans/${routePlanId}/publish`, {
    method: 'POST',
  }).then(async (response) => {
    const data = await response.json();
    return isRecord(data)
      ? {
          ok: typeof data.ok === 'boolean' ? data.ok : undefined,
          routePlan: (data.routePlan as PlannerRoutePlan | null | undefined) ?? null,
          routeRuns: Array.isArray(data.routeRuns) ? data.routeRuns : [],
        }
      : ({ routePlan: null, routeRuns: [] } satisfies PublishRoutePlanResult);
  });
};

export const usePlannerQuery = (serviceDate: string) =>
  useQuery({
    queryKey: queryKeys.planner(serviceDate),
    queryFn: () => getPlanner(serviceDate),
    enabled: Boolean(serviceDate),
  });

export const useGenerateDraftRoutePlanMutation = (serviceDate: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateDraftRoutePlan,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.planner(serviceDate),
      });
    },
  });
};

export const usePlannerMutationInvalidation = (serviceDate: string) => {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.planner(serviceDate),
    });
  };
};
