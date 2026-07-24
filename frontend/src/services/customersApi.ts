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

const previewCustomerSeed = (): CustomerRecord[] => [
  { id: 'CUST-ROUTE-1001', name: 'Jane & Sons Bakery', businessName: 'Food service', email: 'dispatch@janeandsons.example', phone: '(303) 555-0201', defaultAddress: '1425 Market Ave, Denver, CO 80202', notes: 'Morning bakery delivery account.', exceptions: 'Use the loading dock entrance' },
  { id: 'CUST-ROUTE-1002', name: 'Omega Medical', businessName: 'Healthcare', email: 'receiving@omegamedical.example', phone: '(303) 555-0202', defaultAddress: '2100 Santa Fe Dr, Denver, CO 80204', notes: 'Medical receiving account.', exceptions: 'Appointment and signature required' },
  { id: 'CUST-ROUTE-1003', name: 'Pioneer Logistics', businessName: 'Distribution', email: 'ops@pioneerlogistics.example', phone: '(303) 555-0203', defaultAddress: '3300 Peña Blvd, Denver, CO 80216', notes: 'Distribution-center replenishment.', exceptions: 'Call ahead before arrival' },
  { id: 'CUST-ROUTE-1004', name: 'Ridgewood Labs', businessName: 'Laboratory', email: 'receiving@ridgewoodlabs.example', phone: '(303) 555-0204', defaultAddress: '4100 Irving St, Denver, CO 80217', notes: 'Laboratory supply delivery account.', exceptions: 'Signature required' },
  { id: 'CUST-ROUTE-1005', name: 'Riverfront Catering', businessName: 'Food service', email: 'kitchen@riverfrontcatering.example', phone: '(303) 555-0205', defaultAddress: '870 W Evans Ave, Denver, CO 80223', notes: 'Catering kitchen replenishment.', exceptions: 'Deliver to kitchen receiving' },
  { id: 'CUST-ROUTE-1006', name: 'Aurora Office Supply', businessName: 'Office supply', email: 'receiving@auroraoffice.example', phone: '(303) 555-0206', defaultAddress: '12100 E Iliff Ave, Aurora, CO 80014', notes: 'Office supply account.', exceptions: 'Business-hours delivery' },
  { id: 'CUST-ROUTE-1007', name: 'Arvada Grocer', businessName: 'Grocery', email: 'receiving@arvadagrocer.example', phone: '(303) 555-0207', defaultAddress: '7600 W 57th Ave, Arvada, CO 80002', notes: 'Neighborhood grocery replenishment.', exceptions: 'Food-grade carrier required' },
  { id: 'CUST-ROUTE-1008', name: 'Wheat Ridge Pharmacy', businessName: 'Healthcare', email: 'receiving@wheatridgepharmacy.example', phone: '(303) 555-0208', defaultAddress: '4990 Kipling St, Wheat Ridge, CO 80033', notes: 'Pharmacy delivery account.', exceptions: 'Signature and appointment required' },
  {
    id: 'CUST-1001',
    name: 'FreshMart Grocery',
    businessName: 'Grocery',
    email: 'sarah.mitchell@freshmart.com',
    phone: '(312) 555-0198',
    defaultAddress: '12 locations across North Zone',
    notes: 'Regional grocery chain with 12 store locations across the North Zone. Daily deliveries include produce, dairy, and dry goods.',
    exceptions: 'Preferred delivery window: Mon-Sat 6:00 AM-11:00 AM\nTemp-sensitive dairy and produce\nFood-grade carriers required',
  },
  {
    id: 'CUST-1002',
    name: 'Peak Distribution',
    businessName: 'Distribution',
    email: 'ops@peakdistribution.com',
    phone: '(303) 555-0183',
    defaultAddress: '7 locations across East Zone',
    notes: 'Distribution account with early sort windows and dock appointment requirements.',
    exceptions: 'Dock hours: 7a-3p\nCall ahead required',
  },
  {
    id: 'CUST-1003',
    name: 'NextGen Builders',
    businessName: 'Construction',
    email: 'receiving@nextgenbuilders.com',
    phone: '(303) 555-0190',
    defaultAddress: '18 service locations',
    notes: 'Construction supply customer with mixed pallet and jobsite delivery needs.',
    exceptions: 'Site contact required\nLiftgate preferred',
  },
  { id: 'CUST-1004', name: 'MediCore Health', businessName: 'Healthcare', email: 'routing@medicore.com', phone: '(303) 555-0104', defaultAddress: '9 clinics', notes: 'Healthcare locations require appointment windows and signature capture.', exceptions: 'Signature required\nTemperature control' },
  { id: 'CUST-1005', name: 'ServicePro Solutions', businessName: 'Field Service', email: 'dispatch@servicepro.com', phone: '(303) 555-0105', defaultAddress: '24 service addresses', notes: 'Field service parts deliveries across metro territory.', exceptions: 'Preferred territory: North Zone' },
  { id: 'CUST-1006', name: 'Urban Wholesale', businessName: 'Distribution', email: 'ops@urbanwholesale.com', phone: '(303) 555-0106', defaultAddress: '5 warehouses', notes: 'Wholesale replenishment account with morning receiving.', exceptions: 'Dock height 48 inches' },
  { id: 'CUST-1007', name: 'GreenLeaf Organics', businessName: 'Grocery', email: 'orders@greenleaf.com', phone: '(303) 555-0107', defaultAddress: '6 stores', notes: 'Produce and refrigerated goods. Keep food-grade separation.', exceptions: 'Food grade\nInside delivery' },
  { id: 'CUST-1008', name: 'BuildRight Supplies', businessName: 'Construction', email: 'logistics@buildright.com', phone: '(303) 555-0108', defaultAddress: '11 jobsites', notes: 'Mixed jobsite and branch deliveries.', exceptions: 'No stacking\nPallet jack required' },
  { id: 'CUST-1009', name: 'CarePoint Clinics', businessName: 'Healthcare', email: 'ops@carepoint.com', phone: '(303) 555-0109', defaultAddress: '15 clinics', notes: 'Clinic deliveries need contact handoff.', exceptions: 'Appointment required' },
  { id: 'CUST-1010', name: 'Northside Retail', businessName: 'Distribution', email: 'routing@northside.com', phone: '(303) 555-0110', defaultAddress: '4 stores', notes: 'Retail replenishment route with back door access.', exceptions: 'Back door access code required' },
];

let previewCustomerStore = previewCustomerSeed();

export const getCustomers = async (): Promise<CustomerRecord[]> => {
  if (isPreview()) {
    return previewCustomerStore.map((customer) => ({ ...customer }));
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
  if (isPreview()) {
    const nextCustomer = normalizeCustomer({
      id: `customer-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...customer,
    });
    previewCustomerStore = [nextCustomer, ...previewCustomerStore];
    return nextCustomer;
  }

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
  if (isPreview()) {
    const existing = previewCustomerStore.find((customer) => customer.id === id);
    const nextCustomer = normalizeCustomer({
      ...(existing || { id }),
      ...updates,
    });
    previewCustomerStore = previewCustomerStore.map((customer) =>
      customer.id === id ? nextCustomer : customer,
    );
    if (!existing) {
      previewCustomerStore = [nextCustomer, ...previewCustomerStore];
    }
    return nextCustomer;
  }

  const response = await apiFetch(`/api/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  const data = unwrapApiData<{ customer?: unknown }>(await response.json());
  return normalizeCustomer(data.customer);
};

export const deleteCustomer = async (id: string): Promise<void> => {
  if (isPreview()) {
    previewCustomerStore = previewCustomerStore.filter((customer) => customer.id !== id);
    return;
  }

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
