import { unwrapListItems } from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import { isPreview, previewState } from './api.preview';
import type { JobRecord } from './api.types';
import { clonePreview, isRecord } from './api.types';
import { queryKeys } from './queryKeys';

const sanitizeJob = (job: unknown): JobRecord => {
  const value = isRecord(job) ? job : {};
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
      : undefined,
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
