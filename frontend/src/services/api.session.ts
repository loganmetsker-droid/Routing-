import { unwrapApiData, unwrapListItems } from '@shared/contracts';
import {
  apiFetchResponse,
  clearAuthToken as clearStoredAuthToken,
  getAuthToken as getStoredAuthToken,
  setAuthToken as setStoredAuthToken,
} from './apiClient';

const AUTH_BYPASS =
  import.meta.env.VITE_AUTH_BYPASS === 'true' ||
  import.meta.env.VITE_MOCK_PREVIEW === 'true';
const AUTH_BYPASS_TOKEN = 'preview-auth-bypass';

const isLocalPreviewHost = () =>
  typeof window !== 'undefined' &&
  new Set(['localhost', '127.0.0.1', '[::1]']).has(window.location.hostname);

const isLocalPreviewEnabled = () =>
  typeof window !== 'undefined' &&
  import.meta.env.DEV &&
  isLocalPreviewHost() &&
  AUTH_BYPASS;

export type ApiRequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  roles?: string[];
};

export type LoginResponse = {
  accessToken: string;
  expiresIn: string;
  user: AuthUser;
};

export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  defaultAddress?: string;
  defaultAddressStructured?: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    zip: string;
  };
  [key: string]: any;
};

const getAuthToken = (): string | null => getStoredAuthToken();

export const isAuthBypassed = () => isLocalPreviewEnabled();

export const setAuthToken = (token: string | null) => {
  setStoredAuthToken(token);
};

export const clearAuthSession = () => {
  clearStoredAuthToken();
};

export const isAuthenticated = () =>
  isAuthBypassed() || Boolean(getAuthToken());

export const apiFetch = async (
  path: string,
  options: ApiRequestOptions = {},
) => {
  if (options.skipAuth) {
    const headers = new Headers(options.headers);
    headers.set('Authorization', '');
    return apiFetchResponse(path, {
      ...(() => {
        const { skipAuth, ...rest } = options;
        return rest;
      })(),
      headers,
    });
  }

  const { skipAuth, ...rest } = options;
  return apiFetchResponse(path, rest);
};

export const login = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  if (isAuthBypassed()) {
    const response = {
      accessToken: AUTH_BYPASS_TOKEN,
      expiresIn: 'preview-session',
      user: {
        id: 'preview-user',
        email: email || 'preview@trovan.local',
        role: 'dispatcher',
        roles: ['DISPATCHER'],
      },
    };
    setAuthToken(response.accessToken);
    return response;
  }

  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json();
  const data = unwrapApiData<LoginResponse>(payload);
  if (data?.accessToken) {
    setAuthToken(data.accessToken);
  }
  return data;
};

export const getSession = async (): Promise<{ user: AuthUser }> => {
  if (isAuthBypassed()) {
    return {
      user: {
        id: 'preview-user',
        email: 'preview@trovan.local',
        role: 'dispatcher',
        roles: ['DISPATCHER'],
      },
    };
  }

  const response = await apiFetch('/api/auth/me');
  return unwrapApiData<{ user: AuthUser }>(await response.json());
};

export const validateSession = async (): Promise<boolean> => {
  if (isAuthBypassed()) return true;
  if (!isAuthenticated()) return false;

  try {
    await getSession();
    return true;
  } catch {
    clearAuthSession();
    return false;
  }
};

export const getCustomers = async (): Promise<Customer[]> => {
  try {
    const response = await apiFetch('/api/customers');
    const data = await response.json();
    return unwrapListItems<Customer>(data, ['customers', 'items']);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
};

export const createCustomer = async (
  customer: Partial<Customer>,
): Promise<{ customer: Customer }> => {
  const response = await apiFetch('/api/customers', {
    method: 'POST',
    body: JSON.stringify(customer),
  });
  return unwrapApiData<{ customer: Customer }>(await response.json());
};

export const updateCustomer = async (
  id: string,
  updates: Partial<Customer>,
): Promise<{ customer: Customer }> => {
  const response = await apiFetch(`/api/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return unwrapApiData<{ customer: Customer }>(await response.json());
};

export const deleteCustomer = async (id: string): Promise<void> => {
  await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
};
