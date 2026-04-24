export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const AUTH_TOKEN_KEY = 'authToken';

const API_BASE_URL = (
  import.meta.env.VITE_REST_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'
)
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  setAuthToken(null);
}

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => undefined);
  }
  return response.text().catch(() => undefined);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiFetchResponse(path, init);
  return (await parseResponseBody(response)) as T;
}

export async function apiFetchResponse(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 12000);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number.isFinite(timeoutMs) ? timeoutMs : 12000,
  );

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: buildHeaders(init.headers),
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (error: unknown) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timed out. Backend may be unavailable.', 408);
    }
    throw new ApiError(
      'Unable to reach backend service. Check server and database status.',
      503,
      error,
    );
  }

  clearTimeout(timer);

  if (response.status === 401) {
    clearAuthToken();
  }

  if (!response.ok) {
    const body = await parseResponseBody(response);
    const message =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message?: unknown }).message)
        : `Request failed: ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  return response;
}
