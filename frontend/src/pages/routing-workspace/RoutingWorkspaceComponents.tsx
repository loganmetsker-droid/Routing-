import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { RouteInspectorPanel } from '../../components/ops';
import { StatusPill, type StatusPillTone } from '../../components/StatusPill';
import { SurfacePanel } from '../../components/SurfacePanel';
import type { DriverRecord, VehicleRecord } from '../../services/api.types';
import type {
  PlannerRoutePlanGroup,
  PlannerRoutePlanStop,
} from '../../services/plannerApi';

export type LeftPanelTab = 'jobs' | 'routes' | 'vehicles';
export type InspectorTab = 'overview' | 'stops' | 'driver' | 'exceptions';
export type ViewDensity = 'comfortable' | 'compact';
export type LaneEditorMode = 'collapsed' | 'expanded' | 'fullscreen';
export type StopQuickFilter = 'all' | 'unassigned' | 'locked' | 'high' | 'late' | 'exception';
export type RouteQuickFilter =
  | 'all'
  | 'ready'
  | 'needs-driver'
  | 'needs-vehicle'
  | 'has-exceptions'
  | 'has-unassigned';
export type VehicleQuickFilter =
  | 'all'
  | 'available'
  | 'assigned'
  | 'capacity-issue'
  | 'driver-missing';

export type PlannerJobRecord = {
  id: string;
  customerName: string;
  deliveryAddress?: string;
  pickupAddress?: string;
  assignedRouteId?: string | null;
  priority?: string;
  status?: string;
  deliveryLocation?: { lat?: number; lng?: number } | null;
  pickupLocation?: { lat?: number; lng?: number } | null;
};

export type PlannerStopWithJob = PlannerRoutePlanStop & { job?: PlannerJobRecord };
export type PlannerRouteGroupWithStops = PlannerRoutePlanGroup & { stops: PlannerStopWithJob[] };

export type RecentRouteMove = {
  stopId: string;
  sourceGroupId: string;
  targetGroupId: string;
};

export type RouteStopMoveRequest = {
  stopId: string;
  sourceGroupId: string;
  targetGroupId: string;
  targetIndex: number;
};

export type RoutingExceptionSeverity = 'blocking' | 'warning' | 'info';
export type RoutingExceptionStatus = 'open' | 'resolved' | 'accepted';
export type RoutingExceptionType =
  | 'Route warning'
  | 'Stop exception'
  | 'Missing driver'
  | 'Missing vehicle';

export type RoutingExceptionRecord = {
  id: string;
  type: RoutingExceptionType;
  routeId: string;
  routeLabel: string;
  stopId?: string;
  affectedLabel: string;
  severity: RoutingExceptionSeverity;
  recommendedAction: string;
  owner: string;
  status: RoutingExceptionStatus;
  reason?: string;
};

const COMPACT_ROW_HEIGHT = 34;
const COMPACT_ROW_VIRTUALIZATION_THRESHOLD = 24;
const COMPACT_ROW_OVERSCAN = 2;
const COMPACT_ROW_VIEWPORT_HEIGHT = 220;

export function normalizeText(value: unknown) {
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value).trim().toLowerCase();
    } catch {
      return '';
    }
  }
  return String(value || '').trim().toLowerCase();
}

export function stopLabel(stop: PlannerRoutePlanStop) {
  return String(stop.metadata?.address || '').trim();
}

export function getStopCity(stop: PlannerStopWithJob) {
  const address = stopLabel(stop);
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || 'Address pending';
}

export function getJobCity(job: PlannerJobRecord) {
  const address = job.deliveryAddress || job.pickupAddress || '';
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || 'Address pending';
}

export function getPriorityLabel(priority?: string | null) {
  const normalized = normalizeText(priority);
  if (!normalized) return 'Normal';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function isHighPriority(priority?: string | null) {
  const normalized = normalizeText(priority);
  return normalized === 'high' || normalized === 'urgent';
}

export function stopSearchText(stop: PlannerStopWithJob, group?: PlannerRoutePlanGroup) {
  return normalizeText([
    stop.job?.customerName,
    stop.jobId,
    stopLabel(stop),
    getStopCity(stop),
    stop.job?.priority,
    stop.job?.status,
    group?.label,
  ].join(' '));
}

export function hasStopException(stop: PlannerStopWithJob) {
  return normalizeText(stop.metadata).includes('exception') || normalizeText(stop.job?.status).includes('exception');
}

export function hasStopLateRisk(stop: PlannerStopWithJob) {
  return normalizeText(stop.job?.status).includes('late') || isHighPriority(stop.job?.priority);
}

export function stopStatusLabel(stop: PlannerStopWithJob) {
  if (hasStopException(stop)) return 'Exception';
  if (hasStopLateRisk(stop)) return 'Late risk';
  return getPriorityLabel(stop.job?.priority);
}

export function jobSearchText(job: PlannerJobRecord) {
  return normalizeText([
    job.customerName,
    job.deliveryAddress,
    job.pickupAddress,
    getJobCity(job),
    job.priority,
    job.status,
  ].join(' '));
}

export function stopMatchesQuickFilter(
  stop: PlannerStopWithJob,
  group: PlannerRouteGroupWithStops,
  filter: StopQuickFilter,
) {
  if (filter === 'all') return true;
  if (filter === 'locked') return Boolean(stop.isLocked);
  if (filter === 'high') return isHighPriority(stop.job?.priority);
  if (filter === 'late') return isHighPriority(stop.job?.priority) || normalizeText(stop.job?.status).includes('late');
  if (filter === 'exception') {
    return Boolean(group.warnings?.length) || normalizeText(stop.metadata).includes('exception');
  }
  return true;
}

export function jobMatchesQuickFilter(job: PlannerJobRecord, filter: StopQuickFilter) {
  if (filter === 'all') return true;
  if (filter === 'unassigned') return !job.assignedRouteId;
  if (filter === 'locked') return false;
  if (filter === 'high') return isHighPriority(job.priority);
  if (filter === 'late') return isHighPriority(job.priority) || normalizeText(job.status).includes('late');
  if (filter === 'exception') return normalizeText(job.status).includes('exception');
  return true;
}

export function toneForRoute(group: PlannerRoutePlanGroup, stopCount: number) {
  if (!group.vehicleId) return 'warning';
  if (stopCount >= 4) return 'accent';
  return 'info';
}

export function trovanSurfaceColor(selected: boolean, isDark: boolean) {
  if (selected) return 'rgba(169, 99, 33, 0.18)';
  return isDark ? 'rgba(21, 18, 16, 0.94)' : 'rgba(255, 253, 249, 0.78)';
}

function SearchGlyph() {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: 16,
        height: 16,
        display: 'inline-flex',
        color: 'text.secondary',
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M16.5 16.5 21 21" />
      </svg>
    </Box>
  );
}

const ProtectedStopGlyph = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function ProtectedStopGlyph(props, ref) {
  return (
    <Box
      component="span"
      ref={ref}
      {...props}
      role="img"
      aria-label="Protected stop"
      title="Protected stop"
      sx={{
        width: 18,
        height: 18,
        display: 'inline-flex',
        color: 'warning.main',
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    </Box>
  );
});

export function DensityToggle({
  density,
  onChange,
}: {
  density: ViewDensity;
  onChange: (density: ViewDensity) => void;
}) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={density}
      onChange={(_, value) => value && onChange(value)}
      sx={{
        '& .MuiToggleButton-root': {
          px: 1.15,
          py: 0.65,
          textTransform: 'none',
          fontWeight: 850,
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          },
        },
      }}
      aria-label="View density"
    >
      <ToggleButton value="comfortable">Comfortable</ToggleButton>
      <ToggleButton value="compact">Compact</ToggleButton>
    </ToggleButtonGroup>
  );
}

export function RouteDaySummaryBar({
  totalJobCount,
  routedStopCount,
  routeCount,
  unassignedCount,
  openExceptionCount,
  hasPlan,
  routeDayStatusLabel,
  routeDayStatusTone,
  isPreviewPlanner,
}: {
  totalJobCount: number;
  routedStopCount: number;
  routeCount: number;
  unassignedCount: number;
  openExceptionCount: number;
  hasPlan: boolean;
  routeDayStatusLabel: string;
  routeDayStatusTone: StatusPillTone;
  isPreviewPlanner: boolean;
}) {
  return (
    <Stack
      data-testid="routing-route-day-summary"
      direction="row"
      spacing={0.75}
      flexWrap="wrap"
      useFlexGap
    >
      <StatusPill label={`${totalJobCount} total jobs`} tone="accent" />
      <StatusPill label={`${routedStopCount} routed`} tone="info" />
      <StatusPill
        label={`${unassignedCount} unassigned`}
        tone={unassignedCount ? 'warning' : 'success'}
      />
      <StatusPill label={`${routeCount} routes`} tone="info" />
      <StatusPill
        label={`${openExceptionCount} open exceptions`}
        tone={openExceptionCount ? 'warning' : 'success'}
      />
      <StatusPill
        label={hasPlan ? routeDayStatusLabel : 'Setup needed'}
        tone={hasPlan ? routeDayStatusTone : 'default'}
      />
      <StatusPill
        label={isPreviewPlanner ? 'Preview planner' : 'Live planner'}
        tone="default"
      />
    </Stack>
  );
}

export function JobSearchFilters({
  stopSearch,
  setStopSearch,
  stopQuickFilter,
  setStopQuickFilter,
  routeFilterId,
  setRouteFilterId,
  driverFilterId,
  setDriverFilterId,
  vehicleFilterId,
  setVehicleFilterId,
  routeGroups,
  drivers,
  vehicles,
}: {
  stopSearch: string;
  setStopSearch: (value: string) => void;
  stopQuickFilter: StopQuickFilter;
  setStopQuickFilter: (value: StopQuickFilter) => void;
  routeFilterId: string;
  setRouteFilterId: (value: string) => void;
  driverFilterId: string;
  setDriverFilterId: (value: string) => void;
  vehicleFilterId: string;
  setVehicleFilterId: (value: string) => void;
  routeGroups: PlannerRouteGroupWithStops[];
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
}) {
  return (
    <SurfacePanel variant="panel" padding={1.1} data-testid="routing-job-filter-panel">
      <Stack spacing={1}>
        <TextField
          size="small"
          label="Search jobs"
          value={stopSearch}
          onChange={(event) => setStopSearch(event.target.value)}
          data-testid="routing-job-search"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchGlyph />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          fullWidth
          size="small"
          exclusive
          value={stopQuickFilter}
          onChange={(_, value) => value && setStopQuickFilter(value)}
          aria-label="Stop filters"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            '& .MuiToggleButtonGroup-grouped': {
              borderRadius: '6px !important',
              border: '1px solid',
              borderColor: 'divider',
              mx: 0,
            },
            '& .MuiToggleButton-root': {
              px: 0.55,
              py: 0.45,
              fontSize: '0.72rem',
              lineHeight: 1.15,
              textTransform: 'none',
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="unassigned">Unassigned</ToggleButton>
          <ToggleButton value="locked">Locked</ToggleButton>
          <ToggleButton value="high">High</ToggleButton>
          <ToggleButton value="late">Late risk</ToggleButton>
          <ToggleButton value="exception">Exception</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" spacing={0.75}>
          <TextField
            select
            fullWidth
            size="small"
            label="Route"
            value={routeFilterId}
            onChange={(event) => setRouteFilterId(event.target.value)}
          >
            <MenuItem value="all">All routes</MenuItem>
            {routeGroups.map((group) => (
              <MenuItem key={group.id} value={group.id}>
                {group.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            size="small"
            label="Driver"
            value={driverFilterId}
            onChange={(event) => setDriverFilterId(event.target.value)}
          >
            <MenuItem value="all">All drivers</MenuItem>
            {drivers.map((driver) => (
              <MenuItem key={driver.id} value={driver.id}>
                {[driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.id}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <TextField
          select
          size="small"
          label="Vehicle"
          value={vehicleFilterId}
          onChange={(event) => setVehicleFilterId(event.target.value)}
        >
          <MenuItem value="all">All vehicles</MenuItem>
          {vehicles.map((vehicle) => (
            <MenuItem key={vehicle.id} value={vehicle.id}>
              {vehicle.licensePlate || vehicle.id}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </SurfacePanel>
  );
}

export function RouteSearchFilters({
  routeSearch,
  setRouteSearch,
  routeQuickFilter,
  setRouteQuickFilter,
  driverFilterId,
  setDriverFilterId,
  vehicleFilterId,
  setVehicleFilterId,
  drivers,
  vehicles,
}: {
  routeSearch: string;
  setRouteSearch: (value: string) => void;
  routeQuickFilter: RouteQuickFilter;
  setRouteQuickFilter: (value: RouteQuickFilter) => void;
  driverFilterId: string;
  setDriverFilterId: (value: string) => void;
  vehicleFilterId: string;
  setVehicleFilterId: (value: string) => void;
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
}) {
  return (
    <SurfacePanel variant="panel" padding={1.1} data-testid="routing-route-filter-panel">
      <Stack spacing={1}>
        <TextField
          size="small"
          label="Search routes"
          value={routeSearch}
          onChange={(event) => setRouteSearch(event.target.value)}
          data-testid="routing-route-search"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchGlyph />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          fullWidth
          size="small"
          exclusive
          value={routeQuickFilter}
          onChange={(_, value) => value && setRouteQuickFilter(value)}
          aria-label="Route filters"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            '& .MuiToggleButtonGroup-grouped': {
              borderRadius: '6px !important',
              border: '1px solid',
              borderColor: 'divider',
              mx: 0,
            },
            '& .MuiToggleButton-root': {
              px: 0.55,
              py: 0.45,
              fontSize: '0.72rem',
              lineHeight: 1.15,
              textTransform: 'none',
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="ready">Ready</ToggleButton>
          <ToggleButton value="needs-driver">Needs driver</ToggleButton>
          <ToggleButton value="needs-vehicle">Needs vehicle</ToggleButton>
          <ToggleButton value="has-exceptions">Has exceptions</ToggleButton>
          <ToggleButton value="has-unassigned">Has unassigned</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" spacing={0.75}>
          <TextField
            select
            fullWidth
            size="small"
            label="Driver"
            value={driverFilterId}
            onChange={(event) => setDriverFilterId(event.target.value)}
          >
            <MenuItem value="all">All drivers</MenuItem>
            {drivers.map((driver) => (
              <MenuItem key={driver.id} value={driver.id}>
                {[driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            size="small"
            label="Vehicle"
            value={vehicleFilterId}
            onChange={(event) => setVehicleFilterId(event.target.value)}
          >
            <MenuItem value="all">All vehicles</MenuItem>
            {vehicles.map((vehicle) => (
              <MenuItem key={vehicle.id} value={vehicle.id}>
                {vehicle.licensePlate || vehicle.id}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
    </SurfacePanel>
  );
}

export function VehicleSearchFilters({
  vehicleSearch,
  setVehicleSearch,
  vehicleQuickFilter,
  setVehicleQuickFilter,
}: {
  vehicleSearch: string;
  setVehicleSearch: (value: string) => void;
  vehicleQuickFilter: VehicleQuickFilter;
  setVehicleQuickFilter: (value: VehicleQuickFilter) => void;
}) {
  return (
    <SurfacePanel variant="panel" padding={1.1} data-testid="routing-vehicle-filter-panel">
      <Stack spacing={1}>
        <TextField
          size="small"
          label="Search vehicles"
          value={vehicleSearch}
          onChange={(event) => setVehicleSearch(event.target.value)}
          data-testid="routing-vehicle-search"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchGlyph />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          fullWidth
          size="small"
          exclusive
          value={vehicleQuickFilter}
          onChange={(_, value) => value && setVehicleQuickFilter(value)}
          aria-label="Vehicle filters"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            '& .MuiToggleButtonGroup-grouped': {
              borderRadius: '6px !important',
              border: '1px solid',
              borderColor: 'divider',
              mx: 0,
            },
            '& .MuiToggleButton-root': {
              px: 0.55,
              py: 0.45,
              fontSize: '0.72rem',
              lineHeight: 1.15,
              textTransform: 'none',
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="available">Available</ToggleButton>
          <ToggleButton value="assigned">Assigned</ToggleButton>
          <ToggleButton value="capacity-issue">Capacity issue</ToggleButton>
          <ToggleButton value="driver-missing">Driver missing</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </SurfacePanel>
  );
}

export function RoutingLeftPanel({
  leftPanelTab,
  setLeftPanelTab,
  jobFilters,
  routeFilters,
  vehicleFilters,
  jobsPanel,
  routesPanel,
  vehiclesPanel,
}: {
  leftPanelTab: LeftPanelTab;
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  jobFilters: ReactNode;
  routeFilters: ReactNode;
  vehicleFilters: ReactNode;
  jobsPanel: ReactNode;
  routesPanel: ReactNode;
  vehiclesPanel: ReactNode;
}) {
  return (
    <Stack spacing={1.2} sx={{ minHeight: 0, overflow: 'hidden' }}>
      <SurfacePanel variant="panel" padding={1.1}>
        <ToggleButtonGroup
          fullWidth
          size="small"
          exclusive
          value={leftPanelTab}
          onChange={(_, value) => value && setLeftPanelTab(value)}
          aria-label="Planning side panel"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 800,
            },
          }}
        >
          <ToggleButton value="jobs">Jobs</ToggleButton>
          <ToggleButton value="routes">Routes</ToggleButton>
          <ToggleButton value="vehicles">Vehicles</ToggleButton>
        </ToggleButtonGroup>
      </SurfacePanel>
      {leftPanelTab === 'jobs' ? jobFilters : null}
      {leftPanelTab === 'routes' ? routeFilters : null}
      {leftPanelTab === 'vehicles' ? vehicleFilters : null}
      {leftPanelTab === 'jobs' ? jobsPanel : null}
      {leftPanelTab === 'routes' ? routesPanel : null}
      {leftPanelTab === 'vehicles' ? vehiclesPanel : null}
    </Stack>
  );
}

export function CompactStopRows({
  group,
  previousGroupId,
  nextGroupId,
  recentMove,
  selectedStopId,
  selectedGroup,
  saving,
  isReadOnly = false,
  isDark,
  onSelectGroup,
  onSelectStop,
  onMoveStop,
}: {
  group: PlannerRouteGroupWithStops;
  previousGroupId?: string | null;
  nextGroupId?: string | null;
  recentMove: RecentRouteMove | null;
  selectedStopId: string | null;
  selectedGroup: PlannerRouteGroupWithStops | null;
  saving: boolean;
  isReadOnly?: boolean;
  isDark: boolean;
  onSelectGroup: (groupId: string) => void;
  onSelectStop: (stopId: string) => void;
  onMoveStop: (request: RouteStopMoveRequest) => void;
}) {
  const isSelectedLane = group.id === selectedGroup?.id;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const shouldVirtualize = group.stops.length > COMPACT_ROW_VIRTUALIZATION_THRESHOLD;
  const viewportHeight = shouldVirtualize
    ? Math.min(COMPACT_ROW_VIEWPORT_HEIGHT, group.stops.length * COMPACT_ROW_HEIGHT)
    : undefined;
  const startIndex = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / COMPACT_ROW_HEIGHT) - COMPACT_ROW_OVERSCAN)
    : 0;
  const visibleRowCount = shouldVirtualize && viewportHeight
    ? Math.ceil(viewportHeight / COMPACT_ROW_HEIGHT) + COMPACT_ROW_OVERSCAN * 2
    : group.stops.length;
  const endIndex = shouldVirtualize
    ? Math.min(group.stops.length, startIndex + visibleRowCount)
    : group.stops.length;
  const virtualStops = useMemo(
    () =>
      group.stops.slice(startIndex, endIndex).map((stop, offset) => ({
        stop,
        index: startIndex + offset,
      })),
    [endIndex, group.stops, startIndex],
  );
  const topSpacer = shouldVirtualize ? startIndex * COMPACT_ROW_HEIGHT : 0;
  const bottomSpacer = shouldVirtualize ? Math.max(0, (group.stops.length - endIndex) * COMPACT_ROW_HEIGHT) : 0;

  useEffect(() => {
    if (!shouldVirtualize || !viewportRef.current || group.id !== selectedGroup?.id || !selectedStopId) return;
    const selectedIndex = group.stops.findIndex((stop) => stop.id === selectedStopId);
    if (selectedIndex < 0) return;
    const nextTop = selectedIndex * COMPACT_ROW_HEIGHT;
    const currentTop = viewportRef.current.scrollTop;
    const currentBottom = currentTop + viewportRef.current.clientHeight;
    if (nextTop < currentTop || nextTop + COMPACT_ROW_HEIGHT > currentBottom) {
      viewportRef.current.scrollTop = Math.max(0, nextTop - COMPACT_ROW_HEIGHT * COMPACT_ROW_OVERSCAN);
      setScrollTop(viewportRef.current.scrollTop);
    }
  }, [group.id, group.stops, selectedGroup?.id, selectedStopId, shouldVirtualize]);

  return (
    <Box
      ref={viewportRef}
      data-testid="routing-virtualized-stop-list"
      data-virtualized={shouldVirtualize ? 'true' : 'false'}
      data-total-stop-rows={group.stops.length}
      data-rendered-stop-rows={virtualStops.length}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      sx={{
        maxHeight: shouldVirtualize ? `${viewportHeight}px` : 'none',
        overflowY: shouldVirtualize ? 'auto' : 'visible',
        pr: shouldVirtualize ? 0.35 : 0,
      }}
    >
      {topSpacer ? <Box aria-hidden sx={{ height: topSpacer }} /> : null}
      <Stack spacing={0.35}>
      {virtualStops.map(({ stop, index }) => (
        <Draggable
          key={stop.id}
          draggableId={stop.id}
          index={index}
          isDragDisabled={saving || isReadOnly || stop.isLocked}
        >
          {(dragProvided, dragSnapshot) => {
            const isRecentlyMoved = recentMove?.stopId === stop.id;
            const isSelectedStop = selectedStopId === stop.id;
            const isMoveDisabled = saving || isReadOnly || Boolean(stop.isLocked);
            const moveStop = (targetGroupId: string, targetIndex: number) => {
              onSelectGroup(targetGroupId);
              onSelectStop(stop.id);
              onMoveStop({
                stopId: stop.id,
                sourceGroupId: group.id,
                targetGroupId,
                targetIndex,
              });
            };

            return (
              <Box
                ref={dragProvided.innerRef}
                {...dragProvided.draggableProps}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectGroup(group.id);
                  onSelectStop(stop.id);
                }}
                data-testid="routing-compact-stop-row"
                data-stop-id={stop.id}
                data-stop-selected={isSelectedStop ? 'true' : 'false'}
                data-stop-locked={stop.isLocked ? 'true' : 'false'}
                data-stop-order={index + 1}
                sx={{
                  minHeight: COMPACT_ROW_HEIGHT - 2,
                  border: '1px solid',
                  borderColor: dragSnapshot.isDragging
                    ? '#F5B86C'
                    : isRecentlyMoved
                      ? '#D9903D'
                      : isSelectedStop
                        ? alpha('#B97129', 0.58)
                        : alpha(isDark ? '#FFF8ED' : '#17110D', 0.08),
                  bgcolor: dragSnapshot.isDragging
                    ? alpha('#D9903D', 0.15)
                    : isRecentlyMoved
                      ? alpha('#D9903D', isDark ? 0.2 : 0.16)
                      : isSelectedStop
                        ? alpha('#B97129', isDark ? 0.26 : 0.18)
                        : trovanSurfaceColor(isSelectedLane, isDark),
                  cursor: stop.isLocked ? 'not-allowed' : 'grab',
                  outline: dragSnapshot.isDragging
                    ? `3px solid ${alpha('#F5B86C', 0.84)}`
                    : isRecentlyMoved
                      ? `2px solid ${alpha('#D9903D', 0.58)}`
                      : '0 solid transparent',
                  outlineOffset: 2,
                  boxShadow: dragSnapshot.isDragging
                    ? `0 18px 36px ${alpha('#0C0907', 0.5)}, 0 0 0 6px ${alpha('#F5B86C', 0.22)}`
                    : isRecentlyMoved
                      ? `0 0 0 5px ${alpha('#D9903D', 0.14)}`
                      : 'none',
                  transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, outline-color 180ms ease',
                  display: 'grid',
                  gridTemplateColumns: '28px minmax(88px, 1.35fr) minmax(58px, 0.8fr) minmax(72px, 0.9fr) minmax(104px, auto)',
                  gap: 0.4,
                  alignItems: 'center',
                  px: 0.5,
                  py: 0.45,
                  borderRadius: 0.6,
                }}
              >
                <Stack direction="row" spacing={0.2} alignItems="center" sx={{ minWidth: 0 }}>
                  <Button
                    size="small"
                    variant="text"
                    disabled={isMoveDisabled}
                    {...dragProvided.dragHandleProps}
                    data-testid="routing-stop-drag-handle"
                    aria-label={`Drag ${stop.job?.customerName || stop.jobId}`}
                    aria-disabled={isMoveDisabled ? 'true' : 'false'}
                    sx={{ minWidth: 18, width: 18, height: 22, px: 0, py: 0, fontSize: '0.78rem' }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    =
                  </Button>
                  <Typography variant="caption" noWrap color="text.secondary" sx={{ fontWeight: 850 }}>
                    {index + 1}
                  </Typography>
                </Stack>
                <Typography variant="body2" noWrap sx={{ fontWeight: 780 }}>
                  {stop.job?.customerName || stop.jobId}
                </Typography>
                <Typography variant="caption" noWrap color="text.secondary">
                  {getStopCity(stop)}
                </Typography>
                <Typography
                  variant="caption"
                  noWrap
                  color={hasStopException(stop) || hasStopLateRisk(stop) ? 'warning.main' : 'text.secondary'}
                  sx={{ fontWeight: 800 }}
                >
                  {stopStatusLabel(stop)}
                </Typography>
                <Stack direction="row" spacing={0.35} alignItems="center" justifyContent="flex-end">
                  {hasStopException(stop) ? <StatusPill label="!" tone="warning" /> : null}
                  {isRecentlyMoved ? <StatusPill label="Moved" tone="accent" /> : null}
                  {stop.isLocked ? (
                    <Tooltip title="Stop is protected">
                      <ProtectedStopGlyph />
                    </Tooltip>
                  ) : null}
                  <Button
                    size="small"
                    variant="text"
                    disabled={isMoveDisabled || index === 0}
                    aria-label={`Move stop up in ${group.label}`}
                    data-testid="routing-stop-move-up"
                    onClick={(event) => {
                      event.stopPropagation();
                      moveStop(group.id, Math.max(0, index - 1));
                    }}
                    sx={{ minWidth: 22, px: 0.2, py: 0.1 }}
                  >
                    ↑
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    disabled={isMoveDisabled || index >= group.stops.length - 1}
                    aria-label={`Move stop down in ${group.label}`}
                    data-testid="routing-stop-move-down"
                    onClick={(event) => {
                      event.stopPropagation();
                      moveStop(group.id, Math.min(group.stops.length - 1, index + 1));
                    }}
                    sx={{ minWidth: 22, px: 0.2, py: 0.1 }}
                  >
                    ↓
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    disabled={isMoveDisabled || !previousGroupId}
                    aria-label={`Move stop to previous route from ${group.label}`}
                    data-testid="routing-stop-move-previous-route"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (previousGroupId) moveStop(previousGroupId, 0);
                    }}
                    sx={{ minWidth: 22, px: 0.2, py: 0.1 }}
                  >
                    ←
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    disabled={isMoveDisabled || !nextGroupId}
                    aria-label={`Move stop to next route from ${group.label}`}
                    data-testid="routing-stop-move-next-route"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (nextGroupId) moveStop(nextGroupId, Number.MAX_SAFE_INTEGER);
                    }}
                    sx={{ minWidth: 22, px: 0.2, py: 0.1 }}
                  >
                    →
                  </Button>
                </Stack>
              </Box>
            );
          }}
        </Draggable>
      ))}
      </Stack>
      {bottomSpacer ? <Box aria-hidden sx={{ height: bottomSpacer }} /> : null}
    </Box>
  );
}

function ComfortableStopCards({
  group,
  recentMove,
  selectedStopId,
  selectedGroup,
  saving,
  isReadOnly = false,
  isDark,
  onSelectGroup,
  onSelectStop,
}: {
  group: PlannerRouteGroupWithStops;
  recentMove: RecentRouteMove | null;
  selectedStopId: string | null;
  selectedGroup: PlannerRouteGroupWithStops | null;
  saving: boolean;
  isReadOnly?: boolean;
  isDark: boolean;
  onSelectGroup: (groupId: string) => void;
  onSelectStop: (stopId: string) => void;
}) {
  const isSelectedLane = group.id === selectedGroup?.id;

  return (
    <Stack spacing={0.7}>
      {group.stops.map((stop, index) => (
        <Draggable
          key={stop.id}
          draggableId={stop.id}
          index={index}
          isDragDisabled={saving || isReadOnly || stop.isLocked}
        >
          {(dragProvided, dragSnapshot) => {
            const isRecentlyMoved = recentMove?.stopId === stop.id;
            const isSelectedStop = selectedStopId === stop.id;

            return (
              <Box
                ref={dragProvided.innerRef}
                {...dragProvided.draggableProps}
                {...dragProvided.dragHandleProps}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectGroup(group.id);
                  onSelectStop(stop.id);
                }}
                data-testid="routing-stop-card"
                sx={{
                  border: '1px solid',
                  borderColor: dragSnapshot.isDragging
                    ? '#F5B86C'
                    : isRecentlyMoved
                      ? '#D9903D'
                      : isSelectedStop
                        ? alpha('#B97129', 0.58)
                        : 'divider',
                  bgcolor: dragSnapshot.isDragging
                    ? alpha('#D9903D', 0.15)
                    : isRecentlyMoved
                      ? alpha('#D9903D', isDark ? 0.2 : 0.16)
                      : isSelectedStop
                        ? alpha('#B97129', isDark ? 0.26 : 0.18)
                        : trovanSurfaceColor(isSelectedLane, isDark),
                  cursor: stop.isLocked ? 'not-allowed' : 'grab',
                  outline: dragSnapshot.isDragging
                    ? `3px solid ${alpha('#F5B86C', 0.84)}`
                    : isRecentlyMoved
                      ? `2px solid ${alpha('#D9903D', 0.58)}`
                      : '0 solid transparent',
                  outlineOffset: 2,
                  boxShadow: dragSnapshot.isDragging
                    ? `0 18px 36px ${alpha('#0C0907', 0.5)}, 0 0 0 6px ${alpha('#F5B86C', 0.22)}`
                    : isRecentlyMoved
                      ? `0 0 0 5px ${alpha('#D9903D', 0.14)}`
                      : 'none',
                  transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, outline-color 180ms ease',
                  px: 1,
                  py: 0.75,
                  borderRadius: 1,
                }}
              >
                <Stack spacing={0.3}>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                      {stop.job?.customerName || stop.jobId}
                    </Typography>
                    {stop.isLocked ? (
                      <Tooltip title="Stop is protected">
                        <ProtectedStopGlyph />
                      </Tooltip>
                    ) : isRecentlyMoved ? (
                      <StatusPill label="Moved" tone="accent" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {index + 1}
                      </Typography>
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {stopLabel(stop)}
                  </Typography>
                </Stack>
              </Box>
            );
          }}
        </Draggable>
      ))}
    </Stack>
  );
}

export function RouteLaneEditorDrawer({
  isFullscreen = false,
  laneEditorMode,
  setLaneEditorMode,
  visibleGroupedStops,
  selectedGroup,
  selectedStopId,
  setSelectedGroupId,
  setSelectedStopId,
  recentMove,
  density,
  isDark,
  saving,
  isReadOnly = false,
  onDragEnd,
  onMoveStop,
  formatDistance,
}: {
  isFullscreen?: boolean;
  laneEditorMode: LaneEditorMode;
  setLaneEditorMode: (mode: LaneEditorMode) => void;
  visibleGroupedStops: PlannerRouteGroupWithStops[];
  selectedGroup: PlannerRouteGroupWithStops | null;
  selectedStopId: string | null;
  setSelectedGroupId: (groupId: string) => void;
  setSelectedStopId: (stopId: string) => void;
  recentMove: RecentRouteMove | null;
  density: ViewDensity;
  isDark: boolean;
  saving: boolean;
  isReadOnly?: boolean;
  onDragEnd: (result: DropResult) => void;
  onMoveStop: (request: RouteStopMoveRequest) => void;
  formatDistance: (distanceKm?: number | null) => string;
}) {
  const isCollapsed = laneEditorMode === 'collapsed' && !isFullscreen;
  const laneCount = visibleGroupedStops.length;
  const stopCount = visibleGroupedStops.reduce((count, group) => count + group.stops.length, 0);

  return (
    <SurfacePanel
      variant="panel"
      padding={0}
      data-testid="routing-lane-editor"
      data-lane-editor-state={isFullscreen ? 'fullscreen' : laneEditorMode}
      data-read-only={isReadOnly ? 'true' : 'false'}
      sx={{
        overflow: 'hidden',
        height: isFullscreen ? '100%' : 'auto',
        width: isFullscreen ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1.05,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">Route lanes</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            Drag stops between lanes, reorder stops, or protect route order.
          </Typography>
        </Box>
        {isCollapsed ? (
          <StatusPill label="Collapsed" tone="default" />
        ) : (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={isFullscreen ? 'fullscreen' : laneEditorMode}
            onChange={(_, value) => setLaneEditorMode(value || (isFullscreen ? 'expanded' : laneEditorMode))}
            aria-label="Route lane drawer state"
            sx={{
              flex: '0 0 auto',
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 800,
                px: 0.9,
                py: 0.45,
              },
            }}
          >
            <ToggleButton
              value="collapsed"
              aria-label="Collapsed route lanes"
              data-testid="routing-lane-editor-collapse"
            >
              Collapsed
            </ToggleButton>
            <ToggleButton
              value="expanded"
              aria-label="Expanded route lanes"
              data-testid="routing-lane-editor-expand"
            >
              Expanded
            </ToggleButton>
            <ToggleButton
              value="fullscreen"
              aria-label={isFullscreen ? 'Exit full-screen route lanes' : 'Full screen route lanes'}
              data-testid="routing-lane-editor-fullscreen"
            >
              Full screen
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {isCollapsed ? (
        <Box sx={{ p: 1.3 }}>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
            <StatusPill label={`${laneCount} visible routes`} tone="info" />
            <StatusPill label={`${stopCount} visible stops`} tone="accent" />
            <StatusPill label={selectedGroup ? `Focused: ${selectedGroup.label}` : 'No route focused'} tone={selectedGroup ? 'success' : 'default'} />
            <Button
              size="small"
              variant="contained"
              onClick={() => setLaneEditorMode('expanded')}
              data-testid="routing-lane-editor-expand-from-collapsed"
            >
              Expand route lanes
            </Button>
          </Stack>
        </Box>
      ) : visibleGroupedStops.length === 0 ? (
        <Box sx={{ p: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            No route lanes match the current filters. Clear filters or generate a route draft.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <DragDropContext
            onDragStart={(start) => {
              if (isReadOnly) return;
              setSelectedGroupId(start.source.droppableId);
            }}
            onDragEnd={(result) => {
              if (isReadOnly) return;
              onDragEnd(result);
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: `repeat(${Math.min(visibleGroupedStops.length, 2)}, minmax(0, 1fr))`,
                  lg: `repeat(${Math.min(visibleGroupedStops.length, 3)}, minmax(0, 1fr))`,
                  xl: `repeat(${Math.min(visibleGroupedStops.length, 3)}, minmax(0, 1fr))`,
                },
                p: 1.2,
              }}
            >
              {visibleGroupedStops.map((group, groupIndex) => (
                <Droppable droppableId={group.id} key={group.id}>
                  {(provided, snapshot) => {
                    const isRecentTarget = recentMove?.targetGroupId === group.id;
                    const isRecentSource = recentMove?.sourceGroupId === group.id;
                    const isSelectedLane = group.id === selectedGroup?.id;

                    return (
                      <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        onClick={() => setSelectedGroupId(group.id)}
                        data-testid={`routing-route-lane-${group.id}`}
                        data-route-lane-focus={isSelectedLane ? 'selected' : selectedGroup ? 'muted' : 'default'}
                        data-route-stop-count={group.stops.length}
                        data-route-distance={formatDistance(group.totalDistanceKm)}
                        sx={{
                          minHeight: density === 'compact' ? { xs: 176, xl: 204 } : { xs: 210, xl: 240 },
                          borderRadius: 1.2,
                          border: '1px solid',
                          borderColor: snapshot.isDraggingOver
                            ? '#F5B86C'
                            : isRecentTarget
                              ? '#D9903D'
                              : isSelectedLane
                                ? alpha('#B97129', 0.62)
                                : isRecentSource
                                  ? alpha('#D9903D', 0.28)
                                  : 'divider',
                          bgcolor: snapshot.isDraggingOver
                            ? alpha('#D9903D', 0.12)
                            : isRecentTarget
                              ? alpha('#D9903D', 0.1)
                              : isSelectedLane
                                ? alpha('#B97129', isDark ? 0.16 : 0.1)
                                : isRecentSource
                                  ? alpha('#D9903D', 0.035)
                                  : 'background.paper',
                          opacity: selectedGroup && !isSelectedLane ? 0.62 : 1,
                          position: 'relative',
                          zIndex: isSelectedLane ? 2 : 1,
                          overflow: 'hidden',
                          boxShadow: snapshot.isDraggingOver
                            ? `0 0 0 3px ${alpha('#F5B86C', 0.28)}, inset 0 0 0 1px ${alpha('#F5B86C', 0.48)}`
                            : isSelectedLane
                              ? `inset 0 0 0 1px ${alpha('#B97129', 0.36)}`
                              : 'none',
                          p: 1,
                          transition: 'border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease',
                        }}
                      >
                        <Stack spacing={0.8}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={1}
                            sx={{
                              position: 'sticky',
                              top: 0,
                              zIndex: 2,
                              bgcolor: snapshot.isDraggingOver
                                ? alpha('#D9903D', 0.12)
                                : isSelectedLane
                                  ? alpha('#B97129', isDark ? 0.16 : 0.1)
                                  : 'background.paper',
                              py: 0.2,
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 850 }}>
                                {group.label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {formatDistance(group.totalDistanceKm)}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={0.65} alignItems="center">
                              {isRecentTarget ? <StatusPill label="Updated" tone="accent" /> : null}
                              <StatusPill
                                label={`${group.stops.length} stops`}
                                tone={toneForRoute(group, group.stops.length)}
                              />
                            </Stack>
                          </Stack>

                          {density === 'compact' ? (
                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: '28px minmax(88px, 1.35fr) minmax(58px, 0.8fr) minmax(72px, 0.9fr) 24px',
                                gap: 0.4,
                                px: 0.5,
                                py: 0.45,
                                borderRadius: 0.75,
                                bgcolor: alpha(isDark ? '#120E0B' : '#FFFFFF', isDark ? 0.3 : 0.62),
                                color: 'text.secondary',
                              }}
                            >
                              {['#', 'Stop', 'City', 'Status', ''].map((label) => (
                                <Typography key={label} variant="caption" noWrap sx={{ fontWeight: 850 }}>
                                  {label}
                                </Typography>
                              ))}
                            </Box>
                          ) : null}

                          {group.stops.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, py: 1 }}>
                              No stops match the active filters.
                            </Typography>
                          ) : density === 'compact' ? (
                            <CompactStopRows
                              group={group}
                              previousGroupId={visibleGroupedStops[groupIndex - 1]?.id || null}
                              nextGroupId={visibleGroupedStops[groupIndex + 1]?.id || null}
                              recentMove={recentMove}
                              selectedStopId={selectedStopId}
                              selectedGroup={selectedGroup}
                              saving={saving}
                              isReadOnly={isReadOnly}
                              isDark={isDark}
                              onSelectGroup={setSelectedGroupId}
                              onSelectStop={setSelectedStopId}
                              onMoveStop={onMoveStop}
                            />
                          ) : (
                            <ComfortableStopCards
                              group={group}
                              recentMove={recentMove}
                              selectedStopId={selectedStopId}
                              selectedGroup={selectedGroup}
                              saving={saving}
                              isReadOnly={isReadOnly}
                              isDark={isDark}
                              onSelectGroup={setSelectedGroupId}
                              onSelectStop={setSelectedStopId}
                            />
                          )}
                          {provided.placeholder}
                        </Stack>
                      </Box>
                    );
                  }}
                </Droppable>
              ))}
            </Box>
          </DragDropContext>
        </Box>
      )}
    </SurfacePanel>
  );
}

function severityLabel(severity: RoutingExceptionSeverity) {
  if (severity === 'blocking') return 'Blocking';
  if (severity === 'warning') return 'Warning';
  return 'Info';
}

function severityTone(severity: RoutingExceptionSeverity): StatusPillTone {
  if (severity === 'blocking') return 'warning';
  if (severity === 'warning') return 'accent';
  return 'info';
}

function exceptionStatusLabel(status: RoutingExceptionStatus) {
  if (status === 'accepted') return 'Accepted risk';
  if (status === 'resolved') return 'Resolved';
  return 'Open';
}

export function ExceptionResolutionDrawer({
  open,
  exceptions,
  riskReasons,
  canDecideExceptions,
  showCapabilityNotice,
  saving,
  onClose,
  onResolve,
  onAcceptRisk,
  onRiskReasonChange,
  onAssignDriver,
  onAssignVehicle,
  onJumpToAffected,
}: {
  open: boolean;
  exceptions: RoutingExceptionRecord[];
  riskReasons: Record<string, string>;
  canDecideExceptions: boolean;
  showCapabilityNotice: boolean;
  saving: boolean;
  onClose: () => void;
  onResolve: (exceptionId: string) => void;
  onAcceptRisk: (exceptionId: string) => void;
  onRiskReasonChange: (exceptionId: string, reason: string) => void;
  onAssignDriver: (routeId: string) => void;
  onAssignVehicle: (routeId: string) => void;
  onJumpToAffected: (exception: RoutingExceptionRecord) => void;
}) {
  const severities: RoutingExceptionSeverity[] = ['blocking', 'warning', 'info'];
  const openExceptionCount = exceptions.filter((item) => item.status === 'open').length;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520 },
          maxWidth: '100vw',
          bgcolor: 'background.default',
        },
      }}
    >
      <Box
        data-testid="routing-exception-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="routing-exception-drawer-title"
        sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
            <Box sx={{ minWidth: 0 }}>
              <Typography id="routing-exception-drawer-title" variant="h6">
                Exception resolution
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review route blockers, assign missing resources, or accept operational risk with a reason.
              </Typography>
            </Box>
            <Button size="small" variant="text" onClick={onClose}>
              Close
            </Button>
          </Stack>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.2 }}>
            <StatusPill label={`${openExceptionCount} open`} tone={openExceptionCount ? 'warning' : 'success'} />
            <StatusPill label={`${exceptions.filter((item) => item.status === 'resolved').length} resolved`} tone="success" />
            <StatusPill label={`${exceptions.filter((item) => item.status === 'accepted').length} accepted`} tone="info" />
          </Stack>
          {!canDecideExceptions ? (
            <Alert
              severity="info"
              icon={false}
              data-testid="routing-exception-capability-notice"
              sx={{ mt: 1.2 }}
            >
              {showCapabilityNotice
                ? 'Exception decisions are preview-only until the exception decision API is enabled.'
                : 'Exception decisions are read-only for this workspace.'}
            </Alert>
          ) : null}
        </Box>

        <Box sx={{ p: 1.5, overflowY: 'auto', flex: 1 }}>
          <Stack spacing={1.3}>
            {severities.map((severity) => {
              const severityExceptions = exceptions.filter((item) => item.severity === severity);
              if (!severityExceptions.length) return null;
              const routeIds = Array.from(new Set(severityExceptions.map((item) => item.routeId)));
              return (
                <SurfacePanel
                  key={severity}
                  variant="panel"
                  padding={1.1}
                  data-testid={`routing-exception-severity-${severity}`}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                      <Typography variant="subtitle1" sx={{ fontWeight: 880 }}>
                        {severityLabel(severity)}
                      </Typography>
                      <StatusPill label={`${severityExceptions.length} item${severityExceptions.length === 1 ? '' : 's'}`} tone={severityTone(severity)} />
                    </Stack>
                    {routeIds.map((routeId, routeIndex) => {
                      const routeExceptions = severityExceptions.filter((item) => item.routeId === routeId);
                      const routeLabel = routeExceptions[0]?.routeLabel || routeId;
                      return (
                        <Box key={routeId} data-testid={`routing-exception-route-${routeId}`} sx={{ display: 'grid', gap: 0.8 }}>
                          {routeIndex > 0 ? <Divider /> : null}
                          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                              {routeLabel}
                            </Typography>
                            <StatusPill label={`${routeExceptions.length} issue${routeExceptions.length === 1 ? '' : 's'}`} tone={severityTone(severity)} />
                          </Stack>
                          {routeExceptions.map((exception) => {
                            const riskReason = riskReasons[exception.id] || exception.reason || '';
                            const isOpen = exception.status === 'open';
                            return (
                              <SurfacePanel
                                key={exception.id}
                                variant="subtle"
                                padding={1}
                                data-testid={`routing-exception-card-${exception.id}`}
                              >
                                <Stack spacing={0.85}>
                                  <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                                    <Typography variant="subtitle2" sx={{ fontWeight: 880 }}>
                                      {exception.type}
                                    </Typography>
                                    <StatusPill label={exceptionStatusLabel(exception.status)} tone={exception.status === 'open' ? severityTone(exception.severity) : 'success'} />
                                  </Stack>
                                  <Stack spacing={0.5}>
                                    {[
                                      ['Type', exception.type],
                                      ['Affected', exception.stopId ? `Affected stop: ${exception.affectedLabel}` : `Affected route: ${exception.affectedLabel}`],
                                      ['Severity', severityLabel(exception.severity)],
                                      ['Recommended action', exception.recommendedAction],
                                      ['Owner / status', `${exception.owner} / ${exceptionStatusLabel(exception.status)}`],
                                    ].map(([label, value]) => (
                                      <Stack key={label} direction="row" justifyContent="space-between" gap={1} alignItems="baseline">
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 850, flex: '0 0 118px' }}>
                                          {label}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 720, textAlign: 'right' }}>
                                          {value}
                                        </Typography>
                                      </Stack>
                                    ))}
                                  </Stack>
                                  <TextField
                                    size="small"
                                    label="Risk acceptance reason"
                                    value={riskReason}
                                    onChange={(event) => onRiskReasonChange(exception.id, event.target.value)}
                                    disabled={!canDecideExceptions || !isOpen || saving}
                                    multiline
                                    minRows={2}
                                  />
                                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                    <Button size="small" variant="outlined" onClick={() => onJumpToAffected(exception)}>
                                      Jump to affected {exception.stopId ? 'stop' : 'route'}
                                    </Button>
                                    {canDecideExceptions && exception.type === 'Missing driver' ? (
                                      <Button size="small" variant="contained" onClick={() => onAssignDriver(exception.routeId)} disabled={!isOpen || saving}>
                                        Assign driver
                                      </Button>
                                    ) : null}
                                    {canDecideExceptions && exception.type === 'Missing vehicle' ? (
                                      <Button size="small" variant="contained" onClick={() => onAssignVehicle(exception.routeId)} disabled={!isOpen || saving}>
                                        Assign vehicle
                                      </Button>
                                    ) : null}
                                    {exception.type !== 'Missing driver' && exception.type !== 'Missing vehicle' ? (
                                      canDecideExceptions ? (
                                        <Button size="small" variant="contained" onClick={() => onResolve(exception.id)} disabled={!isOpen || saving}>
                                          Resolve exception
                                        </Button>
                                      ) : null
                                    ) : null}
                                    {canDecideExceptions ? (
                                      <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => onAcceptRisk(exception.id)}
                                        disabled={!isOpen || saving || riskReason.trim().length < 4}
                                      >
                                        Accept risk
                                      </Button>
                                    ) : null}
                                  </Stack>
                                </Stack>
                              </SurfacePanel>
                            );
                          })}
                        </Box>
                      );
                    })}
                  </Stack>
                </SurfacePanel>
              );
            })}
            {!exceptions.length ? (
              <SurfacePanel variant="subtle" padding={1.4}>
                <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                  No exceptions need review.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The route day has no open route blockers.
                </Typography>
              </SurfacePanel>
            ) : null}
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
}

export function RouteInspector({
  selectedGroup,
  selectedGroupVisibleStops,
  selectedStop,
  selectedStopId,
  setSelectedStopId,
  inspectorTab,
  setInspectorTab,
  selectedRouteDistance,
  selectedDriverName,
  selectedVehicleName,
  planStatusLabel,
  planStatusTone,
  nextActionLabel,
  hasPlan,
  routeCount,
  totalJobCount,
  routedStopCount,
  unassignedCount,
  planOpenExceptionCount,
  serviceDateLabel,
  objectiveLabel,
  openExceptionCount,
  density,
  isDark,
  isMarketingCapture,
  saving,
  vehicles,
  drivers,
  onUpdateAssignments,
  onToggleStopLock,
  onSetRouteOrderProtection,
}: {
  selectedGroup: PlannerRouteGroupWithStops | null;
  selectedGroupVisibleStops: PlannerStopWithJob[];
  selectedStop: PlannerStopWithJob | null;
  selectedStopId: string | null;
  setSelectedStopId: (stopId: string) => void;
  inspectorTab: InspectorTab;
  setInspectorTab: (tab: InspectorTab) => void;
  selectedRouteDistance: string;
  selectedDriverName: string;
  selectedVehicleName: string;
  planStatusLabel: string;
  planStatusTone: StatusPillTone;
  nextActionLabel: string;
  hasPlan: boolean;
  routeCount: number;
  totalJobCount: number;
  routedStopCount: number;
  unassignedCount: number;
  planOpenExceptionCount: number;
  serviceDateLabel: string;
  objectiveLabel: string;
  openExceptionCount: number;
  density: ViewDensity;
  isDark: boolean;
  isMarketingCapture: boolean;
  saving: boolean;
  vehicles: VehicleRecord[];
  drivers: DriverRecord[];
  onUpdateAssignments: (
    groupId: string,
    payload: { driverId?: string; vehicleId?: string },
  ) => void;
  onToggleStopLock: (stopId: string, isLocked: boolean) => void;
  onSetRouteOrderProtection: (locked: boolean) => void;
}) {
  const selectedRouteStops = selectedGroup?.stops ?? [];
  const lateRiskCount = selectedRouteStops.filter(hasStopLateRisk).length;
  const selectedRouteIssueCards = [
    unassignedCount > 0
      ? {
          id: 'unassigned',
          severity: 'warning' as const,
          title: `${unassignedCount} unassigned jobs`,
          body: 'Resolve unassigned work before publishing the full route day.',
        }
      : null,
    selectedGroup && !selectedGroup.driverId
      ? {
          id: 'missing-driver',
          severity: 'warning' as const,
          title: 'Missing driver',
          body: 'Assign a driver before this route is ready to publish.',
        }
      : null,
    selectedGroup && !selectedGroup.vehicleId
      ? {
          id: 'missing-vehicle',
          severity: 'warning' as const,
          title: 'Missing vehicle',
          body: 'Assign a vehicle before this route is ready to dispatch.',
        }
      : null,
    openExceptionCount > 0
      ? {
          id: 'exceptions',
          severity: 'warning' as const,
          title: `${openExceptionCount} route exception${openExceptionCount === 1 ? '' : 's'}`,
          body: 'Review route warnings before publishing.',
        }
      : null,
    lateRiskCount > 0
      ? {
          id: 'late-risk',
          severity: 'info' as const,
          title: `${lateRiskCount} late-risk stop${lateRiskCount === 1 ? '' : 's'}`,
          body: 'Check stop sequence and service windows before dispatch.',
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    severity: 'info' | 'warning';
    title: string;
    body: string;
  }>;

  return (
    <RouteInspectorPanel
      title={selectedGroup ? selectedGroup.label : 'Planner summary'}
      subtitle={
        selectedGroup
          ? `${selectedGroup.stops.length} stops • ${selectedRouteDistance}`
          : 'Select a lane to manage assignments and protected stops.'
      }
      status={
        <StatusPill
          label={planStatusLabel}
          tone={hasPlan ? planStatusTone : 'default'}
        />
      }
      summary={
        <Stack spacing={0.75}>
          <Typography variant="body2" color="text.secondary">
            Service date: {serviceDateLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Objective: {objectiveLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Plan total: {totalJobCount} total jobs • {routedStopCount} routed • {unassignedCount} unassigned • {routeCount} routes • {planOpenExceptionCount} open exceptions
          </Typography>
        </Stack>
      }
      actions={
        selectedGroup ? (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={inspectorTab}
            onChange={(_, value) => value && setInspectorTab(value)}
            aria-label="Selected route inspector tabs"
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 800,
                px: 0.9,
              },
            }}
          >
            <ToggleButton value="overview">Overview</ToggleButton>
            <ToggleButton value="stops">Stops</ToggleButton>
            <ToggleButton value="driver">Driver</ToggleButton>
            <ToggleButton value="exceptions">Exceptions</ToggleButton>
          </ToggleButtonGroup>
        ) : null
      }
    >
      {!selectedGroup ? (
        <Typography variant="body2" color="text.secondary">
          Generate a draft, then select a lane on the left or directly from the map.
        </Typography>
      ) : (
        <Stack spacing={1.1}>
          {inspectorTab === 'overview' ? (
            <Stack spacing={1}>
              <SurfacePanel
                variant="subtle"
                padding={1.2}
                data-testid="routing-route-readiness-summary"
                data-readiness-layout="summary"
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                  Route readiness
                </Typography>
                <Stack spacing={0.7} sx={{ mt: 1 }}>
                  {[
                    ['Status', planStatusLabel],
                    ['Driver', selectedDriverName],
                    ['Vehicle', selectedVehicleName],
                    ['Stops', `${selectedGroup.stops.length} sequenced`],
                    ['Distance', selectedRouteDistance],
                    ['Exceptions', `${openExceptionCount} open`],
                    ['Unassigned impact', unassignedCount ? `${unassignedCount} jobs outside routes` : 'No unassigned impact'],
                    ['Next action', nextActionLabel],
                  ].map(([label, value]) => (
                    <Stack
                      key={label}
                      direction="row"
                      spacing={1}
                      alignItems="baseline"
                      justifyContent="space-between"
                      sx={{ minWidth: 0 }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 850 }}>
                        {label}
                      </Typography>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 850, textAlign: 'right' }}>
                        {value}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </SurfacePanel>
              {selectedRouteIssueCards.map((issue) => (
                <Alert
                  key={issue.id}
                  severity={issue.severity}
                  icon={false}
                  data-testid="routing-readiness-alert"
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                    {issue.title}
                  </Typography>
                  <Typography variant="body2">{issue.body}</Typography>
                </Alert>
              ))}
              <Stack direction="row" spacing={1}>
                <StatusPill label={`${selectedGroup.stops.length} stops`} tone={toneForRoute(selectedGroup, selectedGroup.stops.length)} />
                <StatusPill label={selectedRouteDistance} tone="info" />
                <StatusPill label={`${unassignedCount} unassigned`} tone={unassignedCount ? 'warning' : 'success'} />
              </Stack>
              {isMarketingCapture ? (
                <SurfacePanel variant="subtle" padding={1.2}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
                    Dispatch readiness
                  </Typography>
                  <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                    {[
                      `Driver assigned: ${selectedDriverName}`,
                      'Route order protected',
                      'Proof required',
                      'Customer tracking ready',
                    ].map((label) => (
                      <StatusPill key={label} label={label} tone="success" />
                    ))}
                  </Stack>
                </SurfacePanel>
              ) : null}
            </Stack>
          ) : null}

          {inspectorTab === 'driver' ? (
            <Stack spacing={1.1}>
              <TextField
                select
                size="small"
                label="Vehicle"
                value={selectedGroup.vehicleId || ''}
                onChange={(event) =>
                  onUpdateAssignments(selectedGroup.id, {
                    vehicleId: event.target.value || undefined,
                    driverId: selectedGroup.driverId || undefined,
                  })
                }
              >
                <MenuItem value="">Unassigned</MenuItem>
                {vehicles.map((vehicle) => (
                  <MenuItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.licensePlate || vehicle.id}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Driver"
                value={selectedGroup.driverId || ''}
                onChange={(event) =>
                  onUpdateAssignments(selectedGroup.id, {
                    driverId: event.target.value || undefined,
                    vehicleId: selectedGroup.vehicleId || undefined,
                  })
                }
              >
                <MenuItem value="">Unassigned</MenuItem>
                {drivers.map((driver) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {[driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.id}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          ) : null}

          {inspectorTab === 'stops' ? (
            <Stack spacing={1}>
              {selectedStop ? (
                <SurfacePanel variant="subtle" padding={1.1}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 850 }}>
                          Selected: {selectedStop.job?.customerName || selectedStop.jobId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {stopLabel(selectedStop)}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        color={selectedStop.isLocked ? 'warning' : 'inherit'}
                        onClick={() => onToggleStopLock(selectedStop.id, selectedStop.isLocked)}
                        disabled={saving}
                        sx={{ flex: '0 0 auto' }}
                      >
                        {selectedStop.isLocked ? 'Unlock selected stop' : 'Lock selected stop'}
                      </Button>
                    </Stack>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => onSetRouteOrderProtection(true)}
                        disabled={saving}
                      >
                        Protect route order
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => onSetRouteOrderProtection(false)}
                        disabled={saving}
                      >
                        Clear route protection
                      </Button>
                    </Stack>
                  </Stack>
                </SurfacePanel>
              ) : null}
              <Stack spacing={0.55}>
                {selectedGroupVisibleStops.map((stop) => {
                  const isSelectedStop = selectedStopId === stop.id;
                  return (
                    <Box
                      key={stop.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelectedStop}
                      onClick={() => setSelectedStopId(stop.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedStopId(stop.id);
                        }
                      }}
                      sx={{
                        px: 1,
                        py: 0.65,
                        borderRadius: 0.8,
                        border: '1px solid',
                        borderColor: isSelectedStop ? alpha('#B97129', 0.55) : 'divider',
                        bgcolor: isSelectedStop ? alpha('#B97129', isDark ? 0.24 : 0.12) : 'background.paper',
                        cursor: 'pointer',
                        '&:focus-visible': {
                          outline: '2px solid #F5B86C',
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                            {stop.stopSequence}. {stop.job?.customerName || stop.jobId}
                          </Typography>
                          {density === 'comfortable' || isSelectedStop ? (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {stopLabel(stop)}
                            </Typography>
                          ) : null}
                        </Box>
                        {stop.isLocked ? (
                          <Tooltip title="Stop is protected">
                            <ProtectedStopGlyph />
                          </Tooltip>
                        ) : null}
                      </Stack>
                    </Box>
                  );
                })}
                {selectedGroupVisibleStops.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No stops in this route match the active filters.
                  </Typography>
                ) : null}
              </Stack>
            </Stack>
          ) : null}

          {inspectorTab === 'exceptions' ? (
            <Alert severity="info" icon={false}>
              Exceptions, late-risk stops, and capacity issues appear here when the selected route needs attention.
            </Alert>
          ) : null}
        </Stack>
      )}
    </RouteInspectorPanel>
  );
}
