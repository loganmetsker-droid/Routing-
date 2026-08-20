import type { DropResult } from '@hello-pangea/dnd';
import {
  evaluateVehicleLoadFit,
  getOptimizationObjectiveLabel,
  normalizeOptimizationObjective,
  type OptimizationObjective,
} from '@shared/contracts';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '../router';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import MultiRouteMap, { type MapDisplayMode } from '../components/maps/MultiRouteMap';
import { OpsCommandBar } from '../components/ops';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import { buildPlannerMapRoutes, type OpsMapRoute } from '../features/dispatch/utils/opsMapData';
import {
  getErrorMessage,
  type DriverRecord,
  type VehicleRecord,
} from '../services/api.types';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import { useJobsQuery } from '../services/jobsApi';
import {
  acceptRoutePlanPublishRisk,
  batchMoveRoutePlanStops,
  generateDraftRoutePlan,
  insertJobIntoRoutePlan,
  publishRoutePlan,
  type PlannerPublishBlocker,
  type PublishRoutePlanResult,
  reoptimizeRoutePlan,
  type PlannerRoutePlan,
  type PlannerRoutePlanGroup,
  type PlannerRoutePlanStop,
  updateRoutePlanGroup,
  updateRoutePlanStop,
  usePlannerQuery,
  useRoutePlanDriverFamiliarityQuery,
  useRoutePlanPublishReadinessQuery,
} from '../services/plannerApi';
import {
  fetchRoadRoutePolyline,
  getRoadRouteSignature,
  type RoadRoutePoint,
} from '../services/roadRouteGeometry';
import {
  ExceptionResolutionDrawer,
  hasStopException,
  JobSearchFilters,
  jobMatchesQuickFilter,
  jobSearchText,
  getJobCity,
  getPriorityLabel,
  getStopCity,
  isHighPriority,
  normalizeText,
  hasStopLateRisk,
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
import { RouteStopTimelineStrip } from './routing-workspace/RouteStopTimelineStrip';
import {
  builtInRouteSummaryViews,
  defaultRouteSummaryColumns,
  deleteRouteSummaryView,
  normalizeRouteSummaryViewSnapshot,
  normalizeSavedRouteSummaryViews,
  routeSummaryColumnDefinitions,
  routeSummarySnapshotsEqual,
  saveRouteSummaryView,
  type RouteSummaryColumnId,
  type RouteSummaryFilter,
  type RouteSummaryViewSnapshot,
  type SavedRouteSummaryView,
} from './routing-workspace/routeSummaryViews';
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

type OptimizerProvenance = {
  solver: string;
  solverVersion: string;
  matrixProvider: string;
  matrixMode: 'road_network' | 'estimated';
  fallbackUsed: boolean;
  solveDurationMs: number;
  coordinateCoveragePercent: number;
  locationCount: number;
};

function optimizerProvenanceFromPlan(plan: PlannerRoutePlan | null): OptimizerProvenance | null {
  const candidate = plan?.warnings?.find((warning) => (
    typeof warning === 'object' &&
    warning !== null &&
    (warning.type === 'OPTIMIZER_PROVENANCE' ||
      warning.type === 'OPTIMIZER_DEGRADED_MATRIX')
  ));
  if (!candidate || typeof candidate !== 'object') return null;
  return {
    solver: String(candidate.solver || 'unknown'),
    solverVersion: String(candidate.solverVersion || 'unknown'),
    matrixProvider: String(candidate.matrixProvider || 'unknown'),
    matrixMode: candidate.matrixMode === 'road_network' ? 'road_network' : 'estimated',
    fallbackUsed: Boolean(candidate.fallbackUsed),
    solveDurationMs: Number(candidate.solveDurationMs || 0),
    coordinateCoveragePercent: Number(candidate.coordinateCoveragePercent || 0),
    locationCount: Number(candidate.locationCount || 0),
  };
}
const routingWorkspacePreferencePrefix = 'trovan-routing-workspace-preferences:v3';
const previewAuthUserStorageKey = 'trovan-preview-auth-user';
const authTokenStorageKey = 'authToken';

type RoutingDistanceUnit = 'mi';
type UnassignedSort = 'priority' | 'customer' | 'city';
type RouteFitRecommendation = {
  groupId: string;
  label: string;
  distanceMiles: number | null;
  workload: number;
  areaMatch: boolean;
  fits: boolean;
  blocker?: string | null;
};
type RoutingWorkspaceRuntimeMode = 'dev-test' | 'production';
type RoutingWorkspaceCapabilities = {
  exceptionDecisionApi: boolean;
  publishReadinessApi: boolean;
  routeVersionApi: boolean;
  dispatchHandoffApi: boolean;
  saveDraftApi: boolean;
  autosaveStatus: boolean;
  structuredPlannerErrors: boolean;
  rolePermissions: boolean;
};
type RoutingWorkspacePreferences = {
  density: ViewDensity;
  laneEditorMode: LaneEditorMode;
  mapDisplayMode: MapDisplayMode;
  leftPanelTab: LeftPanelTab;
  distanceUnit: RoutingDistanceUnit;
  routeSummaryColumns: RouteSummaryColumnId[];
  routeSummaryFilter: RouteSummaryFilter;
  routeSearch: string;
  routeQuickFilter: RouteQuickFilter;
  driverFilterId: string;
  vehicleFilterId: string;
  savedRouteSummaryViews: SavedRouteSummaryView[];
  activeRouteSummaryViewId: string | null;
};

const disabledRoutingWorkspaceCapabilities: RoutingWorkspaceCapabilities = {
  exceptionDecisionApi: false,
  publishReadinessApi: false,
  routeVersionApi: false,
  dispatchHandoffApi: false,
  saveDraftApi: false,
  autosaveStatus: false,
  structuredPlannerErrors: false,
  rolePermissions: false,
};

const productionRoutingWorkspaceCapabilities: RoutingWorkspaceCapabilities = {
  exceptionDecisionApi: false,
  publishReadinessApi: true,
  routeVersionApi: false,
  dispatchHandoffApi: true,
  saveDraftApi: false,
  autosaveStatus: false,
  structuredPlannerErrors: true,
  rolePermissions: false,
};

const enabledRoutingWorkspaceCapabilities: RoutingWorkspaceCapabilities = {
  exceptionDecisionApi: true,
  publishReadinessApi: true,
  routeVersionApi: true,
  dispatchHandoffApi: true,
  saveDraftApi: true,
  autosaveStatus: true,
  structuredPlannerErrors: true,
  rolePermissions: true,
};

function getRoutingWorkspaceRuntimeMode(searchParams: URLSearchParams): RoutingWorkspaceRuntimeMode {
  const requestedMode = searchParams.get('workspaceMode');
  if (requestedMode === 'production') return 'production';
  if (requestedMode === 'dev' || requestedMode === 'test') return 'dev-test';
  return import.meta.env.PROD ? 'production' : 'dev-test';
}

function getRoutingWorkspaceCapabilities(
  searchParams: URLSearchParams,
  runtimeMode: RoutingWorkspaceRuntimeMode,
): RoutingWorkspaceCapabilities {
  const requestedCapabilities = searchParams.get('capabilities');
  if (runtimeMode === 'production') {
    return productionRoutingWorkspaceCapabilities;
  }
  if (requestedCapabilities === 'off') return disabledRoutingWorkspaceCapabilities;
  if (requestedCapabilities === 'on') return enabledRoutingWorkspaceCapabilities;
  return enabledRoutingWorkspaceCapabilities;
}

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
  return value === 'mi';
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
  const routeSummaryView = normalizeRouteSummaryViewSnapshot({
    columns: record.routeSummaryColumns,
    summaryFilter: record.routeSummaryFilter,
    routeSearch: record.routeSearch,
    routeQuickFilter: record.routeQuickFilter,
    driverFilterId: record.driverFilterId,
    vehicleFilterId: record.vehicleFilterId,
    mapDisplayMode: record.mapDisplayMode,
  });
  return {
    density: isViewDensity(record.density) ? record.density : undefined,
    laneEditorMode: isLaneEditorMode(record.laneEditorMode) ? 'collapsed' : undefined,
    mapDisplayMode: isMapDisplayMode(record.mapDisplayMode) ? record.mapDisplayMode : undefined,
    leftPanelTab: isLeftPanelTab(record.leftPanelTab) ? record.leftPanelTab : undefined,
    distanceUnit: isRoutingDistanceUnit(record.distanceUnit) ? record.distanceUnit : undefined,
    routeSummaryColumns: routeSummaryView.columns,
    routeSummaryFilter: routeSummaryView.summaryFilter,
    routeSearch: routeSummaryView.routeSearch,
    routeQuickFilter: routeSummaryView.routeQuickFilter,
    driverFilterId: routeSummaryView.driverFilterId,
    vehicleFilterId: routeSummaryView.vehicleFilterId,
    savedRouteSummaryViews: normalizeSavedRouteSummaryViews(record.savedRouteSummaryViews),
    activeRouteSummaryViewId:
      typeof record.activeRouteSummaryViewId === 'string'
        ? record.activeRouteSummaryViewId.slice(0, 120)
        : null,
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

function shiftServiceDate(value: string, dayDelta: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + dayDelta);
  return date.toISOString().slice(0, 10);
}

function unassignedPriorityRank(priority?: string | null) {
  const normalized = normalizeText(priority);
  if (normalized === 'urgent') return 0;
  if (normalized === 'high') return 1;
  if (normalized === 'normal') return 2;
  return 3;
}

function routeGroupNeedsAttention(group: PlannerRouteGroupWithStops) {
  return (
    !group.driverId ||
    !group.vehicleId ||
    Boolean(group.warnings?.length) ||
    Number(group.totalDurationMinutes || 0) > 480 ||
    group.stops.some((stop) => hasStopException(stop) || hasStopLateRisk(stop))
  );
}

function routeWorkloadPercent(group: PlannerRouteGroupWithStops) {
  return Math.max(0, Math.round((Number(group.totalDurationMinutes || 0) / 480) * 100));
}

function getJobLocation(job?: PlannerJobRecord) {
  const location = job?.deliveryLocation || job?.pickupLocation;
  if (
    !location ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    return null;
  }
  return { lat: Number(location.lat), lng: Number(location.lng) };
}

function distanceMilesBetween(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const latDelta = radians(right.lat - left.lat);
  const lngDelta = radians(right.lng - left.lng);
  const leftLat = radians(left.lat);
  const rightLat = radians(right.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function recommendRouteForJob(
  job: PlannerJobRecord,
  routeGroups: PlannerRouteGroupWithStops[],
  vehicles: VehicleRecord[],
  drivers: DriverRecord[],
  jobsForFit: PlannerJobRecord[] = [job],
): RouteFitRecommendation | null {
  const jobLocation = getJobLocation(job);
  const jobCity = normalizeText(getJobCity(job));
  const candidates = routeGroups
    .filter((group) => group.stops.length > 0)
    .map((group) => {
      const vehicle = vehicles.find((item) => item.id === group.vehicleId);
      const driver = drivers.find((item) => item.id === group.driverId) || null;
      const routeJobs = [
        ...group.stops.map((stop) => stop.job).filter(Boolean),
        ...jobsForFit,
      ] as PlannerJobRecord[];
      const fit = vehicle
        ? evaluateVehicleLoadFit({ vehicle, driver, jobs: routeJobs })
        : null;
      const sequenceBlocker = (() => {
        const distinctJobs = routeJobs.filter(
          (candidate, index) => routeJobs.findIndex((item) => item.id === candidate.id) === index,
        );
        const requiredFirst = distinctJobs.filter(
          (candidate) => candidate.routingRequirements?.sequence?.position === 'first',
        );
        const requiredLast = distinctJobs.filter(
          (candidate) => candidate.routingRequirements?.sequence?.position === 'last',
        );
        if (requiredFirst.length > 1) return 'More than one job is required to be first.';
        if (requiredLast.length > 1) return 'More than one job is required to be last.';
        return null;
      })();
      const fits = Boolean(fit?.fits) && !sequenceBlocker;
      const locations = group.stops
        .map((stop) => getJobLocation(stop.job))
        .filter((location): location is { lat: number; lng: number } => Boolean(location));
      const routeCenter = locations.length
        ? {
            lat: locations.reduce((sum, location) => sum + location.lat, 0) / locations.length,
            lng: locations.reduce((sum, location) => sum + location.lng, 0) / locations.length,
          }
        : null;
      const distanceMiles = jobLocation && routeCenter
        ? distanceMilesBetween(jobLocation, routeCenter)
        : null;
      const areaMatch = Boolean(
        jobCity && group.stops.some((stop) => normalizeText(getStopCity(stop)) === jobCity),
      );
      const workload = routeWorkloadPercent(group);
      const score =
        (distanceMiles === null ? (areaMatch ? 0 : 45) : distanceMiles * 4) +
        workload * 0.35 +
        (!group.driverId ? 35 : 0) +
        (!group.vehicleId ? 35 : 0) +
        (group.warnings?.length ? 18 : 0) +
        (workload > 100 ? 80 : 0) +
        (!fits ? 10_000 : 0);
      return {
        groupId: group.id,
        label: group.label || group.id,
        distanceMiles,
        workload,
        areaMatch,
        fits,
        blocker:
          sequenceBlocker ||
          fit?.blockers[0]?.message ||
          (!vehicle ? 'Assign a vehicle before inserting work.' : null),
        score,
      };
    })
    .sort((left, right) => left.score - right.score);

  const recommendation = candidates[0];
  if (!recommendation) return null;
  return {
    groupId: recommendation.groupId,
    label: recommendation.label,
    distanceMiles: recommendation.distanceMiles,
    workload: recommendation.workload,
    areaMatch: recommendation.areaMatch,
    fits: recommendation.fits,
    blocker: recommendation.blocker,
  };
}

function formatRouteDistance(distanceKm?: number | null) {
  const safeDistance = Number(distanceKm || 0);
  return `${(safeDistance * 0.621371).toFixed(1)} mi`;
}

function formatPlanningDuration(minutes?: number | null) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  if (!remainingMinutes) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const routingWorkspaceRuntimeMode = getRoutingWorkspaceRuntimeMode(searchParams);
  const routingWorkspaceCapabilities = getRoutingWorkspaceCapabilities(
    searchParams,
    routingWorkspaceRuntimeMode,
  );
  const areRoutingWorkspaceQueryStatesAllowed = routingWorkspaceRuntimeMode !== 'production';
  const scenarioParam = areRoutingWorkspaceQueryStatesAllowed ? searchParams.get('scenario') : null;
  const captureParam = searchParams.get('capture');
  const frameParam = searchParams.get('frame');
  const forcedFailure = areRoutingWorkspaceQueryStatesAllowed ? searchParams.get('failure') : null;
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
  const [batchSelectedStopIds, setBatchSelectedStopIds] = useState<string[]>([]);
  const [unassignedJobs, setUnassignedJobs] = useState<PlannerJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insertingJobId, setInsertingJobId] = useState<string | null>(null);
  const [isInsertingArea, setIsInsertingArea] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [mapSelectedJobIds, setMapSelectedJobIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [objective, setObjective] = useState<OptimizationObjective>('balanced');
  const [serviceDate, setServiceDate] = useState(() =>
    searchParams.get('serviceDate') || (searchParams.get('capture') === 'marketing' ? marketingServiceDate : todayServiceDate()),
  );
  const [mode, setMode] = useState<'suggested' | 'manual'>('suggested');
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [routingActionNotice, setRoutingActionNotice] = useState<string | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('jobs');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [density, setDensity] = useState<ViewDensity>(
    () => (searchParams.get('density') === 'compact' ? 'compact' : 'comfortable'),
  );
  const [laneEditorMode, setLaneEditorMode] = useState<LaneEditorMode>('collapsed');
  const [distanceUnitPreference, setDistanceUnitPreference] = useState<RoutingDistanceUnit>(
    () => 'mi',
  );
  const [stopSearch, setStopSearch] = useState('');
  const [stopQuickFilter, setStopQuickFilter] = useState<StopQuickFilter>('all');
  const [routeFilterId, setRouteFilterId] = useState('all');
  const [driverFilterId, setDriverFilterId] = useState('all');
  const [vehicleFilterId, setVehicleFilterId] = useState('all');
  const [routeSearch, setRouteSearch] = useState('');
  const [routeQuickFilter, setRouteQuickFilter] = useState<RouteQuickFilter>('all');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleQuickFilter, setVehicleQuickFilter] = useState<VehicleQuickFilter>('all');
  const [routeSummaryFilter, setRouteSummaryFilter] = useState<RouteSummaryFilter>('all');
  const [routeSummaryColumns, setRouteSummaryColumns] = useState<RouteSummaryColumnId[]>(
    () => [...defaultRouteSummaryColumns],
  );
  const [savedRouteSummaryViews, setSavedRouteSummaryViews] = useState<SavedRouteSummaryView[]>([]);
  const [activeRouteSummaryViewId, setActiveRouteSummaryViewId] = useState<string | null>(null);
  const [isRouteSummaryColumnsOpen, setIsRouteSummaryColumnsOpen] = useState(false);
  const [isRouteSummaryViewsOpen, setIsRouteSummaryViewsOpen] = useState(false);
  const [isSaveRouteSummaryViewOpen, setIsSaveRouteSummaryViewOpen] = useState(false);
  const [routeSummaryViewName, setRouteSummaryViewName] = useState('');
  const [routeSummaryViewError, setRouteSummaryViewError] = useState('');
  const [editingRouteSummaryViewId, setEditingRouteSummaryViewId] = useState<string | null>(null);
  const [editingRouteSummaryViewName, setEditingRouteSummaryViewName] = useState('');
  const [unassignedSort, setUnassignedSort] = useState<UnassignedSort>('priority');
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
  const [publishRiskBlocker, setPublishRiskBlocker] =
    useState<PlannerPublishBlocker | null>(null);
  const [publishRiskReason, setPublishRiskReason] = useState('');
  const [acceptingPublishRisk, setAcceptingPublishRisk] = useState(false);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator === 'undefined' ? false : !navigator.onLine,
  );
  const [routeVersion, setRouteVersion] = useState<string | null>(null);
  const [publishedRouteRunCount, setPublishedRouteRunCount] = useState(0);
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [preferenceStorageKey, setPreferenceStorageKey] = useState<string | null>(() =>
    getRoutingWorkspacePreferenceStorageKey(),
  );
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const isDesktopWorkspace = useMediaQuery('(min-width:1180px)');
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
  const driverFamiliarityShapeKey = useMemo(
    () => [
      ...stops.map((stop) => `${stop.id}:${stop.routePlanGroupId}:${stop.jobStopId}`),
      ...drivers.map((driver) => `driver:${driver.id}`),
    ].sort().join('|'),
    [drivers, stops],
  );
  const publishReadinessQuery = useRoutePlanPublishReadinessQuery(
    routingWorkspaceCapabilities.publishReadinessApi ? plan?.id : null,
  );
  const driverFamiliarityQuery = useRoutePlanDriverFamiliarityQuery(
    plan?.id,
    driverFamiliarityShapeKey,
    isLocalPlannerScenario
      ? {
          serviceDate,
          groups: groups.map((group) => ({ id: group.id })),
          stops: stops.map((stop) => ({ routePlanGroupId: stop.routePlanGroupId })),
          driverIds: drivers.map((driver) => driver.id),
        }
      : undefined,
  );

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
  const attentionRouteCount = visibleGroupedStops.filter(routeGroupNeedsAttention).length;
  const routeSummaryGroups = visibleGroupedStops.filter((group) => {
    if (routeSummaryFilter === 'attention') return routeGroupNeedsAttention(group);
    if (routeSummaryFilter === 'ready') return !routeGroupNeedsAttention(group);
    return true;
  });
  const currentRouteSummarySnapshot = useMemo<RouteSummaryViewSnapshot>(() => ({
    columns: routeSummaryColumns,
    summaryFilter: routeSummaryFilter,
    routeSearch,
    routeQuickFilter,
    driverFilterId,
    vehicleFilterId,
    mapDisplayMode,
  }), [
    driverFilterId,
    mapDisplayMode,
    routeQuickFilter,
    routeSearch,
    routeSummaryColumns,
    routeSummaryFilter,
    vehicleFilterId,
  ]);
  const activeRouteSummaryView = useMemo(
    () =>
      builtInRouteSummaryViews.find((view) => view.id === activeRouteSummaryViewId) ||
      savedRouteSummaryViews.find((view) => view.id === activeRouteSummaryViewId) ||
      null,
    [activeRouteSummaryViewId, savedRouteSummaryViews],
  );
  const activeSavedRouteSummaryView = savedRouteSummaryViews.find(
    (view) => view.id === activeRouteSummaryViewId,
  );
  const activeRouteSummaryViewIsModified = Boolean(
    activeRouteSummaryView &&
    !routeSummarySnapshotsEqual(activeRouteSummaryView.snapshot, currentRouteSummarySnapshot),
  );
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
  const formatDistance = (distanceKm?: number | null) => formatRouteDistance(distanceKm);
  const serviceDateDisplayValue = formatPlannerDate(serviceDate);
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
  const totalDistanceKm = groups.reduce((sum, group) => sum + Number(group.totalDistanceKm || 0), 0);
  const totalDistanceMiles = totalDistanceKm * 0.621371;
  const totalDurationMinutes = groups.reduce((sum, group) => sum + Number(group.totalDurationMinutes || 0), 0);
  const totalServiceMinutes = groups.reduce((sum, group) => sum + Number(group.serviceTimeMinutes || 0), 0);
  const averageDistanceKm = groups.length ? totalDistanceKm / groups.length : 0;
  const maxDistanceSpreadKm = groups.reduce(
    (spread, group) => Math.max(spread, Math.abs(Number(group.totalDistanceKm || 0) - averageDistanceKm)),
    0,
  );
  const routeBalanceScore = groups.length
    ? Math.max(0, Math.round(100 - (averageDistanceKm ? (maxDistanceSpreadKm / averageDistanceKm) * 100 : 0)))
    : 0;
  const slaCompliance = totalJobCount
    ? Math.max(0, Math.round(100 - ((unassignedJobCount + openPlanExceptionCount) / totalJobCount) * 100))
    : 100;
  const estimatedFuelCost = totalDistanceMiles * 0.68;
  const estimatedLaborCost = (totalDurationMinutes / 60) * 32;
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
  const optimizerProvenance = optimizerProvenanceFromPlan(plan);
  const hasUnassignedBlocker = Boolean(plan?.id) && unassignedJobCount > 0;
  const hasBlockingExceptions = Boolean(plan?.id) && openPlanExceptionCount > 0;
  const publishReadiness = routingWorkspaceCapabilities.publishReadinessApi
    ? publishReadinessQuery.data
    : undefined;
  const publishBlockingBlockers = publishReadiness?.blockingBlockers || [];
  const hasPublishReadinessBlockers =
    Boolean(plan?.id) && publishBlockingBlockers.length > 0;
  const primaryActionLabel = !plan?.id
    ? 'Generate route draft'
    : isPlanPublished && !isRevisionMode
      ? 'Published'
    : hasUnassignedBlocker
      ? 'Resolve unassigned'
    : hasBlockingExceptions
      ? 'Review exceptions'
      : hasPublishReadinessBlockers
        ? 'Resolve blockers'
        : 'Publish plan';
  const planStatusLabel = !plan?.id
    ? 'Needs setup'
    : isPlanPublished && !isRevisionMode
      ? 'Published'
    : hasUnassignedBlocker
      ? 'Resolve unassigned'
    : hasBlockingExceptions
      ? 'Review exceptions'
    : hasPublishReadinessBlockers
      ? 'Warnings'
      : 'Ready to publish';
  const planStatusTone = !plan?.id
    ? 'default'
    : isPlanPublished && !isRevisionMode
      ? 'success'
    : hasUnassignedBlocker || hasBlockingExceptions || hasPublishReadinessBlockers
      ? 'warning'
      : 'success';
  const hasDurableDraftSave =
    routingWorkspaceCapabilities.saveDraftApi || routingWorkspaceCapabilities.autosaveStatus;
  const draftActionLabel = hasDurableDraftSave ? 'Save draft' : 'Refresh draft';
  const draftActionFailureMessage = hasDurableDraftSave
    ? 'Save draft failed. Your route changes were not saved; retry before leaving planning.'
    : 'Refresh draft failed. The latest planner data could not be loaded.';
  const hasDispatchHandoffCapability =
    routingWorkspaceCapabilities.dispatchHandoffApi;
  const canShowDispatchHandoff =
    hasDispatchHandoffCapability &&
    publishedRouteRunCount > 0;
  const effectivePreferenceStorageKey = isMarketingCapture ? null : preferenceStorageKey;

  useEffect(() => {
    if (!plan?.id) {
      setLeftPanelTab('jobs');
      if (!loading) {
        setLaneEditorMode('collapsed');
      }
      return;
    }
    setLeftPanelTab((current) => (current === 'jobs' ? 'routes' : current));
    setLaneEditorMode((current) => (current === 'fullscreen' ? 'collapsed' : current));
  }, [loading, plan?.id]);

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
    if (preferences?.routeSummaryColumns) setRouteSummaryColumns(preferences.routeSummaryColumns);
    if (preferences?.routeSummaryFilter) setRouteSummaryFilter(preferences.routeSummaryFilter);
    if (preferences?.routeSearch !== undefined) setRouteSearch(preferences.routeSearch);
    if (preferences?.routeQuickFilter) setRouteQuickFilter(preferences.routeQuickFilter);
    if (preferences?.driverFilterId) setDriverFilterId(preferences.driverFilterId);
    if (preferences?.vehicleFilterId) setVehicleFilterId(preferences.vehicleFilterId);
    setSavedRouteSummaryViews(preferences?.savedRouteSummaryViews || []);
    setActiveRouteSummaryViewId(preferences?.activeRouteSummaryViewId || null);
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
      routeSummaryColumns,
      routeSummaryFilter,
      routeSearch,
      routeQuickFilter,
      driverFilterId,
      vehicleFilterId,
      savedRouteSummaryViews,
      activeRouteSummaryViewId,
    });
  }, [
    activeRouteSummaryViewId,
    density,
    distanceUnitPreference,
    driverFilterId,
    effectivePreferenceStorageKey,
    isMarketingCapture,
    laneEditorMode,
    leftPanelTab,
    mapDisplayMode,
    preferencesHydrated,
    routeQuickFilter,
    routeSearch,
    routeSummaryColumns,
    routeSummaryFilter,
    savedRouteSummaryViews,
    vehicleFilterId,
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
    const movableStopIds = new Set(
      stops.filter((stop) => !stop.isLocked).map((stop) => stop.id),
    );
    setBatchSelectedStopIds((current) =>
      current.filter((stopId) => movableStopIds.has(stopId)),
    );
  }, [stops]);

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
  const selectedMapRoute = selectedGroup ? mapRoutes.find((route) => route.id === selectedGroup.id) : null;

  const handleGenerate = async () => {
    setSaving(true);
    setError(null);
    try {
      if (forcedFailure === 'optimizer') {
        throw new Error('Optimizer failed to generate a route draft. Review selected jobs, vehicles, constraints, and address quality before retrying.');
      }
      const seededJobIds = searchParams.getAll('jobId');
      const jobIdsForDraft = selectedJobIds.length ? selectedJobIds : seededJobIds;
      if (!jobIdsForDraft.length) {
        throw new Error('Select at least one job before optimizing a route draft.');
      }
      const payload = await generateDraftRoutePlan({
        serviceDate,
        objective,
        jobIds: jobIdsForDraft,
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
    if (hasPublishReadinessBlockers) {
      setError(null);
      setWarningsExpanded(true);
      return;
    }

    if (routingWorkspaceCapabilities.publishReadinessApi) {
      setSaving(true);
      setError(null);
      try {
        const latestReadiness = await publishReadinessQuery.refetch();
        if (!latestReadiness.data) {
          throw new Error('Publish readiness could not be verified.');
        }
        if (!latestReadiness.data.ready) {
          setWarningsExpanded(true);
          return;
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Publish readiness could not be verified. Refresh the route day and retry.'));
        return;
      } finally {
        setSaving(false);
      }
    }

    setIsPublishSummaryOpen(true);
  };

  const handleConfirmPublish = async () => {
    if (!plan?.id) return;
    const nextVersion = routingWorkspaceCapabilities.routeVersionApi
      ? nextRouteVersion(routeVersion)
      : null;
    setSaving(true);
    setError(null);
    try {
      if (forcedFailure === 'publish') {
        throw new Error('Publish failed. Dispatch handoff was not created; retry before sending routes to drivers.');
      }
      let publishResult: PublishRoutePlanResult | null = null;
      if (!isLocalPlannerScenario) {
        if (routingWorkspaceCapabilities.publishReadinessApi) {
          const latestReadiness = await publishReadinessQuery.refetch();
          if (latestReadiness.data && !latestReadiness.data.ready) {
            throw new Error('Route plan is not ready to publish.');
          }
        }
        publishResult = await publishRoutePlan(plan.id);
      } else if (routingWorkspaceRuntimeMode !== 'production') {
        publishResult = {
          ok: true,
          routePlan: plan,
          routeRuns: groups,
        };
      }
      setPlan((current) => (current ? { ...current, status: 'published' } : current));
      setRouteVersion(nextVersion);
      setPublishedRouteRunCount(Array.isArray(publishResult?.routeRuns) ? publishResult.routeRuns.length : 0);
      setIsRevisionMode(false);
      setIsPublishSummaryOpen(false);
      setLaneEditorMode('expanded');
      await publishReadinessQuery.refetch();
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

  const handleOpenPublishRisk = (blocker: PlannerPublishBlocker) => {
    setPublishRiskBlocker(blocker);
    setPublishRiskReason('');
  };

  const handleAcceptPublishRisk = async () => {
    if (!plan?.id || !publishRiskBlocker) return;
    setAcceptingPublishRisk(true);
    setError(null);
    try {
      await acceptRoutePlanPublishRisk(plan.id, {
        blockerCode: publishRiskBlocker.code,
        reason: publishRiskReason,
        jobId: publishRiskBlocker.jobId,
        groupId: publishRiskBlocker.groupId,
        warningIndex: publishRiskBlocker.warningIndex,
      });
      await publishReadinessQuery.refetch();
      setPublishRiskBlocker(null);
      setPublishRiskReason('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to accept publish risk.'));
    } finally {
      setAcceptingPublishRisk(false);
    }
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
    if (!routingWorkspaceCapabilities.exceptionDecisionApi) return;
    setExceptionDecision(exceptionId, 'resolved');
  };

  const handleAcceptExceptionRisk = (exceptionId: string) => {
    if (!routingWorkspaceCapabilities.exceptionDecisionApi) return;
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
    if (!routingWorkspaceCapabilities.exceptionDecisionApi) return;
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
    if (!routingWorkspaceCapabilities.exceptionDecisionApi) return;
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
        throw new Error(draftActionFailureMessage);
      }
      await plannerQuery.refetch();
      setRoutingActionNotice(
        hasDurableDraftSave
          ? 'Route draft saved.'
          : 'Route draft refreshed from the latest planner data.',
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, draftActionFailureMessage));
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

  const applyLocalBatchStopMove = (targetGroupId: string) => {
    const selectedStopIdSet = new Set(batchSelectedStopIds);
    const requestedStops = stops.filter((stop) => selectedStopIdSet.has(stop.id));
    const movingJobIds = Array.from(
      new Set(requestedStops.map((stop) => stop.jobId)),
    );
    const movingStops = stops.filter((stop) => movingJobIds.includes(stop.jobId));
    const targetGroup = groups.find((group) => group.id === targetGroupId);
    if (!targetGroup || !movingStops.length) return null;
    if (movingStops.some((stop) => stop.isLocked)) {
      setError('Protected stops cannot be batch moved. Unlock them first.');
      return null;
    }

    const sourceGroupByJobId = new Map<string, string>();
    for (const jobId of movingJobIds) {
      const sourceGroupIds = Array.from(
        new Set(
          movingStops
            .filter((stop) => stop.jobId === jobId)
            .map((stop) => stop.routePlanGroupId),
        ),
      );
      if (sourceGroupIds.length !== 1) {
        setError('A selected job is split across routes. Reoptimize before moving it.');
        return null;
      }
      sourceGroupByJobId.set(jobId, sourceGroupIds[0]);
    }

    const deltaByGroupId = new Map<
      string,
      { weightKg: number; volumeM3: number; serviceMinutes: number; durationMinutes: number }
    >();
    const ensureDelta = (groupId: string) => {
      const existing = deltaByGroupId.get(groupId);
      if (existing) return existing;
      const created = {
        weightKg: 0,
        volumeM3: 0,
        serviceMinutes: 0,
        durationMinutes: 0,
      };
      deltaByGroupId.set(groupId, created);
      return created;
    };
    movingJobIds.forEach((jobId) => {
      const sourceGroupId = sourceGroupByJobId.get(jobId);
      if (!sourceGroupId || sourceGroupId === targetGroupId) return;
      const job = jobs.find((candidate) => candidate.id === jobId);
      const jobStopCount = movingStops.filter((stop) => stop.jobId === jobId).length;
      const serviceMinutes = Math.max(
        10,
        Math.round(Number(job?.estimatedDuration || 15)),
      );
      const durationMinutes = serviceMinutes + jobStopCount * 12;
      const sourceDelta = ensureDelta(sourceGroupId);
      sourceDelta.weightKg -= Number(job?.weight || 0);
      sourceDelta.volumeM3 -= Number(job?.volume || 0);
      sourceDelta.serviceMinutes -= serviceMinutes;
      sourceDelta.durationMinutes -= durationMinutes;
      const targetDelta = ensureDelta(targetGroupId);
      targetDelta.weightKg += Number(job?.weight || 0);
      targetDelta.volumeM3 += Number(job?.volume || 0);
      targetDelta.serviceMinutes += serviceMinutes;
      targetDelta.durationMinutes += durationMinutes;
    });

    const targetDelta = ensureDelta(targetGroupId);
    if (targetDelta.durationMinutes > 0) {
      const targetVehicle = vehicles.find(
        (vehicle) => vehicle.id === targetGroup.vehicleId,
      );
      if (!targetVehicle) {
        setError('Assign an available vehicle before moving work into this route.');
        return null;
      }
      const projectedWeight =
        Number(targetGroup.totalWeightKg || 0) + targetDelta.weightKg;
      const projectedVolume =
        Number(targetGroup.totalVolumeM3 || 0) + targetDelta.volumeM3;
      const projectedDuration =
        Number(targetGroup.totalDurationMinutes || 0) + targetDelta.durationMinutes;
      const maxWeight = Number(
        targetVehicle.capacityWeightKg || targetVehicle.weightCapacity || 999999,
      );
      const maxVolume = Number(
        targetVehicle.capacityVolumeM3 || targetVehicle.volumeCapacity || 999999,
      );
      const maxDuration = Number(
        targetVehicle.maxRouteMinutes ||
          targetVehicle.metadata?.maxShiftMinutes ||
          480,
      );
      const exceeded = [
        projectedWeight > maxWeight ? 'weight' : null,
        projectedVolume > maxVolume ? 'volume' : null,
        projectedDuration > maxDuration ? 'shift' : null,
      ].filter(Boolean);
      if (exceeded.length) {
        setError(
          `Batch move exceeds target route ${exceeded.join(', ')} constraints.`,
        );
        return null;
      }
    }

    const movingStopIds = new Set(movingStops.map((stop) => stop.id));
    const groupIndexById = new Map(groups.map((group) => [group.id, group.groupIndex]));
    const orderedMovingStops = [...movingStops].sort((left, right) => {
      const groupDifference =
        Number(groupIndexById.get(left.routePlanGroupId) || 0) -
        Number(groupIndexById.get(right.routePlanGroupId) || 0);
      return groupDifference || left.stopSequence - right.stopSequence;
    });
    const remainingStops = stops.filter((stop) => !movingStopIds.has(stop.id));
    const nextStops = groups.flatMap((group) => {
      const groupStops = remainingStops
        .filter((stop) => stop.routePlanGroupId === group.id)
        .sort((left, right) => left.stopSequence - right.stopSequence);
      if (group.id === targetGroupId) {
        groupStops.push(
          ...orderedMovingStops.map((stop) => ({
            ...stop,
            routePlanGroupId: targetGroupId,
            plannedArrival: null,
            plannedDeparture: null,
          })),
        );
      }
      return groupStops.map((stop, index) => ({ ...stop, stopSequence: index + 1 }));
    });
    const nextJobs = jobs.map((job) =>
      movingJobIds.includes(job.id)
        ? { ...job, assignedRouteId: targetGroupId }
        : job,
    );
    const nextGroups = groups.map((group) => {
      const delta = ensureDelta(group.id);
      const nextGroup = {
        ...group,
        totalWeightKg: Math.max(
          0,
          Number(group.totalWeightKg || 0) + delta.weightKg,
        ),
        totalVolumeM3: Math.max(
          0,
          Number(group.totalVolumeM3 || 0) + delta.volumeM3,
        ),
        serviceTimeMinutes: Math.max(
          0,
          Number(group.serviceTimeMinutes || 0) + delta.serviceMinutes,
        ),
        totalDurationMinutes: Math.max(
          0,
          Number(group.totalDurationMinutes || 0) + delta.durationMinutes,
        ),
      };
      return {
        ...nextGroup,
        totalDistanceKm: estimateGroupDistanceKm(nextGroup, nextStops, nextJobs),
      };
    });

    setStops(nextStops);
    setJobs(nextJobs);
    setGroups(nextGroups);
    setPlan((current) =>
      current
        ? {
            ...current,
            status: 'draft',
            warnings: [
              ...(current.warnings || []).filter(
                (warning) =>
                  !(
                    typeof warning === 'object' &&
                    warning !== null &&
                    'type' in warning &&
                    warning.type === 'MANUAL_BATCH_MOVE_REOPTIMIZE_REQUIRED'
                  ),
              ),
              {
                type: 'MANUAL_BATCH_MOVE_REOPTIMIZE_REQUIRED',
                message: `${movingJobIds.length} ${movingJobIds.length === 1 ? 'job was' : 'jobs were'} moved into ${targetGroup.label}. Reoptimize before publish.`,
                jobIds: movingJobIds,
                stopIds: movingStops.map((stop) => stop.id),
                groupId: targetGroupId,
              },
            ],
          }
        : current,
    );
    return {
      firstStopId: movingStops[0].id,
      firstSourceGroupId: sourceGroupByJobId.get(movingJobIds[0]) || targetGroupId,
      jobCount: movingJobIds.length,
      stopCount: movingStops.length,
      targetGroup,
    };
  };

  const handleBatchMoveStops = async (targetGroupId: string) => {
    if (!plan?.id || !batchSelectedStopIds.length) return;
    const targetGroup = groups.find((group) => group.id === targetGroupId);
    if (!targetGroup) {
      setError('The selected target route is no longer available.');
      return;
    }
    const movingJobIds = Array.from(
      new Set(
        stops
          .filter((stop) => batchSelectedStopIds.includes(stop.id))
          .map((stop) => stop.jobId),
      ),
    );
    const movingStops = stops.filter((stop) => movingJobIds.includes(stop.jobId));
    const firstSourceGroupId = movingStops[0]?.routePlanGroupId || targetGroupId;
    setSaving(true);
    setError(null);
    try {
      if (isLocalPlannerScenario) {
        const localResult = applyLocalBatchStopMove(targetGroupId);
        if (!localResult) return;
      } else {
        const response = await batchMoveRoutePlanStops(plan.id, {
          stopIds: batchSelectedStopIds,
          targetGroupId,
          targetSequence:
            stops.filter((stop) => stop.routePlanGroupId === targetGroupId).length + 1,
        });
        refreshPlanView(response);
      }
      setBatchSelectedStopIds([]);
      setSelectedGroupId(targetGroupId);
      setSelectedStopId(movingStops[0]?.id || null);
      if (movingStops[0]) {
        setRecentMove({
          stopId: movingStops[0].id,
          sourceGroupId: firstSourceGroupId,
          targetGroupId,
        });
      }
      setMode('manual');
      setMapDisplayMode('selected');
      setRoutingActionNotice(
        `${movingJobIds.length} ${movingJobIds.length === 1 ? 'job' : 'jobs'} (${movingStops.length} ${movingStops.length === 1 ? 'stop' : 'stops'}) moved into ${targetGroup.label}. Route totals were updated; reoptimize before publish.`,
      );
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          'The selected stops could not be moved. Review route constraints and retry.',
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
    .sort((left, right) => {
      if (unassignedSort === 'customer') {
        return String(left.customerName || left.id).localeCompare(String(right.customerName || right.id));
      }
      if (unassignedSort === 'city') {
        return getJobCity(left).localeCompare(getJobCity(right));
      }
      return (
        unassignedPriorityRank(left.priority) - unassignedPriorityRank(right.priority) ||
        String(left.customerName || left.id).localeCompare(String(right.customerName || right.id))
      );
    })
    .slice(0, isMarketingCapture ? 6 : 50);
  const unassignedJobIds = new Set(unassignedJobs.map((job) => job.id));
  const queuedUnassignedJobs = demandJobs.filter((job) => unassignedJobIds.has(job.id));
  const bestFitByJobId = new Map(
    queuedUnassignedJobs.map((job) => [
      job.id,
      recommendRouteForJob(job, groupedStops, vehicles, drivers),
    ]),
  );
  const mappedUnassignedJobs = unassignedJobs.flatMap((job) => {
    const location = getJobLocation(job);
    return location
      ? [{
          ...location,
          id: job.id,
          label: job.customerName || job.id,
          priority: job.priority,
        }]
      : [];
  });
  const selectedAreaJobs = unassignedJobs.filter((job) => mapSelectedJobIds.includes(job.id));
  const selectedAreaRecommendation = (() => {
    const locatedJobs = selectedAreaJobs.flatMap((job) => {
      const location = getJobLocation(job);
      return location ? [{ job, location }] : [];
    });
    if (!locatedJobs.length) return null;
    const centroid = {
      lat: locatedJobs.reduce((sum, item) => sum + item.location.lat, 0) / locatedJobs.length,
      lng: locatedJobs.reduce((sum, item) => sum + item.location.lng, 0) / locatedJobs.length,
    };
    return recommendRouteForJob(
      { ...locatedJobs[0].job, deliveryLocation: centroid, pickupLocation: undefined },
      groupedStops,
      vehicles,
      drivers,
      selectedAreaJobs,
    );
  })();
  const selectedAreaPriorityCount = selectedAreaJobs.filter((job) => isHighPriority(job.priority)).length;
  const unlocatedUnassignedCount = unassignedJobs.length - mappedUnassignedJobs.length;

  const handleMapAreaSelection = (jobIds: string[]) => {
    setMapSelectedJobIds(jobIds);
    setSelectedJobIds(jobIds);
    if (!jobIds.length) {
      setRoutingActionNotice('Map area selection cleared.');
      return;
    }
    setLeftPanelTab('jobs');
    setRoutingActionNotice(
      `${jobIds.length} unassigned ${jobIds.length === 1 ? 'job' : 'jobs'} selected from the map. Review the cluster before inserting or optimizing.`,
    );
  };

  const handleServiceDateChange = (nextDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    setServiceDate(nextDate);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('serviceDate', nextDate);
    setSearchParams(nextSearchParams, { replace: true });
    setRoutingActionNotice(`Route day changed to ${formatPlannerDate(nextDate)}.`);
  };

  const handlePlanningModeChange = (nextMode: 'suggested' | 'manual') => {
    setMode(nextMode);
    if (nextMode === 'manual') {
      setLaneEditorMode('expanded');
      setLeftPanelTab('routes');
      setMobilePanel('routes');
      setRoutingActionNotice('Manual edit mode enabled. Route lanes are open for assignment and stop moves.');
    } else {
      setLaneEditorMode('collapsed');
      setLeftPanelTab('jobs');
      setMobilePanel('map');
      setMapDisplayMode('all');
      setRoutingActionNotice('Auto assign mode enabled. The map is showing all route candidates.');
    }
  };

  const handleUnassignedJobToggle = (
    job: PlannerJobRecord,
    recommendation: RouteFitRecommendation | null,
  ) => {
    setSelectedJobIds((current) =>
      current.includes(job.id)
        ? current.filter((id) => id !== job.id)
        : [...current, job.id],
    );
    if (!recommendation) return;
    setSelectedGroupId(recommendation.groupId);
    setMapDisplayMode('selected');
    const fitReason = recommendation.distanceMiles !== null
      ? `${recommendation.distanceMiles.toFixed(1)} mi from the route area`
      : recommendation.areaMatch
        ? `${getJobCity(job)} area match`
        : 'lowest current workload';
    setRoutingActionNotice(recommendation.fits
      ? `Best fit for ${job.customerName || job.id}: ${recommendation.label} — ${fitReason}, ${recommendation.workload}% workload. Constraints pass for insertion.`
      : `${job.customerName || job.id} has no compatible route. Closest route ${recommendation.label} is blocked: ${recommendation.blocker || 'fleet constraints do not pass'}`,
    );
  };

  const handleInsertRecommendedJob = async (
    job: PlannerJobRecord,
    recommendation: RouteFitRecommendation,
  ) => {
    if (!plan?.id) {
      setError('Generate a draft route plan before inserting unassigned work.');
      return;
    }
    if (!recommendation.fits) {
      setError(
        recommendation.blocker ||
          'No current driver–vehicle route satisfies this job’s constraints.',
      );
      return;
    }
    const targetGroup = groupedStops.find(
      (group) => group.id === recommendation.groupId,
    );
    if (!targetGroup) {
      setError('The recommended route is no longer available. Refresh the plan and retry.');
      return;
    }

    setInsertingJobId(job.id);
    setError(null);
    try {
      if (isLocalPlannerScenario) {
        const insertedServiceMinutes = Math.max(
          10,
          Math.round(Number(job.estimatedDuration || 15)),
        );
        const targetSequence = targetGroup.stops.length + 1;
        const insertedStop: PlannerRoutePlanStop = {
          id: `local-insert-${job.id}`,
          routePlanId: plan.id,
          routePlanGroupId: recommendation.groupId,
          jobId: job.id,
          jobStopId: `local-job-stop-${job.id}`,
          stopSequence: targetSequence,
          isLocked: false,
          plannedArrival: job.timeWindowStart || null,
          plannedDeparture: job.timeWindowEnd || null,
          metadata: {
            stopType: 'DROPOFF',
            address: job.deliveryAddress || job.pickupAddress || 'Address pending',
            insertedManually: true,
          },
        };
        setStops((current) => [...current, insertedStop]);
        setGroups((current) =>
          current.map((group) =>
            group.id === recommendation.groupId
              ? {
                  ...group,
                  totalDurationMinutes:
                    Number(group.totalDurationMinutes || 0) +
                    insertedServiceMinutes +
                    12,
                  serviceTimeMinutes:
                    Number(group.serviceTimeMinutes || 0) + insertedServiceMinutes,
                  totalWeightKg:
                    Number(group.totalWeightKg || 0) + Number(job.weight || 0),
                  totalVolumeM3:
                    Number(group.totalVolumeM3 || 0) + Number(job.volume || 0),
                }
              : group,
          ),
        );
        setJobs((current) =>
          current.map((candidate) =>
            candidate.id === job.id
              ? { ...candidate, assignedRouteId: recommendation.groupId }
              : candidate,
          ),
        );
        setUnassignedJobs((current) =>
          current.filter((candidate) => candidate.id !== job.id),
        );
        setPlan((current) =>
          current
            ? {
                ...current,
                status: 'draft',
                metrics: {
                  ...(current.metrics || {}),
                  assignedJobCount:
                    Number(current.metrics?.assignedJobCount || routedStopCount) + 1,
                  unassignedJobCount: Math.max(
                    0,
                    Number(current.metrics?.unassignedJobCount || unassignedJobCount) - 1,
                  ),
                  stopCount: Number(current.metrics?.stopCount || routedStopCount) + 1,
                  totalDurationMinutes:
                    Number(current.metrics?.totalDurationMinutes || totalDurationMinutes) +
                    insertedServiceMinutes +
                    12,
                },
                warnings: [
                  ...(current.warnings || []),
                  {
                    type: 'MANUAL_INSERTION_REOPTIMIZE_REQUIRED',
                    message: `${job.customerName || job.id} was inserted into ${recommendation.label}. Reoptimize before publish.`,
                    jobId: job.id,
                    groupId: recommendation.groupId,
                  },
                ],
              }
            : current,
        );
      } else {
        const payload = await insertJobIntoRoutePlan(
          plan.id,
          recommendation.groupId,
          {
            jobId: job.id,
            targetSequence: targetGroup.stops.length + 1,
          },
        );
        refreshPlanView(payload);
      }

      setSelectedGroupId(recommendation.groupId);
      setMapDisplayMode('selected');
      setRoutingActionNotice(
        `${job.customerName || job.id} inserted into ${recommendation.label}. Route totals were updated; reoptimize before publish.`,
      );
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          'The job could not be inserted. Review route constraints and retry.',
        ),
      );
    } finally {
      setInsertingJobId(null);
    }
  };

  const handleInsertSelectedArea = async () => {
    if (!plan?.id || !selectedAreaRecommendation || !selectedAreaJobs.length) {
      setError('Select a mapped cluster and generate a draft route plan before inserting it.');
      return;
    }
    const targetGroup = groupedStops.find((group) => group.id === selectedAreaRecommendation.groupId);
    if (!targetGroup) {
      setError('The recommended route is no longer available. Refresh the plan and retry.');
      return;
    }

    setIsInsertingArea(true);
    setError(null);
    try {
      if (isLocalPlannerScenario) {
        for (const job of selectedAreaJobs) {
          await handleInsertRecommendedJob(job, selectedAreaRecommendation);
        }
      } else {
        let latestView = null;
        for (const [index, job] of selectedAreaJobs.entries()) {
          latestView = await insertJobIntoRoutePlan(plan.id, selectedAreaRecommendation.groupId, {
            jobId: job.id,
            targetSequence: targetGroup.stops.length + index + 1,
          });
        }
        if (latestView) refreshPlanView(latestView);
      }
      setSelectedJobIds([]);
      setMapSelectedJobIds([]);
      setSelectedGroupId(selectedAreaRecommendation.groupId);
      setMapDisplayMode('selected');
      setRoutingActionNotice(
        `${selectedAreaJobs.length} mapped ${selectedAreaJobs.length === 1 ? 'job was' : 'jobs were'} inserted into ${selectedAreaRecommendation.label} through constraint-checked route updates. Reoptimize before publish.`,
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'The selected cluster could not be fully inserted. Refresh the route day, review constraints, and retry.'));
    } finally {
      setIsInsertingArea(false);
    }
  };

  const applyRouteSummaryView = (
    view: { id: string; name: string; snapshot: RouteSummaryViewSnapshot },
  ) => {
    const snapshot = normalizeRouteSummaryViewSnapshot(view.snapshot);
    setRouteSummaryColumns(snapshot.columns);
    setRouteSummaryFilter(snapshot.summaryFilter);
    setRouteSearch(snapshot.routeSearch);
    setRouteQuickFilter(snapshot.routeQuickFilter);
    setDriverFilterId(
      snapshot.driverFilterId === 'all' || drivers.some((driver) => driver.id === snapshot.driverFilterId)
        ? snapshot.driverFilterId
        : 'all',
    );
    setVehicleFilterId(
      snapshot.vehicleFilterId === 'all' || vehicles.some((vehicle) => vehicle.id === snapshot.vehicleFilterId)
        ? snapshot.vehicleFilterId
        : 'all',
    );
    setMapDisplayMode(snapshot.mapDisplayMode);
    setActiveRouteSummaryViewId(view.id);
    setIsRouteSummaryViewsOpen(false);
    setRoutingActionNotice(`${view.name} applied to route summaries.`);
  };

  const toggleRouteSummaryColumn = (columnId: RouteSummaryColumnId) => {
    setRouteSummaryColumns((current) => {
      if (current.includes(columnId)) {
        return current.length === 1 ? current : current.filter((id) => id !== columnId);
      }
      return routeSummaryColumnDefinitions
        .map(({ id }) => id)
        .filter((id) => current.includes(id) || id === columnId);
    });
  };

  const openSaveRouteSummaryViewDialog = () => {
    setRouteSummaryViewName('');
    setRouteSummaryViewError('');
    setIsSaveRouteSummaryViewOpen(true);
  };

  const handleCreateRouteSummaryView = () => {
    const result = saveRouteSummaryView(
      savedRouteSummaryViews,
      routeSummaryViewName,
      currentRouteSummarySnapshot,
    );
    if (result.error || !result.saved) {
      setRouteSummaryViewError(result.error || 'The view could not be saved.');
      return;
    }
    setSavedRouteSummaryViews(result.views);
    setActiveRouteSummaryViewId(result.saved.id);
    setIsSaveRouteSummaryViewOpen(false);
    setRouteSummaryViewName('');
    setRouteSummaryViewError('');
    setRoutingActionNotice(`${result.saved.name} saved for this dispatcher.`);
  };

  const handleSaveActiveRouteSummaryView = () => {
    const savedView = savedRouteSummaryViews.find((view) => view.id === activeRouteSummaryViewId);
    if (!savedView) {
      openSaveRouteSummaryViewDialog();
      return;
    }
    const result = saveRouteSummaryView(
      savedRouteSummaryViews,
      savedView.name,
      currentRouteSummarySnapshot,
      { id: savedView.id },
    );
    if (result.error || !result.saved) {
      setRouteSummaryViewError(result.error || 'The view could not be updated.');
      return;
    }
    setSavedRouteSummaryViews(result.views);
    setRoutingActionNotice(`${result.saved.name} updated.`);
  };

  const handleRenameRouteSummaryView = (view: SavedRouteSummaryView) => {
    const result = saveRouteSummaryView(
      savedRouteSummaryViews,
      editingRouteSummaryViewName,
      view.snapshot,
      { id: view.id },
    );
    if (result.error) {
      setRouteSummaryViewError(result.error);
      return;
    }
    setSavedRouteSummaryViews(result.views);
    setEditingRouteSummaryViewId(null);
    setEditingRouteSummaryViewName('');
    setRouteSummaryViewError('');
  };

  const handleDeleteRouteSummaryView = (view: SavedRouteSummaryView) => {
    setSavedRouteSummaryViews((current) => deleteRouteSummaryView(current, view.id));
    if (activeRouteSummaryViewId === view.id) setActiveRouteSummaryViewId(null);
    if (editingRouteSummaryViewId === view.id) {
      setEditingRouteSummaryViewId(null);
      setEditingRouteSummaryViewName('');
    }
    setRouteSummaryViewError('');
    setRoutingActionNotice(`${view.name} deleted from saved views.`);
  };

  const commandBar = (
    <Stack spacing={1.05} data-testid="routing-planning-toolbar">
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', lg: 'center' }}
      >
        <SurfacePanel
          variant="subtle"
          padding={0.35}
          data-testid="routing-service-date-control"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.35, width: 'fit-content', maxWidth: '100%' }}
        >
          <IconButton
            size="small"
            aria-label="Previous route day"
            onClick={() => handleServiceDateChange(shiftServiceDate(serviceDate, -1))}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
          <TextField
            type="date"
            size="small"
            label="Route day"
            value={serviceDate}
            onChange={(event) => handleServiceDateChange(event.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'routing-service-date-input' }}
            sx={{ width: 154 }}
          />
          <IconButton
            size="small"
            aria-label="Next route day"
            onClick={() => handleServiceDateChange(shiftServiceDate(serviceDate, 1))}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
          <Button
            size="small"
            variant="text"
            onClick={() => handleServiceDateChange(todayServiceDate())}
            sx={{ minWidth: 54 }}
          >
            Today
          </Button>
        </SurfacePanel>
        <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" justifyContent={{ lg: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={plan?.id ? handleReoptimize : handleGenerate}
            disabled={saving || (!plan?.id && (selectedJobIds.length === 0 || selectedVehicleIds.length === 0))}
            data-testid={plan?.id ? 'routing-optimize-routes-button' : 'routing-generate-draft-button'}
            sx={{ minWidth: 148 }}
          >
            {plan?.id ? 'Optimize Routes' : 'Generate route draft'}
          </Button>
          <Button
            variant={mode === 'suggested' ? 'contained' : 'outlined'}
            onClick={() => handlePlanningModeChange('suggested')}
            disabled={saving}
          >
            Auto Assign
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setRoutingActionNotice('Rebalancing routes with the latest job and capacity data.');
              void handleReoptimize();
            }}
            disabled={saving || !plan?.id}
          >
            Rebalance
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setMapDisplayMode('density');
              setDensity('comfortable');
              setRoutingActionNotice('Scenario compare opened using route density view.');
            }}
          >
            Scenario Compare
          </Button>
        </Stack>
      </Stack>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={0.8}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <Stack direction="row" spacing={0.65} useFlexGap flexWrap="wrap">
          <StatusPill label={`${groups.length} routes`} tone={groups.length ? 'info' : 'default'} />
          <StatusPill label={`${routedStopCount} routed stops`} tone={routedStopCount ? 'accent' : 'default'} />
          <StatusPill
            label={`${unassignedJobCount} unassigned`}
            tone={unassignedJobCount ? 'warning' : 'success'}
          />
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', fontWeight: 750 }}>
            {serviceDateDisplayValue}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
          <TextField
            select
            size="small"
            label="Scenario"
            value={objective}
            onChange={(event) => setObjective(normalizeOptimizationObjective(event.target.value))}
            sx={{ minWidth: 190 }}
          >
            {objectives.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label === 'Balanced' ? 'Baseline' : item.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            onClick={handleSaveDraft}
            disabled={saving}
            data-testid="routing-draft-refresh-button"
          >
            {draftActionLabel}
          </Button>
          {!plan?.id ? null : isPlanPublished && !isRevisionMode ? (
            <StatusPill
              label={canShowDispatchHandoff ? 'Dispatch handoff ready' : 'Published'}
              tone="success"
            />
          ) : (
            <Button
              variant="contained"
              onClick={
                hasUnassignedBlocker
                  ? handleResolveUnassigned
                  : hasBlockingExceptions
                    ? handleReviewExceptions
                    : handlePublish
              }
              disabled={saving || !plan?.id}
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
          )}
        </Stack>
      </Stack>
    </Stack>
  );

  const planningKpiCards = (
    <Box
      data-testid="routing-planning-kpis"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(5, minmax(0, 1fr))',
        },
        gap: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.4,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      {[
        ['Total Miles', formatRouteDistance(totalDistanceKm), '+ live plan'],
        ['Est. Fuel Cost', formatMoney(estimatedFuelCost), '+ derived from miles'],
        ['Labor Hours', formatPlanningDuration(totalDurationMinutes || totalServiceMinutes), '+ route duration'],
        ['Route Balance Score', `${routeBalanceScore} / 100`, '+ workload spread'],
        ['SLA Compliance', `${slaCompliance}%`, '+ routable work'],
      ].map(([label, value, delta], index) => (
        <Box
          key={label}
          sx={{
            p: 1.15,
            minHeight: 70,
            gridColumn: {
              xs: index === 4 ? '1 / -1' : 'auto',
              md: 'auto',
            },
            borderRight: {
              xs: index < 4 && index % 2 === 0 ? '1px solid' : 'none',
              md: index === 4 ? 'none' : '1px solid',
            },
            borderBottom: {
              xs: index < 4 ? '1px solid' : 'none',
              md: 'none',
            },
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 0.35, fontSize: { xs: 22, md: 19, xl: 22 }, fontWeight: 900, lineHeight: 1 }}>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ mt: 0.7, display: 'block', color: 'success.main', fontWeight: 750 }}>
            {delta}
          </Typography>
        </Box>
      ))}
    </Box>
  );

  const planningUnassignedPanel = (
    <SurfacePanel
      variant="panel"
      padding={0}
      data-testid="routing-planning-unassigned-panel"
      sx={{
        overflow: 'hidden',
        minHeight: 0,
        maxHeight: { md: 'min(64vh, 660px)', xl: 'min(66vh, 720px)' },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Typography variant="h6">Unassigned Jobs ({unassignedJobCount})</Typography>
        <Button
          size="small"
          variant="text"
          onClick={() => {
            setLeftPanelTab('jobs');
            setRoutingActionNotice('Job filters are available in the Jobs panel.');
          }}
        >
          Filters
        </Button>
      </Stack>
      <Box sx={{ px: 1.2, pt: 1 }}>
        <TextField
          select
          size="small"
          label="Sort"
          value={unassignedSort}
          onChange={(event) => setUnassignedSort(event.target.value as UnassignedSort)}
          fullWidth
          data-testid="routing-unassigned-sort"
        >
          <MenuItem value="priority">Priority</MenuItem>
          <MenuItem value="customer">Customer</MenuItem>
          <MenuItem value="city">City</MenuItem>
        </TextField>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8 }}>
          Preview the best fit, then insert after an automatic constraint check.
        </Typography>
      </Box>
      <List disablePadding sx={{ mt: 0.5, maxHeight: { md: 'clamp(260px, 38vh, 430px)', xl: 'clamp(340px, 42vh, 520px)' }, overflowY: 'auto' }}>
        {queuedUnassignedJobs.length === 0 ? (
          <ListItem sx={{ py: 2 }}>
            <ListItemText primary="No unassigned jobs" secondary="All visible work is already routed." />
          </ListItem>
        ) : (
          queuedUnassignedJobs.slice(0, 8).map((job, index) => {
            const selected = selectedJobIds.includes(job.id);
            const priority = getPriorityLabel(job.priority);
            const recommendation = bestFitByJobId.get(job.id) || null;
            return (
              <ListItem
                key={job.id}
                disablePadding
                sx={{
                  display: 'block',
                  borderTop: index === 0 ? 'none' : '1px solid',
                  borderColor: 'divider',
                }}
              >
                <ListItemButton
                  selected={selected}
                  onClick={() => handleUnassignedJobToggle(job, recommendation)}
                  data-testid={`routing-unassigned-job-${index}`}
                  sx={{
                    alignItems: 'flex-start',
                    gap: 1,
                    py: 1,
                  }}
                >
                  <Box
                    sx={{
                      mt: 0.25,
                      width: 3,
                      alignSelf: 'stretch',
                      borderRadius: 99,
                      bgcolor: isHighPriority(job.priority) ? 'error.main' : index % 3 === 0 ? 'success.main' : 'warning.main',
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="body2" sx={{ fontWeight: 850 }} noWrap>
                        {job.customerName || job.id}
                      </Typography>
                      <StatusPill label={priority} tone={isHighPriority(job.priority) ? 'danger' : 'warning'} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {job.deliveryAddress || job.pickupAddress || 'Address pending'}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.45 }}>
                      <Typography variant="caption" color="text.secondary">
                        {getJobCity(job)}
                      </Typography>
                      {recommendation ? (
                        <Typography
                          variant="caption"
                          color={recommendation.fits ? 'primary.main' : 'error.main'}
                          sx={{ fontWeight: 800 }}
                          data-testid={`routing-best-fit-${index}`}
                        >
                          {recommendation.fits ? 'Best fit' : 'Blocked'} {recommendation.label}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>
                          Awaiting route
                        </Typography>
                      )}
                    </Stack>
                    {recommendation ? (
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {recommendation.distanceMiles !== null
                          ? `${recommendation.distanceMiles.toFixed(1)} mi from route area`
                          : recommendation.areaMatch
                            ? 'Same service area'
                            : 'Lowest active workload'}
                        {' · '}{recommendation.workload}% workload
                      </Typography>
                    ) : null}
                  </Box>
                </ListItemButton>
                {recommendation ? (
                  <Button
                    size="small"
                    variant="text"
                    fullWidth
                    disabled={!recommendation.fits || Boolean(insertingJobId) || saving}
                    onClick={() => void handleInsertRecommendedJob(job, recommendation)}
                    data-testid={`routing-insert-recommended-${index}`}
                    sx={{ justifyContent: 'flex-start', px: 2.2, pb: 0.9, pt: 0.2 }}
                  >
                    {insertingJobId === job.id
                      ? 'Checking constraints…'
                      : recommendation.fits
                        ? `Insert into ${recommendation.label}`
                        : recommendation.blocker || 'No compatible route'}
                  </Button>
                ) : null}
              </ListItem>
            );
          })
        )}
      </List>
    </SurfacePanel>
  );

  const routeSummariesPanel = (
    <SurfacePanel variant="panel" padding={0} data-testid="routing-route-summaries-panel" sx={{ overflow: 'hidden', minHeight: 0 }}>
      <Stack spacing={0.8} sx={{ px: 1.2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6">Route Summaries</Typography>
            <Typography variant="caption" color="text.secondary">
              Attention-first route review
            </Typography>
          </Box>
          <Button size="small" variant="text" onClick={() => setMapDisplayMode('all')}>
            View on map
          </Button>
        </Stack>
        <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap" alignItems="center">
          <Typography
            variant="caption"
            color={activeRouteSummaryViewIsModified ? 'warning.main' : 'text.secondary'}
            sx={{ fontWeight: 850, mr: 'auto' }}
            data-testid="routing-active-summary-view"
          >
            {activeRouteSummaryView?.name || 'Custom view'}
            {activeRouteSummaryViewIsModified ? ' · Modified' : ''}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setRouteSummaryViewError('');
              setIsRouteSummaryViewsOpen(true);
            }}
            data-testid="routing-open-saved-views"
          >
            Views
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setIsRouteSummaryColumnsOpen(true)}
            data-testid="routing-open-summary-columns"
          >
            Columns {routeSummaryColumns.length}
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={handleSaveActiveRouteSummaryView}
            disabled={Boolean(activeSavedRouteSummaryView) && !activeRouteSummaryViewIsModified}
            data-testid="routing-save-summary-view"
          >
            {activeSavedRouteSummaryView
              ? activeRouteSummaryViewIsModified ? 'Save changes' : 'Saved'
              : 'Save view'}
          </Button>
        </Stack>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={routeSummaryFilter}
          onChange={(_, value: RouteSummaryFilter | null) => value && setRouteSummaryFilter(value)}
          aria-label="Route summary filter"
          data-testid="routing-route-summary-filter"
          sx={{
            '& .MuiToggleButton-root': {
              py: 0.45,
              px: 0.75,
              textTransform: 'none',
              fontWeight: 850,
              fontSize: 12,
            },
          }}
        >
          <ToggleButton value="all">All {visibleGroupedStops.length}</ToggleButton>
          <ToggleButton value="attention">Attention {attentionRouteCount}</ToggleButton>
          <ToggleButton value="ready">Ready {Math.max(0, visibleGroupedStops.length - attentionRouteCount)}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Stack spacing={0} sx={{ maxHeight: 'calc(100vh - 386px)', overflowY: 'auto' }}>
        {routeSummaryGroups.length === 0 ? (
          <Box sx={{ px: 1.2, py: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 850 }}>
              No routes in this view
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Choose another filter or clear the route search.
            </Typography>
          </Box>
        ) : routeSummaryGroups.map((group) => {
          const mapRoute = mapRoutes.find((route) => route.id === group.id);
          const driver = group.driverId ? drivers.find((item) => item.id === group.driverId) : null;
          const vehicle = group.vehicleId ? vehicles.find((item) => item.id === group.vehicleId) : null;
          const driverName = driver
            ? [driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.id
            : 'Unassigned';
          const needsAttention = routeGroupNeedsAttention(group);
          const workload = routeWorkloadPercent(group);
          const columnValues: Record<RouteSummaryColumnId, { label: string; value: string }> = {
            driver: { label: 'Driver', value: driverName },
            vehicle: {
              label: 'Vehicle',
              value: vehicle?.licensePlate || group.vehicleId || 'Pending',
            },
            stops: { label: 'Stops', value: String(group.stops.length) },
            distance: {
              label: 'Miles',
              value: formatRouteDistance(group.totalDistanceKm).replace(' mi', ''),
            },
            duration: {
              label: 'Route time',
              value: formatPlanningDuration(group.totalDurationMinutes),
            },
            service: {
              label: 'Service',
              value: formatPlanningDuration(group.serviceTimeMinutes),
            },
            weight: {
              label: 'Weight',
              value: `${Math.round(Number(group.totalWeightKg || 0)).toLocaleString()} kg`,
            },
            volume: {
              label: 'Volume',
              value: `${Number(group.totalVolumeM3 || 0).toFixed(1)} m³`,
            },
            workload: { label: 'Workload', value: `${workload}%` },
          };
          const metricColumns = routeSummaryColumns.filter((columnId) => columnId !== 'workload');
          return (
            <Box
              key={group.id}
              component="button"
              type="button"
              onClick={() => setSelectedGroupId(group.id)}
              aria-pressed={group.id === selectedGroup?.id}
              data-testid={`routing-route-summary-${group.id}`}
              sx={{
                width: '100%',
                appearance: 'none',
                border: 0,
                textAlign: 'left',
                font: 'inherit',
                color: 'text.primary',
                cursor: 'pointer',
                px: 1.2,
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: group.id === selectedGroup?.id ? alpha(mapRoute?.color || theme.palette.primary.main, 0.08) : 'transparent',
                '&:hover': {
                  bgcolor: alpha(mapRoute?.color || theme.palette.primary.main, 0.08),
                },
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: -2,
                },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.85}>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: mapRoute?.color || 'primary.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 900 }} noWrap>
                  {group.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {group.stops[0] ? getStopCity(group.stops[0]) : 'Route'}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <StatusPill
                  label={needsAttention ? 'Attention' : 'Ready'}
                  tone={needsAttention ? 'warning' : 'success'}
                />
              </Stack>
              {metricColumns.length ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    columnGap: 1,
                    rowGap: 0.75,
                    alignItems: 'start',
                    mt: 0.8,
                  }}
                >
                  {metricColumns.map((columnId) => (
                    <Box
                      key={columnId}
                      sx={{ minWidth: 0 }}
                      data-testid={`routing-route-summary-${group.id}-column-${columnId}`}
                    >
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {columnValues[columnId].label}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 850 }} display="block" noWrap>
                        {columnValues[columnId].value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : null}
              {routeSummaryColumns.includes('workload') ? (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mt: 0.8 }}
                  data-testid={`routing-route-summary-${group.id}-column-workload`}
                >
                  <Typography variant="caption" color={workload > 100 ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 850, minWidth: 78 }}>
                    {workload}% workload
                  </Typography>
                  <Box sx={{ flex: 1, height: 6, borderRadius: 99, bgcolor: alpha(theme.palette.text.primary, 0.1), overflow: 'hidden' }}>
                    <Box
                      sx={{
                        width: `${Math.min(workload, 100)}%`,
                        height: '100%',
                        bgcolor: workload > 100 ? 'error.main' : needsAttention ? 'warning.main' : 'success.main',
                      }}
                    />
                  </Box>
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </Stack>
    </SurfacePanel>
  );

  const planningAlertsPanel = (
    <SurfacePanel variant="panel" padding={1.1} data-testid="routing-planning-alerts-panel">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
        <Typography variant="h6">Alerts</Typography>
        <Button size="small" variant="text" onClick={() => setWarningsExpanded((current) => !current)}>
          View all alerts
        </Button>
      </Stack>
      <Stack spacing={0.75}>
        {(publishBlockingBlockers.length ? publishBlockingBlockers.slice(0, 3) : exceptionRecords.filter((item) => item.status === 'open').slice(0, 3)).map((alert, index) => (
          <Stack key={'code' in alert ? `${alert.code}-${index}` : alert.id} direction="row" spacing={0.8} alignItems="flex-start">
            <Typography sx={{ color: index === 0 ? 'error.main' : 'warning.main', fontWeight: 900, lineHeight: 1 }}>△</Typography>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 850 }} noWrap>
                {'code' in alert ? alert.code.replace(/_/g, ' ') : alert.type}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {'message' in alert ? alert.message : alert.recommendedAction}
              </Typography>
            </Box>
          </Stack>
        ))}
        {!publishBlockingBlockers.length && !exceptionRecords.some((item) => item.status === 'open') ? (
          <Typography variant="body2" color="text.secondary">No active route alerts.</Typography>
        ) : null}
      </Stack>
    </SurfacePanel>
  );

  const scenarioCardsPanel = (
    <SurfacePanel variant="panel" padding={1.1} data-testid="routing-scenario-cards">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '160px repeat(4, minmax(0, 1fr))' },
          gap: 1,
          alignItems: 'stretch',
        }}
      >
        <Box>
          <Typography variant="h6">Scenarios</Typography>
          <Typography variant="caption" color="text.secondary">
            Compare optimization strategies
          </Typography>
        </Box>
        {[
          ['Baseline', totalDistanceMiles, estimatedFuelCost, estimatedLaborCost, totalDurationMinutes, true],
          ['Fastest', totalDistanceMiles * 0.94, estimatedFuelCost * 1.08, estimatedLaborCost * 0.96, totalDurationMinutes * 0.92, false],
          ['Lowest Cost', totalDistanceMiles * 1.05, estimatedFuelCost * 0.88, estimatedLaborCost * 0.94, totalDurationMinutes * 1.07, false],
          ['Balanced', totalDistanceMiles * 0.98, estimatedFuelCost * 0.96, estimatedLaborCost * 0.97, totalDurationMinutes * 0.97, false],
        ].map(([label, miles, fuel, labor, minutes, selected]) => (
          <Box
            key={String(label)}
            sx={{
              border: '1px solid',
              borderColor: selected ? 'primary.main' : 'divider',
              borderRadius: 1,
              p: 1,
              bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'background.default',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 900 }}>{label}</Typography>
            <Stack spacing={0.25} sx={{ mt: 0.7 }}>
              <Typography variant="caption">{Number(miles).toFixed(1)} mi</Typography>
              <Typography variant="caption">{formatMoney(Number(fuel))}</Typography>
              <Typography variant="caption">{formatMoney(Number(labor))} labor</Typography>
              <Typography variant="caption">{formatPlanningDuration(Number(minutes))}</Typography>
            </Stack>
          </Box>
        ))}
      </Box>
    </SurfacePanel>
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
      {hasPublishReadinessBlockers ? (
        <Alert
          severity="warning"
          data-testid="routing-publish-readiness-alert"
          action={
            <Button
              color="inherit"
              size="small"
              endIcon={warningsExpanded ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setWarningsExpanded((current) => !current)}
              data-testid="routing-warnings-toggle"
              sx={{ fontWeight: 850 }}
            >
              {warningsExpanded ? 'Hide' : 'Show'}
            </Button>
          }
        >
          <Stack spacing={warningsExpanded ? 1 : 0.25}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                Warnings
              </Typography>
              <Typography variant="body2">
                {publishBlockingBlockers.length} planner check{publishBlockingBlockers.length === 1 ? '' : 's'} need review before publish.
              </Typography>
            </Box>
            <Collapse in={warningsExpanded} timeout="auto" unmountOnExit>
              <Stack spacing={0.75} sx={{ pt: 0.75 }}>
                {publishBlockingBlockers.slice(0, 6).map((blocker, index) => (
                  <Stack
                    key={`${blocker.code}-${blocker.jobId || blocker.groupId || blocker.warningIndex || index}`}
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ md: 'center' }}
                    spacing={0.75}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      px: 1,
                      py: 0.75,
                      bgcolor: alpha(theme.palette.background.paper, 0.72),
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 850 }}>
                        {blocker.code.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {blocker.message}
                      </Typography>
                    </Box>
                    {blocker.canAcceptRisk ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenPublishRisk(blocker)}
                      >
                        Accept risk
                      </Button>
                    ) : (
                      <StatusPill label="Required fix" tone="danger" />
                    )}
                  </Stack>
                ))}
                {publishBlockingBlockers.length > 6 ? (
                  <Typography variant="caption" color="text.secondary">
                    + {publishBlockingBlockers.length - 6} more blockers
                  </Typography>
                ) : null}
              </Stack>
            </Collapse>
          </Stack>
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
      <Box
        sx={{
          px: 1.5,
          py: 1.15,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">Draft job selection</Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedJobIds.length} selected for the next optimization draft.
          </Typography>
        </Box>
        <StatusPill
          label={`${selectedJobIds.length} selected`}
          tone={selectedJobIds.length > 0 ? 'accent' : 'default'}
        />
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
          const recommendation = bestFitByJobId.get(job.id) || null;
          return (
            <ListItem key={job.id} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                onClick={() => {
                  if (recommendation) {
                    handleUnassignedJobToggle(job, recommendation);
                    return;
                  }
                  setSelectedJobIds((current) =>
                    current.includes(job.id)
                      ? current.filter((id) => id !== job.id)
                      : [...current, job.id],
                  );
                }}
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
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 750 }} noWrap>
                    {job.customerName || 'Job'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    {job.deliveryAddress || job.pickupAddress || 'Address pending'}
                  </Typography>
                  {recommendation ? (
                    <Typography
                      variant="caption"
                      color={recommendation.fits ? 'primary.main' : 'error.main'}
                      display="block"
                      sx={{ fontWeight: 800 }}
                      data-testid={`routing-mobile-best-fit-${index}`}
                    >
                      {recommendation.fits ? 'Best fit' : 'Blocked'} {recommendation.label} · {recommendation.workload}% workload
                    </Typography>
                  ) : null}
                </Box>
                <StatusPill
                  label={getPriorityLabel(job.priority)}
                  tone={isHighPriority(job.priority) ? 'warning' : 'default'}
                />
              </ListItemButton>
              {recommendation ? (
                <Button
                  size="small"
                  variant="text"
                  fullWidth
                  disabled={!recommendation.fits || Boolean(insertingJobId) || saving}
                  onClick={() => void handleInsertRecommendedJob(job, recommendation)}
                  data-testid={`routing-mobile-insert-recommended-${index}`}
                  sx={{ justifyContent: 'flex-start', pl: 6.6, pb: 0.8, pt: 0 }}
                >
                  {insertingJobId === job.id
                    ? 'Checking constraints…'
                    : recommendation.fits
                      ? `Insert into ${recommendation.label}`
                      : recommendation.blocker || 'No compatible route'}
                </Button>
              ) : null}
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

  const mapDisplayModeLabel: Record<MapDisplayMode, string> = {
    selected: 'Selected route',
    all: 'All routes',
    density: 'Route density',
    exceptions: 'Exceptions only',
  };

  const mapPanel = (
    <SurfacePanel
      variant="canvas"
      padding={0}
      data-testid="routing-map-panel"
      sx={{
        overflow: 'hidden',
        flex: isDesktopWorkspace ? '1 1 0' : undefined,
        minHeight: isDesktopWorkspace ? '100%' : { xs: 430, md: 540 },
        height: isDesktopWorkspace ? '100%' : { xs: 430, md: 540 },
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
          <Typography variant="h6" noWrap sx={{ display: { xs: 'none', xl: 'block' }, fontSize: 15 }}>
            Route map
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ flex: '0 0 auto' }}>
          <Typography
            data-testid="routing-map-mode-state"
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 850, whiteSpace: 'nowrap' }}
          >
            {`Map view: ${mapDisplayModeLabel[mapDisplayMode]}`}
          </Typography>
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
      {selectedAreaJobs.length ? (
        <Paper
          variant="outlined"
          data-testid="routing-map-area-review"
          sx={{ mx: 1, mb: 1, p: 1.1, borderColor: alpha(theme.palette.warning.main, 0.4) }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                Map cluster: {selectedAreaJobs.length} unassigned {selectedAreaJobs.length === 1 ? 'job' : 'jobs'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedAreaPriorityCount} high priority • Best fit: {selectedAreaRecommendation?.label || 'No eligible route'}
                {unlocatedUnassignedCount ? ` • ${unlocatedUnassignedCount} unlocated excluded` : ''}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75}>
              <Button size="small" onClick={() => handleMapAreaSelection([])}>
                Clear
              </Button>
              <Button
                size="small"
                variant="contained"
                data-testid="routing-map-area-insert"
                disabled={!plan?.id || !selectedAreaRecommendation || isInsertingArea || saving}
                onClick={handleInsertSelectedArea}
              >
                {isInsertingArea ? 'Checking constraints…' : `Insert into ${selectedAreaRecommendation?.label || 'best fit'}`}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {displayedMapRoutes.length ? (
          <MultiRouteMap
            routes={displayedMapRoutes}
            height="100%"
            showLegend={false}
            selectedRouteId={selectedGroupId}
            displayMode={mapDisplayMode}
            onRouteSelect={(routeId) => {
              if (routeId) setSelectedGroupId(routeId);
            }}
            selectableJobs={mappedUnassignedJobs}
            selectedJobIds={selectedAreaJobs.map((job) => job.id)}
            onAreaSelectionChange={handleMapAreaSelection}
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
      batchSelectedStopIds={batchSelectedStopIds}
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
      onToggleStopSelection={(stopId) =>
        setBatchSelectedStopIds((current) =>
          current.includes(stopId)
            ? current.filter((candidate) => candidate !== stopId)
            : [...current, stopId],
        )
      }
      onSetStopSelection={(stopIds, selected) =>
        setBatchSelectedStopIds((current) => {
          const next = new Set(current);
          stopIds.forEach((stopId) => {
            if (selected) next.add(stopId);
            else next.delete(stopId);
          });
          return Array.from(next);
        })
      }
      onClearStopSelection={() => setBatchSelectedStopIds([])}
      onBatchMove={(targetGroupId) => void handleBatchMoveStops(targetGroupId)}
      formatDistance={formatDistance}
    />
  );

  const routeTimelinePanel = (
    <RouteStopTimelineStrip
      selectedGroup={selectedGroup}
      timelineGroups={mapDisplayMode === 'all' ? visibleGroupedStops : undefined}
      selectedStopId={selectedStopId}
      onStopSelect={(groupId, stopId) => {
        setSelectedGroupId(groupId);
        setSelectedStopId(stopId);
      }}
      driverName={selectedDriverName}
      routeColor={selectedMapRoute?.color}
      routeColorsById={Object.fromEntries(mapRoutes.map((route) => [route.id, route.color]))}
      onReoptimize={handleReoptimize}
      isBusy={saving}
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
      driverFamiliarity={driverFamiliarityQuery.data?.recommendations.find(
        (recommendation) => recommendation.groupId === selectedGroup?.id,
      ) || null}
      driverFamiliarityContext={driverFamiliarityQuery.data || null}
      driverFamiliarityLoading={driverFamiliarityQuery.isLoading}
      driverFamiliarityError={driverFamiliarityQuery.isError}
      onUpdateAssignments={(groupId, payload) => void updateAssignments(groupId, payload)}
      onToggleStopLock={(stopId, isLocked) => void toggleStopLock(stopId, isLocked)}
      onSetRouteOrderProtection={(locked) => void setRouteOrderProtection(locked)}
    />
  );

  return (
    <Box
      data-testid="routing-workspace-page"
      data-capture-mode={isMarketingCapture ? 'marketing' : undefined}
      data-runtime-mode={routingWorkspaceRuntimeMode}
      data-query-states-allowed={String(areRoutingWorkspaceQueryStatesAllowed)}
      data-capability-exception-decision-api={String(routingWorkspaceCapabilities.exceptionDecisionApi)}
      data-capability-publish-readiness-api={String(routingWorkspaceCapabilities.publishReadinessApi)}
      data-capability-route-version-api={String(routingWorkspaceCapabilities.routeVersionApi)}
      data-capability-dispatch-handoff-api={String(routingWorkspaceCapabilities.dispatchHandoffApi)}
      data-capability-save-draft-api={String(routingWorkspaceCapabilities.saveDraftApi)}
      data-capability-autosave-status={String(routingWorkspaceCapabilities.autosaveStatus)}
      data-capability-structured-planner-errors={String(routingWorkspaceCapabilities.structuredPlannerErrors)}
      data-capability-role-permissions={String(routingWorkspaceCapabilities.rolePermissions)}
      data-density={density}
      data-selected-route-id={selectedGroupId || undefined}
      data-route-version={routingWorkspaceCapabilities.routeVersionApi ? routeVersion || undefined : undefined}
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

      {routingActionNotice ? (
        <Alert
          severity="info"
          data-testid="routing-action-notice"
          onClose={() => setRoutingActionNotice(null)}
        >
          {routingActionNotice}
        </Alert>
      ) : null}

      {optimizerProvenance ? (
        <SurfacePanel
          variant="panel"
          padding={1.15}
          data-testid="optimizer-provenance"
          sx={{
            borderColor: optimizerProvenance.fallbackUsed ? 'warning.main' : 'divider',
            bgcolor: optimizerProvenance.fallbackUsed
              ? alpha(isDark ? '#352512' : '#FFF4E1', isDark ? 0.26 : 0.7)
              : undefined,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                Optimizer evidence
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {optimizerProvenance.fallbackUsed
                  ? 'Estimated travel inputs are visible for review and block production publish.'
                  : 'This draft used provider-backed road travel times and distances.'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.65} useFlexGap flexWrap="wrap">
              <StatusPill
                label={`${optimizerProvenance.solver} ${optimizerProvenance.solverVersion}`}
                tone="info"
              />
              <StatusPill
                label={optimizerProvenance.matrixMode === 'road_network'
                  ? `Road matrix · ${optimizerProvenance.matrixProvider}`
                  : `Estimated matrix · ${optimizerProvenance.matrixProvider}`}
                tone={optimizerProvenance.fallbackUsed ? 'warning' : 'success'}
              />
              <StatusPill label={`${optimizerProvenance.solveDurationMs} ms`} tone="default" />
              <StatusPill
                label={`${optimizerProvenance.coordinateCoveragePercent}% coordinates · ${optimizerProvenance.locationCount} points`}
                tone={optimizerProvenance.coordinateCoveragePercent === 100 ? 'success' : 'warning'}
              />
            </Stack>
          </Stack>
        </SurfacePanel>
      ) : null}

      {!isDesktopWorkspace ||
      isEmptyRouteDay ||
      hasNoVehicles ||
      hasNoDrivers ||
      hasAddressGeocodeFailure ||
      hasStaleRouteDataWarning ||
      hasPublishReadinessBlockers
        ? workspaceStateAlerts
        : null}

      {planningKpiCards}

      {isPlanPublished && canShowDispatchHandoff ? (
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
                {routingWorkspaceCapabilities.routeVersionApi && routeVersion ? (
                  <StatusPill label={`Route version ${routeVersion}`} tone="info" />
                ) : null}
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

      {isPlanPublished && !canShowDispatchHandoff ? (
        <SurfacePanel
          variant="panel"
          padding={1.25}
          data-testid="routing-published-summary"
          sx={{
            borderColor: 'success.main',
            bgcolor: alpha(isDark ? '#16351f' : '#EAF7EE', isDark ? 0.22 : 0.62),
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <Box>
              <StatusPill label="Published" tone="success" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.55 }}>
                Route lanes are read-only until a revision is started.
              </Typography>
            </Box>
            {!isRevisionMode ? (
              <Button variant="outlined" onClick={handleStartRevision}>
                Start revision
              </Button>
            ) : null}
          </Stack>
        </SurfacePanel>
      ) : null}

      {isDesktopWorkspace ? (
        <Stack spacing={1.2} sx={{ minWidth: 0 }}>
          <Box
            data-testid="routing-reference-layout"
            sx={{
              display: 'grid',
              gap: 1.2,
              gridTemplateColumns: isHeroMarketingCapture
                ? 'minmax(0, 1fr) 320px'
                : isMarketingCapture
                  ? {
                      md: '200px minmax(360px, 1fr) 280px',
                      xl: 'minmax(218px, 248px) minmax(0, 1fr) minmax(270px, 310px)',
                    }
                  : {
                      md: '190px minmax(360px, 1fr) 280px',
                      xl: 'minmax(228px, 286px) minmax(0, 1fr) minmax(300px, 360px)',
                    },
              alignItems: 'stretch',
              minHeight: 0,
              overflow: 'visible',
            }}
          >
            {isHeroMarketingCapture ? null : planningUnassignedPanel}

            <Stack spacing={1.2} sx={{ minHeight: 0, minWidth: 0, overflow: 'visible' }}>
              <Box
                sx={{
                  minHeight: 238,
                  height: isMarketingCapture ? '41vh' : 'clamp(250px, 31vh, 380px)',
                  minWidth: 0,
                }}
              >
                {mapPanel}
              </Box>
              {isHeroMarketingCapture ? null : (
                <Box sx={{ minWidth: 0 }}>
                  {routeTimelinePanel}
                </Box>
              )}
              {isHeroMarketingCapture || laneEditorMode === 'fullscreen' ? null : (
                <Box
                  sx={{
                    minWidth: 0,
                    height:
                      laneEditorMode === 'collapsed'
                        ? 96
                        : batchSelectedStopIds.length
                          ? 'min(32vh, 340px)'
                          : 'min(21vh, 220px)',
                    maxHeight:
                      laneEditorMode === 'collapsed'
                        ? 96
                        : batchSelectedStopIds.length
                          ? 'min(32vh, 340px)'
                          : 'min(21vh, 220px)',
                    overflow: 'hidden',
                  }}
                >
                  {renderRouteEditorPanel()}
                </Box>
              )}
            </Stack>

            <Stack spacing={1.2} sx={{ minHeight: 0, minWidth: 0, overflow: 'visible' }}>
              {routeSummariesPanel}
              {planningAlertsPanel}
              {inspectorPanel}
            </Stack>
          </Box>
          <Box sx={{ display: { xs: 'none', xl: 'block' } }}>
            {scenarioCardsPanel}
          </Box>
        </Stack>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.2 }}>
          <ToggleButtonGroup
            fullWidth
            size="small"
            exclusive
            data-testid="routing-compact-panel-toggle"
            value={mobilePanel}
            onChange={(_, value) => {
              if (!value) return;
              setMobilePanel(value);
              if (value === 'jobs') setLeftPanelTab('jobs');
            }}
          >
            <ToggleButton value="map">Map</ToggleButton>
            <ToggleButton value="routes">Routes</ToggleButton>
            <ToggleButton value="jobs">Jobs</ToggleButton>
          </ToggleButtonGroup>
          {mobilePanel === 'map' ? (
            <Stack spacing={1.2} sx={{ minWidth: 0 }}>
              {mapPanel}
              {routeTimelinePanel}
            </Stack>
          ) : null}
          {mobilePanel === 'routes' ? (
            <Stack spacing={1.2}>
              {routeSummariesPanel}
              {draftRoutesPanel}
              {laneEditorMode === 'fullscreen' ? null : renderRouteEditorPanel()}
              {inspectorPanel}
            </Stack>
          ) : null}
          {mobilePanel === 'jobs' ? (
            <Stack spacing={1.2}>
              {leftPanelTabs}
            </Stack>
          ) : null}
        </Box>
      )}
      {laneEditorMode === 'fullscreen' ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            display: 'flex',
            minHeight: 0,
            p: { xs: 1, md: 1.5 },
            bgcolor: (currentTheme) => alpha(currentTheme.palette.background.default, 0.94),
            backdropFilter: 'blur(8px)',
          }}
        >
          {renderRouteEditorPanel(true)}
        </Box>
      ) : null}
      <Dialog
        open={isRouteSummaryColumnsOpen}
        onClose={() => setIsRouteSummaryColumnsOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          'data-testid': 'routing-summary-columns-dialog',
        } as Record<string, unknown>}
      >
        <DialogTitle>Route summary columns</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Choose the planning metrics shown on every route. Route name, area, and attention status always remain visible.
          </Typography>
          <List disablePadding>
            {routeSummaryColumnDefinitions.map((column) => {
              const checked = routeSummaryColumns.includes(column.id);
              const isOnlyColumn = checked && routeSummaryColumns.length === 1;
              return (
                <ListItem key={column.id} disablePadding>
                  <ListItemButton
                    onClick={() => toggleRouteSummaryColumn(column.id)}
                    disabled={isOnlyColumn}
                    dense
                  >
                    <Checkbox
                      edge="start"
                      checked={checked}
                      tabIndex={-1}
                      disableRipple
                      inputProps={{ 'aria-label': column.label }}
                    />
                    <ListItemText primary={column.label} secondary={column.description} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRouteSummaryColumns([...defaultRouteSummaryColumns])}>
            Reset defaults
          </Button>
          <Button variant="contained" onClick={() => setIsRouteSummaryColumnsOpen(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={isRouteSummaryViewsOpen}
        onClose={() => setIsRouteSummaryViewsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          'data-testid': 'routing-saved-views-dialog',
        } as Record<string, unknown>}
      >
        <DialogTitle>Dispatcher views</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
            Apply a built-in workflow or restore a personal view with its columns, route filters, search, and map mode.
          </Typography>
          <Typography variant="overline" color="text.secondary">Built-in views</Typography>
          <List disablePadding sx={{ mb: 1.5 }}>
            {builtInRouteSummaryViews.map((view) => (
              <ListItem key={view.id} disablePadding>
                <ListItemButton
                  onClick={() => applyRouteSummaryView(view)}
                  selected={activeRouteSummaryViewId === view.id && !activeRouteSummaryViewIsModified}
                  data-testid={`routing-apply-summary-view-${view.id.replace(':', '-')}`}
                >
                  <ListItemText primary={view.name} secondary={view.description} />
                  {activeRouteSummaryViewId === view.id ? (
                    <StatusPill
                      label={activeRouteSummaryViewIsModified ? 'Modified' : 'Active'}
                      tone={activeRouteSummaryViewIsModified ? 'warning' : 'success'}
                    />
                  ) : null}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
            <Typography variant="overline" color="text.secondary">Saved views</Typography>
            <Button size="small" onClick={() => {
              setIsRouteSummaryViewsOpen(false);
              openSaveRouteSummaryViewDialog();
            }}>
              Save current view
            </Button>
          </Stack>
          {routeSummaryViewError ? <Alert severity="error" sx={{ mb: 1 }}>{routeSummaryViewError}</Alert> : null}
          {savedRouteSummaryViews.length ? (
            <List disablePadding data-testid="routing-saved-view-list">
              {savedRouteSummaryViews.map((view) => (
                <ListItem
                  key={view.id}
                  disableGutters
                  data-testid="routing-saved-view-row"
                  sx={{
                    py: 0.8,
                    gap: 1,
                    alignItems: editingRouteSummaryViewId === view.id ? 'flex-start' : 'center',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {editingRouteSummaryViewId === view.id ? (
                    <TextField
                      size="small"
                      label="View name"
                      value={editingRouteSummaryViewName}
                      onChange={(event) => {
                        setEditingRouteSummaryViewName(event.target.value);
                        setRouteSummaryViewError('');
                      }}
                      inputProps={{ maxLength: 40 }}
                      autoFocus
                      fullWidth
                    />
                  ) : (
                    <ListItemText
                      primary={view.name}
                      secondary={`${view.snapshot.columns.length} columns · ${view.snapshot.summaryFilter === 'all' ? 'All routes' : view.snapshot.summaryFilter}`}
                    />
                  )}
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" justifyContent="flex-end">
                    {editingRouteSummaryViewId === view.id ? (
                      <>
                        <Button size="small" variant="contained" onClick={() => handleRenameRouteSummaryView(view)}>
                          Save name
                        </Button>
                        <Button size="small" onClick={() => {
                          setEditingRouteSummaryViewId(null);
                          setEditingRouteSummaryViewName('');
                          setRouteSummaryViewError('');
                        }}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="small" onClick={() => applyRouteSummaryView(view)}>
                          Apply
                        </Button>
                        <Button size="small" onClick={() => {
                          setEditingRouteSummaryViewId(view.id);
                          setEditingRouteSummaryViewName(view.name);
                          setRouteSummaryViewError('');
                        }}>
                          Rename
                        </Button>
                        <Button size="small" color="error" onClick={() => handleDeleteRouteSummaryView(view)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </Stack>
                </ListItem>
              ))}
            </List>
          ) : (
            <SurfacePanel variant="subtle" padding={1.1}>
              <Typography variant="body2" sx={{ fontWeight: 850 }}>No personal views yet</Typography>
              <Typography variant="caption" color="text.secondary">
                Configure the route summary, then save it for your next dispatch shift.
              </Typography>
            </SurfacePanel>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRouteSummaryViewsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={isSaveRouteSummaryViewOpen}
        onClose={() => setIsSaveRouteSummaryViewOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          'data-testid': 'routing-save-summary-view-dialog',
        } as Record<string, unknown>}
      >
        <DialogTitle>Save dispatcher view</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Saves the current columns, route search and filters, and map mode for your user account.
            </Typography>
            {routeSummaryViewError ? <Alert severity="error">{routeSummaryViewError}</Alert> : null}
            <TextField
              label="View name"
              value={routeSummaryViewName}
              onChange={(event) => {
                setRouteSummaryViewName(event.target.value);
                setRouteSummaryViewError('');
              }}
              inputProps={{ maxLength: 40 }}
              autoFocus
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSaveRouteSummaryViewOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateRouteSummaryView}
            disabled={!routeSummaryViewName.trim()}
          >
            Save view
          </Button>
        </DialogActions>
      </Dialog>
      <ExceptionResolutionDrawer
        open={isExceptionDrawerOpen}
        exceptions={exceptionRecords}
        riskReasons={exceptionRiskReasons}
        canDecideExceptions={routingWorkspaceCapabilities.exceptionDecisionApi}
        showCapabilityNotice={routingWorkspaceRuntimeMode !== 'production'}
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
              {hasDispatchHandoffCapability
                ? 'Confirm the plan is ready for dispatch handoff. Publishing records the current route version and locks route lanes until a revision is started.'
                : 'Confirm this route plan is ready to publish. Route lanes become read-only until a revision is started.'}
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
      <Dialog
        open={Boolean(publishRiskBlocker)}
        onClose={() => (acceptingPublishRisk ? undefined : setPublishRiskBlocker(null))}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          'data-testid': 'routing-accept-publish-risk-dialog',
        } as Record<string, unknown>}
      >
        <DialogTitle>Accept publish risk</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Alert severity="warning">
              {publishRiskBlocker?.message || 'This publish blocker requires a saved reason.'}
            </Alert>
            <TextField
              label="Reason"
              value={publishRiskReason}
              onChange={(event) => setPublishRiskReason(event.target.value)}
              multiline
              minRows={3}
              placeholder="Explain who approved this risk and how dispatch should handle it."
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPublishRiskBlocker(null)}
            disabled={acceptingPublishRisk}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleAcceptPublishRisk()}
            disabled={acceptingPublishRisk || publishRiskReason.trim().length < 8}
          >
            Save reason
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
