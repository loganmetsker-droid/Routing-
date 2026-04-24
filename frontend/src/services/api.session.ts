import { unwrapApiData } from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import {
  apiFetchResponse,
  clearAuthToken as clearStoredAuthToken,
  getAuthToken as getStoredAuthToken,
  setAuthToken as setStoredAuthToken,
} from './apiClient';
import {
  isRecord,
  type AuthConfigurationRecord,
  type AuthSessionRecord,
} from './api.types';

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
  authProvider?: string;
  organizationId?: string;
  organizationSlug?: string;
  membershipId?: string;
  sessionId?: string;
};

export type LoginResponse = {
  accessToken: string;
  expiresIn: string;
  sessionId?: string;
  user: AuthUser;
};

const getAuthToken = (): string | null => getStoredAuthToken();

const normalizeAuthConfig = (value: unknown): AuthConfigurationRecord => {
  const record = isRecord(value) ? value : {};
  const workos = isRecord(record.workos) ? record.workos : {};
  return {
    enabled: Boolean(record.enabled),
    configured: Boolean(record.configured),
    localLoginAllowed: Boolean(record.localLoginAllowed),
    preferredProvider:
      record.preferredProvider === 'workos' ? 'workos' : 'local-config',
    workos: {
      apiKeyConfigured: Boolean(workos.apiKeyConfigured),
      authkitDomain:
        typeof workos.authkitDomain === 'string' ? workos.authkitDomain : null,
      clientIdConfigured: Boolean(workos.clientIdConfigured),
      connectionIdConfigured: Boolean(workos.connectionIdConfigured),
      mfaManagedByProvider: Boolean(workos.mfaManagedByProvider),
      redirectUri:
        typeof workos.redirectUri === 'string' ? workos.redirectUri : null,
      ssoReady: Boolean(workos.ssoReady),
    },
  };
};

const normalizeAuthSession = (value: unknown): AuthSessionRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id: typeof record.id === 'string' ? record.id : 'unknown-session',
    email: typeof record.email === 'string' ? record.email : 'unknown',
    authProvider:
      typeof record.authProvider === 'string'
        ? record.authProvider
        : 'local-config',
    providerSessionId:
      typeof record.providerSessionId === 'string'
        ? record.providerSessionId
        : null,
    current: Boolean(record.current),
    roles: Array.isArray(record.roles)
      ? record.roles.filter((item): item is string => typeof item === 'string')
      : [],
    userAgent:
      typeof record.userAgent === 'string' ? record.userAgent : null,
    ipAddress:
      typeof record.ipAddress === 'string' ? record.ipAddress : null,
    lastSeenAt:
      typeof record.lastSeenAt === 'string' ? record.lastSeenAt : null,
    revokedAt:
      typeof record.revokedAt === 'string' ? record.revokedAt : null,
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
};

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

export const getAuthConfig = async (): Promise<AuthConfigurationRecord> => {
  if (isAuthBypassed()) {
    return {
      enabled: false,
      configured: false,
      localLoginAllowed: true,
      preferredProvider: 'local-config',
      workos: {
        apiKeyConfigured: false,
        authkitDomain: null,
        clientIdConfigured: false,
        connectionIdConfigured: false,
        mfaManagedByProvider: false,
        redirectUri: null,
        ssoReady: false,
      },
    };
  }

  const response = await apiFetch('/api/auth/config', {
    skipAuth: true,
  });
  const payload = unwrapApiData<{ auth?: unknown }>(await response.json());
  return normalizeAuthConfig(payload.auth);
};

export const getWorkosAuthorizeUrl = async (
  organizationId?: string,
): Promise<string | null> => {
  const searchParams = new URLSearchParams();
  if (organizationId) {
    searchParams.set('organizationId', organizationId);
  }
  const response = await apiFetch(
    `/api/auth/workos/authorize-url${
      searchParams.toString() ? `?${searchParams.toString()}` : ''
    }`,
    { skipAuth: true },
  );
  const payload = unwrapApiData<{ url?: unknown }>(await response.json());
  return typeof payload.url === 'string' ? payload.url : null;
};

export const beginWorkosLogin = async (organizationId?: string) => {
  const url = await getWorkosAuthorizeUrl(organizationId);
  if (!url) {
    throw new Error('WorkOS AuthKit is not configured for this environment.');
  }
  if (typeof window !== 'undefined') {
    window.location.assign(url);
  }
};

export const login = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  if (isAuthBypassed()) {
    const response = {
      accessToken: AUTH_BYPASS_TOKEN,
      expiresIn: 'preview-session',
      sessionId: 'preview-session',
      user: {
        id: 'preview-user',
        email: email || 'preview@trovan.local',
        role: 'dispatcher',
        roles: ['DISPATCHER'],
        authProvider: 'local-config',
        organizationId: 'preview-org',
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

export const completeWorkosCallback = async (
  code: string,
  invitationToken?: string,
): Promise<LoginResponse> => {
  const response = await apiFetch('/api/auth/workos/callback', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ code, invitationToken }),
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
        authProvider: 'local-config',
        organizationId: 'preview-org',
        sessionId: 'preview-session',
      },
    };
  }

  const response = await apiFetch('/api/auth/me');
  return unwrapApiData<{ user: AuthUser }>(await response.json());
};

export const getAuthSessions = async (): Promise<AuthSessionRecord[]> => {
  const response = await apiFetch('/api/auth/sessions');
  const payload = unwrapApiData<{ sessions?: unknown[] }>(await response.json());
  return Array.isArray(payload.sessions)
    ? payload.sessions.map(normalizeAuthSession)
    : [];
};

export const revokeAuthSession = async (sessionId: string) => {
  const response = await apiFetch(`/api/auth/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  return unwrapApiData<{ session?: unknown }>(await response.json());
};

export const getLogoutUrl = async (): Promise<string | null> => {
  const response = await apiFetch('/api/auth/logout-url');
  const payload = unwrapApiData<{ url?: unknown }>(await response.json());
  return typeof payload.url === 'string' ? payload.url : null;
};

export const logout = async (): Promise<void> => {
  let redirectUrl: string | null = null;
  try {
    redirectUrl = await getLogoutUrl();
  } catch {
    redirectUrl = null;
  }

  clearAuthSession();

  if (redirectUrl && typeof window !== 'undefined') {
    window.location.assign(redirectUrl);
  }
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

export const useAuthConfigQuery = () =>
  useQuery({
    queryKey: queryKeys.authConfig,
    queryFn: getAuthConfig,
  });

export const useAuthSessionsQuery = () =>
  useQuery({
    queryKey: queryKeys.authSessions,
    queryFn: getAuthSessions,
    enabled: !isAuthBypassed(),
  });

export const useRevokeAuthSessionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeAuthSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.authSessions });
    },
  });
};
