// GraphQL hooks disabled - using REST API via src/services/api.ts

export const useCustomers = () => ({ data: { customers: [] }, loading: false, error: null, refetch: async () => {} });
export const useCustomer = (_id?: string) => ({ data: null, loading: false, error: null, refetch: async () => {} });
export const useCreateCustomer = () => [async (_input: any) => {}, { loading: false }] as const;
export const useUpdateCustomer = () => [async (_input: any) => {}, { loading: false }] as const;
export const useDeleteCustomer = () => [async (_id: string) => {}, { loading: false }] as const;

export const useDrivers = () => ({ data: { drivers: [] }, loading: false, error: null, refetch: async () => {} });
export const useDriver = (_id?: string) => ({ data: null, loading: false, error: null, refetch: async () => {} });
export const useCreateDriver = () => [async (_input: any) => {}, { loading: false }] as const;
export const useUpdateDriver = () => [async (_input: any) => {}, { loading: false }] as const;

export const useVehicles = () => ({ data: { vehicles: [] }, loading: false, error: null, refetch: async () => {} });
export const useVehiclesByType = (_type?: string) => ({ data: { vehicles: [] }, loading: false, error: null, refetch: async () => {} });
export const useVehiclesNeedingMaintenance = () => ({ data: { vehicles: [] }, loading: false, error: null, refetch: async () => {} });
export const useCreateVehicle = () => [async (_input: any) => {}, { loading: false }] as const;
export const useUpdateVehicle = () => [async (_input: any) => {}, { loading: false }] as const;

export const useJobs = () => ({ data: { jobs: [] }, loading: false, error: null, refetch: async () => {} });
export const useCreateJob = () => [async (_input: any) => {}, { loading: false }] as const;
export const useUpdateJob = () => [async (_input: any) => {}, { loading: false }] as const;

export const useRoutes = () => ({ data: { routes: [] }, loading: false, error: null, refetch: async () => {} });
export const useRoute = (_id?: string) => ({ data: { route: null }, loading: false, error: null, refetch: async () => {} });
export const useCreateRoute = () => [async (_input: any) => {}, { loading: false }] as const;

export const useLogin = () => [async (_credentials: any) => {}, { loading: false }] as const;
