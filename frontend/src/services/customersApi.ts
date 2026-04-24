import { unwrapApiData, unwrapListItems } from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import { isPreview } from './api.preview';
import { getErrorMessage, isRecord, type StructuredAddress } from './api.types';
import { queryKeys } from './queryKeys';

export type CustomerRecord = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  businessName?: string;
  defaultAddress?: string;
  defaultAddressStructured?: StructuredAddress | null;
  notes?: string;
  exceptions?: string;
  address?: string;
};

export type CustomerFormInput = {
  name: string;
  phone?: string;
  email?: string;
  businessName?: string;
  defaultAddress?: string;
  notes?: string;
  exceptions?: string;
};

const normalizeStructuredAddress = (
  value: unknown,
): StructuredAddress | null => {
  if (!isRecord(value) || typeof value.line1 !== 'string') {
    return null;
  }

  return {
    line1: value.line1,
    line2: typeof value.line2 === 'string' ? value.line2 : null,
    city: typeof value.city === 'string' ? value.city : '',
    state: typeof value.state === 'string' ? value.state : '',
    zip: typeof value.zip === 'string' ? value.zip : '',
  };
};

const normalizeCustomer = (value: unknown): CustomerRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof record.name === 'string' ? record.name : 'Unknown Customer',
    email: typeof record.email === 'string' ? record.email : undefined,
    phone: typeof record.phone === 'string' ? record.phone : undefined,
    businessName:
      typeof record.businessName === 'string' ? record.businessName : undefined,
    defaultAddress:
      typeof record.defaultAddress === 'string'
        ? record.defaultAddress
        : typeof record.address === 'string'
          ? record.address
          : undefined,
    defaultAddressStructured: normalizeStructuredAddress(
      record.defaultAddressStructured,
    ),
    notes: typeof record.notes === 'string' ? record.notes : undefined,
    exceptions:
      typeof record.exceptions === 'string' ? record.exceptions : undefined,
    address: typeof record.address === 'string' ? record.address : undefined,
  };
};

const previewCustomers = (): CustomerRecord[] => [
  {
    id: 'customer-sunrise',
    name: 'Sunrise Retail',
    businessName: 'Sunrise Retail',
    email: 'dispatch@sunriseretail.com',
    phone: '(303) 555-0118',
    defaultAddress: '1425 Market Ave, Denver, CO 80202',
    notes: 'Dock access from alley entrance. Call receiving team before arrival.',
    exceptions: 'Service time: 15 min\nTime windows: 9a-1p\nSignature required',
  },
  {
    id: 'customer-omega',
    name: 'Omega Medical',
    businessName: 'Omega Medical',
    email: 'ops@omegamedical.com',
    phone: '(303) 555-0183',
    defaultAddress: '2100 Santa Fe Dr, Denver, CO 80204',
    notes: 'Cold-chain delivery workflow. Use dock 2.',
    exceptions: 'Vehicle restrictions: Cargo van only\nCall ahead required',
  },
  {
    id: 'customer-pioneer',
    name: 'Pioneer Logistics',
    businessName: 'Pioneer Logistics',
    email: 'routing@pioneerlogistics.com',
    phone: '(303) 555-0190',
    defaultAddress: '3300 Pena Blvd, Denver, CO 80216',
    notes: 'Freight window shifts quickly during afternoon sort.',
    exceptions: 'Preferred territory: DEN-North\nDock hours: 8a-5p',
  },
];

export const getCustomers = async (): Promise<CustomerRecord[]> => {
  if (isPreview()) {
    return previewCustomers();
  }
  const response = await apiFetch('/api/customers');
  const data = await response.json();
  return unwrapListItems<unknown>(data, ['customers', 'items']).map(
    normalizeCustomer,
  );
};

export const createCustomer = async (
  customer: CustomerFormInput,
): Promise<CustomerRecord> => {
  const response = await apiFetch('/api/customers', {
    method: 'POST',
    body: JSON.stringify(customer),
  });
  const data = unwrapApiData<{ customer?: unknown }>(await response.json());
  return normalizeCustomer(data.customer);
};

export const updateCustomer = async (
  id: string,
  updates: Partial<CustomerFormInput>,
): Promise<CustomerRecord> => {
  const response = await apiFetch(`/api/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  const data = unwrapApiData<{ customer?: unknown }>(await response.json());
  return normalizeCustomer(data.customer);
};

export const deleteCustomer = async (id: string): Promise<void> => {
  await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
};

export const useCustomersQuery = () =>
  useQuery({
    queryKey: queryKeys.customers,
    queryFn: getCustomers,
  });

export const useCreateCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
};

export const useUpdateCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CustomerFormInput> }) =>
      updateCustomer(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
};

export const useDeleteCustomerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });
};

export const getCustomerErrorMessage = (error: unknown) =>
  getErrorMessage(error, 'Customer request failed.');
