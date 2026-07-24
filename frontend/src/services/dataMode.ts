export type TrovanDataMode = 'live' | 'preview' | 'degraded' | 'simulated';

type DataModeEnv = Partial<{
  DEV: boolean;
  VITE_TROVAN_DATA_MODE: string;
  VITE_DATA_MODE: string;
  VITE_MOCK_PREVIEW: string;
  VITE_AUTH_BYPASS: string;
}>;

type DataModeLocation = Pick<Location, 'search'> | URL;

type ResolveDataModeOptions = {
  env?: DataModeEnv;
  location?: DataModeLocation | null;
  hasPreviewBootstrap?: boolean;
};

const truthy = (value: unknown) =>
  ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

const normalizeDataMode = (value: unknown): TrovanDataMode | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'production' || normalized === 'backend') return 'live';
  if (normalized === 'demo' || normalized === 'mock') return 'preview';
  if (
    normalized === 'live' ||
    normalized === 'preview' ||
    normalized === 'degraded' ||
    normalized === 'simulated'
  ) {
    return normalized;
  }
  return null;
};

const searchParamsFor = (location: DataModeLocation | null | undefined) => {
  const search = location?.search ?? '';
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
};

const getRuntimePreviewBootstrap = () =>
  typeof window !== 'undefined' &&
  Boolean((window as unknown as { __TROVAN_LOCAL_DEMO_PREVIEW__?: boolean })
    .__TROVAN_LOCAL_DEMO_PREVIEW__);

export function resolveTrovanDataMode(
  options: ResolveDataModeOptions = {},
): TrovanDataMode {
  const env = options.env ?? import.meta.env;
  const params = searchParamsFor(options.location);
  const explicitMode =
    normalizeDataMode(params.get('dataMode')) ??
    normalizeDataMode(params.get('workspaceMode'));

  if (explicitMode) {
    return explicitMode;
  }

  if (params.get('auth') === 'live') {
    return 'live';
  }

  if (options.hasPreviewBootstrap ?? getRuntimePreviewBootstrap()) {
    return 'preview';
  }

  const envMode =
    normalizeDataMode(env.VITE_TROVAN_DATA_MODE) ??
    normalizeDataMode(env.VITE_DATA_MODE);
  if (envMode) {
    return envMode;
  }

  if (truthy(env.VITE_MOCK_PREVIEW)) {
    return 'preview';
  }

  return 'live';
}

export function getTrovanDataMode(): TrovanDataMode {
  return resolveTrovanDataMode({
    env: import.meta.env,
    location: typeof window === 'undefined' ? null : window.location,
  });
}

export function usesPreviewDataMode(mode: TrovanDataMode = getTrovanDataMode()) {
  return mode === 'preview' || mode === 'simulated';
}

export function getTrovanDataModeCopy(mode: TrovanDataMode) {
  switch (mode) {
    case 'preview':
      return {
        label: 'Preview data mode',
        detail: 'Local preview state; not backend persistence.',
      };
    case 'degraded':
      return {
        label: 'Degraded data mode',
        detail: 'Backend data with fallback estimates.',
      };
    case 'simulated':
      return {
        label: 'Simulated data mode',
        detail: 'Synthetic planner outputs; not backend persistence.',
      };
    case 'live':
    default:
      return {
        label: 'Live backend',
        detail: 'Using persisted API data.',
      };
  }
}
