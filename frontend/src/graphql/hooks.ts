// GraphQL hooks disabled - using REST API via src/services/api.ts

export const useCustomers = () => ({ data: { customers: [] }, loading: false, error: null, refetch: async () => {} });
export const useCustomer = (id?: string) => ({ data: null, loading: false, error: null, refetch: async () => {} });
export const useCreateCustomer = () => [async () => {}, { loading: false }] as const;
export const useUpdateCustomer = () => [async () => {}, { loading: false }] as const;
export const useDeleteCustomer = () => [async () => {}, { loading: false }] as const;

export const useDrivers = () => ({ data: { drivers: [] }, loading: false, error: null, refetch: async () => {} });
export const useDriver = (id?: string) => ({ data: null, loading: false, error: null, refetch: async () => {} });
export const useCreateDriver = () => [async () => {}, { loading: false }] as const;
export const useUpdateDriver = () => [async () => {}, { loading: false }] as const;

export const useVehicles = () => ({ data: { vehicles: [] }, loading: false, error: null, refetch: async () => {} });
export const useVehiclesByType = (type?: string) => ({ data: { vehicles: [] }, loading: false, error: null, refetch: async () => {} });
export const useVehiclesNeedingMaintenance = () => ({ data: { vehicles: [] }, loading: false, error: null, refetch: async () => {} });
export const useCreateVehicle = () => [async () => {}, { loading: false }] as const;
export const useUpdateVehicle = () => [async () => {}, { loading: false }] as const;

export const useJobs = () => ({ data: { jobs: [] }, loading: false, error: null, refetch: async () => {} });
export const useCreateJob = () => [async () => {}, { loading: false }] as const;
export const useUpdateJob = () => [async () => {}, { loading: false }] as const;

export const useRoutes = () => ({ data: { routes: [] }, loading: false, error: null, refetch: async () => {} });
export const useRoute = (id?: string) => ({ data: { route: null }, loading: false, error: null, refetch: async () => {} });
export const useCreateRoute = () => [async () => {}, { loading: false }] as const;

export const useLogin = () => [async () => {}, { loading: false }] as const;
