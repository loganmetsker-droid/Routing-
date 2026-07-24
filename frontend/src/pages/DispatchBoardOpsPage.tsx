import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CalendarTodayOutlined,
  MoreVertOutlined,
  PauseCircleOutlineOutlined,
  RefreshOutlined,
  ReportGmailerrorredOutlined,
  SendOutlined,
  SwapHorizOutlined,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import MultiRouteMap from '../components/maps/MultiRouteMap';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import {
  type CreateExceptionPayload,
  type DispatchExceptionRecord,
  type RouteRunRecord,
  type RouteRunStopRecord,
  getRouteRunsErrorMessage,
  useCreateExceptionMutation,
  useCreateRouteRunMessageMutation,
  useDispatchBoardQuery,
  useDispatchRouteRunMutation,
  useReassignRouteRunMutation,
  useRouteRunMessagesQuery,
} from '../features/dispatch/api/routeRunsApi';
import {
  buildRouteDispatchReadiness,
  getRouteDispatchState,
  resolveDriverVehicleAssignment,
} from '../features/dispatch/utils/dispatchExecution';
import { buildDispatchMapRoutes } from '../features/dispatch/utils/opsMapData';
import { useRoutesQuery } from '../services/dispatchApi';
import type { JobRecord } from '../services/api.types';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import { useJobsQuery } from '../services/jobsApi';
import { trovanColors } from '../theme/designTokens';

type DispatchLaneStop = RouteRunStopRecord & { job?: JobRecord };
type DispatchRouteLane = {
  route: RouteRunRecord;
  stops: DispatchLaneStop[];
  exceptions: DispatchExceptionRecord[];
};

type ExceptionFormState = {
  code: string;
  message: string;
};

type NoticeState = {
  severity: 'success' | 'info' | 'warning' | 'error';
  message: string;
};

const emptyExceptionForm: ExceptionFormState = {
  code: '',
  message: '',
};

const routeLaneAccents = ['#B87333', '#2E90FA', '#16A34A', '#855CF8', '#F59E0B', '#20C5A3'];
const kmToMiles = 0.621371;

const asCoordinateNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const coordinateFromRecord = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const lat = asCoordinateNumber(record.lat ?? record.latitude);
  const lng = asCoordinateNumber(record.lng ?? record.longitude);
  return lat == null || lng == null ? null : { lat, lng };
};

const milesBetween = (
  left?: { lat: number; lng: number } | null,
  right?: { lat: number; lng: number } | null,
) => {
  if (!left || !right) return null;
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(right.lat - left.lat);
  const lngDelta = toRadians(right.lng - left.lng);
  const startLat = toRadians(left.lat);
  const endLat = toRadians(right.lat);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function statusTone(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced', 'resolved'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'danger';
  if (['assigned', 'ready_for_dispatch', 'in_progress', 'arrived', 'planned'].includes(normalized)) return 'success';
  if (['open', 'rescheduled'].includes(normalized)) return 'warning';
  return 'default';
}

function priorityTone(priority: string) {
  const normalized = String(priority || '').toLowerCase();
  if (['urgent', 'critical', 'high'].includes(normalized)) return 'danger';
  if (['medium', 'normal'].includes(normalized)) return 'warning';
  return 'success';
}

function isEditableRoute(status: string) {
  return ['planned', 'assigned', 'ready_for_dispatch'].includes(
    String(status || '').toLowerCase(),
  );
}

function routeLabel(route: RouteRunRecord) {
  const compact = route.id.replace(/^route-/i, '').toUpperCase();
  return compact.startsWith('RT-') ? compact : `R-${compact.slice(0, 5)}`;
}

function routeZone(index: number) {
  return ['North Zone', 'East Zone', 'South Zone', 'West Zone', 'Downtown'][index % 5];
}

function formatMiles(value?: number | null) {
  if (!value || !Number.isFinite(value)) return '0 mi';
  return `${value.toFixed(value >= 10 ? 0 : 1)} mi`;
}

function formatTimeWindow(job: JobRecord) {
  const start = job.timeWindow?.start || job.timeWindowStart || '';
  const end = job.timeWindow?.end || job.timeWindowEnd || '';
  if (!start && !end) return 'Window pending';
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function jobAddress(job: JobRecord) {
  return job.deliveryAddress || job.pickupAddress || 'Address pending';
}

function jobDistanceMiles(job: JobRecord) {
  return milesBetween(
    coordinateFromRecord(job.pickupLocation),
    coordinateFromRecord(job.deliveryLocation),
  );
}

function driverDisplayName(driver: { firstName?: string; lastName?: string; id: string }) {
  return [driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.id;
}

function formatClock(value?: string | null) {
  if (!value) return 'Not started';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function routeDispatchTime(route: RouteRunRecord) {
  if (route.actualStart) {
    return { label: 'Started', value: formatClock(route.actualStart) };
  }
  if (route.dispatchedAt) {
    return { label: 'Sent', value: formatClock(route.dispatchedAt) };
  }
  return { label: 'Sent', value: 'Not sent' };
}

function completedStopCount(stops: DispatchLaneStop[]) {
  return stops.filter((stop) =>
    ['completed', 'departed', 'serviced'].includes(String(stop.status).toLowerCase()),
  ).length;
}

export default function DispatchBoardOpsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [savingRouteId, setSavingRouteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDriverByRoute, setSelectedDriverByRoute] = useState<Record<string, string>>({});
  const [selectedVehicleByRoute, setSelectedVehicleByRoute] = useState<Record<string, string>>({});
  const [dispatchNoteByRoute, setDispatchNoteByRoute] = useState<Record<string, string>>({});
  const [messageDraft, setMessageDraft] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionForm, setExceptionForm] = useState<ExceptionFormState>(emptyExceptionForm);
  const [depotFilter, setDepotFilter] = useState('all');
  const [dispatcherFilter, setDispatcherFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [dispatchAllDialogOpen, setDispatchAllDialogOpen] = useState(false);
  const [sendUpdatesDialogOpen, setSendUpdatesDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [bulkUpdateDraft, setBulkUpdateDraft] = useState('Please confirm your next stop status.');
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const boardQuery = useDispatchBoardQuery();
  const routesQuery = useRoutesQuery();
  const jobsQuery = useJobsQuery();
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const dispatchMutation = useDispatchRouteRunMutation();
  const reassignMutation = useReassignRouteRunMutation();
  const createExceptionMutation = useCreateExceptionMutation();
  const createMessageMutation = useCreateRouteRunMessageMutation();

  const routeRuns = boardQuery.data?.routeRuns ?? [];
  const routeRunStops = boardQuery.data?.routeRunStops ?? [];
  const exceptions = boardQuery.data?.exceptions ?? [];
  const dispatchReadinessByRoute = boardQuery.data?.dispatchReadiness ?? {};
  const routes = routesQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const loading =
    boardQuery.isLoading ||
    routesQuery.isLoading ||
    jobsQuery.isLoading ||
    driversQuery.isLoading ||
    vehiclesQuery.isLoading;

  const jobById = useMemo(
    () => new Map(jobs.map((job) => [job.id, job])),
    [jobs],
  );
  const driverNameById = useMemo(
    () => Object.fromEntries(drivers.map((driver) => [driver.id, driverDisplayName(driver)])),
    [drivers],
  );
  const vehicleNameById = useMemo(
    () =>
      Object.fromEntries(
        vehicles.map((vehicle) => [
          vehicle.id,
          vehicle.licensePlate ||
            `${vehicle.make || 'Vehicle'} ${vehicle.model || ''}`.trim() ||
            vehicle.id,
        ]),
      ),
    [vehicles],
  );

  const stopsByRoute = useMemo(() => {
    return routeRunStops.reduce<Record<string, RouteRunStopRecord[]>>((acc, stop) => {
      acc[stop.routeId] = [...(acc[stop.routeId] || []), stop];
      return acc;
    }, {});
  }, [routeRunStops]);

  const orderedRouteLanes = useMemo<DispatchRouteLane[]>(() => {
    return routeRuns
      .map((route) => {
        const laneStops = (stopsByRoute[route.id] || [])
          .slice()
          .sort((left, right) => left.stopSequence - right.stopSequence)
          .map((stop) => ({
            ...stop,
            job: jobById.get(stop.jobId),
          }));
        return {
          route,
          stops: laneStops,
          exceptions: exceptions.filter((item) => item.routeId === route.id),
        };
      })
      .sort((left, right) => {
        const leftActive = String(left.route.status).toLowerCase() === 'in_progress' ? -1 : 0;
        const rightActive = String(right.route.status).toLowerCase() === 'in_progress' ? -1 : 0;
        return leftActive - rightActive || left.route.id.localeCompare(right.route.id);
      });
  }, [exceptions, jobById, routeRuns, stopsByRoute]);

  useEffect(() => {
    if (!selectedRouteId && orderedRouteLanes.length) {
      setSelectedRouteId(orderedRouteLanes[0].route.id);
    }
    if (
      selectedRouteId &&
      orderedRouteLanes.length &&
      !orderedRouteLanes.some((lane) => lane.route.id === selectedRouteId)
    ) {
      setSelectedRouteId(orderedRouteLanes[0]?.route.id || null);
    }
  }, [orderedRouteLanes, selectedRouteId]);

  const selectedLane =
    orderedRouteLanes.find((item) => item.route.id === selectedRouteId) ||
    orderedRouteLanes[0] ||
    null;
  const selectedRouteMessagesQuery = useRouteRunMessagesQuery(selectedLane?.route.id || '');
  const selectedRouteMessages = selectedRouteMessagesQuery.data?.messages || [];

  const mapRoutes = useMemo(
    () =>
      buildDispatchMapRoutes({
        routes,
        jobs,
        drivers,
        vehicles,
      }),
    [drivers, jobs, routes, vehicles],
  );

  const routedJobIds = useMemo(
    () => new Set(routeRunStops.map((stop) => stop.jobId)),
    [routeRunStops],
  );

  const unassignedJobs = useMemo(() => {
    return jobs.filter((job) => {
      const record = job as JobRecord & { assignedRouteId?: string | null; routeId?: string | null };
      const hasRoute = routedJobIds.has(job.id) || Boolean(record.assignedRouteId || record.routeId);
      const status = String(job.status || '').toLowerCase();
      if (jobStatusFilter !== 'all' && status !== jobStatusFilter) return false;
      return !hasRoute && !['delivered', 'completed', 'cancelled'].includes(status);
    });
  }, [jobStatusFilter, jobs, routedJobIds]);

  const visibleRoutes = useMemo(() => {
    return orderedRouteLanes.filter((lane, index) => {
      if (regionFilter !== 'all' && routeZone(index) !== regionFilter) return false;
      if (dispatcherFilter !== 'all' && lane.route.driverId !== dispatcherFilter) return false;
      return depotFilter === 'all';
    });
  }, [depotFilter, dispatcherFilter, orderedRouteLanes, regionFilter]);

  const boardSummary = useMemo(
    () => ({
      ready: routeRuns.filter((route) =>
        ['assigned', 'planned', 'ready_for_dispatch'].includes(
          String(route.workflowStatus || route.status || '').toLowerCase(),
        ),
      ).length,
      inProgress: routeRuns.filter((route) =>
        ['in_progress'].includes(String(route.status || '').toLowerCase()),
      ).length,
      completed: routeRuns.filter((route) =>
        ['completed'].includes(String(route.status || '').toLowerCase()),
      ).length,
      exceptions: exceptions.filter((item) => item.status === 'OPEN').length,
    }),
    [exceptions, routeRuns],
  );

  const getAssignmentPayload = (routeId: string) => {
    const lane = orderedRouteLanes.find((item) => item.route.id === routeId);
    const selectedDriverId = selectedDriverByRoute[routeId] ?? lane?.route.driverId ?? '';
    const selectedVehicleId = selectedVehicleByRoute[routeId] ?? '';
    return resolveDriverVehicleAssignment({
      selectedDriverId,
      selectedVehicleId,
      routeVehicleId: lane?.route.vehicleId || null,
      drivers,
    });
  };

  const getReadiness = (lane: DispatchRouteLane) => {
    const assignment = getAssignmentPayload(lane.route.id);
    const localReadiness = buildRouteDispatchReadiness({
      route: {
        ...lane.route,
        driverId: assignment.driverId || null,
        vehicleId: assignment.vehicleId || null,
      },
      stops: lane.stops,
      exceptions: lane.exceptions,
    });
    return dispatchReadinessByRoute[lane.route.id] &&
      !selectedDriverByRoute[lane.route.id] &&
      !selectedVehicleByRoute[lane.route.id]
      ? dispatchReadinessByRoute[lane.route.id]
      : localReadiness;
  };

  const dispatchableRouteIds = visibleRoutes
    .filter((lane) => isEditableRoute(String(lane.route.status)) && getReadiness(lane).ready)
    .map((lane) => lane.route.id);

  const handleDriverSelection = (routeId: string, driverId: string) => {
    const nextAssignment = resolveDriverVehicleAssignment({
      selectedDriverId: driverId,
      selectedVehicleId: selectedVehicleByRoute[routeId] || '',
      routeVehicleId:
        orderedRouteLanes.find((item) => item.route.id === routeId)?.route.vehicleId || null,
      drivers,
    });
    setSelectedDriverByRoute((current) => ({
      ...current,
      [routeId]: driverId,
    }));
    if (nextAssignment.vehicleId) {
      setSelectedVehicleByRoute((current) => ({
        ...current,
        [routeId]: nextAssignment.vehicleId || '',
      }));
    }
  };

  const handleRouteAction = async (routeId: string, action: 'dispatch' | 'assign') => {
    setSavingRouteId(routeId);
    setError(null);
    try {
      const lane = orderedRouteLanes.find((item) => item.route.id === routeId);
      const assignment = getAssignmentPayload(routeId);
      if (action === 'dispatch') {
        if (
          assignment.driverId &&
          (assignment.driverId !== (lane?.route.driverId || '') ||
            assignment.vehicleId !== (lane?.route.vehicleId || ''))
        ) {
          await reassignMutation.mutateAsync({
            routeRunId: routeId,
            payload: {
              driverId: assignment.driverId,
              vehicleId: assignment.vehicleId,
              reason: 'dispatch board assignment',
            },
          });
        }
        await dispatchMutation.mutateAsync({
          routeRunId: routeId,
          payload: {
            note: dispatchNoteByRoute[routeId]?.trim() || undefined,
          },
        });
      } else {
        await reassignMutation.mutateAsync({
          routeRunId: routeId,
          payload: {
            driverId: assignment.driverId,
            vehicleId: assignment.vehicleId,
            reason: 'dispatch board assignment',
          },
        });
      }
      const routeName = routeLabel(lane?.route || ({ id: routeId } as RouteRunRecord));
      setNotice({
        severity: 'success',
        message:
          action === 'dispatch'
            ? `${routeName} sent to the assigned driver.`
            : `${routeName} assignment saved.`,
      });
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    } finally {
      setSavingRouteId(null);
    }
  };

  const handleDispatchAll = async () => {
    if (!dispatchableRouteIds.length) {
      setNotice({
        severity: 'warning',
        message: 'No routes are ready to dispatch. Assign a driver and vehicle first.',
      });
      return;
    }
    setSavingRouteId('bulk-dispatch');
    setError(null);
    try {
      for (const routeId of dispatchableRouteIds) {
        await handleRouteAction(routeId, 'dispatch');
      }
      setNotice({
        severity: 'success',
        message: `${dispatchableRouteIds.length} route${dispatchableRouteIds.length === 1 ? '' : 's'} sent to drivers.`,
      });
      setDispatchAllDialogOpen(false);
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    } finally {
      setSavingRouteId(null);
    }
  };

  const handleSendBulkUpdate = async () => {
    if (!bulkUpdateDraft.trim()) {
      setNotice({ severity: 'warning', message: 'Write an update before sending.' });
      return;
    }
    const targetRoutes = visibleRoutes.length ? visibleRoutes : orderedRouteLanes;
    if (!targetRoutes.length) {
      setNotice({ severity: 'warning', message: 'No route runs are available for updates.' });
      return;
    }
    setError(null);
    try {
      for (const lane of targetRoutes) {
        await createMessageMutation.mutateAsync({
          routeRunId: lane.route.id,
          payload: { body: bulkUpdateDraft.trim() },
        });
      }
      setNotice({
        severity: 'success',
        message: `Update sent to ${targetRoutes.length} active route${targetRoutes.length === 1 ? '' : 's'}.`,
      });
      setSendUpdatesDialogOpen(false);
      setBulkUpdateDraft('Please confirm your next stop status.');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const handleResetFilters = () => {
    setDepotFilter('all');
    setDispatcherFilter('all');
    setRegionFilter('all');
    setJobStatusFilter('all');
    setNotice({ severity: 'info', message: 'Dispatch filters reset.' });
  };

  const submitException = async () => {
    if (!selectedLane) return;
    const payload: CreateExceptionPayload = {
      routeId: selectedLane.route.id,
      code: exceptionForm.code.trim().toUpperCase(),
      message: exceptionForm.message.trim(),
      details: { source: 'dispatch-board' },
    };
    setError(null);
    try {
      await createExceptionMutation.mutateAsync(payload);
      setExceptionDialogOpen(false);
      setExceptionForm(emptyExceptionForm);
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  if (loading) {
    return <LoadingState label="Loading dispatch board..." minHeight="50vh" />;
  }

  const actionButtonSx = {
    minHeight: 42,
    px: 1.45,
    whiteSpace: 'nowrap',
    fontWeight: 850,
  } as const;

  const openExceptions = exceptions.filter((item) => item.status === 'OPEN');
  const missedWindowExceptions = openExceptions.filter((item) =>
    `${item.code} ${item.message}`.toLowerCase().includes('window'),
  );
  const highSignalExceptions = missedWindowExceptions.length
    ? missedWindowExceptions
    : openExceptions;
  const activeDrivers = drivers.filter((driver) =>
    ['active', 'available', 'en_route', 'on_route'].includes(String(driver.status || '').toLowerCase()),
  ).length;
  const jobsInProgress = jobs.filter((job) =>
    ['in_progress', 'assigned', 'ready'].includes(String(job.status || '').toLowerCase()),
  ).length;
  const currentDateLabel = new Date().toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Box
      data-testid="dispatch-board-page"
      sx={{
        display: 'grid',
        gap: 1.35,
        overflowX: 'hidden',
        maxWidth: '100%',
        '& .MuiButton-root, & .MuiInputBase-root, & .MuiTypography-root': {
          letterSpacing: 0,
        },
      }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', lg: 'center' }}
        sx={{ minWidth: 0 }}
      >
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            startIcon={<CalendarTodayOutlined />}
            disabled={savingRouteId === 'bulk-dispatch'}
            onClick={() => setDispatchAllDialogOpen(true)}
            sx={actionButtonSx}
          >
            Dispatch All ({dispatchableRouteIds.length})
          </Button>
          <Button
            variant="outlined"
            startIcon={<SendOutlined />}
            disabled={!selectedLane}
            onClick={() => {
              if (!selectedLane) return;
              setSelectedRouteId(selectedLane.route.id);
              setSendUpdatesDialogOpen(true);
            }}
            sx={actionButtonSx}
          >
            Send Updates
          </Button>
          <Button
            variant="outlined"
            startIcon={<SwapHorizOutlined />}
            disabled={!visibleRoutes.length}
            onClick={() => {
              const reassignmentLane =
                visibleRoutes.find((lane) => !lane.route.driverId) || visibleRoutes[0];
              setSelectedRouteId(reassignmentLane.route.id);
              setReassignDialogOpen(true);
            }}
            sx={actionButtonSx}
          >
            Reassign
          </Button>
          <Button
            variant="outlined"
            startIcon={<PauseCircleOutlineOutlined />}
            disabled={!selectedLane}
            onClick={() => {
              setExceptionForm({
                code: 'HOLD',
                message: selectedLane
                  ? `${routeLabel(selectedLane.route)} needs dispatch hold review.`
                  : 'Route needs dispatch hold review.',
              });
              setExceptionDialogOpen(true);
            }}
            sx={actionButtonSx}
          >
            Hold
          </Button>
          <Button
            component={RouterLink}
            to="/exceptions"
            variant="outlined"
            color="error"
            startIcon={<ReportGmailerrorredOutlined />}
            sx={actionButtonSx}
          >
            Accept Risk
          </Button>
        </Stack>
        <Stack direction="row" spacing={0.9} alignItems="center" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
          <Box
            aria-label={`Current dispatch date: ${currentDateLabel}`}
            sx={{
              ...actionButtonSx,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '8px',
              px: 1.35,
              bgcolor: 'background.paper',
              fontWeight: 800,
            }}
          >
            <CalendarTodayOutlined sx={{ fontSize: 19 }} />
            {currentDateLabel}
          </Box>
          <Button
            variant={autoRefreshEnabled ? 'contained' : 'outlined'}
            startIcon={<RefreshOutlined />}
            onClick={() => {
              setAutoRefreshEnabled((current) => !current);
              setNotice({
                severity: 'info',
                message: `Auto-refresh ${autoRefreshEnabled ? 'paused' : 'resumed'}.`,
              });
            }}
            sx={actionButtonSx}
          >
            Auto-refresh {autoRefreshEnabled ? 'on' : 'off'}
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)' },
          gap: 1.2,
          minWidth: 0,
        }}
      >
        <SurfacePanel variant="panel" padding={1.1}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
              gap: 1,
              alignItems: 'end',
            }}
          >
            <TextField select size="small" label="Depot" value={depotFilter} onChange={(event) => setDepotFilter(event.target.value)}>
              <MenuItem value="all">All Depots</MenuItem>
            </TextField>
            <TextField select size="small" label="Dispatcher" value={dispatcherFilter} onChange={(event) => setDispatcherFilter(event.target.value)}>
              <MenuItem value="all">All Dispatchers</MenuItem>
              {drivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  {driverNameById[driver.id]}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Region" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
              <MenuItem value="all">All Regions</MenuItem>
              {['North Zone', 'East Zone', 'South Zone', 'West Zone', 'Downtown'].map((region) => (
                <MenuItem key={region} value={region}>
                  {region}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Job Status" value={jobStatusFilter} onChange={(event) => setJobStatusFilter(event.target.value)}>
              <MenuItem value="all">Unassigned, Ready, In Progress</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="ready">Ready</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
            </TextField>
            <Button
              variant="text"
              onClick={handleResetFilters}
              sx={{ minHeight: 40, fontWeight: 850 }}
            >
              Reset filters
            </Button>
          </Box>
        </SurfacePanel>
        <SurfacePanel variant="canvas" padding={0} sx={{ overflow: 'hidden', minHeight: 184 }}>
          {mapRoutes.length ? (
            <MultiRouteMap
              routes={mapRoutes}
              height="184px"
              showLegend={false}
              selectedRouteId={selectedRouteId}
              onRouteSelect={(routeId) => {
                if (routeId) setSelectedRouteId(routeId);
              }}
            />
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Publish routes to populate the live map preview.
              </Typography>
            </Box>
          )}
        </SurfacePanel>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: 'minmax(280px, 0.92fr) minmax(360px, 1.28fr) minmax(300px, 1.02fr)',
          },
          gap: 1.2,
          minWidth: 0,
          alignItems: 'start',
        }}
      >
        <SurfacePanel variant="panel" padding={0} sx={{ overflow: 'hidden', minWidth: 0 }}>
          <PanelHeader title="Unassigned Jobs" count={unassignedJobs.length} action="Sort by: Window Start" />
          <Stack spacing={0.85} sx={{ p: 1, maxHeight: { lg: 'calc(100vh - 296px)' }, overflowY: 'auto' }}>
            {unassignedJobs.slice(0, 12).map((job) => (
              <Box
                key={job.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.1,
                  p: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mb: 0.6 }}>
                      <StatusPill label={job.priority || 'Normal'} tone={priorityTone(job.priority || '')} />
                      <Typography variant="subtitle2" noWrap sx={{ fontWeight: 950 }}>
                        {job.id}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 850 }}>
                      {job.customerName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {formatTimeWindow(job)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {jobAddress(job)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {jobDistanceMiles(job) == null ? 'Distance pending' : formatMiles(jobDistanceMiles(job))}
                    </Typography>
                  </Box>
                  <Stack spacing={0.55} alignItems="flex-end">
                    <StatusPill label={String(job.status || 'Ready')} tone={statusTone(job.status)} />
                    <Button
                      variant="outlined"
                      size="small"
                      component={RouterLink}
                      to="/routing"
                      sx={{ minWidth: 72, fontWeight: 850 }}
                    >
                      Assign
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ))}
            {unassignedJobs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                No unassigned jobs match the current filters.
              </Typography>
            ) : null}
            <Button component={RouterLink} to="/jobs" variant="text" sx={{ justifyContent: 'flex-start', fontWeight: 850 }}>
              View all unassigned jobs
            </Button>
          </Stack>
        </SurfacePanel>

        <SurfacePanel variant="panel" padding={0} sx={{ overflow: 'hidden', minWidth: 0 }}>
          <PanelHeader title="Active Routes" count={visibleRoutes.length} action="Group by: Route" />
          <Stack spacing={0.95} sx={{ p: 1, maxHeight: { lg: 'calc(100vh - 296px)' }, overflowY: 'auto' }}>
            {visibleRoutes.map((lane, index) => {
              const accent = routeLaneAccents[index % routeLaneAccents.length];
              const completed = completedStopCount(lane.stops);
              const progress = lane.stops.length ? Math.round((completed / lane.stops.length) * 100) : 0;
              const routeState = getRouteDispatchState(lane.route);
              const readiness = getReadiness(lane);
              const assignment = resolveDriverVehicleAssignment({
                selectedDriverId:
                  selectedDriverByRoute[lane.route.id] ?? lane.route.driverId ?? '',
                selectedVehicleId: selectedVehicleByRoute[lane.route.id] || '',
                routeVehicleId: lane.route.vehicleId || null,
                drivers,
              });
              const driverId = assignment.driverId || lane.route.driverId || '';
              const vehicleId = assignment.vehicleId || lane.route.vehicleId || '';
              const editable = isEditableRoute(String(lane.route.status));
              const selected = selectedLane?.route.id === lane.route.id;
              return (
                <Box
                  key={lane.route.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`Select ${routeLabel(lane.route)}`}
                  onClick={() => setSelectedRouteId(lane.route.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedRouteId(lane.route.id);
                    }
                  }}
                  sx={{
                    border: '1px solid',
                    borderColor: selected ? alpha(accent, 0.55) : 'divider',
                    borderRadius: 1.1,
                    p: 1.1,
                    bgcolor: selected ? alpha(accent, isDark ? 0.1 : 0.055) : 'background.paper',
                    boxShadow: `inset 4px 0 0 ${accent}`,
                    cursor: 'pointer',
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Typography variant="h6" noWrap sx={{ fontWeight: 950, minWidth: 76 }}>
                          {routeLabel(lane.route)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {routeZone(index)}
                        </Typography>
                        <StatusPill label={routeState.label} tone={routeState.tone} />
                      </Stack>
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <Typography variant="subtitle2" sx={{ fontWeight: 950 }}>
                          {progress}%
                        </Typography>
                        <Box sx={{ width: 96 }}>
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{
                              height: 6,
                              borderRadius: 999,
                              bgcolor: alpha(trovanColors.semantic.success, 0.12),
                              '& .MuiLinearProgress-bar': {
                                bgcolor: trovanColors.semantic.success,
                                borderRadius: 999,
                              },
                            }}
                          />
                        </Box>
                      </Stack>
                    </Stack>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr auto' },
                        gap: 1,
                        alignItems: 'center',
                      }}
                    >
                      <InfoBlock label="Driver" value={driverNameById[driverId] || 'Unassigned'} />
                      <InfoBlock label="Vehicle" value={vehicleNameById[vehicleId] || 'Unassigned'} />
                      <InfoBlock {...routeDispatchTime(lane.route)} />
                      <InfoBlock label="Stops" value={`${completed || Math.min(1, lane.stops.length)} / ${lane.stops.length || 0}`} />
                    </Box>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.max(lane.stops.length || 1, 5)}, minmax(0, 1fr))`,
                        gap: 0.5,
                        alignItems: 'center',
                      }}
                    >
                      {Array.from({ length: Math.max(lane.stops.length || 1, 5) }).map((_, stopIndex) => {
                        const done = stopIndex < completed || (stopIndex === 0 && lane.stops.length > 0);
                        return (
                          <Box
                            key={`${lane.route.id}-${stopIndex}`}
                            sx={{
                              height: 8,
                              borderRadius: 999,
                              bgcolor: done ? trovanColors.semantic.success : alpha(theme.palette.text.primary, 0.16),
                            }}
                          />
                        );
                      })}
                    </Box>
                    <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                        <StatusPill label={readiness.ready ? 'On track' : readiness.blockers[0]?.message || 'Needs review'} tone={readiness.ready ? 'success' : 'warning'} />
                        <StatusPill label={formatMiles((lane.route.totalDistanceKm || 0) * kmToMiles)} tone="default" />
                      </Stack>
                      <Stack direction="row" spacing={0.65} alignItems="center">
                        <Button component={RouterLink} to={`/route-runs/${lane.route.id}`} variant="text" size="small" sx={{ fontWeight: 850 }}>
                          View route
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={!editable || savingRouteId === lane.route.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRouteAction(lane.route.id, 'assign');
                          }}
                          sx={{ fontWeight: 850 }}
                        >
                          Save
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          disabled={!editable || !readiness.ready || savingRouteId === lane.route.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRouteAction(lane.route.id, 'dispatch');
                          }}
                          sx={{ fontWeight: 850 }}
                        >
                          Dispatch
                        </Button>
                      </Stack>
                    </Stack>
                    {selected ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: '1fr 1fr 1.2fr' },
                          gap: 0.8,
                        }}
                      >
                        <TextField
                          select
                          size="small"
                          label="Driver"
                          value={driverId}
                          onChange={(event) => handleDriverSelection(lane.route.id, event.target.value)}
                        >
                          <MenuItem value="">Unassigned</MenuItem>
                          {drivers.map((driver) => (
                            <MenuItem key={driver.id} value={driver.id}>
                              {driverNameById[driver.id]}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          size="small"
                          label="Vehicle"
                          value={vehicleId}
                          onChange={(event) =>
                            setSelectedVehicleByRoute((current) => ({
                              ...current,
                              [lane.route.id]: event.target.value,
                            }))
                          }
                        >
                          <MenuItem value="">Unassigned</MenuItem>
                          {vehicles.map((vehicle) => (
                            <MenuItem key={vehicle.id} value={vehicle.id}>
                              {vehicleNameById[vehicle.id]}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          size="small"
                          label="Dispatch note"
                          value={dispatchNoteByRoute[lane.route.id] ?? lane.route.dispatchNote ?? ''}
                          onChange={(event) =>
                            setDispatchNoteByRoute((current) => ({
                              ...current,
                              [lane.route.id]: event.target.value,
                            }))
                          }
                        />
                      </Box>
                    ) : null}
                  </Stack>
                </Box>
              );
            })}
            {visibleRoutes.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                No active routes match the current filters.
              </Typography>
            ) : null}
            <Button component={RouterLink} to="/routing" variant="text" sx={{ justifyContent: 'flex-start', fontWeight: 850 }}>
              View all routes
            </Button>
          </Stack>
        </SurfacePanel>

        <SurfacePanel variant="panel" padding={0} sx={{ overflow: 'hidden', minWidth: 0 }}>
          <PanelHeader title="Exceptions & Communications" count={openExceptions.length} action="" />
          <Stack spacing={1} sx={{ p: 1, maxHeight: { lg: 'calc(100vh - 296px)' }, overflowY: 'auto' }}>
            <SurfacePanel variant="subtle" padding={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 950 }}>
                  Missed Window Alerts
                </Typography>
                <StatusPill label={String(highSignalExceptions.length)} tone={highSignalExceptions.length ? 'danger' : 'success'} />
              </Stack>
              <Stack spacing={0.7}>
                {highSignalExceptions.slice(0, 4).map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      borderLeft: `3px solid ${trovanColors.semantic.danger}`,
                      pl: 0.9,
                      py: 0.35,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 850 }}>
                          {item.code}
                        </Typography>
                        <Typography variant="caption" color="error" noWrap sx={{ display: 'block' }}>
                          {item.message}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {formatClock(item.createdAt)}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
                {highSignalExceptions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No active exceptions are blocking dispatch.
                  </Typography>
                ) : null}
                <Button component={RouterLink} to="/exceptions" size="small" variant="text" sx={{ justifyContent: 'flex-start', fontWeight: 850 }}>
                  View all
                </Button>
              </Stack>
            </SurfacePanel>

            <SurfacePanel variant="subtle" padding={1}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                <StatusPill label="Communications" tone="accent" />
                <StatusPill label="Driver Chat" tone="default" />
                <StatusPill label="Dispatch Notes" tone="default" />
                <StatusPill label="Acks" tone="default" />
              </Stack>
              <Stack spacing={0.75}>
                {selectedRouteMessages.slice(-5).reverse().map((message) => (
                  <Stack key={message.id} direction="row" spacing={0.9} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        bgcolor:
                          String(message.senderRole).toUpperCase() === 'DRIVER'
                            ? alpha(trovanColors.semantic.blue, 0.14)
                            : alpha(trovanColors.semantic.success, 0.14),
                        color:
                          String(message.senderRole).toUpperCase() === 'DRIVER'
                            ? trovanColors.semantic.blue
                            : trovanColors.semantic.success,
                        display: 'grid',
                        placeItems: 'center',
                        flex: '0 0 auto',
                      }}
                    >
                      <SendOutlined sx={{ fontSize: 15 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 850 }}>
                          {String(message.senderRole).toUpperCase() === 'DRIVER' ? 'Driver' : 'Dispatch'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {formatClock(message.createdAt)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {message.body}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
                {selectedRouteMessages.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No messages yet for the selected route.
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={0.75}>
                  <TextField
                    size="small"
                    label="Type message"
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    disabled={!selectedLane || !messageDraft.trim() || createMessageMutation.isPending}
                    onClick={async () => {
                      if (!selectedLane || !messageDraft.trim()) return;
                      setError(null);
                      try {
                        await createMessageMutation.mutateAsync({
                          routeRunId: selectedLane.route.id,
                          payload: { body: messageDraft.trim() },
                        });
                        setMessageDraft('');
                      } catch (err: unknown) {
                        setError(getRouteRunsErrorMessage(err));
                      }
                    }}
                    sx={{ fontWeight: 850 }}
                  >
                    Send
                  </Button>
                </Stack>
              </Stack>
            </SurfacePanel>

            <SurfacePanel variant="subtle" padding={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 950, mb: 0.8 }}>
                Acknowledgment Status
              </Typography>
              <Stack spacing={0.9}>
                <StatusProgress label="All drivers" value={routeRuns.length ? Math.max(routeRuns.length - boardSummary.ready, 0) : 0} total={routeRuns.length || 1} tone={trovanColors.semantic.success} />
                <StatusProgress label="Pending" value={boardSummary.ready} total={routeRuns.length || 1} tone={trovanColors.semantic.warning} />
              </Stack>
              <Button component={RouterLink} to={selectedLane ? `/route-runs/${selectedLane.route.id}` : '/dispatch'} size="small" variant="text" sx={{ mt: 1, fontWeight: 850 }}>
                View details
              </Button>
            </SurfacePanel>
          </Stack>
        </SurfacePanel>
      </Box>

      <SurfacePanel variant="panel" padding={0.9}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          divider={<Divider orientation="vertical" flexItem />}
        >
          <FooterMetric label="Live Updates" value="On" color={trovanColors.semantic.success} />
          <FooterMetric label="Active Drivers" value={`${activeDrivers} / ${drivers.length || 0}`} />
          <FooterMetric label="Jobs in Progress" value={String(jobsInProgress)} />
          <FooterMetric label="Exceptions" value={String(boardSummary.exceptions)} color={boardSummary.exceptions ? trovanColors.semantic.danger : trovanColors.semantic.success} />
          <FooterMetric label="Last updated" value={formatClock(new Date().toISOString())} />
        </Stack>
      </SurfacePanel>

      <Dialog
        open={exceptionDialogOpen}
        onClose={() => setExceptionDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create Exception</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            label="Code"
            value={exceptionForm.code}
            onChange={(event) =>
              setExceptionForm((current) => ({ ...current, code: event.target.value }))
            }
            placeholder="DELAY"
            fullWidth
          />
          <TextField
            label="Message"
            value={exceptionForm.message}
            onChange={(event) =>
              setExceptionForm((current) => ({
                ...current,
                message: event.target.value,
              }))
            }
            multiline
            minRows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExceptionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void submitException()}
            disabled={!selectedLane || !exceptionForm.code.trim() || !exceptionForm.message.trim()}
          >
            Create exception
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dispatchAllDialogOpen}
        onClose={() => setDispatchAllDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Dispatch Ready Routes</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {dispatchableRouteIds.length
              ? `${dispatchableRouteIds.length} route${dispatchableRouteIds.length === 1 ? '' : 's'} passed driver, vehicle, stop, and blocker checks.`
              : 'No routes currently pass dispatch readiness checks.'}
          </Typography>
          {visibleRoutes.map((lane) => {
            const readiness = getReadiness(lane);
            return (
              <Stack
                key={lane.route.id}
                direction="row"
                justifyContent="space-between"
                spacing={1}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  px: 1,
                  py: 0.85,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 850 }}>
                  {routeLabel(lane.route)}
                </Typography>
                <StatusPill
                  label={readiness.ready ? 'Ready' : readiness.blockers[0]?.message || 'Blocked'}
                  tone={readiness.ready ? 'success' : 'warning'}
                />
              </Stack>
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDispatchAllDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!dispatchableRouteIds.length || savingRouteId === 'bulk-dispatch'}
            onClick={() => void handleDispatchAll()}
          >
            Dispatch ready routes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={sendUpdatesDialogOpen}
        onClose={() => setSendUpdatesDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Send Route Updates</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            This sends a persisted dispatch message to every route currently visible on the board.
          </Typography>
          <TextField
            label="Update message"
            value={bulkUpdateDraft}
            onChange={(event) => setBulkUpdateDraft(event.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendUpdatesDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!bulkUpdateDraft.trim() || createMessageMutation.isPending}
            onClick={() => void handleSendBulkUpdate()}
          >
            Send updates
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={reassignDialogOpen}
        onClose={() => setReassignDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Reassign Route</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            select
            label="Route"
            value={selectedLane?.route.id || ''}
            onChange={(event) => setSelectedRouteId(event.target.value)}
            fullWidth
          >
            {visibleRoutes.map((lane) => (
              <MenuItem key={lane.route.id} value={lane.route.id}>
                {routeLabel(lane.route)} · {lane.stops.length} stops
              </MenuItem>
            ))}
          </TextField>
          {selectedLane ? (
            <>
              <TextField
                select
                label="Driver"
                value={selectedDriverByRoute[selectedLane.route.id] ?? selectedLane.route.driverId ?? ''}
                onChange={(event) => handleDriverSelection(selectedLane.route.id, event.target.value)}
                fullWidth
              >
                <MenuItem value="">Unassigned</MenuItem>
                {drivers.map((driver) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {driverNameById[driver.id]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Vehicle"
                value={selectedVehicleByRoute[selectedLane.route.id] ?? selectedLane.route.vehicleId ?? ''}
                onChange={(event) =>
                  setSelectedVehicleByRoute((current) => ({
                    ...current,
                    [selectedLane.route.id]: event.target.value,
                  }))
                }
                fullWidth
              >
                <MenuItem value="">Unassigned</MenuItem>
                {vehicles.map((vehicle) => (
                  <MenuItem key={vehicle.id} value={vehicle.id}>
                    {vehicleNameById[vehicle.id]}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedLane || savingRouteId === selectedLane.route.id}
            onClick={async () => {
              if (!selectedLane) return;
              await handleRouteAction(selectedLane.route.id, 'assign');
              setNotice({ severity: 'success', message: `${routeLabel(selectedLane.route)} assignment saved.` });
              setReassignDialogOpen(false);
            }}
          >
            Save reassignment
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={3600}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {notice ? (
          <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)}>
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

function PanelHeader({
  title,
  count,
  action,
}: {
  title: string;
  count: number;
  action: string;
}) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ px: 1.25, py: 1.05, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
        <Typography variant="h6" noWrap sx={{ fontWeight: 950 }}>
          {title}
        </Typography>
        <StatusPill label={String(count)} tone={count ? 'info' : 'default'} />
      </Stack>
      {action ? (
        <Stack direction="row" spacing={0.4} alignItems="center">
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
            {action}
          </Typography>
          <MoreVertOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
        </Stack>
      ) : null}
    </Stack>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 750 }}>
        {label}
      </Typography>
      <Typography variant="body2" noWrap sx={{ fontWeight: 850 }}>
        {value}
      </Typography>
    </Box>
  );
}

function StatusProgress({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" sx={{ width: 96, fontWeight: 750 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={percent}
          sx={{
            height: 6,
            borderRadius: 999,
            bgcolor: alpha(tone, 0.12),
            '& .MuiLinearProgress-bar': {
              bgcolor: tone,
              borderRadius: 999,
            },
          }}
        />
      </Box>
      <Typography variant="body2" sx={{ width: 52, textAlign: 'right', fontWeight: 850 }}>
        {value} / {total}
      </Typography>
    </Stack>
  );
}

function FooterMetric({
  label,
  value,
  color = trovanColors.black[500],
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: 999,
          bgcolor: color,
          flex: '0 0 auto',
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>
        {label}
      </Typography>
      <Typography variant="body2" noWrap sx={{ fontWeight: 900 }}>
        {value}
      </Typography>
    </Stack>
  );
}
