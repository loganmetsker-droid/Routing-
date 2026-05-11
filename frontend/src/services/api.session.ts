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
const AUTH_PREVIEW_USER_KEY = 'trovan-preview-auth-user';
const PREVIEW_DRIVER_EMAIL = 'anna.quinn@trovan.local';

const isLocalPreviewHost = () =>
  typeof window !== 'undefined' &&
  new Set(['localhost', '127.0.0.1', '[::1]']).has(window.location.hostname);

const hasLocalDemoPreviewBootstrap = () =>
  typeof window !== 'undefined' &&
  Boolean((window as unknown as { __TROVAN_LOCAL_DEMO_PREVIEW__?: boolean })
    .__TROVAN_LOCAL_DEMO_PREVIEW__);

const isLocalPreviewEnabled = () =>
  typeof window !== 'undefined' &&
  (hasLocalDemoPreviewBootstrap() || (isLocalPreviewHost() && AUTH_BYPASS));

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

export function isDriverOnlyAuthUser(
  user?: Pick<AuthUser, 'role' | 'roles'> | null,
) {
  const roles = (user?.roles?.length ? user.roles : [user?.role || ''])
    .map((role) => String(role).trim().toUpperCase())
    .filter(Boolean);
  return (
    roles.includes('DRIVER') &&
    !roles.some((role) =>
      ['OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER'].includes(role),
    )
  );
}

const shouldUseDriverPreviewUser = (email?: string | null) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail.includes('driver')) return true;
  if (normalizedEmail === PREVIEW_DRIVER_EMAIL) return true;
  return (
    typeof window !== 'undefined' && window.location.pathname.startsWith('/driver')
  );
};

const makePreviewUser = (email?: string | null): AuthUser => {
  if (shouldUseDriverPreviewUser(email)) {
    return {
      id: 'preview-driver-user',
      email: PREVIEW_DRIVER_EMAIL,
      role: 'driver',
      roles: ['DRIVER'],
      authProvider: 'local-config',
      organizationId: 'preview-org',
      sessionId: 'preview-session',
    };
  }

  return {
    id: 'preview-user',
    email: email || 'preview@trovan.local',
    role: 'dispatcher',
    roles: ['DISPATCHER'],
    authProvider: 'local-config',
    organizationId: 'preview-org',
    sessionId: 'preview-session',
  };
};

const persistPreviewUser = (user: AuthUser) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_PREVIEW_USER_KEY, JSON.stringify(user));
};

const readPreviewUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(AUTH_PREVIEW_USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (typeof parsed.email !== 'string') return null;
    return {
      id: typeof parsed.id === 'string' ? parsed.id : 'preview-user',
      email: parsed.email,
      role: typeof parsed.role === 'string' ? parsed.role : 'dispatcher',
      roles: Array.isArray(parsed.roles)
        ? parsed.roles.filter((role): role is string => typeof role === 'string')
        : undefined,
      authProvider:
        typeof parsed.authProvider === 'string'
          ? parsed.authProvider
          : 'local-config',
      organizationId:
        typeof parsed.organizationId === 'string'
          ? parsed.organizationId
          : 'preview-org',
      organizationSlug:
        typeof parsed.organizationSlug === 'string'
          ? parsed.organizationSlug
          : undefined,
      membershipId:
        typeof parsed.membershipId === 'string' ? parsed.membershipId : undefined,
      sessionId:
        typeof parsed.sessionId === 'string' ? parsed.sessionId : 'preview-session',
    };
  } catch {
    return null;
  }
};

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
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_PREVIEW_USER_KEY);
  }
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
    const user = makePreviewUser(email);
    const response = {
      accessToken: AUTH_BYPASS_TOKEN,
      expiresIn: 'preview-session',
      sessionId: 'preview-session',
      user,
    };
    setAuthToken(response.accessToken);
    persistPreviewUser(user);
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
      user: readPreviewUser() ?? makePreviewUser(),
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
