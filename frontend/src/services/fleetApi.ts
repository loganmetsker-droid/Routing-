import { unwrapApiData, unwrapListItems } from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DriverRecord, VehicleRecord } from './api.types';
import { apiFetch } from './api.session';
import { isPreview, previewState } from './api.preview';
import { clonePreview, isRecord } from './api.types';
import { queryKeys } from './queryKeys';

const getMetadata = (value: unknown) => (isRecord(value) ? value : {});

const buildPreviewVehicle = (vehicle: Partial<VehicleRecord>): VehicleRecord => {
  const metadata = getMetadata(vehicle.metadata);
  return sanitizeVehicle({
    id: vehicle.id || `vehicle-preview-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    make: vehicle.make || '',
    model: vehicle.model || '',
    year: vehicle.year || new Date().getFullYear(),
    licensePlate: vehicle.licensePlate || 'PREVIEW',
    vin: vehicle.vin || null,
    vehicleType: vehicle.vehicleType || vehicle.type || 'box_truck',
    fuelType: vehicle.fuelType || 'diesel',
    status: vehicle.status || 'available',
    capacityWeightKg:
      typeof vehicle.capacityWeightKg === 'number'
        ? vehicle.capacityWeightKg
        : typeof vehicle.capacity === 'number'
          ? vehicle.capacity
          : null,
    capacityVolumeM3:
      typeof vehicle.capacityVolumeM3 === 'number' ? vehicle.capacityVolumeM3 : null,
    metadata: {
      ...metadata,
      territoryRestriction:
        typeof vehicle.territoryRestriction === 'string'
          ? vehicle.territoryRestriction
          : metadata.territoryRestriction,
      maxRouteMinutes:
        typeof vehicle.maxRouteMinutes === 'string' || typeof vehicle.maxRouteMinutes === 'number'
          ? vehicle.maxRouteMinutes
          : metadata.maxRouteMinutes,
    },
  });
};

const sanitizeVehicle = (vehicle: unknown): VehicleRecord => {
  const value = isRecord(vehicle) ? vehicle : {};
  const metadata = getMetadata(value.metadata);
  return {
    ...(value as unknown as Partial<VehicleRecord>),
    id:
      typeof value.id === 'string'
        ? value.id
        : `vehicle-${Date.now()}-${Math.random()}`,
    make: typeof value.make === 'string' ? value.make : '',
    model: typeof value.model === 'string' ? value.model : '',
    type:
      typeof value.type === 'string'
        ? value.type
        : typeof value.vehicleType === 'string'
          ? value.vehicleType
          : null,
    weightCapacity:
      typeof value.weightCapacity === 'string' || typeof value.weightCapacity === 'number'
        ? value.weightCapacity
        : typeof value.capacityWeightKg === 'number'
          ? value.capacityWeightKg
          : null,
    volumeCapacity:
      typeof value.volumeCapacity === 'string' || typeof value.volumeCapacity === 'number'
        ? value.volumeCapacity
        : typeof value.capacityVolumeM3 === 'number'
          ? value.capacityVolumeM3
          : null,
    territoryRestriction:
      typeof value.territoryRestriction === 'string'
        ? value.territoryRestriction
        : typeof metadata.territoryRestriction === 'string'
          ? metadata.territoryRestriction
          : null,
    maxRouteMinutes:
      typeof value.maxRouteMinutes === 'string' || typeof value.maxRouteMinutes === 'number'
        ? value.maxRouteMinutes
        : typeof metadata.maxRouteMinutes === 'string' || typeof metadata.maxRouteMinutes === 'number'
          ? metadata.maxRouteMinutes
          : null,
    status: typeof value.status === 'string' ? value.status : 'unknown',
  };
};

const sanitizeDriver = (driver: unknown): DriverRecord => {
  const value = isRecord(driver) ? driver : {};
  const metadata = getMetadata(value.metadata);
  return {
    ...(value as unknown as Partial<DriverRecord>),
    id:
      typeof value.id === 'string'
        ? value.id
        : `driver-${Date.now()}-${Math.random()}`,
    firstName: typeof value.firstName === 'string' ? value.firstName : '',
    lastName: typeof value.lastName === 'string' ? value.lastName : '',
    licenseType:
      typeof value.licenseType === 'string'
        ? value.licenseType
        : typeof value.licenseClass === 'string'
          ? value.licenseClass
          : null,
    assignedVehicleId:
      typeof value.assignedVehicleId === 'string'
        ? value.assignedVehicleId
        : typeof value.currentVehicleId === 'string'
          ? value.currentVehicleId
          : null,
    notes:
      typeof value.notes === 'string'
        ? value.notes
        : typeof metadata.notes === 'string'
          ? metadata.notes
          : null,
    status: typeof value.status === 'string' ? value.status : 'UNKNOWN',
  };
};

export const createVehicle = async (
  vehicle: Partial<VehicleRecord>,
): Promise<{ vehicle: VehicleRecord }> => {
  if (isPreview()) {
    const nextVehicle = buildPreviewVehicle(vehicle);
    previewState.vehicles.unshift(nextVehicle as unknown as (typeof previewState.vehicles)[number]);
    return { vehicle: nextVehicle };
  }
  const response = await apiFetch('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify(vehicle),
  });
  return unwrapApiData<{ vehicle: VehicleRecord }>(await response.json());
};

export const updateVehicle = async (
  id: string,
  updates: Partial<VehicleRecord>,
): Promise<{ vehicle: VehicleRecord }> => {
  if (isPreview()) {
    const index = previewState.vehicles.findIndex((vehicle) => vehicle.id === id);
    if (index >= 0) {
      const nextVehicle = buildPreviewVehicle({
        ...(previewState.vehicles[index] as unknown as VehicleRecord),
        ...updates,
        id,
      });
      previewState.vehicles[index] = nextVehicle as unknown as (typeof previewState.vehicles)[number];
      return { vehicle: nextVehicle };
    }
  }
  const response = await apiFetch(`/api/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return unwrapApiData<{ vehicle: VehicleRecord }>(await response.json());
};

export const deleteVehicle = async (id: string): Promise<void> => {
  if (isPreview()) {
    previewState.vehicles = previewState.vehicles.filter((vehicle) => vehicle.id !== id);
    return;
  }
  await apiFetch(`/api/vehicles/${id}`, { method: 'DELETE' });
};

export const createDriver = async (
  driver: Partial<DriverRecord>,
): Promise<{ driver: DriverRecord }> => {
  const response = await apiFetch('/api/drivers', {
    method: 'POST',
    body: JSON.stringify(driver),
  });
  return unwrapApiData<{ driver: DriverRecord }>(await response.json());
};

export const updateDriver = async (
  id: string,
  updates: Partial<DriverRecord>,
): Promise<{ driver: DriverRecord }> => {
  const response = await apiFetch(`/api/drivers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return unwrapApiData<{ driver: DriverRecord }>(await response.json());
};

export const deleteDriver = async (id: string): Promise<void> => {
  await apiFetch(`/api/drivers/${id}`, { method: 'DELETE' });
};

export const getVehicles = async (): Promise<VehicleRecord[]> => {
  if (isPreview()) {
    return clonePreview(previewState.vehicles).map(sanitizeVehicle);
  }

  try {
    const response = await apiFetch('/api/vehicles');
    const data = await response.json();
    const rawVehicles = unwrapListItems<unknown>(data, ['vehicles', 'items']);
    return rawVehicles.map(sanitizeVehicle);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return [];
  }
};

export const getDrivers = async (): Promise<DriverRecord[]> => {
  if (isPreview()) {
    return clonePreview(previewState.drivers).map(sanitizeDriver);
  }

  try {
    const response = await apiFetch('/api/drivers');
    const data = await response.json();
    const rawDrivers = unwrapListItems<unknown>(data, ['drivers', 'items']);
    return rawDrivers.map(sanitizeDriver);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return [];
  }
};

export const useVehiclesQuery = () =>
  useQuery({
    queryKey: queryKeys.vehicles,
    queryFn: getVehicles,
  });

export const useDriversQuery = () =>
  useQuery({
    queryKey: queryKeys.drivers,
    queryFn: getDrivers,
  });

export const useCreateVehicleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVehicle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
    },
  });
};

export const useUpdateVehicleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<VehicleRecord> }) =>
      updateVehicle(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
    },
  });
};

export const useCreateDriverMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDriver,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.drivers });
    },
  });
};

export const useUpdateDriverMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<DriverRecord> }) =>
      updateDriver(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.drivers });
    },
  });
};
