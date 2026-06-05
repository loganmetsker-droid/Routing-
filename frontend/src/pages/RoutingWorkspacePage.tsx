import type { DropResult } from '@hello-pangea/dnd';
import {
  getOptimizationObjectiveLabel,
  normalizeOptimizationObjective,
  type OptimizationObjective,
} from '@shared/contracts';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MultiRouteMap, { type MapDisplayMode } from '../components/maps/MultiRouteMap';
import { OpsCommandBar } from '../components/ops';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import { buildPlannerMapRoutes, type OpsMapRoute } from '../features/dispatch/utils/opsMapData';
import { isPreview } from '../services/api.preview';
import {
  getErrorMessage,
  type DriverRecord,
  type VehicleRecord,
} from '../services/api.types';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import { useJobsQuery } from '../services/jobsApi';
import {
  generateDraftRoutePlan,
  publishRoutePlan,
  reoptimizeRoutePlan,
  type PlannerRoutePlan,
  type PlannerRoutePlanGroup,
  type PlannerRoutePlanStop,
  updateRoutePlanGroup,
  updateRoutePlanStop,
  usePlannerQuery,
} from '../services/plannerApi';
import {
  fetchRoadRoutePolyline,
  getRoadRouteSignature,
  type RoadRoutePoint,
} from '../services/roadRouteGeometry';
import {
  DensityToggle,
  ExceptionResolutionDrawer,
  hasStopException,
  JobSearchFilters,
  jobMatchesQuickFilter,
  jobSearchText,
  getPriorityLabel,
  isHighPriority,
  normalizeText,
  RouteDaySummaryBar,
  RouteInspector,
  RouteLaneEditorDrawer,
  RouteSearchFilters,
  RoutingLeftPanel,
  VehicleSearchFilters,
  type InspectorTab,
  type LaneEditorMode,
  type LeftPanelTab,
  type PlannerJobRecord,
  type PlannerRouteGroupWithStops,
  type RecentRouteMove,
  type RoutingExceptionRecord,
  type RoutingExceptionStatus,
  type RouteStopMoveRequest,
  type RouteQuickFilter,
  type StopQuickFilter,
  type VehicleQuickFilter,
  type ViewDensity,
} from './routing-workspace/RoutingWorkspaceComponents';
import {
  buildDense300StopDayScenario,
  buildCleanRouteDayScenario,
  buildDenseRouteDayScenario,
  buildExceptionRouteDayScenario,
  buildSetupRouteDayScenario,
} from './routing-workspace/densePlannerScenario';
const objectives: Array<{ value: OptimizationObjective; label: string }> = [
  { value: 'speed', label: 'Speed' },
  { value: 'distance', label: 'Distance' },
  { value: 'balanced', label: 'Balanced' },
];

function todayServiceDate() {
  return new Date().toISOString().slice(0, 10);
}

const marketingServiceDate = '2026-06-02';
const routingWorkspacePreferencePrefix = 'trovan-routing-workspace-preferences:v1';
const previewAuthUserStorageKey = 'trovan-preview-auth-user';
const authTokenStorageKey = 'authToken';

type RoutingDistanceUnit = 'mi' | 'km';
type DateDisplayPreference = 'readable' | 'iso';
type RoutingWorkspacePreferences = {
  density: ViewDensity;
  laneEditorMode: LaneEditorMode;
  mapDisplayMode: MapDisplayMode;
  leftPanelTab: LeftPanelTab;
  distanceUnit: RoutingDistanceUnit;
  dateDisplayPreference: DateDisplayPreference;
};

function nextRouteVersion(currentVersion: string | null) {
  const currentNumber = Number(currentVersion?.replace(/^v/i, '') || 0);
  return `v${Number.isFinite(currentNumber) ? currentNumber + 1 : 1}`;
}

function isViewDensity(value: unknown): value is ViewDensity {
  return value === 'comfortable' || value === 'compact';
}

function isLaneEditorMode(value: unknown): value is LaneEditorMode {
  return value === 'collapsed' || value === 'expanded' || value === 'fullscreen';
}

function isMapDisplayMode(value: unknown): value is MapDisplayMode {
  return value === 'selected' || value === 'all' || value === 'density' || value === 'exceptions';
}

function isLeftPanelTab(value: unknown): value is LeftPanelTab {
  return value === 'jobs' || value === 'routes' || value === 'vehicles';
}

function isRoutingDistanceUnit(value: unknown): value is RoutingDistanceUnit {
  return value === 'mi' || value === 'km';
}

function isDateDisplayPreference(value: unknown): value is DateDisplayPreference {
  return value === 'readable' || value === 'iso';
}

function normalizeStorageScopePart(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@-]+/g, '-')
    .slice(0, 96);
}

function readJsonRecord(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || !token.includes('.')) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const decoded = window.atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return readJsonRecord(decoded);
  } catch {
    return null;
  }
}

function getRoutingWorkspacePreferenceStorageKey() {
  if (typeof window === 'undefined') return null;
  const previewUser = readJsonRecord(window.localStorage.getItem(previewAuthUserStorageKey));
  const tokenPayload = previewUser
    ? null
    : decodeJwtPayload(window.localStorage.getItem(authTokenStorageKey));
  const identity = previewUser || tokenPayload;
  if (!identity) return null;

  const organizationScope = normalizeStorageScopePart(
    identity.organizationId ||
      identity.organization_id ||
      identity.orgId ||
      identity.org_id ||
      identity.tenantId ||
      identity.tenant_id,
  );
  const userScope = normalizeStorageScopePart(
    identity.id ||
      identity.sub ||
      identity.userId ||
      identity.user_id ||
      identity.email ||
      identity.sessionId ||
      identity.session_id,
  );
  if (!organizationScope || !userScope) return null;
  return `${routingWorkspacePreferencePrefix}:${organizationScope}:${userScope}`;
}

function readRoutingWorkspacePreferences(storageKey: string | null): Partial<RoutingWorkspacePreferences> | null {
  if (!storageKey || typeof window === 'undefined') return null;
  const record = readJsonRecord(window.localStorage.getItem(storageKey));
  if (!record) return null;
  return {
    density: isViewDensity(record.density) ? record.density : undefined,
    laneEditorMode: isLaneEditorMode(record.laneEditorMode) ? record.laneEditorMode : undefined,
    mapDisplayMode: isMapDisplayMode(record.mapDisplayMode) ? record.mapDisplayMode : undefined,
    leftPanelTab: isLeftPanelTab(record.leftPanelTab) ? record.leftPanelTab : undefined,
    distanceUnit: isRoutingDistanceUnit(record.distanceUnit) ? record.distanceUnit : undefined,
    dateDisplayPreference: isDateDisplayPreference(record.dateDisplayPreference)
      ? record.dateDisplayPreference
      : undefined,
  };
}

function writeRoutingWorkspacePreferences(
  storageKey: string | null,
  preferences: RoutingWorkspacePreferences,
) {
  if (!storageKey || typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

function formatPlannerDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year || 2026, (month || 1) - 1, day || 1));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatRouteDistance(distanceKm?: number | null, unit: 'mi' | 'km' = 'km') {
  const safeDistance = Number(distanceKm || 0);
  if (unit === 'mi') {
    return `${(safeDistance * 0.621371).toFixed(1)} mi`;
  }
  return `${safeDistance.toFixed(1)} km`;
}

function RoutingWorkspaceSkeleton() {
  return (
    <Box data-testid="routing-loading-skeleton" sx={{ display: 'grid', gap: 1.5 }}>
      <OpsCommandBar
        eyebrow="Planning"
        title="Routing"
        subtitle="Loading route workspace, route-day controls, and planner data."
        actions={<Skeleton variant="rounded" width={172} height={38} />}
        filters={
          <>
            <Skeleton variant="rounded" width={142} height={40} />
            <Skeleton variant="rounded" width={136} height={40} />
            <Skeleton variant="rounded" width={116} height={40} />
          </>
        }
        meta={
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {[120, 104, 96, 88, 132].map((width, index) => (
              <Skeleton key={index} variant="rounded" width={width} height={26} />
            ))}
          </Stack>
        }
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '260px minmax(640px, 1fr) 310px' },
          gap: 1.5,
          minHeight: 620,
        }}
      >
        <SurfacePanel variant="panel" padding={1.25}>
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={36} />
            <Skeleton variant="rounded" height={84} />
            <Skeleton variant="rounded" height={84} />
            <Skeleton variant="rounded" height={84} />
          </Stack>
        </SurfacePanel>
        <SurfacePanel variant="canvas" padding={1.25}>
          <Stack spacing={1.2} sx={{ height: '100%' }}>
            <Skeleton variant="rounded" width="42%" height={32} />
            <Skeleton variant="rounded" width="100%" sx={{ flex: 1, minHeight: 420 }} />
            <Skeleton variant="rounded" width="100%" height={92} />
          </Stack>
        </SurfacePanel>
        <SurfacePanel variant="panel" padding={1.25}>
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={32} />
            <Skeleton variant="rounded" height={54} />
            <Skeleton variant="rounded" height={54} />
            <Skeleton variant="rounded" height={54} />
          </Stack>
        </SurfacePanel>
      </Box>
    </Box>
  );
}

function distanceBetweenKm(
  left?: { lat?: number; lng?: number } | null,
  right?: { lat?: number; lng?: number } | null,
) {
  if (
    typeof left?.lat !== 'number' ||
    typeof left.lng !== 'number' ||
    typeof right?.lat !== 'number' ||
    typeof right.lng !== 'number'
  ) {
    return 0;
  }
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(right.lat - left.lat);
  const deltaLng = toRadians(right.lng - left.lng);
  const lat1 = toRadians(left.lat);
  const lat2 = toRadians(right.lat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type PlannerWorkspacePayload = {
  routePlan?: PlannerRoutePlan | null;
  plan?: PlannerRoutePlan | null;
  groups?: PlannerRoutePlanGroup[];
  stops?: PlannerRoutePlanStop[];
  unassignedJobs?: PlannerJobRecord[];
};

type RoadRouteGeometryState = Record<
  string,
  {
    signature: string;
    coordinates: RoadRoutePoint[];
  }
>;

const marketingStops = [
  ['Boulder Cold Chain', '1685 29th St, Boulder, CO', 40.0175, -105.2521],
  ['Flatiron Produce', '4800 Baseline Rd, Boulder, CO', 39.9996, -105.2392],
  ['Broomfield Medical', '1 W Flatiron Crossing Dr, Broomfield, CO', 39.9287, -105.1306],
  ['Arista Kitchens', '8001 Arista Pl, Broomfield, CO', 39.9044, -105.0867],
  ['Westminster Parts', '10600 Westminster Blvd, Westminster, CO', 39.8888, -105.0647],
  ['Northgate Pharmacy', '500 W 120th Ave, Westminster, CO', 39.9139, -104.9932],
  ['Arvada Depot Store', '7500 W 57th Ave, Arvada, CO', 39.8018, -105.0813],
  ['Golden Clinic', '17155 W 44th Ave, Golden, CO', 39.7763, -105.1872],
  ['Colfax Parts Counter', '18301 W Colfax Ave, Golden, CO', 39.7392, -105.2038],
  ['Lakewood Supply', '1400 Wadsworth Blvd, Lakewood, CO', 39.7389, -105.0816],
  ['RiNo Fulfillment', '3501 Wazee St, Denver, CO', 39.7685, -104.9781],
  ['Five Points Medical', '2701 Welton St, Denver, CO', 39.7542, -104.9774],
  ['Central Park Foods', '8304 E 49th Ave, Denver, CO', 39.7869, -104.8912],
  ['Stapleton Lab Supply', '7600 E 36th Ave, Denver, CO', 39.7678, -104.9005],
  ['Aurora Pharmacy', '13700 E Colfax Ave, Aurora, CO', 39.7402, -104.8354],
  ['Anschutz Receiving', '13001 E 17th Pl, Aurora, CO', 39.7431, -104.8381],
  ['Buckley Medical', '18500 E 6th Ave, Aurora, CO', 39.7246, -104.7739],
  ['Havana Market', '10400 E Mississippi Ave, Aurora, CO', 39.6962, -104.8646],
  ['Lowry Catering', '7581 E Academy Blvd, Denver, CO', 39.7172, -104.8973],
  ['Cherry Creek Clinic', '3000 E 1st Ave, Denver, CO', 39.7189, -104.9538],
  ['University Catering', '2050 E Evans Ave, Denver, CO', 39.6782, -104.9618],
  ['Englewood Medical', '333 W Hampden Ave, Englewood, CO', 39.6539, -104.9928],
  ['South Broadway Supply', '3400 S Broadway, Englewood, CO', 39.6549, -104.9875],
  ['Littleton Parts', '1500 W Littleton Blvd, Littleton, CO', 39.6134, -105.0041],
  ['Centennial Clinic', '6860 S Yosemite Ct, Centennial, CO', 39.5937, -104.8879],
  ['Tech Center Receiving', '8400 E Crescent Pkwy, Greenwood Village, CO', 39.6177, -104.8921],
  ['Parker Cold Storage', '19751 E Mainstreet, Parker, CO', 39.5186, -104.7607],
  ['Lone Tree Pharmacy', '10099 RidgeGate Pkwy, Lone Tree, CO', 39.5299, -104.8721],
  ['Highlands Ranch Market', '9370 S Colorado Blvd, Highlands Ranch, CO', 39.5478, -104.9391],
  ['Castle Rock Supply', '312 Wilcox St, Castle Rock, CO', 39.3739, -104.8596],
] as const;

function buildMarketingPlannerSeed(serviceDate: string) {
  const vehicleSeed = [
    { id: 'marketing-vehicle-112', licensePlate: 'DEN-112', make: 'Ford', model: 'Transit', currentLocation: { lat: 39.7392, lng: -104.9903 } },
    { id: 'marketing-vehicle-220', licensePlate: 'DEN-220', make: 'Chevy', model: 'Express', currentLocation: { lat: 39.7392, lng: -104.9903 } },
    { id: 'marketing-vehicle-331', licensePlate: 'DEN-331', make: 'Mercedes', model: 'Sprinter', currentLocation: { lat: 39.7392, lng: -104.9903 } },
  ];
  const driverSeed = [
    { id: 'marketing-driver-1', firstName: 'Mara', lastName: 'Ellis' },
    { id: 'marketing-driver-2', firstName: 'Jon', lastName: 'Reed' },
    { id: 'marketing-driver-3', firstName: 'Tess', lastName: 'Carter' },
  ];
  const jobs = marketingStops.map(([customerName, deliveryAddress, lat, lng], index) => ({
    id: `marketing-job-${index + 1}`,
    customerName,
    deliveryAddress,
    priority: index % 9 === 0 ? 'high' : 'normal',
    status: 'pending',
    assignedRouteId: `marketing-route-${Math.floor(index / 10) + 1}`,
    deliveryLocation: { lat, lng },
  })) satisfies PlannerJobRecord[];
  const groups = [0, 1, 2].map((index) => ({
    id: `marketing-route-${index + 1}`,
    routePlanId: 'marketing-plan',
    groupIndex: index + 1,
    label: `DEN-${['112', '220', '331'][index]} Run ${index + 1}`,
    driverId: driverSeed[index].id,
    vehicleId: vehicleSeed[index].id,
    totalDistanceKm: [70.2, 58.4, 64.9][index],
    totalDurationMinutes: [312, 286, 301][index],
    serviceTimeMinutes: 80,
    totalWeightKg: 1200,
    totalVolumeM3: 9.5,
    warnings: [],
  })) satisfies PlannerRoutePlanGroup[];
  const stops = jobs.map((job, index) => ({
    id: `marketing-stop-${index + 1}`,
    routePlanId: 'marketing-plan',
    routePlanGroupId: `marketing-route-${Math.floor(index / 10) + 1}`,
    jobId: job.id,
    jobStopId: `${job.id}-stop`,
    stopSequence: (index % 10) + 1,
    isLocked: index === 0 || index === 14,
    plannedArrival: null,
    plannedDeparture: null,
    metadata: {
      stopType: 'DELIVERY',
      address: job.deliveryAddress,
    },
  })) satisfies PlannerRoutePlanStop[];

  return {
    plan: {
      id: 'marketing-plan',
      serviceDate,
      status: 'draft',
      objective: 'balanced' as OptimizationObjective,
      metrics: {
        routeCount: 3,
        stopCount: 30,
        unassignedJobCount: 0,
      },
      warnings: [],
    } satisfies PlannerRoutePlan,
    jobs,
    vehicles: vehicleSeed as unknown as VehicleRecord[],
    drivers: driverSeed as unknown as DriverRecord[],
    groups,
    stops,
    unassignedJobs: [] as PlannerJobRecord[],
  };
}


export default function RoutingWorkspacePage() {
  const [searchParams] = useSearchParams();
  const scenarioParam = searchParams.get('scenario');
  const captureParam = searchParams.get('capture');
  const frameParam = searchParams.get('frame');
  const forcedFailure = searchParams.get('failure');
  const usesDenverScenarioFormatting =
    captureParam === 'marketing' ||
    scenarioParam === 'clean-route-day' ||
    scenarioParam === 'dense-300-stop-day' ||
    scenarioParam === 'dense-route-day' ||
    scenarioParam === 'empty-route-day' ||
    scenarioParam === 'exception-route-day' ||
    scenarioParam === 'geocode-failure' ||
    scenarioParam === 'loading-route-day' ||
    scenarioParam === 'no-drivers' ||
    scenarioParam === 'no-vehicles' ||
    scenarioParam === 'stale-route-data' ||
    scenarioParam === 'setup-route-day';
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [jobs, setJobs] = useState<PlannerJobRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [plan, setPlan] = useState<PlannerRoutePlan | null>(null);
  const [groups, setGroups] = useState<PlannerRoutePlanGroup[]>([]);
  const [stops, setStops] = useState<PlannerRoutePlanStop[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [unassignedJobs, setUnassignedJobs] = useState<PlannerJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [objective, setObjective] = useState<OptimizationObjective>('balanced');
  const [serviceDate, setServiceDate] = useState(() =>
    searchParams.get('serviceDate') || (searchParams.get('capture') === 'marketing' ? marketingServiceDate : todayServiceDate()),
  );
  const [mode, setMode] = useState<'suggested' | 'manual'>('suggested');
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('jobs');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [density, setDensity] = useState<ViewDensity>(
    () => (searchParams.get('density') === 'compact' ? 'compact' : 'comfortable'),
  );
  const [laneEditorMode, setLaneEditorMode] = useState<LaneEditorMode>('collapsed');
  const [distanceUnitPreference, setDistanceUnitPreference] = useState<RoutingDistanceUnit>(
    () => (usesDenverScenarioFormatting ? 'mi' : 'km'),
  );
  const [dateDisplayPreference, setDateDisplayPreference] = useState<DateDisplayPreference>('readable');
  const [stopSearch, setStopSearch] = useState('');
  const [stopQuickFilter, setStopQuickFilter] = useState<StopQuickFilter>('all');
  const [routeFilterId, setRouteFilterId] = useState('all');
  const [driverFilterId, setDriverFilterId] = useState('all');
  const [vehicleFilterId, setVehicleFilterId] = useState('all');
  const [routeSearch, setRouteSearch] = useState('');
  const [routeQuickFilter, setRouteQuickFilter] = useState<RouteQuickFilter>('all');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleQuickFilter, setVehicleQuickFilter] = useState<VehicleQuickFilter>('all');
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>('selected');
  const [mobilePanel, setMobilePanel] = useState<'map' | 'routes' | 'jobs'>('map');
  const [roadRouteGeometry, setRoadRouteGeometry] = useState<RoadRouteGeometryState>({});
  const [recentMove, setRecentMove] = useState<RecentRouteMove | null>(null);
  const [isExceptionDrawerOpen, setIsExceptionDrawerOpen] = useState(false);
  const [exceptionDecisions, setExceptionDecisions] = useState<
    Record<string, { status: Exclude<RoutingExceptionStatus, 'open'>; reason?: string }>
  >({});
  const [exceptionRiskReasons, setExceptionRiskReasons] = useState<Record<string, string>>({});
  const [isPublishSummaryOpen, setIsPublishSummaryOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator === 'undefined' ? false : !navigator.onLine,
  );
  const [routeVersion, setRouteVersion] = useState<string | null>(null);
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [preferenceStorageKey, setPreferenceStorageKey] = useState<string | null>(() =>
    getRoutingWorkspacePreferenceStorageKey(),
  );
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const isDesktopWorkspace = useMediaQuery('(min-width:1200px)');
  const isMarketingCapture = captureParam === 'marketing';
  const isHeroMarketingCapture = isMarketingCapture && frameParam === 'hero';
  const isDenseProductScenario = !isMarketingCapture && scenarioParam === 'dense-route-day';
  const isDense300ProductScenario = !isMarketingCapture && scenarioParam === 'dense-300-stop-day';
  const isSetupProductScenario = !isMarketingCapture && scenarioParam === 'setup-route-day';
  const isCleanProductScenario = !isMarketingCapture && scenarioParam === 'clean-route-day';
  const isExceptionProductScenario = !isMarketingCapture && scenarioParam === 'exception-route-day';
  const isLoadingStateScenario = !isMarketingCapture && scenarioParam === 'loading-route-day';
  const isEmptyRouteDayScenario = !isMarketingCapture && scenarioParam === 'empty-route-day';
  const isNoVehiclesScenario = !isMarketingCapture && scenarioParam === 'no-vehicles';
  const isNoDriversScenario = !isMarketingCapture && scenarioParam === 'no-drivers';
  const isGeocodeFailureScenario = !isMarketingCapture && scenarioParam === 'geocode-failure';
  const isStaleRouteDataScenario = !isMarketingCapture && scenarioParam === 'stale-route-data';
  const isLocalPlannerScenario =
    isMarketingCapture ||
    isDenseProductScenario ||
    isDense300ProductScenario ||
    isSetupProductScenario ||
    isCleanProductScenario ||
    isExceptionProductScenario ||
    isLoadingStateScenario ||
    isEmptyRouteDayScenario ||
    isNoVehiclesScenario ||
    isNoDriversScenario ||
    isGeocodeFailureScenario ||
    isStaleRouteDataScenario;

  const jobsQuery = useJobsQuery();
  const vehiclesQuery = useVehiclesQuery();
  const driversQuery = useDriversQuery();
  const plannerQuery = usePlannerQuery(serviceDate);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateNetworkStatus = () => {
      setIsOffline(!window.navigator.onLine);
    };
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    if (!isMarketingCapture) return;
    const seed = buildMarketingPlannerSeed(serviceDate);
    setJobs(seed.jobs);
    setVehicles(seed.vehicles);
    setDrivers(seed.drivers);
    setPlan(seed.plan);
    setGroups(seed.groups);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(seed.jobs.map((job) => job.id));
    setSelectedVehicleIds(seed.vehicles.map((vehicle) => vehicle.id));
    setObjective('balanced');
    setMode('manual');
    setLeftPanelTab('routes');
    setDensity('compact');
    setMapDisplayMode('selected');
    setLaneEditorMode(isHeroMarketingCapture ? 'collapsed' : 'expanded');
    setSelectedGroupId(seed.groups[0]?.id || null);
    setSelectedStopId(seed.stops[0]?.id || null);
    setLoading(false);
  }, [isHeroMarketingCapture, isMarketingCapture, serviceDate]);

  useEffect(() => {
    if (!isDenseProductScenario) return;
    const seed = buildDenseRouteDayScenario(serviceDate);
    setJobs(seed.jobs);
    setVehicles(seed.vehicles);
    setDrivers(seed.drivers);
    setPlan(seed.plan);
    setGroups(seed.groups);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(seed.jobs.map((job) => job.id));
    setSelectedVehicleIds(seed.vehicles.map((vehicle) => vehicle.id));
    setObjective('balanced');
    setMode('manual');
    setLeftPanelTab('routes');
    setDensity('compact');
    setMapDisplayMode('selected');
    setLaneEditorMode('expanded');
    setSelectedGroupId(seed.groups[0]?.id || null);
    setSelectedStopId(seed.stops[0]?.id || null);
    setLoading(false);
  }, [isDenseProductScenario, serviceDate]);

  useEffect(() => {
    if (!isDense300ProductScenario) return;
    const seed = buildDense300StopDayScenario(serviceDate);
    setJobs(seed.jobs);
    setVehicles(seed.vehicles);
    setDrivers(seed.drivers);
    setPlan(seed.plan);
    setGroups(seed.groups);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(seed.jobs.map((job) => job.id));
    setSelectedVehicleIds(seed.vehicles.map((vehicle) => vehicle.id));
    setObjective('balanced');
    setMode('manual');
    setLeftPanelTab('routes');
    setDensity('compact');
    setMapDisplayMode('selected');
    setLaneEditorMode('expanded');
    setSelectedGroupId(seed.groups[0]?.id || null);
    setSelectedStopId(seed.stops[0]?.id || null);
    setLoading(false);
  }, [isDense300ProductScenario, serviceDate]);

  useEffect(() => {
    if (!isSetupProductScenario) return;
    const seed = buildSetupRouteDayScenario(serviceDate);
    setJobs(seed.jobs);
    setVehicles(seed.vehicles);
    setDrivers(seed.drivers);
    setPlan(seed.plan);
    setGroups(seed.groups);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(seed.jobs.map((job) => job.id));
    setSelectedVehicleIds(seed.vehicles.map((vehicle) => vehicle.id));
    setObjective('balanced');
    setMode('suggested');
    setLeftPanelTab('jobs');
    setDensity('comfortable');
    setMapDisplayMode('all');
    setLaneEditorMode('collapsed');
    setSelectedGroupId(null);
    setSelectedStopId(null);
    setLoading(false);
  }, [isSetupProductScenario, serviceDate]);

  useEffect(() => {
    if (!isCleanProductScenario) return;
    const seed = buildCleanRouteDayScenario(serviceDate);
    setJobs(seed.jobs);
    setVehicles(seed.vehicles);
    setDrivers(seed.drivers);
    setPlan(seed.plan);
    setGroups(seed.groups);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(seed.jobs.map((job) => job.id));
    setSelectedVehicleIds(seed.vehicles.map((vehicle) => vehicle.id));
    setObjective('balanced');
    setMode('manual');
    setLeftPanelTab('routes');
    setDensity('compact');
    setMapDisplayMode('selected');
    setLaneEditorMode('expanded');
    setSelectedGroupId(seed.groups[0]?.id || null);
    setSelectedStopId(seed.stops[0]?.id || null);
    setLoading(false);
  }, [isCleanProductScenario, serviceDate]);

  useEffect(() => {
    if (!isExceptionProductScenario) return;
    const seed = buildExceptionRouteDayScenario(serviceDate);
    setJobs(seed.jobs);
    setVehicles(seed.vehicles);
    setDrivers(seed.drivers);
    setPlan(seed.plan);
    setGroups(seed.groups);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(seed.jobs.map((job) => job.id));
    setSelectedVehicleIds(seed.vehicles.map((vehicle) => vehicle.id));
    setObjective('balanced');
    setMode('manual');
    setLeftPanelTab('routes');
    setDensity('compact');
    setMapDisplayMode('exceptions');
    setLaneEditorMode('expanded');
    setSelectedGroupId(seed.groups[0]?.id || null);
    setSelectedStopId(seed.stops[0]?.id || null);
    setExceptionDecisions({});
    setExceptionRiskReasons({});
    setIsExceptionDrawerOpen(false);
    setLoading(false);
  }, [isExceptionProductScenario, serviceDate]);

  useEffect(() => {
    if (!isLoadingStateScenario) return;
    setLoading(true);
    setError(null);
  }, [isLoadingStateScenario]);

  useEffect(() => {
    if (!isEmptyRouteDayScenario) return;
    setJobs([]);
    setVehicles([]);
    setDrivers([]);
    setPlan(null);
    setGroups([]);
    setStops([]);
    setUnassignedJobs([]);
    setSelectedJobIds([]);
    setSelectedVehicleIds([]);
    setObjective('balanced');
    setMode('suggested');
    setLeftPanelTab('jobs');
    setDensity('comfortable');
    setMapDisplayMode('all');
    setLaneEditorMode('collapsed');
    setSelectedGroupId(null);
    setSelectedStopId(null);
    setError(null);
    setLoading(false);
  }, [isEmptyRouteDayScenario]);

  useEffect(() => {
    if (!isNoVehiclesScenario) return;
    const seed = buildSetupRouteDayScenario(serviceDate);
    setJobs(seed.jobs);
    setVehicles([]);
    setDrivers(seed.drivers);
    setPlan(seed.plan);
    setGroups(seed.groups);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(seed.jobs.map((job) => job.id));
    setSelectedVehicleIds([]);
    setObjective('balanced');
    setMode('suggested');
    setLeftPanelTab('jobs');
    setDensity('comfortable');
    setMapDisplayMode('all');
    setLaneEditorMode('collapsed');
    setSelectedGroupId(null);
    setSelectedStopId(null);
    setError(null);
    setLoading(false);
  }, [isNoVehiclesScenario, serviceDate]);

  useEffect(() => {
    if (!isNoDriversScenario) return;
    const seed = buildCleanRouteDayScenario(serviceDate);
    const groupsWithoutDrivers = seed.groups.map((group) => ({
      ...group,
      driverId: null,
    }));
    setJobs(seed.jobs);
    setVehicles(seed.vehicles);
    setDrivers([]);
    setPlan(seed.plan);
    setGroups(groupsWithoutDrivers);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(seed.jobs.map((job) => job.id));
    setSelectedVehicleIds(seed.vehicles.map((vehicle) => vehicle.id));
    setObjective('balanced');
    setMode('manual');
    setLeftPanelTab('routes');
    setDensity('compact');
    setMapDisplayMode('selected');
    setLaneEditorMode('expanded');
    setSelectedGroupId(groupsWithoutDrivers[0]?.id || null);
    setSelectedStopId(seed.stops[0]?.id || null);
    setError(null);
    setLoading(false);
  }, [isNoDriversScenario, serviceDate]);

  useEffect(() => {
    if (!isGeocodeFailureScenario) return;
    const seed = buildSetupRouteDayScenario(serviceDate);
    const jobsWithGeocodeIssue = seed.jobs.map((job, index) =>
      index < 2
        ? {
            ...job,
            status: 'geocode_failed',
            deliveryLocation: null,
            pickupLocation: null,
          }
        : job,
    );
    setJobs(jobsWithGeocodeIssue);
    setVehicles(seed.vehicles);
    setDrivers(seed.drivers);
    setPlan(seed.plan);
    setGroups(seed.groups);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(jobsWithGeocodeIssue.map((job) => job.id));
    setSelectedVehicleIds(seed.vehicles.map((vehicle) => vehicle.id));
    setObjective('balanced');
    setMode('suggested');
    setLeftPanelTab('jobs');
    setDensity('comfortable');
    setMapDisplayMode('all');
    setLaneEditorMode('collapsed');
    setSelectedGroupId(null);
    setSelectedStopId(null);
    setError(null);
    setLoading(false);
  }, [isGeocodeFailureScenario, serviceDate]);

  useEffect(() => {
    if (!isStaleRouteDataScenario) return;
    const seed = buildCleanRouteDayScenario(serviceDate);
    setJobs(seed.jobs);
    setVehicles(seed.vehicles);
    setDrivers(seed.drivers);
    setPlan({
      ...seed.plan,
      warnings: [...(seed.plan.warnings || []), 'stale route data'],
    });
    setGroups(seed.groups);
    setStops(seed.stops);
    setUnassignedJobs(seed.unassignedJobs);
    setSelectedJobIds(seed.jobs.map((job) => job.id));
    setSelectedVehicleIds(seed.vehicles.map((vehicle) => vehicle.id));
    setObjective('balanced');
    setMode('manual');
    setLeftPanelTab('routes');
    setDensity('compact');
    setMapDisplayMode('selected');
    setLaneEditorMode('expanded');
    setSelectedGroupId(seed.groups[0]?.id || null);
    setSelectedStopId(seed.stops[0]?.id || null);
    setError(null);
    setLoading(false);
  }, [isStaleRouteDataScenario, serviceDate]);

  useEffect(() => {
    if (isLocalPlannerScenario) return;
    const safeJobs = (jobsQuery.data ?? []) as PlannerJobRecord[];
    const safeVehicles = (vehiclesQuery.data ?? []) as VehicleRecord[];
    const safeDrivers = driversQuery.data ?? [];
    const plannerData = plannerQuery.data;
    if (!plannerData) return;

    setJobs(safeJobs);
    setVehicles(safeVehicles);
    setDrivers(safeDrivers);
    setPlan(plannerData.plan || null);
    setGroups(plannerData.groups || []);
    setStops(plannerData.stops || []);
    setSelectedGroupId((current) =>
      current && (plannerData.groups || []).some((group) => group.id === current)
        ? current
        : plannerData.groups?.[0]?.id || null,
    );
    setUnassignedJobs(plannerData.unassignedJobs || []);

    const seededJobs = searchParams.getAll('jobId');
    setSelectedJobIds((current) =>
      current.length
        ? current
        : seededJobs.length
              ? seededJobs
              : safeJobs
                  .filter((job) => !job.assignedRouteId)
                  .slice(0, 50)
                  .map((job) => job.id),
    );
    setSelectedVehicleIds((current) =>
      current.length ? current : safeVehicles.slice(0, 5).map((vehicle) => vehicle.id),
    );
    if (plannerData.plan?.objective) {
      setObjective(normalizeOptimizationObjective(plannerData.plan.objective));
    }
    setLoading(false);
  }, [
    driversQuery.data,
    isCleanProductScenario,
    isDense300ProductScenario,
    isDenseProductScenario,
    isEmptyRouteDayScenario,
    isExceptionProductScenario,
    isGeocodeFailureScenario,
    isLoadingStateScenario,
    isLocalPlannerScenario,
    isMarketingCapture,
    isNoDriversScenario,
    isNoVehiclesScenario,
    isSetupProductScenario,
    isStaleRouteDataScenario,
    jobsQuery.data,
    plannerQuery.data,
    searchParams,
    vehiclesQuery.data,
  ]);

  useEffect(() => {
    if (isLoadingStateScenario) {
      setLoading(true);
      return;
    }
    if (isLocalPlannerScenario) {
      setLoading(false);
      return;
    }
    if (
      jobsQuery.isLoading ||
      vehiclesQuery.isLoading ||
      driversQuery.isLoading ||
      plannerQuery.isLoading
    ) {
      setLoading(true);
    }
  }, [
    driversQuery.isLoading,
    isCleanProductScenario,
    isEmptyRouteDayScenario,
    isExceptionProductScenario,
    isGeocodeFailureScenario,
    isLoadingStateScenario,
    isLocalPlannerScenario,
    jobsQuery.isLoading,
    plannerQuery.isLoading,
    isDense300ProductScenario,
    isDenseProductScenario,
    isMarketingCapture,
    isNoDriversScenario,
    isNoVehiclesScenario,
    isSetupProductScenario,
    isStaleRouteDataScenario,
    vehiclesQuery.isLoading,
  ]);

  const groupedStops = useMemo<PlannerRouteGroupWithStops[]>(() => {
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    return groups.map((group) => ({
      ...group,
      stops: stops
        .filter((stop) => stop.routePlanGroupId === group.id)
        .sort((left, right) => left.stopSequence - right.stopSequence)
        .map((stop) => ({
          ...stop,
          job: jobsById.get(stop.jobId),
        })),
    }));
  }, [groups, jobs, stops]);

  const unfilteredVisibleGroupedStops = useMemo(() => {
    const visible = isMarketingCapture ? groupedStops.slice(0, 3) : groupedStops;
    return [...visible].sort((left, right) => {
      if (left.id === selectedGroupId) return -1;
      if (right.id === selectedGroupId) return 1;
      return left.groupIndex - right.groupIndex;
    });
  }, [groupedStops, isMarketingCapture, selectedGroupId]);

  const groupById = useMemo(
    () => new Map(groupedStops.map((group) => [group.id, group])),
    [groupedStops],
  );
  const unassignedJobCount = unassignedJobs.length;

  const routeFilteredGroupedStops = useMemo(() => {
    const query = normalizeText(routeSearch);
    return unfilteredVisibleGroupedStops
      .filter((group) => {
        if (query && !normalizeText([group.label, group.id, group.driverId, group.vehicleId].join(' ')).includes(query)) {
          return false;
        }
        if (driverFilterId !== 'all' && group.driverId !== driverFilterId) return false;
        if (vehicleFilterId !== 'all' && group.vehicleId !== vehicleFilterId) return false;
        const hasDriver = Boolean(group.driverId);
        const hasVehicle = Boolean(group.vehicleId);
        const hasException = Boolean(group.warnings?.length) || group.stops.some(hasStopException);
        if (routeQuickFilter === 'ready') return hasDriver && hasVehicle && !hasException && unassignedJobCount === 0;
        if (routeQuickFilter === 'needs-driver') return !hasDriver;
        if (routeQuickFilter === 'needs-vehicle') return !hasVehicle;
        if (routeQuickFilter === 'has-exceptions') return hasException;
        if (routeQuickFilter === 'has-unassigned') return unassignedJobCount > 0;
        return true;
      });
  }, [
    driverFilterId,
    routeQuickFilter,
    routeSearch,
    unfilteredVisibleGroupedStops,
    unassignedJobCount,
    vehicleFilterId,
  ]);

  const selectedGroup =
    groupedStops.find((group) => group.id === selectedGroupId) ||
    groupedStops[0] ||
    null;

  const visibleGroupedStops = routeFilteredGroupedStops;
  const selectedGroupVisibleStops =
    (selectedGroup && visibleGroupedStops.find((group) => group.id === selectedGroup.id)?.stops) ||
    selectedGroup?.stops ||
    [];

  const selectedStop =
    selectedGroup?.stops.find((stop) => stop.id === selectedStopId) ||
    selectedGroup?.stops[0] ||
    null;

  const selectedVehicle = selectedGroup?.vehicleId
    ? vehicles.find((vehicle) => vehicle.id === selectedGroup.vehicleId)
    : null;
  const selectedDriver = selectedGroup?.driverId
    ? drivers.find((driver) => driver.id === selectedGroup.driverId)
    : null;
  const usesDenverDemoFormatting =
    isMarketingCapture ||
    isCleanProductScenario ||
    isDense300ProductScenario ||
    isDenseProductScenario ||
    isEmptyRouteDayScenario ||
    isExceptionProductScenario ||
    isGeocodeFailureScenario ||
    isLoadingStateScenario ||
    isNoDriversScenario ||
    isNoVehiclesScenario ||
    isSetupProductScenario ||
    isStaleRouteDataScenario ||
    isPreview();
  const routeDistanceUnit = distanceUnitPreference;
  const formatDistance = (distanceKm?: number | null) => formatRouteDistance(distanceKm, routeDistanceUnit);
  const serviceDateDisplayValue =
    dateDisplayPreference === 'iso' ? serviceDate : formatPlannerDate(serviceDate);
  const selectedRouteDistance = formatDistance(selectedGroup?.totalDistanceKm);
  const selectedDriverName = selectedDriver
    ? [selectedDriver.firstName, selectedDriver.lastName].filter(Boolean).join(' ') || selectedDriver.id
    : 'Unassigned';
  const selectedVehicleName = selectedVehicle?.licensePlate || selectedVehicle?.id || 'Unassigned';
  const exceptionRecords = useMemo<RoutingExceptionRecord[]>(() => {
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const decisions = exceptionDecisions;
    const statusFor = (id: string): RoutingExceptionStatus => decisions[id]?.status || 'open';
    const reasonFor = (id: string) => decisions[id]?.reason;
    const includeStopExceptions =
      isExceptionProductScenario ||
      (!isDenseProductScenario && !isDense300ProductScenario && !isSetupProductScenario);
    const records: RoutingExceptionRecord[] = [];

    groups.forEach((group) => {
      (group.warnings || []).forEach((warning, index) => {
        const warningText = typeof warning === 'string' ? warning : JSON.stringify(warning);
        const id = `route-warning-${group.id}-${index}`;
        records.push({
          id,
          type: 'Route warning',
          routeId: group.id,
          routeLabel: group.label,
          affectedLabel: group.label,
          severity: 'blocking',
          recommendedAction: warningText || 'Review this route warning before publishing.',
          owner: 'Dispatch',
          status: statusFor(id),
          reason: reasonFor(id),
        });
      });

      const missingDriverId = `missing-driver-${group.id}`;
      if (!group.driverId || decisions[missingDriverId]) {
        records.push({
          id: missingDriverId,
          type: 'Missing driver',
          routeId: group.id,
          routeLabel: group.label,
          affectedLabel: group.label,
          severity: 'blocking',
          recommendedAction: 'Assign an available driver before publishing this route.',
          owner: 'Dispatcher',
          status: group.driverId && decisions[missingDriverId] ? statusFor(missingDriverId) : 'open',
          reason: reasonFor(missingDriverId),
        });
      }

      const missingVehicleId = `missing-vehicle-${group.id}`;
      if (!group.vehicleId || decisions[missingVehicleId]) {
        records.push({
          id: missingVehicleId,
          type: 'Missing vehicle',
          routeId: group.id,
          routeLabel: group.label,
          affectedLabel: group.label,
          severity: 'blocking',
          recommendedAction: 'Assign a vehicle with available capacity before publishing this route.',
          owner: 'Dispatcher',
          status: group.vehicleId && decisions[missingVehicleId] ? statusFor(missingVehicleId) : 'open',
          reason: reasonFor(missingVehicleId),
        });
      }
    });

    if (includeStopExceptions) {
      stops.forEach((stop) => {
        const job = jobsById.get(stop.jobId);
        if (!hasStopException({ ...stop, job })) return;
        const group = groups.find((candidate) => candidate.id === stop.routePlanGroupId);
        if (!group) return;
        const id = `stop-exception-${stop.id}`;
        records.push({
          id,
          type: 'Stop exception',
          routeId: group.id,
          routeLabel: group.label,
          stopId: stop.id,
          affectedLabel: job?.customerName || stop.jobId,
          severity: 'blocking',
          recommendedAction: String(stop.metadata?.exception || 'Confirm the stop can still be serviced.'),
          owner: 'Dispatch',
          status: statusFor(id),
          reason: reasonFor(id),
        });
      });
    }

    return records;
  }, [
    exceptionDecisions,
    groups,
    isDense300ProductScenario,
    isDenseProductScenario,
    isExceptionProductScenario,
    isSetupProductScenario,
    jobs,
    stops,
  ]);
  const openPlanExceptionCount = exceptionRecords.filter((record) => record.status === 'open').length;
  const openExceptionCount = exceptionRecords.filter(
    (record) => record.status === 'open' && record.routeId === selectedGroup?.id,
  ).length;
  const routedStopCount = stops.length;
  const totalJobCount = Math.max(
    jobs.length,
    routedStopCount + unassignedJobCount,
    Number(plan?.metrics?.stopCount || 0) + Number(plan?.metrics?.unassignedJobCount || 0),
  );
  const isPlanPublished = plan?.status === 'published';
  const isRouteLanesReadOnly = Boolean(isPlanPublished && !isRevisionMode);
  const acceptedExceptionCount = exceptionRecords.filter((record) => record.status === 'accepted').length;
  const driversAssignedCount = groups.filter((group) => Boolean(group.driverId)).length;
  const vehiclesAssignedCount = groups.filter((group) => Boolean(group.vehicleId)).length;
  const isEmptyRouteDay =
    !plan?.id &&
    jobs.length === 0 &&
    groups.length === 0 &&
    stops.length === 0 &&
    unassignedJobs.length === 0;
  const hasNoVehicles = !isEmptyRouteDay && vehicles.length === 0;
  const hasNoDrivers = !isEmptyRouteDay && drivers.length === 0;
  const hasAddressGeocodeFailure =
    !isEmptyRouteDay &&
    jobs.some((job) => {
      const hasAddress = Boolean(job.deliveryAddress || job.pickupAddress);
      const hasLocation = Boolean(job.deliveryLocation || job.pickupLocation);
      return hasAddress && (!hasLocation || normalizeText(job.status).includes('geocode'));
    });
  const hasStaleRouteDataWarning =
    isStaleRouteDataScenario || normalizeText(plan?.warnings).includes('stale');
  const hasUnassignedBlocker = Boolean(plan?.id) && unassignedJobCount > 0;
  const hasBlockingExceptions = Boolean(plan?.id) && openPlanExceptionCount > 0;
  const primaryActionLabel = !plan?.id
    ? 'Generate route draft'
    : isPlanPublished && !isRevisionMode
      ? 'Published'
    : hasUnassignedBlocker
      ? 'Resolve unassigned'
      : hasBlockingExceptions
        ? 'Review exceptions'
        : 'Publish plan';
  const planStatusLabel = !plan?.id
    ? 'Needs setup'
    : isPlanPublished && !isRevisionMode
      ? 'Published'
    : hasUnassignedBlocker
      ? 'Resolve unassigned'
      : hasBlockingExceptions
        ? 'Review exceptions'
        : 'Ready to publish';
  const planStatusTone = !plan?.id
    ? 'default'
    : isPlanPublished && !isRevisionMode
      ? 'success'
    : hasUnassignedBlocker || hasBlockingExceptions
      ? 'warning'
      : 'success';
  const effectivePreferenceStorageKey = isMarketingCapture ? null : preferenceStorageKey;

  useEffect(() => {
    if (!plan?.id) {
      setLeftPanelTab('jobs');
      setLaneEditorMode('collapsed');
      return;
    }
    setLeftPanelTab((current) => (current === 'jobs' ? 'routes' : current));
    setLaneEditorMode((current) => (current === 'collapsed' ? 'expanded' : current));
  }, [plan?.id]);

  useEffect(() => {
    const nextStorageKey = getRoutingWorkspacePreferenceStorageKey();
    setPreferenceStorageKey((current) => (current === nextStorageKey ? current : nextStorageKey));
  }, [searchParams]);

  useEffect(() => {
    setPreferencesHydrated(false);
  }, [effectivePreferenceStorageKey]);

  useEffect(() => {
    if (loading || isMarketingCapture) return;
    const preferences = readRoutingWorkspacePreferences(effectivePreferenceStorageKey);
    if (preferences?.density) setDensity(preferences.density);
    if (preferences?.laneEditorMode) setLaneEditorMode(preferences.laneEditorMode);
    if (preferences?.mapDisplayMode) setMapDisplayMode(preferences.mapDisplayMode);
    if (preferences?.leftPanelTab) setLeftPanelTab(preferences.leftPanelTab);
    if (preferences?.distanceUnit) setDistanceUnitPreference(preferences.distanceUnit);
    if (preferences?.dateDisplayPreference) setDateDisplayPreference(preferences.dateDisplayPreference);
    setPreferencesHydrated(true);
  }, [effectivePreferenceStorageKey, isMarketingCapture, loading, plan?.id]);

  useEffect(() => {
    if (!preferencesHydrated || isMarketingCapture) return;
    writeRoutingWorkspacePreferences(effectivePreferenceStorageKey, {
      density,
      laneEditorMode,
      mapDisplayMode,
      leftPanelTab,
      distanceUnit: distanceUnitPreference,
      dateDisplayPreference,
    });
  }, [
    dateDisplayPreference,
    density,
    distanceUnitPreference,
    effectivePreferenceStorageKey,
    isMarketingCapture,
    laneEditorMode,
    leftPanelTab,
    mapDisplayMode,
    preferencesHydrated,
  ]);

  useEffect(() => {
    if (!isMarketingCapture) return;
    setDensity('compact');
    setLaneEditorMode(isHeroMarketingCapture ? 'collapsed' : 'expanded');
    setLeftPanelTab('routes');
    if (groupedStops.length) {
      setMode('manual');
      setSelectedGroupId((current) => {
        const visible = groupedStops.slice(0, 3);
        return current && visible.some((group) => group.id === current) ? current : visible[0]?.id || current;
      });
    }
  }, [groupedStops, isHeroMarketingCapture, isMarketingCapture]);

  useEffect(() => {
    if (!selectedGroup?.stops.length) {
      setSelectedStopId(null);
      return;
    }
    setSelectedStopId((current) =>
      current && selectedGroup.stops.some((stop) => stop.id === current)
        ? current
        : selectedGroup.stops[0]?.id || null,
    );
  }, [selectedGroup?.id, selectedGroup?.stops]);

  useEffect(() => {
    if (!recentMove) return undefined;
    const timer = window.setTimeout(() => setRecentMove(null), 11000);
    return () => window.clearTimeout(timer);
  }, [recentMove]);

  const refreshPlanView = (payload: PlannerWorkspacePayload) => {
    setPlan(payload.routePlan || payload.plan || null);
    setGroups(payload.groups || []);
    setStops(payload.stops || []);
    setUnassignedJobs(payload.unassignedJobs || []);
    setSelectedGroupId((current) =>
      current && (payload.groups || []).some((group) => group.id === current)
        ? current
        : payload.groups?.[0]?.id || null,
    );
  };

  const baseMapRoutes = useMemo(
    () =>
      buildPlannerMapRoutes({
        groups,
        stops,
        jobs,
        drivers,
        vehicles,
      }),
    [drivers, groups, jobs, stops, vehicles],
  );

  const roadRouteRequests = useMemo(
    () => {
      if (isDenseProductScenario || isDense300ProductScenario || isCleanProductScenario || isExceptionProductScenario) return [];
      return baseMapRoutes
        .map((route) => {
          const points = route.polyline?.coordinates?.filter(
            ([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat),
          ) as RoadRoutePoint[] | undefined;
          if (!points || points.length < 2) return null;
          return {
            routeId: route.id,
            points,
            signature: getRoadRouteSignature(points),
          };
        })
        .filter(Boolean) as Array<{
        routeId: string;
        points: RoadRoutePoint[];
        signature: string;
      }>;
    },
    [baseMapRoutes, isCleanProductScenario, isDense300ProductScenario, isDenseProductScenario, isExceptionProductScenario],
  );

  const roadRouteRequestSignature = useMemo(
    () =>
      roadRouteRequests
        .map((request) => `${request.routeId}:${request.signature}`)
        .join('|'),
    [roadRouteRequests],
  );

  useEffect(() => {
    if (!roadRouteRequests.length) {
      setRoadRouteGeometry({});
      return;
    }

    const controller = new AbortController();
    let isCurrent = true;

    Promise.allSettled(
      roadRouteRequests.map(async (request) => {
        const coordinates = await fetchRoadRoutePolyline(request.points, controller.signal);
        return coordinates
          ? {
              routeId: request.routeId,
              signature: request.signature,
              coordinates,
            }
          : null;
      }),
    ).then((results) => {
      if (!isCurrent) return;
      const nextGeometry: RoadRouteGeometryState = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          nextGeometry[result.value.routeId] = {
            signature: result.value.signature,
            coordinates: result.value.coordinates,
          };
        }
      });
      setRoadRouteGeometry(nextGeometry);
    });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [roadRouteRequestSignature, roadRouteRequests]);

  const mapRoutes = useMemo(
    () =>
      baseMapRoutes.map((route): OpsMapRoute => {
        const points = route.polyline?.coordinates as RoadRoutePoint[] | undefined;
        const signature = points?.length ? getRoadRouteSignature(points) : '';
        const roadGeometry = roadRouteGeometry[route.id];
        const sourceGroup = groupById.get(route.id);
        const hasException =
          Boolean(sourceGroup?.warnings?.length) ||
          Boolean(sourceGroup?.stops.some(hasStopException)) ||
          Boolean(route.stops?.some((stop) => stop.hasException || stop.isLateRisk || stop.isBlocking));
        if (!roadGeometry || roadGeometry.signature !== signature) {
          return {
            ...route,
            hasException,
          };
        }
        return {
          ...route,
          hasException,
          polyline: {
            coordinates: roadGeometry.coordinates,
          },
        };
      }),
    [baseMapRoutes, groupById, roadRouteGeometry],
  );

  const displayedMapRoutes = useMemo(() => {
    const scopedRoutes = isMarketingCapture
      ? mapRoutes.filter((route) => new Set(unfilteredVisibleGroupedStops.map((group) => group.id)).has(route.id))
      : mapRoutes;
    if (mapDisplayMode === 'exceptions') {
      return scopedRoutes.filter((route) => route.hasException || route.id === selectedGroupId);
    }
    return scopedRoutes;
  }, [isMarketingCapture, mapDisplayMode, mapRoutes, selectedGroupId, unfilteredVisibleGroupedStops]);

  const handleGenerate = async () => {
    setSaving(true);
    setError(null);
    try {
      if (forcedFailure === 'optimizer') {
        throw new Error('Optimizer failed to generate a route draft. Review selected jobs, vehicles, constraints, and address quality before retrying.');
      }
      const payload = await generateDraftRoutePlan({
        serviceDate,
        objective,
        jobIds: selectedJobIds,
        vehicleIds: selectedVehicleIds,
      });
      refreshPlanView(payload);
      setMode('manual');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Optimizer failed to generate a route draft. Review constraints and retry.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReoptimize = async () => {
    if (!plan?.id) return;
    setSaving(true);
    setError(null);
    try {
      const payload = await reoptimizeRoutePlan(plan.id);
      refreshPlanView(payload);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reoptimize plan.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!plan?.id) return;
    if (hasUnassignedBlocker) {
      handleResolveUnassigned();
      return;
    }
    if (hasBlockingExceptions) {
      handleReviewExceptions();
      return;
    }
    setIsPublishSummaryOpen(true);
  };

  const handleConfirmPublish = async () => {
    if (!plan?.id) return;
    const nextVersion = nextRouteVersion(routeVersion);
    setSaving(true);
    setError(null);
    try {
      if (forcedFailure === 'publish') {
        throw new Error('Publish failed. Dispatch handoff was not created; retry before sending routes to drivers.');
      }
      if (!isLocalPlannerScenario) {
        await publishRoutePlan(plan.id);
      }
      setPlan((current) => (current ? { ...current, status: 'published' } : current));
      setRouteVersion(nextVersion);
      setIsRevisionMode(false);
      setIsPublishSummaryOpen(false);
      setLaneEditorMode('expanded');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Publish failed. Dispatch handoff was not created; retry before sending routes to drivers.'));
    } finally {
      setSaving(false);
    }
  };

  const handleStartRevision = () => {
    setIsRevisionMode(true);
    setPlan((current) => (current ? { ...current, status: 'draft' } : current));
    setLaneEditorMode('expanded');
  };

  const handleResolveUnassigned = () => {
    setLeftPanelTab('jobs');
    setStopQuickFilter('unassigned');
    setMobilePanel('jobs');
  };

  const handleReviewExceptions = () => {
    const firstOpenException = exceptionRecords.find((exception) => exception.status === 'open');
    const exceptionGroup = firstOpenException
      ? groupedStops.find((group) => group.id === firstOpenException.routeId)
      : groupedStops.find((group) => group.warnings?.length || group.stops.some(hasStopException));
    if (exceptionGroup) {
      setSelectedGroupId(exceptionGroup.id);
    }
    if (firstOpenException?.stopId) {
      setSelectedStopId(firstOpenException.stopId);
    }
    setInspectorTab('exceptions');
    setMapDisplayMode('exceptions');
    setMobilePanel('routes');
    setIsExceptionDrawerOpen(true);
  };

  const setExceptionDecision = (
    exceptionId: string,
    status: Exclude<RoutingExceptionStatus, 'open'>,
    reason?: string,
  ) => {
    setInspectorTab('overview');
    setExceptionDecisions((current) => ({
      ...current,
      [exceptionId]: {
        status,
        reason,
      },
    }));
  };

  const handleResolveException = (exceptionId: string) => {
    setExceptionDecision(exceptionId, 'resolved');
  };

  const handleAcceptExceptionRisk = (exceptionId: string) => {
    const reason = (exceptionRiskReasons[exceptionId] || '').trim();
    if (reason.length < 4) return;
    setExceptionDecision(exceptionId, 'accepted', reason);
  };

  const handleJumpToException = (exception: RoutingExceptionRecord) => {
    setSelectedGroupId(exception.routeId);
    if (exception.stopId) {
      setSelectedStopId(exception.stopId);
    }
    setMapDisplayMode('selected');
    setLeftPanelTab('routes');
    setMobilePanel('routes');
  };

  const handleAssignExceptionDriver = (routeId: string) => {
    const group = groups.find((candidate) => candidate.id === routeId);
    const availableDriver =
      drivers.find((driver) => !groups.some((candidate) => candidate.driverId === driver.id)) ||
      drivers[0];
    if (!group || !availableDriver) return;
    if (isLocalPlannerScenario) {
      setGroups((current) =>
        current.map((candidate) =>
          candidate.id === routeId ? { ...candidate, driverId: availableDriver.id } : candidate,
        ),
      );
      setExceptionDecision(`missing-driver-${routeId}`, 'resolved');
      return;
    }
    void updateAssignments(routeId, {
      driverId: availableDriver.id,
      vehicleId: group.vehicleId || undefined,
    });
    setExceptionDecision(`missing-driver-${routeId}`, 'resolved');
  };

  const handleAssignExceptionVehicle = (routeId: string) => {
    const group = groups.find((candidate) => candidate.id === routeId);
    const availableVehicle =
      vehicles.find((vehicle) => !groups.some((candidate) => candidate.vehicleId === vehicle.id)) ||
      vehicles[0];
    if (!group || !availableVehicle) return;
    if (isLocalPlannerScenario) {
      setGroups((current) =>
        current.map((candidate) =>
          candidate.id === routeId ? { ...candidate, vehicleId: availableVehicle.id } : candidate,
        ),
      );
      setExceptionDecision(`missing-vehicle-${routeId}`, 'resolved');
      return;
    }
    void updateAssignments(routeId, {
      driverId: group.driverId || undefined,
      vehicleId: availableVehicle.id,
    });
    setExceptionDecision(`missing-vehicle-${routeId}`, 'resolved');
  };

  const handleSaveDraft = async () => {
    if (!plan?.id) return;
    setSaving(true);
    setError(null);
    try {
      if (forcedFailure === 'save-draft') {
        throw new Error('Save draft failed. Your route changes were not saved; retry before leaving planning.');
      }
      await plannerQuery.refetch();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Save draft failed. Your route changes were not saved; retry before leaving planning.'));
    } finally {
      setSaving(false);
    }
  };

  const updateAssignments = async (
    groupId: string,
    payload: { driverId?: string; vehicleId?: string },
  ) => {
    if (!plan?.id) return;
    if (isLocalPlannerScenario) {
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                driverId: payload.driverId ?? group.driverId,
                vehicleId: payload.vehicleId ?? group.vehicleId,
              }
            : group,
        ),
      );
      setSelectedGroupId(groupId);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateRoutePlanGroup(plan.id, groupId, payload);
      refreshPlanView(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update route assignment.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStopLock = async (stopId: string, isLocked: boolean) => {
    if (!plan?.id) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateRoutePlanStop(plan.id, stopId, {
        isLocked: !isLocked,
      });
      refreshPlanView(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update stop lock.'));
    } finally {
      setSaving(false);
    }
  };

  const setRouteOrderProtection = async (locked: boolean) => {
    if (!plan?.id || !selectedGroup?.stops.length) return;
    setSaving(true);
    setError(null);
    try {
      let latest: PlannerWorkspacePayload | null = null;
      for (const stop of selectedGroup.stops) {
        if (stop.isLocked === locked) continue;
        latest = await updateRoutePlanStop(plan.id, stop.id, { isLocked: locked });
      }
      if (latest) {
        refreshPlanView(latest);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update route lock protection.'));
    } finally {
      setSaving(false);
    }
  };

  const estimateGroupDistanceKm = (
    group: PlannerRoutePlanGroup,
    nextStops: PlannerRoutePlanStop[],
    nextJobs: PlannerJobRecord[],
  ) => {
    const jobsById = new Map(nextJobs.map((job) => [job.id, job]));
    const vehicle = vehicles.find((candidate) => candidate.id === group.vehicleId);
    const routePoints = nextStops
      .filter((stop) => stop.routePlanGroupId === group.id)
      .sort((left, right) => left.stopSequence - right.stopSequence)
      .map((stop) => {
        const job = jobsById.get(stop.jobId);
        return job?.deliveryLocation || job?.pickupLocation || null;
      })
      .filter(Boolean) as Array<{ lat: number; lng: number }>;
    const points = vehicle?.currentLocation ? [vehicle.currentLocation, ...routePoints] : routePoints;
    const distance = points.reduce((total, point, index) => {
      if (index === 0) return total;
      return total + distanceBetweenKm(points[index - 1], point);
    }, 0);
    return Number(Math.max(distance, 0).toFixed(1));
  };

  const applyLocalStopMove = ({
    stopId,
    sourceGroupId,
    targetGroupId,
    targetIndex,
  }: RouteStopMoveRequest) => {
    const movingStop = stops.find((stop) => stop.id === stopId);
    if (!movingStop || movingStop.isLocked) {
      return false;
    }

    const resequencedByGroup = new Map<string, PlannerRoutePlanStop[]>();

    if (sourceGroupId === targetGroupId) {
      const sameGroupStops = stops
        .filter((stop) => stop.routePlanGroupId === sourceGroupId)
        .sort((left, right) => left.stopSequence - right.stopSequence);
      const currentIndex = sameGroupStops.findIndex((stop) => stop.id === stopId);
      if (currentIndex < 0) {
        return false;
      }
      const [movedStop] = sameGroupStops.splice(currentIndex, 1);
      const boundedTargetIndex = Math.max(0, Math.min(targetIndex, sameGroupStops.length));
      sameGroupStops.splice(boundedTargetIndex, 0, movedStop);
      resequencedByGroup.set(
        sourceGroupId,
        sameGroupStops.map((stop, index) => ({ ...stop, stopSequence: index + 1 })),
      );
    } else {
      const sourceStops = stops
        .filter((stop) => stop.routePlanGroupId === sourceGroupId && stop.id !== stopId)
        .sort((left, right) => left.stopSequence - right.stopSequence);
      const targetStops = stops
        .filter((stop) => stop.routePlanGroupId === targetGroupId && stop.id !== stopId)
        .sort((left, right) => left.stopSequence - right.stopSequence);
      const boundedTargetIndex = Math.max(0, Math.min(targetIndex, targetStops.length));
      const movedStop = {
        ...movingStop,
        routePlanGroupId: targetGroupId,
      };

      targetStops.splice(boundedTargetIndex, 0, movedStop);
      resequencedByGroup.set(
        sourceGroupId,
        sourceStops.map((stop, index) => ({ ...stop, stopSequence: index + 1 })),
      );
      resequencedByGroup.set(
        targetGroupId,
        targetStops.map((stop, index) => ({ ...stop, stopSequence: index + 1 })),
      );
    }

    const resequencedStopsById = new Map(
      [...resequencedByGroup.values()].flat().map((stop) => [stop.id, stop]),
    );
    const nextStops = stops.map((stop) => resequencedStopsById.get(stop.id) || stop);
    const nextJobs = jobs.map((job) =>
      job.id === movingStop.jobId ? { ...job, assignedRouteId: targetGroupId } : job,
    );
    const nextGroups = groups.map((group) =>
      group.id === sourceGroupId || group.id === targetGroupId
        ? {
            ...group,
            totalDistanceKm: estimateGroupDistanceKm(group, nextStops, nextJobs),
          }
        : group,
    );

    setStops(nextStops);
    setJobs(nextJobs);
    setGroups(nextGroups);
    setSelectedGroupId(targetGroupId);
    setSelectedStopId(stopId);
    setRecentMove({ stopId, sourceGroupId, targetGroupId });
    setMode('manual');
    return true;
  };

  const moveStop = async (request: RouteStopMoveRequest) => {
    if (!plan?.id) {
      setRecentMove(null);
      return;
    }
    if (request.sourceGroupId === request.targetGroupId) {
      const currentIndex = stops
        .filter((stop) => stop.routePlanGroupId === request.sourceGroupId)
        .sort((left, right) => left.stopSequence - right.stopSequence)
        .findIndex((stop) => stop.id === request.stopId);
      if (currentIndex === request.targetIndex) {
        return;
      }
    }
    if (isLocalPlannerScenario) {
      applyLocalStopMove(request);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await updateRoutePlanStop(plan.id, request.stopId, {
        targetGroupId: request.targetGroupId,
        targetSequence: request.targetIndex + 1,
      });
      refreshPlanView(response);
      setSelectedGroupId(request.targetGroupId);
      setSelectedStopId(request.stopId);
      setRecentMove({
        stopId: request.stopId,
        sourceGroupId: request.sourceGroupId,
        targetGroupId: request.targetGroupId,
      });
      setMode('manual');
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          'Failed to move this stop. Regenerate or publish the draft if the planner is out of sync.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !plan?.id) {
      setRecentMove(null);
      return;
    }
    await moveStop({
      stopId: result.draggableId,
      sourceGroupId: result.source.droppableId,
      targetGroupId: result.destination.droppableId,
      targetIndex: result.destination.index,
    });
  };

  const filteredVehicles = useMemo(() => {
    const query = normalizeText(vehicleSearch);
    return vehicles.filter((vehicle) => {
      const assignedGroup = groupedStops.find((group) => group.vehicleId === vehicle.id);
      const searchText = normalizeText([
        vehicle.licensePlate,
        vehicle.make,
        vehicle.model,
        vehicle.id,
        assignedGroup?.label,
      ].join(' '));
      if (query && !searchText.includes(query)) return false;
      if (vehicleQuickFilter === 'available') return !assignedGroup;
      if (vehicleQuickFilter === 'assigned') return Boolean(assignedGroup);
      if (vehicleQuickFilter === 'driver-missing') return Boolean(assignedGroup && !assignedGroup.driverId);
      if (vehicleQuickFilter === 'capacity-issue') {
        return normalizeText(assignedGroup?.warnings).includes('capacity');
      }
      return true;
    });
  }, [groupedStops, vehicleQuickFilter, vehicleSearch, vehicles]);

  if (loading || (!isLocalPlannerScenario && plannerQuery.isLoading)) {
    return <RoutingWorkspaceSkeleton />;
  }

  const demandJobs = jobs
    .filter((job) => {
      const query = normalizeText(stopSearch);
      if (query && !jobSearchText(job).includes(query)) return false;
      const jobGroup = job.assignedRouteId ? groupById.get(job.assignedRouteId) : null;
      if (routeFilterId !== 'all' && job.assignedRouteId !== routeFilterId) return false;
      if (driverFilterId !== 'all' && jobGroup?.driverId !== driverFilterId) return false;
      if (vehicleFilterId !== 'all' && jobGroup?.vehicleId !== vehicleFilterId) return false;
      return jobMatchesQuickFilter(job, stopQuickFilter);
    })
    .slice(0, isMarketingCapture ? 6 : 50);

  const commandBar = (
    <OpsCommandBar
      eyebrow="Planning"
      title="Routing"
      subtitle="Plan the route day, resolve blockers, then publish clean lanes."
      sx={{ p: 1.1, gap: 0.85 }}
      actions={
        plan?.id ? (
          isPlanPublished && !isRevisionMode ? (
            <StatusPill label="Dispatch handoff ready" tone="success" />
          ) : (
            <>
              <Button
                variant="contained"
                onClick={
                  hasUnassignedBlocker
                    ? handleResolveUnassigned
                    : hasBlockingExceptions
                      ? handleReviewExceptions
                      : handlePublish
                }
                disabled={saving}
                data-testid={
                  hasUnassignedBlocker
                    ? 'routing-resolve-unassigned-button'
                    : hasBlockingExceptions
                      ? 'routing-review-exceptions-button'
                      : 'routing-publish-button'
                }
              >
                {primaryActionLabel}
              </Button>
              <Button variant="outlined" onClick={handleReoptimize} disabled={saving}>
                Reoptimize plan
              </Button>
              <Button variant="text" onClick={handleSaveDraft} disabled={saving}>
                Save draft
              </Button>
            </>
          )
        ) : (
          <>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={saving || selectedJobIds.length === 0 || selectedVehicleIds.length === 0}
              data-testid="routing-generate-draft-button"
            >
              {primaryActionLabel}
            </Button>
            <Button variant="outlined" onClick={() => setMode('manual')}>
              Manual setup
            </Button>
          </>
        )
      }
      filters={
        <>
          <TextField
            size="small"
            label="Service date"
            type={!usesDenverDemoFormatting && dateDisplayPreference === 'iso' ? 'date' : undefined}
            value={
              !usesDenverDemoFormatting && dateDisplayPreference === 'iso'
                ? serviceDate
                : serviceDateDisplayValue
            }
            onChange={(event) => {
              if (!usesDenverDemoFormatting && dateDisplayPreference === 'iso') {
                setServiceDate(event.target.value);
              }
            }}
            InputProps={{
              readOnly: usesDenverDemoFormatting || dateDisplayPreference === 'readable',
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 142 }}
          />
          <TextField
            select
            size="small"
            label="Objective"
            value={objective}
            onChange={(event) => setObjective(normalizeOptimizationObjective(event.target.value))}
	            sx={{ minWidth: 136 }}
	          >
            {objectives.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Units"
            value={distanceUnitPreference}
            onChange={(event) => setDistanceUnitPreference(event.target.value as RoutingDistanceUnit)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 116 }}
          >
            <MenuItem value="mi">Miles</MenuItem>
            <MenuItem value="km">Kilometers</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Date display"
            value={dateDisplayPreference}
            onChange={(event) => setDateDisplayPreference(event.target.value as DateDisplayPreference)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 146 }}
          >
            <MenuItem value="readable">Readable date</MenuItem>
            <MenuItem value="iso">ISO date</MenuItem>
          </TextField>
	          <SurfacePanel
	            variant="subtle"
	            padding={0.35}
	            data-testid="routing-secondary-controls"
	            sx={{ display: 'flex', alignItems: 'center', gap: 0.55, borderRadius: 1 }}
	          >
	            <ToggleButtonGroup
	              size="small"
	              exclusive
	              value={mode}
	              onChange={(_, value) => value && setMode(value)}
	              sx={{
	                '& .MuiToggleButton-root': {
	                  px: 0.8,
	                  py: 0.42,
	                  textTransform: 'none',
	                },
	              }}
	            >
	              <ToggleButton value="suggested">Auto plan</ToggleButton>
	              <ToggleButton value="manual">Manual edit</ToggleButton>
	            </ToggleButtonGroup>
	            <DensityToggle density={density} onChange={setDensity} />
	          </SurfacePanel>
	        </>
	      }
	      meta={
	        <RouteDaySummaryBar
	          totalJobCount={totalJobCount}
	          routedStopCount={routedStopCount}
	          routeCount={groups.length}
	          unassignedCount={unassignedJobCount}
	          openExceptionCount={openPlanExceptionCount}
	          hasPlan={Boolean(plan)}
            routeDayStatusLabel={planStatusLabel}
            routeDayStatusTone={planStatusTone}
          isPreviewPlanner={isPreview()}
        />
      }
    />
  );

  const workspaceStateAlerts = (
    <Stack spacing={1}>
      {isEmptyRouteDay ? (
        <SurfacePanel
          variant="panel"
          padding={1.25}
          data-testid="routing-empty-route-day-state"
          sx={{
            borderColor: 'warning.main',
            bgcolor: alpha(isDark ? '#352512' : '#FFF4E1', isDark ? 0.28 : 0.72),
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>
                No route day loaded
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Import jobs, select a service date with work, or connect an order source before route planning.
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => setLeftPanelTab('jobs')}>
              Open jobs
            </Button>
          </Stack>
        </SurfacePanel>
      ) : null}
      {hasNoVehicles ? (
        <Alert
          severity="warning"
          data-testid="routing-no-vehicles-state"
          action={
            <Button color="inherit" size="small" onClick={() => setLeftPanelTab('vehicles')}>
              Vehicles
            </Button>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
            No vehicles available
          </Typography>
          <Typography variant="body2">
            Add or activate vehicles before generating a route draft. Vehicle capacity and assignment are required for dispatch-ready lanes.
          </Typography>
        </Alert>
      ) : null}
      {hasNoDrivers ? (
        <Alert
          severity="warning"
          data-testid="routing-no-drivers-state"
          action={
            <Button color="inherit" size="small" onClick={() => setLeftPanelTab('routes')}>
              Routes
            </Button>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
            No drivers available
          </Typography>
          <Typography variant="body2">
            Assign or invite drivers before publishing. Routes without drivers stay in review until ownership is resolved.
          </Typography>
        </Alert>
      ) : null}
      {hasAddressGeocodeFailure ? (
        <Alert severity="error" data-testid="routing-geocode-failure-warning">
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
            Address issue detected
          </Typography>
          <Typography variant="body2">
            Some jobs are missing usable coordinates. Fix failed geocodes before trusting route distance, sequence, or ETA output.
          </Typography>
        </Alert>
      ) : null}
      {hasStaleRouteDataWarning ? (
        <Alert severity="warning" data-testid="routing-stale-data-warning">
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
            Route data may be stale
          </Typography>
          <Typography variant="body2">
            Refresh route data before publishing so dispatch receives the latest jobs, assignments, and exception state.
          </Typography>
        </Alert>
      ) : null}
      {isOffline ? (
        <Alert severity="warning" data-testid="routing-offline-warning">
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
            Offline
          </Typography>
          <Typography variant="body2">
            Network connection is interrupted. Keep reviewing routes, but save and publish actions may fail until the connection returns.
          </Typography>
        </Alert>
      ) : null}
    </Stack>
  );

  const jobsPanel = (
    <SurfacePanel variant="panel" padding={0} sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 1.15, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Unassigned jobs</Typography>
        <Typography variant="body2" color="text.secondary">
          Select work for the next draft. Manual moves stay visually tied to route lanes.
        </Typography>
      </Box>
      <List disablePadding sx={{ maxHeight: { xs: 420, xl: '32vh' }, overflowY: 'auto' }}>
        {demandJobs.length === 0 ? (
          <ListItem sx={{ py: 2 }}>
            <ListItemText
              primary="No jobs match the active filters"
              secondary="Clear the search or filters to show more stops."
            />
          </ListItem>
        ) : demandJobs.map((job, index) => {
          const selected = selectedJobIds.includes(job.id);
          return (
            <ListItem key={job.id} disablePadding>
              <ListItemButton
                onClick={() =>
                  setSelectedJobIds((current) =>
                    current.includes(job.id)
                      ? current.filter((id) => id !== job.id)
                      : [...current, job.id],
                  )
                }
                data-testid={`routing-job-row-${index}`}
                sx={{ gap: 1, py: 0.85, px: 1.1 }}
              >
                <Checkbox
                  edge="start"
                  checked={selected}
                  tabIndex={-1}
                  disableRipple
                  data-testid={`routing-job-checkbox-${index}`}
                  sx={{ p: 0.45 }}
                />
                <ListItemText
                  primary={job.customerName || 'Job'}
                  secondary={job.deliveryAddress || job.pickupAddress || 'Address pending'}
                  primaryTypographyProps={{ fontWeight: 750, noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
                <StatusPill
                  label={getPriorityLabel(job.priority)}
                  tone={isHighPriority(job.priority) ? 'warning' : 'default'}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </SurfacePanel>
  );

  const draftRoutesPanel = (
    <SurfacePanel variant="panel" padding={0} sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 1.15, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Routes</Typography>
        <Typography variant="body2" color="text.secondary">
          Click a lane to focus the inspector and map.
        </Typography>
      </Box>
      <List disablePadding sx={{ maxHeight: { xs: 420, xl: '26vh' }, overflowY: 'auto' }}>
        {groups.length === 0 ? (
          <ListItem sx={{ py: 2 }}>
            <ListItemText
              primary="No draft routes yet"
              secondary="Generate a route draft to begin manual edits."
            />
          </ListItem>
        ) : visibleGroupedStops.length === 0 ? (
          <ListItem sx={{ py: 2 }}>
            <ListItemText
              primary="No routes match the active filters"
              secondary="Clear search, route, driver, or vehicle filters to show route lanes."
            />
          </ListItem>
        ) : (
          visibleGroupedStops.map((group) => (
            <ListItem key={group.id} disablePadding>
              <ListItemButton
                selected={group.id === selectedGroup?.id}
                onClick={() => setSelectedGroupId(group.id)}
                sx={{
                  py: 0.95,
                  px: 1.2,
                  borderLeft: group.id === selectedGroup?.id ? '3px solid #B97129' : '3px solid transparent',
                }}
              >
                <ListItemText
                  primary={group.label}
                  secondary={`${group.stops.length} stops • ${formatDistance(group.totalDistanceKm)}`}
                  primaryTypographyProps={{ fontWeight: 800, noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
                <StatusPill
                  label={group.vehicleId ? 'Assigned' : 'Needs vehicle'}
                  tone={group.vehicleId ? 'success' : 'warning'}
                />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>
    </SurfacePanel>
  );

  const vehiclesPanel = (
    <SurfacePanel variant="subtle" padding={1.4} data-testid="routing-vehicle-list-panel">
      <Typography variant="h6" sx={{ mb: 1 }}>
        Vehicle list
      </Typography>
      <Stack spacing={0.55} sx={{ maxHeight: { xl: '19vh' }, overflowY: 'auto' }}>
        {filteredVehicles.slice(0, 12).map((vehicle, index) => (
          <Box
            key={vehicle.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              py: 0.25,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                {vehicle.licensePlate || vehicle.id}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {vehicle.make || 'Vehicle'} {vehicle.model || ''}
              </Typography>
            </Box>
            <Checkbox
              checked={selectedVehicleIds.includes(vehicle.id)}
              onChange={() =>
                setSelectedVehicleIds((current) =>
                  current.includes(vehicle.id)
                    ? current.filter((id) => id !== vehicle.id)
                    : [...current, vehicle.id],
                )
              }
              data-testid={`routing-vehicle-checkbox-${index}`}
              sx={{ p: 0.45 }}
            />
          </Box>
        ))}
        {filteredVehicles.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No vehicles match the active filters.
          </Typography>
        ) : null}
      </Stack>
    </SurfacePanel>
  );

  const jobFilters = (
    <JobSearchFilters
      stopSearch={stopSearch}
      setStopSearch={setStopSearch}
      stopQuickFilter={stopQuickFilter}
      setStopQuickFilter={setStopQuickFilter}
      routeFilterId={routeFilterId}
      setRouteFilterId={setRouteFilterId}
      driverFilterId={driverFilterId}
      setDriverFilterId={setDriverFilterId}
      vehicleFilterId={vehicleFilterId}
      setVehicleFilterId={setVehicleFilterId}
      routeGroups={unfilteredVisibleGroupedStops}
      drivers={drivers}
      vehicles={vehicles}
    />
  );

  const routeFilters = (
    <RouteSearchFilters
      routeSearch={routeSearch}
      setRouteSearch={setRouteSearch}
      routeQuickFilter={routeQuickFilter}
      setRouteQuickFilter={setRouteQuickFilter}
      driverFilterId={driverFilterId}
      setDriverFilterId={setDriverFilterId}
      vehicleFilterId={vehicleFilterId}
      setVehicleFilterId={setVehicleFilterId}
      drivers={drivers}
      vehicles={vehicles}
    />
  );

  const vehicleFilters = (
    <VehicleSearchFilters
      vehicleSearch={vehicleSearch}
      setVehicleSearch={setVehicleSearch}
      vehicleQuickFilter={vehicleQuickFilter}
      setVehicleQuickFilter={setVehicleQuickFilter}
    />
  );

  const leftPanelTabs = (
    <RoutingLeftPanel
      leftPanelTab={leftPanelTab}
      setLeftPanelTab={setLeftPanelTab}
      jobFilters={jobFilters}
      routeFilters={routeFilters}
      vehicleFilters={vehicleFilters}
      jobsPanel={jobsPanel}
      routesPanel={draftRoutesPanel}
      vehiclesPanel={vehiclesPanel}
    />
  );

  const mapPanel = (
    <SurfacePanel
      variant="canvas"
      padding={0}
      data-testid="routing-map-panel"
      sx={{
        overflow: 'hidden',
        minHeight: { xs: 430, md: 540, xl: 0 },
        height: { xs: 430, md: 540, xl: '100%' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        sx={{ px: 1.35, py: 0.95, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">Route map</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            Keep the route picture visible while editing lanes and assignments.
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ flex: '0 0 auto' }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mapDisplayMode}
            onChange={(_, value) => value && setMapDisplayMode(value)}
            aria-label="Map display mode"
            data-testid="routing-map-mode-toggle"
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 800,
                px: 0.8,
                py: 0.45,
              },
            }}
          >
            <ToggleButton value="selected">Selected route</ToggleButton>
            <ToggleButton value="all">All routes</ToggleButton>
            <ToggleButton value="density">Route density</ToggleButton>
            <ToggleButton value="exceptions">Exceptions only</ToggleButton>
          </ToggleButtonGroup>
          <StatusPill
            label={selectedGroup ? selectedGroup.label : 'No lane selected'}
            tone={selectedGroup ? 'accent' : 'default'}
          />
        </Stack>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {displayedMapRoutes.length ? (
          <MultiRouteMap
            routes={displayedMapRoutes}
            height="100%"
            showLegend={false}
            selectedRouteId={selectedGroupId}
            displayMode={mapDisplayMode}
            distanceUnit={routeDistanceUnit}
            onRouteSelect={(routeId) => {
              if (routeId) setSelectedGroupId(routeId);
            }}
          />
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>
              No route lanes to display
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isEmptyRouteDay
                ? 'Import jobs or choose a service date with work before building a route plan.'
                : 'Generate a draft route plan to populate the planner canvas.'}
            </Typography>
          </Box>
        )}
      </Box>
    </SurfacePanel>
  );

  const renderRouteEditorPanel = (isFullscreen = false) => (
    <RouteLaneEditorDrawer
      isFullscreen={isFullscreen}
      laneEditorMode={laneEditorMode}
      setLaneEditorMode={setLaneEditorMode}
      visibleGroupedStops={visibleGroupedStops}
      selectedGroup={selectedGroup}
      selectedStopId={selectedStopId}
      setSelectedGroupId={(groupId) => {
        setRecentMove(null);
        setSelectedGroupId(groupId);
      }}
      setSelectedStopId={setSelectedStopId}
      recentMove={recentMove}
      density={density}
      isDark={isDark}
      saving={saving}
      isReadOnly={isRouteLanesReadOnly}
      onDragEnd={(result) => void handleDragEnd(result)}
      onMoveStop={(request) => void moveStop(request)}
      formatDistance={formatDistance}
    />
  );

  const inspectorPanel = (
    <RouteInspector
      selectedGroup={selectedGroup}
      selectedGroupVisibleStops={selectedGroupVisibleStops}
      selectedStop={selectedStop}
      selectedStopId={selectedStopId}
      setSelectedStopId={setSelectedStopId}
      inspectorTab={inspectorTab}
      setInspectorTab={setInspectorTab}
      selectedRouteDistance={selectedRouteDistance}
	      selectedDriverName={selectedDriverName}
	      selectedVehicleName={selectedVehicleName}
	      planStatusLabel={planStatusLabel}
        planStatusTone={planStatusTone}
	      nextActionLabel={primaryActionLabel}
	      hasPlan={Boolean(plan)}
	      routeCount={groups.length}
	      totalJobCount={totalJobCount}
	      routedStopCount={routedStopCount}
	      unassignedCount={unassignedJobCount}
        planOpenExceptionCount={openPlanExceptionCount}
      serviceDateLabel={serviceDateDisplayValue}
      objectiveLabel={getOptimizationObjectiveLabel(objective)}
      openExceptionCount={openExceptionCount}
      density={density}
      isDark={isDark}
      isMarketingCapture={isMarketingCapture}
      saving={saving}
      vehicles={vehicles}
      drivers={drivers}
      onUpdateAssignments={(groupId, payload) => void updateAssignments(groupId, payload)}
      onToggleStopLock={(stopId, isLocked) => void toggleStopLock(stopId, isLocked)}
      onSetRouteOrderProtection={(locked) => void setRouteOrderProtection(locked)}
    />
  );

  return (
    <Box
      data-testid="routing-workspace-page"
      data-capture-mode={isMarketingCapture ? 'marketing' : undefined}
      data-density={density}
      data-selected-route-id={selectedGroupId || undefined}
      data-route-version={routeVersion || undefined}
      sx={{
        display: 'grid',
        gap: 1.5,
        ...(isMarketingCapture
          ? {
              '& *': {
                animation: 'none !important',
                transition: 'none !important',
              },
            }
          : {}),
      }}
    >
      {commandBar}

      {error ? (
        <Alert severity="error" data-testid="routing-error-alert" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      ) : null}

      {workspaceStateAlerts}

      {isPlanPublished ? (
        <SurfacePanel
          variant="panel"
          padding={1.25}
          data-testid="routing-dispatch-handoff"
          sx={{
            borderColor: 'success.main',
            bgcolor: alpha(isDark ? '#16351f' : '#EAF7EE', isDark ? 0.28 : 0.7),
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <Box>
              <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                <StatusPill label="Published" tone="success" />
                <StatusPill label={`Route version ${routeVersion || 'v1'}`} tone="info" />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.55 }}>
                Dispatch can now pick up this route plan. Lanes are read-only until a revision is started.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Button variant="contained" href="/dispatch">
                Open dispatch board
              </Button>
              {!isRevisionMode ? (
                <Button variant="outlined" onClick={handleStartRevision}>
                  Start revision
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </SurfacePanel>
      ) : null}

      {isDesktopWorkspace ? (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: isHeroMarketingCapture
              ? 'minmax(760px, 1fr) 320px'
              : isMarketingCapture
                ? '240px minmax(620px, 1fr) 300px'
                : '260px minmax(760px, 1fr) 310px',
            alignItems: 'stretch',
            height: isHeroMarketingCapture ? '720px' : 'calc(100vh - 176px)',
            minHeight: 640,
          }}
        >
          {isHeroMarketingCapture ? null : leftPanelTabs}

          <Stack spacing={1.2} sx={{ minHeight: 0, overflow: 'hidden' }}>
            {mapPanel}
            {isHeroMarketingCapture || laneEditorMode === 'fullscreen' ? null : (
              <Box sx={{ maxHeight: laneEditorMode === 'collapsed' ? '92px' : isMarketingCapture ? '28vh' : '30vh', overflow: 'hidden' }}>
                {renderRouteEditorPanel()}
              </Box>
            )}
          </Stack>

          {inspectorPanel}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.2 }}>
          <ToggleButtonGroup
            fullWidth
            size="small"
            exclusive
            value={mobilePanel}
            onChange={(_, value) => value && setMobilePanel(value)}
          >
            <ToggleButton value="map">Map</ToggleButton>
            <ToggleButton value="routes">Routes</ToggleButton>
            <ToggleButton value="jobs">Jobs</ToggleButton>
          </ToggleButtonGroup>
          {mobilePanel === 'map' ? mapPanel : null}
          {mobilePanel === 'routes' ? (
            <Stack spacing={1.2}>
              {draftRoutesPanel}
              {laneEditorMode === 'fullscreen' ? null : renderRouteEditorPanel()}
              {inspectorPanel}
            </Stack>
          ) : null}
          {mobilePanel === 'jobs' ? (
            <Stack spacing={1.2}>
              {jobsPanel}
              {vehiclesPanel}
            </Stack>
          ) : null}
        </Box>
      )}
      {laneEditorMode === 'fullscreen' ? (
        <Box
          sx={{
            position: 'fixed',
            inset: { xs: 8, md: 18 },
            zIndex: 1400,
            display: 'flex',
            minHeight: 0,
          }}
        >
          {renderRouteEditorPanel(true)}
        </Box>
      ) : null}
      <ExceptionResolutionDrawer
        open={isExceptionDrawerOpen}
        exceptions={exceptionRecords}
        riskReasons={exceptionRiskReasons}
        saving={saving}
        onClose={() => setIsExceptionDrawerOpen(false)}
        onResolve={handleResolveException}
        onAcceptRisk={handleAcceptExceptionRisk}
        onRiskReasonChange={(exceptionId, reason) =>
          setExceptionRiskReasons((current) => ({ ...current, [exceptionId]: reason }))
        }
        onAssignDriver={handleAssignExceptionDriver}
        onAssignVehicle={handleAssignExceptionVehicle}
        onJumpToAffected={handleJumpToException}
      />
      <Dialog
        open={isPublishSummaryOpen}
        onClose={() => (saving ? undefined : setIsPublishSummaryOpen(false))}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          'data-testid': 'routing-publish-summary-dialog',
        } as Record<string, unknown>}
      >
        <DialogTitle>Publish route plan</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Confirm the plan is ready for dispatch handoff. Publishing records the current route version
              and locks route lanes until a revision is started.
            </Typography>
            <SurfacePanel variant="subtle" padding={1.1}>
              <Stack spacing={0.85}>
                {[
                  ['Routes', groups.length],
                  ['Routed stops', routedStopCount],
                  ['Unassigned jobs', unassignedJobCount],
                  ['Accepted exceptions', acceptedExceptionCount],
                  ['Drivers assigned', `${driversAssignedCount}/${groups.length}`],
                  ['Vehicles assigned', `${vehiclesAssignedCount}/${groups.length}`],
                ].map(([label, value]) => (
                  <Stack key={label} direction="row" justifyContent="space-between" gap={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 780 }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 850 }}>
                      {value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </SurfacePanel>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsPublishSummaryOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleConfirmPublish()} disabled={saving}>
            Confirm publish
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
