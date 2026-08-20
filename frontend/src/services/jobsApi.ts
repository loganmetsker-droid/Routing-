import {
  evaluateJobRoutingReadiness,
  unwrapListItems,
  type JobRoutingRequirements,
  type JobRoutingReadiness,
} from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import { isPreview, persistPreviewState, previewState } from './api.preview';
import type { JobRecord } from './api.types';
import { clonePreview, isRecord } from './api.types';
import { queryKeys } from './queryKeys';

const asOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const sanitizeJob = (job: unknown): JobRecord => {
  const value = isRecord(job) ? job : {};
  const timeWindowStart = asOptionalString(value.timeWindowStart);
  const timeWindowEnd = asOptionalString(value.timeWindowEnd);
  const routingRequirements = isRecord(value.routingRequirements)
    ? (value.routingRequirements as JobRoutingRequirements)
    : undefined;
  const estimatedDuration = asOptionalNumber(value.estimatedDuration);
  const weight = asOptionalNumber(value.weight);
  const volume = asOptionalNumber(value.volume);
  const quantity = asOptionalNumber(value.quantity);
  const routingReadiness = isRecord(value.routingReadiness)
    ? (value.routingReadiness as JobRoutingReadiness)
    : evaluateJobRoutingReadiness({
        deliveryAddress:
          typeof value.deliveryAddress === 'string' ? value.deliveryAddress : undefined,
        timeWindowStart,
        timeWindowEnd,
        estimatedDuration,
        weight,
        volume,
        quantity,
        routingRequirements,
      });

  return {
    id: typeof value.id === 'string' ? value.id : `job-${Date.now()}-${Math.random()}`,
    customerId: typeof value.customerId === 'string' ? value.customerId : undefined,
    customerName:
      typeof value.customerName === 'string' && value.customerName.trim()
        ? value.customerName
        : 'Unknown Customer',
    customerPhone: typeof value.customerPhone === 'string' ? value.customerPhone : undefined,
    customerEmail: typeof value.customerEmail === 'string' ? value.customerEmail : undefined,
    deliveryAddress:
      typeof value.deliveryAddress === 'string' && value.deliveryAddress.trim()
        ? value.deliveryAddress
        : 'Unknown Address',
    pickupAddress: typeof value.pickupAddress === 'string' ? value.pickupAddress : undefined,
    deliveryAddressStructured: isRecord(value.deliveryAddressStructured)
      ? (value.deliveryAddressStructured as JobRecord['deliveryAddressStructured'])
      : undefined,
    pickupAddressStructured: isRecord(value.pickupAddressStructured)
      ? (value.pickupAddressStructured as JobRecord['pickupAddressStructured'])
      : undefined,
    pickupLocation: isRecord(value.pickupLocation) ? value.pickupLocation : undefined,
    deliveryLocation: isRecord(value.deliveryLocation) ? value.deliveryLocation : undefined,
    timeWindow: isRecord(value.timeWindow)
      ? {
          start: String(value.timeWindow.start || ''),
          end: String(value.timeWindow.end || ''),
        }
      : timeWindowStart || timeWindowEnd
        ? { start: timeWindowStart || '', end: timeWindowEnd || '' }
        : undefined,
    timeWindowStart,
    timeWindowEnd,
    weight,
    volume,
    quantity,
    estimatedDuration,
    notes: asOptionalString(value.notes),
    specialInstructions: asOptionalString(value.specialInstructions),
    routingRequirements,
    routingReadiness,
    priority: typeof value.priority === 'string' ? value.priority : 'normal',
    status: typeof value.status === 'string' ? value.status : 'pending',
    assignedRouteId:
      typeof value.assignedRouteId === 'string' ? value.assignedRouteId : null,
    assignedVehicleId:
      typeof value.assignedVehicleId === 'string'
        ? value.assignedVehicleId
        : undefined,
    stopSequence:
      typeof value.stopSequence === 'number' ? value.stopSequence : undefined,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
};

export const createJob = async (
  job: Omit<JobRecord, 'id'>,
): Promise<{ job: JobRecord }> => {
  if (isPreview()) {
    const jobInput = job as Partial<JobRecord>;
    const nextJob = sanitizeJob({
      id: `job-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...jobInput,
      status: jobInput.status || 'pending',
      priority: jobInput.priority || 'normal',
      assignedRouteId: null,
      createdAt: new Date().toISOString(),
    });
    previewState.jobs.unshift(nextJob as unknown as (typeof previewState.jobs)[number]);
    persistPreviewState();
    return { job: nextJob };
  }

  const response = await apiFetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(job),
  });
  return response.json();
};

export const getJobs = async (): Promise<JobRecord[]> => {
  if (isPreview()) {
    return clonePreview(previewState.jobs).map(sanitizeJob);
  }

  try {
    const response = await apiFetch('/api/jobs');
    const data = await response.json();
    const rawJobs = unwrapListItems<unknown>(data, ['jobs', 'items']);
    return rawJobs.map(sanitizeJob);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
};

export const updateJobStatus = async (
  id: string,
  status: string,
  assignedRouteId?: string,
): Promise<{ job: JobRecord }> => {
  if (isPreview()) {
    const index = previewState.jobs.findIndex((job) => job.id === id);
    const nextJob = sanitizeJob({
      ...(index >= 0 ? previewState.jobs[index] : { id }),
      status,
      assignedRouteId,
      updatedAt: new Date().toISOString(),
    });
    if (index >= 0) {
      previewState.jobs[index] = nextJob as unknown as (typeof previewState.jobs)[number];
    } else {
      previewState.jobs.unshift(nextJob as unknown as (typeof previewState.jobs)[number]);
    }
    persistPreviewState();
    return { job: nextJob };
  }

  const response = await apiFetch(`/api/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, assignedRouteId }),
  });
  return response.json();
};

export const updateJob = async (
  id: string,
  updates: Partial<JobRecord>,
): Promise<{ job: JobRecord }> => {
  if (isPreview()) {
    const index = previewState.jobs.findIndex((job) => job.id === id);
    const nextJob = sanitizeJob({
      ...(index >= 0 ? previewState.jobs[index] : { id }),
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    if (index >= 0) {
      previewState.jobs[index] = nextJob as unknown as (typeof previewState.jobs)[number];
    } else {
      previewState.jobs.unshift(nextJob as unknown as (typeof previewState.jobs)[number]);
    }
    persistPreviewState();
    return { job: nextJob };
  }

  const response = await apiFetch(`/api/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return response.json();
};

export const useJobsQuery = () =>
  useQuery({
    queryKey: queryKeys.jobs,
    queryFn: getJobs,
  });

export const useCreateJobMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createJob,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
};

export const useUpdateJobMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<JobRecord> }) =>
      updateJob(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
};
