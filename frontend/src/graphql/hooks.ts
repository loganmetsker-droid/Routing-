// GraphQL hooks disabled - using REST API via src/services/api.ts
import { login as apiLogin } from '../services/api';

type Vehicle = { id: string; make: string; model: string; licensePlate: string; status: string; [key: string]: any };
type Driver = { id: string; name?: string; firstName?: string; lastName?: string; status: string; [key: string]: any };
type Route = { id: string; status: string; driver?: Driver; vehicle?: Vehicle; [key: string]: any };
type Job = { id: string; status: string; address?: string; [key: string]: any };
type Customer = { id: string; name?: string; [key: string]: any };

export const useCustomers = () => ({ data: { customers: [] as Customer[] }, loading: false, error: null, refetch: async () => {} });
export const useCustomer = (_id?: string) => ({ data: null, loading: false, error: null, refetch: async () => {} });
export const useCreateCustomer = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;
export const useUpdateCustomer = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;
export const useDeleteCustomer = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;

export const useDrivers = () => ({ data: { drivers: [] as Driver[] }, loading: false, error: null, refetch: async () => {} });
export const useDriver = (_id?: string) => ({ data: null, loading: false, error: null, refetch: async () => {} });
export const useCreateDriver = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;
export const useUpdateDriver = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;

export const useVehicles = () => ({ data: { vehicles: [] as Vehicle[] }, loading: false, error: null, refetch: async () => {} });
export const useVehiclesByType = (_type?: string) => ({ data: { vehicles: [] as Vehicle[] }, loading: false, error: null, refetch: async () => {} });
export const useVehiclesNeedingMaintenance = () => ({ data: { vehicles: [] as Vehicle[] }, loading: false, error: null, refetch: async () => {} });
export const useCreateVehicle = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;
export const useUpdateVehicle = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;

export const useJobs = () => ({ data: { jobs: [] as Job[] }, loading: false, error: null, refetch: async () => {} });
export const useCreateJob = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;
export const useUpdateJob = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;

export const useRoutes = () => ({ data: { routes: [] as Route[] }, loading: false, error: null, refetch: async () => {} });
export const useRoute = (_id?: string) => ({ data: { route: null as Route | null }, loading: false, error: null, refetch: async () => {} });
export const useCreateRoute = () => [async (_input: any) => ({ data: {} }), { loading: false }] as const;

export const useLogin = () =>
  [
    async (input: { email: string; password: string }) => {
      const data = await apiLogin(input.email, input.password);
      return { data };
    },
    { loading: false },
  ] as const;
