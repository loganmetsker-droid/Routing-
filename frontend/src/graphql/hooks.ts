// GraphQL hooks disabled - using REST API via src/services/api.ts
// Stub implementations to prevent build errors

export const useCustomers = () => ({ data: { customers: [] }, loading: false, error: null });
export const useCustomer = () => ({ data: null, loading: false, error: null });
export const useCreateCustomer = () => [() => {}, { loading: false }];
export const useUpdateCustomer = () => [() => {}, { loading: false }];
export const useDeleteCustomer = () => [() => {}, { loading: false }];

export const useDrivers = () => ({ data: { drivers: [] }, loading: false, error: null });
export const useDriver = () => ({ data: null, loading: false, error: null });
export const useCreateDriver = () => [() => {}, { loading: false }];
export const useUpdateDriver = () => [() => {}, { loading: false }];

export const useVehicles = () => ({ data: { vehicles: [] }, loading: false, error: null });
export const useVehiclesByType = () => ({ data: { vehicles: [] }, loading: false, error: null });
export const useVehiclesNeedingMaintenance = () => ({ data: { vehicles: [] }, loading: false, error: null });
export const useCreateVehicle = () => [() => {}, { loading: false }];
export const useUpdateVehicle = () => [() => {}, { loading: false }];

export const useJobs = () => ({ data: { jobs: [] }, loading: false, error: null });
export const useCreateJob = () => [() => {}, { loading: false }];
export const useUpdateJob = () => [() => {}, { loading: false }];

export const useRoutes = () => ({ data: { routes: [] }, loading: false, error: null });
export const useRoute = () => ({ data: null, loading: false, error: null });
export const useCreateRoute = () => [() => {}, { loading: false }];

export const useLogin = () => [() => {}, { loading: false }];
