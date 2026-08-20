import type { MapDisplayMode } from '../../components/maps/MultiRouteMap';
import type { RouteQuickFilter } from './RoutingWorkspaceComponents';

export type RouteSummaryFilter = 'all' | 'attention' | 'ready';

export type RouteSummaryColumnId =
  | 'driver'
  | 'vehicle'
  | 'stops'
  | 'distance'
  | 'duration'
  | 'service'
  | 'weight'
  | 'volume'
  | 'workload';

export type RouteSummaryViewSnapshot = {
  columns: RouteSummaryColumnId[];
  summaryFilter: RouteSummaryFilter;
  routeSearch: string;
  routeQuickFilter: RouteQuickFilter;
  driverFilterId: string;
  vehicleFilterId: string;
  mapDisplayMode: MapDisplayMode;
};

export type SavedRouteSummaryView = {
  id: string;
  name: string;
  snapshot: RouteSummaryViewSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type BuiltInRouteSummaryView = {
  id: `builtin:${string}`;
  name: string;
  description: string;
  snapshot: RouteSummaryViewSnapshot;
};

export const routeSummaryColumnDefinitions: ReadonlyArray<{
  id: RouteSummaryColumnId;
  label: string;
  description: string;
}> = [
  { id: 'driver', label: 'Driver', description: 'Assigned driver name' },
  { id: 'vehicle', label: 'Vehicle', description: 'Vehicle plate or assignment state' },
  { id: 'stops', label: 'Stops', description: 'Number of planned stops' },
  { id: 'distance', label: 'Miles', description: 'Planned route distance' },
  { id: 'duration', label: 'Route time', description: 'Travel and service duration' },
  { id: 'service', label: 'Service time', description: 'Planned on-site service time' },
  { id: 'weight', label: 'Weight', description: 'Assigned shipment weight' },
  { id: 'volume', label: 'Volume', description: 'Assigned shipment volume' },
  { id: 'workload', label: 'Workload', description: 'Share of an eight-hour route day' },
];

export const defaultRouteSummaryColumns: RouteSummaryColumnId[] = [
  'driver',
  'vehicle',
  'stops',
  'distance',
  'duration',
  'workload',
];

const routeSummaryColumnIds = new Set<RouteSummaryColumnId>(
  routeSummaryColumnDefinitions.map(({ id }) => id),
);
const routeSummaryFilters = new Set<RouteSummaryFilter>(['all', 'attention', 'ready']);
const routeQuickFilters = new Set<RouteQuickFilter>([
  'all',
  'ready',
  'needs-driver',
  'needs-vehicle',
  'has-exceptions',
  'has-unassigned',
]);
const mapDisplayModes = new Set<MapDisplayMode>(['selected', 'all', 'density', 'exceptions']);

const defaultSnapshot: RouteSummaryViewSnapshot = {
  columns: defaultRouteSummaryColumns,
  summaryFilter: 'all',
  routeSearch: '',
  routeQuickFilter: 'all',
  driverFilterId: 'all',
  vehicleFilterId: 'all',
  mapDisplayMode: 'selected',
};

export const builtInRouteSummaryViews: BuiltInRouteSummaryView[] = [
  {
    id: 'builtin:operations',
    name: 'Operations default',
    description: 'Every route with the core assignment and plan metrics.',
    snapshot: defaultSnapshot,
  },
  {
    id: 'builtin:attention',
    name: 'Attention review',
    description: 'Routes that need an assignment, constraint, or timing decision.',
    snapshot: {
      ...defaultSnapshot,
      columns: ['driver', 'vehicle', 'stops', 'duration', 'workload'],
      summaryFilter: 'attention',
      mapDisplayMode: 'exceptions',
    },
  },
  {
    id: 'builtin:capacity',
    name: 'Capacity watch',
    description: 'Shipment load, vehicle assignment, and route-day workload.',
    snapshot: {
      ...defaultSnapshot,
      columns: ['vehicle', 'stops', 'weight', 'volume', 'workload'],
      mapDisplayMode: 'all',
    },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value: unknown, fallback: string, maxLength = 96) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

export function normalizeRouteSummaryColumns(
  value: unknown,
  fallback: RouteSummaryColumnId[] = defaultRouteSummaryColumns,
) {
  if (!Array.isArray(value)) return [...fallback];
  const columns: RouteSummaryColumnId[] = [];
  for (const candidate of value) {
    if (
      typeof candidate === 'string' &&
      routeSummaryColumnIds.has(candidate as RouteSummaryColumnId) &&
      !columns.includes(candidate as RouteSummaryColumnId)
    ) {
      columns.push(candidate as RouteSummaryColumnId);
    }
  }
  return columns.length ? columns : [...fallback];
}

export function normalizeRouteSummaryViewSnapshot(
  value: unknown,
  fallback: RouteSummaryViewSnapshot = defaultSnapshot,
): RouteSummaryViewSnapshot {
  const record = isRecord(value) ? value : {};
  return {
    columns: normalizeRouteSummaryColumns(record.columns, fallback.columns),
    summaryFilter: routeSummaryFilters.has(record.summaryFilter as RouteSummaryFilter)
      ? record.summaryFilter as RouteSummaryFilter
      : fallback.summaryFilter,
    routeSearch: typeof record.routeSearch === 'string'
      ? record.routeSearch.slice(0, 120)
      : fallback.routeSearch,
    routeQuickFilter: routeQuickFilters.has(record.routeQuickFilter as RouteQuickFilter)
      ? record.routeQuickFilter as RouteQuickFilter
      : fallback.routeQuickFilter,
    driverFilterId: boundedString(record.driverFilterId, fallback.driverFilterId),
    vehicleFilterId: boundedString(record.vehicleFilterId, fallback.vehicleFilterId),
    mapDisplayMode: mapDisplayModes.has(record.mapDisplayMode as MapDisplayMode)
      ? record.mapDisplayMode as MapDisplayMode
      : fallback.mapDisplayMode,
  };
}

export function normalizeSavedRouteSummaryViews(value: unknown): SavedRouteSummaryView[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const names = new Set<string>();
  const views: SavedRouteSummaryView[] = [];

  for (const candidate of value) {
    if (views.length >= 12) break;
    if (!isRecord(candidate)) continue;
    const id = boundedString(candidate.id, '', 120);
    const name = boundedString(candidate.name, '', 40);
    const normalizedName = name.toLocaleLowerCase();
    if (!id || !name || ids.has(id) || names.has(normalizedName)) continue;
    const createdAt = boundedString(candidate.createdAt, new Date(0).toISOString(), 40);
    const updatedAt = boundedString(candidate.updatedAt, createdAt, 40);
    ids.add(id);
    names.add(normalizedName);
    views.push({
      id,
      name,
      snapshot: normalizeRouteSummaryViewSnapshot(candidate.snapshot),
      createdAt,
      updatedAt,
    });
  }
  return views;
}

function uniqueViewId(name: string, views: SavedRouteSummaryView[], now: Date) {
  const slug = name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'view';
  const stem = `view:${now.getTime()}:${slug}`;
  let id = stem;
  let suffix = 2;
  while (views.some((view) => view.id === id)) {
    id = `${stem}:${suffix}`;
    suffix += 1;
  }
  return id;
}

export function saveRouteSummaryView(
  views: SavedRouteSummaryView[],
  name: string,
  snapshot: RouteSummaryViewSnapshot,
  options: { id?: string; now?: Date } = {},
) {
  const normalizedName = boundedString(name, '', 40);
  if (!normalizedName) {
    return { views, error: 'Enter a view name.' } as const;
  }
  const duplicate = views.find(
    (view) =>
      view.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase() &&
      view.id !== options.id,
  );
  if (duplicate) {
    return { views, error: 'A saved view already uses that name.' } as const;
  }
  if (!options.id && views.length >= 12) {
    return { views, error: 'You can save up to 12 dispatcher views.' } as const;
  }

  const now = options.now || new Date();
  const timestamp = now.toISOString();
  const existing = options.id ? views.find((view) => view.id === options.id) : null;
  const saved: SavedRouteSummaryView = {
    id: existing?.id || uniqueViewId(normalizedName, views, now),
    name: normalizedName,
    snapshot: normalizeRouteSummaryViewSnapshot(snapshot),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
  const nextViews = existing
    ? views.map((view) => (view.id === existing.id ? saved : view))
    : [...views, saved];
  return { views: nextViews, saved, error: null } as const;
}

export function deleteRouteSummaryView(views: SavedRouteSummaryView[], id: string) {
  return views.filter((view) => view.id !== id);
}

export function routeSummarySnapshotsEqual(
  left: RouteSummaryViewSnapshot,
  right: RouteSummaryViewSnapshot,
) {
  return JSON.stringify(normalizeRouteSummaryViewSnapshot(left)) ===
    JSON.stringify(normalizeRouteSummaryViewSnapshot(right));
}
