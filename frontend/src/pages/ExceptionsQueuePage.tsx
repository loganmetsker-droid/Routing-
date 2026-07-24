import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  List,
  ListItemButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MultiRouteMap from '../components/maps/MultiRouteMap';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import {
  getRouteRunsErrorMessage,
  type DispatchExceptionRecord,
  type RouteRunRecord,
  useCreateExceptionMutation,
  useExceptionsQuery,
  useRouteRunsQuery,
  useUpdateExceptionMutation,
} from '../features/dispatch/api/routeRunsApi';
import { extractRoutePolyline } from '../features/dispatch/utils/routeMap';
import {
  estimateTrailerLoadFit,
  formatConstraintLabel,
  routingConstraintOptions,
  type ConstraintSeverity,
  type RoutingConstraintType,
} from '../features/exceptions/routingConstraints';
import { trovanColors } from '../theme/designTokens';

const trailerProfiles = [
  {
    value: 'dry-van-53',
    label: '53 ft dry van',
    lengthFt: 53,
    widthIn: 102,
    heightIn: 110,
    weightCapacityLb: 45000,
  },
  {
    value: 'box-truck-26',
    label: '26 ft box truck',
    lengthFt: 26,
    widthIn: 96,
    heightIn: 96,
    weightCapacityLb: 10000,
  },
  {
    value: 'sprinter-van',
    label: 'Sprinter van',
    lengthFt: 14,
    widthIn: 70,
    heightIn: 76,
    weightCapacityLb: 3000,
  },
] as const;

type ConstraintScope = 'JOB' | 'CUSTOMER' | 'ROUTE' | 'VEHICLE' | 'SITE';

const defaultTrailerProfile = trailerProfiles[0];

const constraintCodeFor = (type: RoutingConstraintType) =>
  type.replace(/_/g, '-').slice(0, 24).toUpperCase();

const normalizeDetails = (details?: Record<string, unknown>) =>
  details && typeof details === 'object' ? details : {};

const detailString = (details: Record<string, unknown>, key: string) =>
  typeof details[key] === 'string' ? String(details[key]) : '';

const detailRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const detailNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

function formatLoadSummary(details: Record<string, unknown>) {
  const load = detailRecord(details.load);
  const estimate = detailRecord(load.estimate);
  const quantity = detailNumber(load.quantity);
  const positions = detailNumber(estimate.floorPositionsRequired);
  const maxPallets = detailNumber(estimate.maxPalletsEstimated);
  if (quantity == null || positions == null || maxPallets == null) return null;
  return `${quantity} pallets • ${positions} floor spots • ${maxPallets} max estimated`;
}

function getCreatedExceptionId(result: unknown) {
  const record = detailRecord(result);
  const exception = detailRecord(record.exception);
  const dataException = detailRecord(detailRecord(record.data).exception);
  const exceptionId = typeof exception.id === 'string' ? exception.id : '';
  const dataExceptionId = typeof dataException.id === 'string' ? dataException.id : '';
  return exceptionId || dataExceptionId || null;
}

function statusTone(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'resolved') return 'success';
  if (normalized === 'acknowledged') return 'info';
  if (['failed', 'cancelled'].includes(normalized)) return 'danger';
  if (['open', 'rescheduled'].includes(normalized)) return 'warning';
  return 'default';
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return timestamp.toLocaleString();
}

function formatStatusLabel(value?: string | null) {
  return String(value || 'unknown').replace(/_/g, ' ');
}

function summarizeRoute(routeRun?: RouteRunRecord) {
  if (!routeRun) return null;
  const routeStops = Array.isArray((routeRun.routeData as { route?: unknown[] } | null)?.route)
    ? ((routeRun.routeData as { route?: Array<Record<string, unknown>> | undefined } | null)?.route ?? [])
    : [];

  return {
    stopCount: routeRun.jobCount ?? routeStops.length,
    distance:
      routeRun.totalDistanceKm != null ? `${(routeRun.totalDistanceKm * 0.621371).toFixed(1)} mi` : 'Pending',
    duration:
      routeRun.totalDurationMinutes != null
        ? `${Math.round(routeRun.totalDurationMinutes)} min`
        : 'Pending',
    plannedStart: formatDateTime(routeRun.plannedStart),
    notes: routeRun.notes || 'No route notes yet.',
  };
}

function buildRouteMap(routeRun?: RouteRunRecord) {
  if (!routeRun) return [];

  const routeStops = Array.isArray((routeRun.routeData as { route?: unknown[] } | null)?.route)
    ? ((routeRun.routeData as { route?: Array<Record<string, unknown>> | undefined } | null)?.route ?? [])
    : [];

  const polyline = extractRoutePolyline(routeRun as any).map(([lat, lng]) => [lng, lat] as [number, number]);
  const stops = routeStops
    .map((stop) => {
      const latitude = typeof stop.latitude === 'number' ? stop.latitude : null;
      const longitude = typeof stop.longitude === 'number' ? stop.longitude : null;
      if (latitude == null || longitude == null) return null;
      return {
        lat: latitude,
        lng: longitude,
        address: typeof stop.address === 'string' ? stop.address : 'Address pending',
        type: 'delivery' as const,
      };
    })
    .filter(Boolean) as Array<{ lat: number; lng: number; address: string; type: 'delivery' }>;

  if (!polyline.length && !stops.length) {
    return [];
  }

  return [
    {
      id: routeRun.id,
      color: trovanColors.copper[500],
      status: String(routeRun.workflowStatus || routeRun.status || 'planned'),
      totalDistanceKm: routeRun.totalDistanceKm ?? undefined,
      totalDurationMinutes: routeRun.totalDurationMinutes ?? undefined,
      jobCount: routeRun.jobCount ?? stops.length,
      polyline: polyline.length ? { coordinates: polyline } : undefined,
      stops,
    },
  ];
}

export default function ExceptionsQueuePage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'>('ALL');
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [routeId, setRouteId] = useState('');
  const [constraintType, setConstraintType] = useState<RoutingConstraintType>('LOAD_FIT');
  const [constraintScope, setConstraintScope] = useState<ConstraintScope>('JOB');
  const [severity, setSeverity] = useState<ConstraintSeverity>('hard');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [requiredDriver, setRequiredDriver] = useState('');
  const [timeWindowStart, setTimeWindowStart] = useState('');
  const [timeWindowEnd, setTimeWindowEnd] = useState('');
  const [equipmentRequirement, setEquipmentRequirement] = useState('');
  const [accessRestriction, setAccessRestriction] = useState('');
  const [handlingRequirement, setHandlingRequirement] = useState('');
  const [temperatureRequirement, setTemperatureRequirement] = useState('');
  const [hazmatClass, setHazmatClass] = useState('');
  const [appointmentReference, setAppointmentReference] = useState('');
  const [trailerProfile, setTrailerProfile] = useState<string>(defaultTrailerProfile.value);
  const [palletQuantity, setPalletQuantity] = useState(1);
  const [palletLengthIn, setPalletLengthIn] = useState(48);
  const [palletWidthIn, setPalletWidthIn] = useState(40);
  const [palletHeightIn, setPalletHeightIn] = useState(48);
  const [palletWeightLb, setPalletWeightLb] = useState(1000);
  const [stackable, setStackable] = useState(true);
  const [maxStackLevels, setMaxStackLevels] = useState(2);
  const [trailerLengthFt, setTrailerLengthFt] = useState<number>(defaultTrailerProfile.lengthFt);
  const [trailerWidthIn, setTrailerWidthIn] = useState<number>(defaultTrailerProfile.widthIn);
  const [trailerHeightIn, setTrailerHeightIn] = useState<number>(defaultTrailerProfile.heightIn);
  const [trailerWeightCapacityLb, setTrailerWeightCapacityLb] = useState<number>(
    defaultTrailerProfile.weightCapacityLb,
  );

  const exceptionsQuery = useExceptionsQuery();
  const routeRunsQuery = useRouteRunsQuery();
  const createExceptionMutation = useCreateExceptionMutation();
  const updateExceptionMutation = useUpdateExceptionMutation();

  const items: DispatchExceptionRecord[] = exceptionsQuery.data ?? [];
  const routeRuns = routeRunsQuery.data ?? [];
  const loading = exceptionsQuery.isLoading || routeRunsQuery.isLoading;

  const counts = useMemo(
    () => ({
      open: items.filter((item) => item.status === 'OPEN').length,
      acknowledged: items.filter((item) => item.status === 'ACKNOWLEDGED').length,
      resolved: items.filter((item) => item.status === 'RESOLVED').length,
    }),
    [items],
  );

  const visibleItems = useMemo(
    () => items.filter((item) => (filter === 'ALL' ? true : item.status === filter)),
    [filter, items],
  );

  const loadEstimate = useMemo(
    () =>
      estimateTrailerLoadFit({
        quantity: palletQuantity,
        palletLengthIn,
        palletWidthIn,
        palletHeightIn,
        palletWeightLb,
        stackable,
        maxStackLevels,
        trailerLengthFt,
        trailerWidthIn,
        trailerHeightIn,
        trailerWeightCapacityLb,
      }),
    [
      maxStackLevels,
      palletHeightIn,
      palletLengthIn,
      palletQuantity,
      palletWeightLb,
      palletWidthIn,
      stackable,
      trailerHeightIn,
      trailerLengthFt,
      trailerWeightCapacityLb,
      trailerWidthIn,
    ],
  );

  const routeRunById = useMemo(
    () => new Map(routeRuns.map((routeRun) => [routeRun.id, routeRun])),
    [routeRuns],
  );

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedExceptionId(null);
      return;
    }
    if (!selectedExceptionId || !visibleItems.some((item) => item.id === selectedExceptionId)) {
      setSelectedExceptionId(visibleItems[0].id);
    }
  }, [selectedExceptionId, visibleItems]);

  const selectedException = visibleItems.find((item) => item.id === selectedExceptionId) ?? null;
  const selectedDetails = normalizeDetails(selectedException?.details);
  const selectedConstraintType = detailString(selectedDetails, 'constraintType');
  const selectedLoadSummary = formatLoadSummary(selectedDetails);
  const selectedRouteRun = selectedException?.routeId
    ? routeRunById.get(selectedException.routeId)
    : undefined;
  const selectedRouteSummary = summarizeRoute(selectedRouteRun);
  const selectedRouteMap = useMemo(() => buildRouteMap(selectedRouteRun), [selectedRouteRun]);

  const resetCreateDialog = () => {
    setDialogOpen(false);
    setRouteId('');
    setConstraintType('LOAD_FIT');
    setConstraintScope('JOB');
    setSeverity('hard');
    setCode('');
    setMessage('');
    setRequiredDriver('');
    setTimeWindowStart('');
    setTimeWindowEnd('');
    setEquipmentRequirement('');
    setAccessRestriction('');
    setHandlingRequirement('');
    setTemperatureRequirement('');
    setHazmatClass('');
    setAppointmentReference('');
    setTrailerProfile(defaultTrailerProfile.value);
    setPalletQuantity(1);
    setPalletLengthIn(48);
    setPalletWidthIn(40);
    setPalletHeightIn(48);
    setPalletWeightLb(1000);
    setStackable(true);
    setMaxStackLevels(2);
    setTrailerLengthFt(defaultTrailerProfile.lengthFt);
    setTrailerWidthIn(defaultTrailerProfile.widthIn);
    setTrailerHeightIn(defaultTrailerProfile.heightIn);
    setTrailerWeightCapacityLb(defaultTrailerProfile.weightCapacityLb);
  };

  const handleTrailerProfileChange = (profileValue: string) => {
    setTrailerProfile(profileValue);
    const profile = trailerProfiles.find((item) => item.value === profileValue);
    if (!profile) return;
    setTrailerLengthFt(profile.lengthFt);
    setTrailerWidthIn(profile.widthIn);
    setTrailerHeightIn(profile.heightIn);
    setTrailerWeightCapacityLb(profile.weightCapacityLb);
  };

  const handleUpdate = async (
    exceptionId: string,
    status: 'ACKNOWLEDGED' | 'RESOLVED',
  ) => {
    setError(null);
    try {
      await updateExceptionMutation.mutateAsync({ exceptionId, status });
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const handleCreate = async () => {
    setError(null);
    const effectiveCode = (code.trim() || constraintCodeFor(constraintType)).toUpperCase();
    const details = {
      source: 'exceptions-queue',
      timing: 'pre_routing',
      constraintType,
      constraintScope,
      severity,
      requiredDriver: requiredDriver.trim() || undefined,
      timeWindow:
        timeWindowStart || timeWindowEnd
          ? {
              start: timeWindowStart || undefined,
              end: timeWindowEnd || undefined,
            }
          : undefined,
      equipmentRequirement: equipmentRequirement.trim() || undefined,
      accessRestriction: accessRestriction.trim() || undefined,
      handlingRequirement: handlingRequirement.trim() || undefined,
      temperatureRequirement: temperatureRequirement.trim() || undefined,
      hazmatClass: hazmatClass.trim() || undefined,
      appointmentReference: appointmentReference.trim() || undefined,
      load: {
        quantity: palletQuantity,
        palletLengthIn,
        palletWidthIn,
        palletHeightIn,
        palletWeightLb,
        stackable,
        maxStackLevels,
        trailerProfile,
        trailerLengthFt,
        trailerWidthIn,
        trailerHeightIn,
        trailerWeightCapacityLb,
        estimate: loadEstimate,
      },
    };

    try {
      const result = await createExceptionMutation.mutateAsync({
        routeId: routeId || undefined,
        code: effectiveCode,
        message: message.trim(),
        details,
      });
      const createdId = getCreatedExceptionId(result);
      resetCreateDialog();
      setSelectedExceptionId(createdId);
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  if (loading) {
    return <LoadingState label="Loading exceptions queue..." minHeight="50vh" />;
  }

  return (
    <Stack spacing={1.5}>
      <PageHeader
        eyebrow="Dispatch"
        title="Exceptions & constraints"
        subtitle="Capture routing rules before planning and resolve live delivery issues from one operational workspace."
        actions={
          <>
            <Button component={RouterLink} to="/dispatch" variant="outlined">
              Back to dispatch
            </Button>
            <Button variant="contained" onClick={() => setDialogOpen(true)}>
              New exception
            </Button>
          </>
        }
      />
      {error ? <Alert severity="error">{error}</Alert> : null}

      <SurfacePanel variant="command" padding={0} sx={{ overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          justifyContent="space-between"
          spacing={1.25}
          sx={{ px: 1.75, py: 1.1, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Stack direction="row" spacing={0.75} flexWrap="wrap">
            <Button size="small" aria-pressed={filter === 'ALL'} variant={filter === 'ALL' ? 'contained' : 'outlined'} onClick={() => setFilter('ALL')}>
              All {items.length}
            </Button>
            <Button size="small" aria-pressed={filter === 'OPEN'} variant={filter === 'OPEN' ? 'contained' : 'outlined'} onClick={() => setFilter('OPEN')}>
              Open {counts.open}
            </Button>
            <Button
              size="small"
              aria-pressed={filter === 'ACKNOWLEDGED'}
              variant={filter === 'ACKNOWLEDGED' ? 'contained' : 'outlined'}
              onClick={() => setFilter('ACKNOWLEDGED')}
            >
              Acknowledged {counts.acknowledged}
            </Button>
            <Button
              size="small"
              aria-pressed={filter === 'RESOLVED'}
              variant={filter === 'RESOLVED' ? 'contained' : 'outlined'}
              onClick={() => setFilter('RESOLVED')}
            >
              Resolved {counts.resolved}
            </Button>
          </Stack>
          <Stack direction="row" spacing={0.75} flexWrap="wrap">
            <StatusPill label={`${visibleItems.length} visible`} />
            {selectedException ? <StatusPill label={selectedException.code} tone="accent" /> : null}
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              xl: 'minmax(280px, 0.95fr) minmax(340px, 1.15fr) minmax(320px, 1fr)',
            },
            minHeight: 'calc(100vh - 255px)',
          }}
        >
          <Box sx={{ borderRight: { xl: '1px solid' }, borderColor: 'divider' }}>
            <List disablePadding>
              {visibleItems.length === 0 ? (
                <Box sx={{ px: 2, py: 2.5 }}>
                  <Typography variant="subtitle1" sx={{ mb: 0.45 }}>
                    No exceptions in this view
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Adjust the filter or create a manual exception to populate the queue.
                  </Typography>
                </Box>
              ) : (
                visibleItems.map((item) => {
                  const active = item.id === selectedExceptionId;
                  const details = normalizeDetails(item.details);
                  const itemConstraintType = detailString(details, 'constraintType');
                  const itemSeverity = detailString(details, 'severity');
                  const itemLoadSummary = formatLoadSummary(details);
                  return (
                    <ListItemButton
                      key={item.id}
                      selected={active}
                      onClick={() => setSelectedExceptionId(item.id)}
                      sx={{
                        px: 1.5,
                        py: 1.2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        bgcolor: active ? alpha(trovanColors.copper[500], 0.06) : 'transparent',
                      }}
                    >
                      <Stack spacing={0.85} sx={{ width: '100%' }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          spacing={1}
                          alignItems="flex-start"
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {item.code}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.15 }}>
                              {item.message}
                            </Typography>
                          </Box>
                          <StatusPill label={item.status} tone={statusTone(item.status)} />
                        </Stack>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap">
                          {itemConstraintType ? (
                            <StatusPill label={formatConstraintLabel(itemConstraintType)} tone="accent" />
                          ) : null}
                          {itemSeverity ? <StatusPill label={`${itemSeverity} rule`} tone="warning" /> : null}
                          {item.routeId ? <StatusPill label={`Route ${item.routeId.slice(0, 8)}`} /> : null}
                          {item.routeRunStopId ? (
                            <StatusPill
                              label={`Stop ${item.routeRunStopId.slice(0, 8)}`}
                              tone="info"
                            />
                          ) : null}
                        </Stack>
                        {itemLoadSummary ? (
                          <Typography variant="caption" color="text.secondary">
                            {itemLoadSummary}
                          </Typography>
                        ) : null}
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(item.createdAt)}
                        </Typography>
                      </Stack>
                    </ListItemButton>
                  );
                })
              )}
            </List>
          </Box>

          <Box sx={{ borderRight: { xl: '1px solid' }, borderColor: 'divider', p: 1.75 }}>
            {selectedException ? (
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                  alignItems="flex-start"
                >
                  <Box>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ letterSpacing: '0.1em' }}
                    >
                      SELECTED EXCEPTION
                    </Typography>
                    <Typography variant="h4" sx={{ mt: 0.35 }}>
                      {selectedException.message}
                    </Typography>
                  </Box>
                  <StatusPill
                    label={selectedException.status}
                    tone={statusTone(selectedException.status)}
                  />
                </Stack>

                <Grid container spacing={1.1}>
                  <Grid item xs={6}>
                    <SurfacePanel variant="muted" padding={1.35}>
                      <Typography variant="caption" color="text.secondary">
                        Code
                      </Typography>
                      <Typography variant="subtitle1" sx={{ mt: 0.35 }}>
                        {selectedException.code}
                      </Typography>
                    </SurfacePanel>
                  </Grid>
                  <Grid item xs={6}>
                    <SurfacePanel variant="muted" padding={1.35}>
                      <Typography variant="caption" color="text.secondary">
                        Updated
                      </Typography>
                      <Typography variant="subtitle1" sx={{ mt: 0.35 }}>
                        {formatDateTime(selectedException.updatedAt || selectedException.createdAt)}
                      </Typography>
                    </SurfacePanel>
                  </Grid>
                </Grid>

                {selectedConstraintType ? (
                  <SurfacePanel variant="panel" padding={1.5}>
                    <Stack spacing={1.1}>
                      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                        <Box>
                          <Typography variant="subtitle2">Routing constraint</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {formatConstraintLabel(selectedConstraintType)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.65} flexWrap="wrap" justifyContent="flex-end">
                          {detailString(selectedDetails, 'timing') ? (
                            <StatusPill label="Pre-routing" tone="info" />
                          ) : null}
                          {detailString(selectedDetails, 'severity') ? (
                            <StatusPill
                              label={`${detailString(selectedDetails, 'severity')} rule`}
                              tone={detailString(selectedDetails, 'severity') === 'hard' ? 'danger' : 'warning'}
                            />
                          ) : null}
                          {detailString(selectedDetails, 'constraintScope') ? (
                            <StatusPill label={detailString(selectedDetails, 'constraintScope')} />
                          ) : null}
                        </Stack>
                      </Stack>

                      {selectedLoadSummary ? (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.65 }}>
                            {selectedLoadSummary}
                          </Typography>
                          {(() => {
                            const load = detailRecord(selectedDetails.load);
                            const estimate = detailRecord(load.estimate);
                            const floorPercent = detailNumber(estimate.floorSpacePercent) ?? 0;
                            const weightPercent = detailNumber(estimate.weightPercent) ?? 0;
                            const fits = estimate.fits === true;
                            return (
                              <Stack spacing={0.8}>
                                <Stack spacing={0.35}>
                                  <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      Trailer floor
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                      {floorPercent}%
                                    </Typography>
                                  </Stack>
                                  <LinearProgress
                                    variant="determinate"
                                    value={clampPercent(floorPercent)}
                                    color={floorPercent > 100 ? 'error' : floorPercent > 85 ? 'warning' : 'success'}
                                  />
                                </Stack>
                                <Stack spacing={0.35}>
                                  <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      Weight
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                      {weightPercent}%
                                    </Typography>
                                  </Stack>
                                  <LinearProgress
                                    variant="determinate"
                                    value={clampPercent(weightPercent)}
                                    color={weightPercent > 100 ? 'error' : weightPercent > 85 ? 'warning' : 'success'}
                                  />
                                </Stack>
                                <StatusPill
                                  label={fits ? 'Estimated to fit' : 'Needs capacity review'}
                                  tone={fits ? 'success' : 'danger'}
                                />
                              </Stack>
                            );
                          })()}
                        </Box>
                      ) : null}

                      <Grid container spacing={1}>
                        {[
                          ['Required driver', detailString(selectedDetails, 'requiredDriver')],
                          ['Equipment', detailString(selectedDetails, 'equipmentRequirement')],
                          ['Access', detailString(selectedDetails, 'accessRestriction')],
                          ['Handling', detailString(selectedDetails, 'handlingRequirement')],
                          ['Temperature', detailString(selectedDetails, 'temperatureRequirement')],
                          ['Hazmat', detailString(selectedDetails, 'hazmatClass')],
                          ['Appointment', detailString(selectedDetails, 'appointmentReference')],
                        ]
                          .filter(([, value]) => Boolean(value))
                          .map(([label, value]) => (
                            <Grid item xs={12} sm={6} key={label}>
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1,
                                  bgcolor: alpha(trovanColors.black[950], isDark ? 0.24 : 0.04),
                                  border: '1px solid',
                                  borderColor: 'divider',
                                }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  {label}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.15 }}>
                                  {value}
                                </Typography>
                              </Box>
                            </Grid>
                          ))}
                      </Grid>
                    </Stack>
                  </SurfacePanel>
                ) : null}

                <SurfacePanel variant="panel" padding={1.5}>
                  <Stack spacing={1.15}>
                    <Typography variant="subtitle2">Delivery context</Typography>
                    <Stack spacing={0.85}>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="body2" color="text.secondary">
                          Route run
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {selectedException.routeId
                            ? selectedException.routeId.slice(0, 8)
                            : 'Not linked'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="body2" color="text.secondary">
                          Affected stop
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {selectedException.routeRunStopId
                            ? selectedException.routeRunStopId.slice(0, 8)
                            : 'Route-level issue'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="body2" color="text.secondary">
                          Created
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatDateTime(selectedException.createdAt)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </SurfacePanel>

                <SurfacePanel variant="subtle" padding={1.5}>
                  <Typography variant="subtitle2" sx={{ mb: 0.85 }}>
                    Operator actions
                  </Typography>
                  <Stack direction="row" spacing={0.85} flexWrap="wrap">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={selectedException.status !== 'OPEN'}
                      onClick={() => void handleUpdate(selectedException.id, 'ACKNOWLEDGED')}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={selectedException.status === 'RESOLVED'}
                      onClick={() => void handleUpdate(selectedException.id, 'RESOLVED')}
                    >
                      Resolve
                    </Button>
                    {selectedException.routeId ? (
                      <Button
                        size="small"
                        component={RouterLink}
                        to={`/route-runs/${selectedException.routeId}`}
                      >
                        Open route
                      </Button>
                    ) : null}
                  </Stack>
                </SurfacePanel>

                <SurfacePanel variant="muted" padding={1.45}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Response timeline
                  </Typography>
                  <Stack spacing={0.9}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2" color="text.secondary">
                        Raised
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatDateTime(selectedException.createdAt)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2" color="text.secondary">
                        Current state
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatStatusLabel(selectedException.status)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2" color="text.secondary">
                        Last activity
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatDateTime(selectedException.updatedAt || selectedException.createdAt)}
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        mt: 0.2,
                        px: 1,
                        py: 0.95,
                        borderRadius: 1,
                        bgcolor: isDark ? alpha(trovanColors.black[950], 0.28) : alpha('#FFFFFF', 0.52),
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Operator note
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.25 }}>
                        {selectedException.status === 'RESOLVED'
                          ? 'Issue has been closed and is ready for timeline review.'
                          : selectedException.status === 'ACKNOWLEDGED'
                            ? 'Queue owner has accepted the issue and can continue route coordination.'
                            : 'This issue still needs a dispatcher decision before the route board is fully clear.'}
                      </Typography>
                    </Box>
                  </Stack>
                </SurfacePanel>
              </Stack>
            ) : (
              <Stack spacing={0.75} sx={{ py: 2 }}>
                <Typography variant="subtitle1">Select an exception</Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose an item from the queue to review delivery context and operator actions.
                </Typography>
              </Stack>
            )}
          </Box>

          <Box sx={{ p: 1.75 }}>
            {selectedException ? (
              <Stack spacing={1.5}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ letterSpacing: '0.1em' }}
                  >
                    ROUTE CONTEXT
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.35 }}>
                    {selectedRouteRun ? `Route ${selectedRouteRun.id.slice(0, 8)}` : 'No route linked'}
                  </Typography>
                </Box>

                <SurfacePanel variant="muted" padding={1.4}>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 1 }}>
                    {selectedRouteRun ? (
                      <StatusPill
                        label={formatStatusLabel(selectedRouteRun.workflowStatus || selectedRouteRun.status)}
                        tone={statusTone(String(selectedRouteRun.workflowStatus || selectedRouteRun.status))}
                      />
                    ) : null}
                    {selectedRouteSummary ? (
                      <StatusPill label={`${selectedRouteSummary.stopCount} stops`} tone="info" />
                    ) : null}
                  </Stack>
                  {selectedRouteSummary ? (
                    <Stack spacing={0.7}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Distance
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {selectedRouteSummary.distance}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Duration
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {selectedRouteSummary.duration}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="body2" color="text.secondary">
                          Planned start
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, textAlign: 'right' }}
                        >
                          {selectedRouteSummary.plannedStart}
                        </Typography>
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      This exception is not linked to a specific route run yet.
                    </Typography>
                  )}
                </SurfacePanel>

                <SurfacePanel variant="canvas" padding={0} sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{ px: 1.5, py: 1.1, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Typography variant="subtitle2">Route map</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Spatial context for the selected exception.
                    </Typography>
                  </Box>
                  {selectedRouteMap.length ? (
                    <MultiRouteMap routes={selectedRouteMap} height="260px" showLegend={false} />
                  ) : (
                    <Box sx={{ px: 1.5, py: 2.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        No route geometry is available for this exception.
                      </Typography>
                    </Box>
                  )}
                </SurfacePanel>

                {selectedRouteSummary ? (
                  <SurfacePanel variant="panel" padding={1.4}>
                    <Typography variant="subtitle2" sx={{ mb: 0.7 }}>
                      Route notes
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedRouteSummary.notes}
                    </Typography>
                  </SurfacePanel>
                ) : null}
              </Stack>
            ) : null}
          </Box>
        </Box>
      </SurfacePanel>

      <Dialog open={dialogOpen} onClose={resetCreateDialog} fullWidth maxWidth="md">
        <DialogTitle>Create routing constraint</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            select
            label="Route"
            value={routeId}
            onChange={(event) => setRouteId(event.target.value)}
            fullWidth
          >
            <MenuItem value="">No specific route</MenuItem>
            {routeRuns.map((route) => (
              <MenuItem key={route.id} value={route.id}>
                Route {route.id.slice(0, 8)}
              </MenuItem>
            ))}
          </TextField>

          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <TextField
                select
                label="Constraint type"
                value={constraintType}
                onChange={(event) => setConstraintType(event.target.value as RoutingConstraintType)}
                fullWidth
              >
                {routingConstraintOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Applies to"
                value={constraintScope}
                onChange={(event) => setConstraintScope(event.target.value as ConstraintScope)}
                fullWidth
              >
                <MenuItem value="JOB">Job</MenuItem>
                <MenuItem value="CUSTOMER">Customer</MenuItem>
                <MenuItem value="ROUTE">Route</MenuItem>
                <MenuItem value="VEHICLE">Vehicle</MenuItem>
                <MenuItem value="SITE">Site</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Rule strength"
                value={severity}
                onChange={(event) => setSeverity(event.target.value as ConstraintSeverity)}
                fullWidth
              >
                <MenuItem value="hard">Hard</MenuItem>
                <MenuItem value="soft">Soft</MenuItem>
                <MenuItem value="note">Note</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          <SurfacePanel variant="muted" padding={1.5}>
            <Stack spacing={1.4}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box>
                  <Typography variant="subtitle2">Load fit estimator</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pallet footprint, stackability, trailer positions, and weight capacity.
                  </Typography>
                </Box>
                <StatusPill
                  label={loadEstimate.fits ? 'Estimated to fit' : 'Capacity review'}
                  tone={loadEstimate.fits ? 'success' : 'danger'}
                />
              </Stack>

              <Grid container spacing={1.2}>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Pallets"
                    type="number"
                    value={palletQuantity}
                    onChange={(event) => setPalletQuantity(Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Length in"
                    type="number"
                    value={palletLengthIn}
                    onChange={(event) => setPalletLengthIn(Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Width in"
                    type="number"
                    value={palletWidthIn}
                    onChange={(event) => setPalletWidthIn(Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Height in"
                    type="number"
                    value={palletHeightIn}
                    onChange={(event) => setPalletHeightIn(Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Weight each lb"
                    type="number"
                    value={palletWeightLb}
                    onChange={(event) => setPalletWeightLb(Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={stackable}
                        onChange={(event) => setStackable(event.target.checked)}
                      />
                    }
                    label="Stackable"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Max stack levels"
                    type="number"
                    value={maxStackLevels}
                    onChange={(event) => setMaxStackLevels(Number(event.target.value))}
                    disabled={!stackable}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    label="Trailer profile"
                    value={trailerProfile}
                    onChange={(event) => handleTrailerProfileChange(event.target.value)}
                    fullWidth
                  >
                    {trailerProfiles.map((profile) => (
                      <MenuItem key={profile.value} value={profile.value}>
                        {profile.label}
                      </MenuItem>
                    ))}
                    <MenuItem value="custom">Custom</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <Grid container spacing={1.2}>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Trailer length ft"
                    type="number"
                    value={trailerLengthFt}
                    onChange={(event) => {
                      setTrailerProfile('custom');
                      setTrailerLengthFt(Number(event.target.value));
                    }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Trailer width in"
                    type="number"
                    value={trailerWidthIn}
                    onChange={(event) => {
                      setTrailerProfile('custom');
                      setTrailerWidthIn(Number(event.target.value));
                    }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Trailer height in"
                    type="number"
                    value={trailerHeightIn}
                    onChange={(event) => {
                      setTrailerProfile('custom');
                      setTrailerHeightIn(Number(event.target.value));
                    }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Weight cap lb"
                    type="number"
                    value={trailerWeightCapacityLb}
                    onChange={(event) => {
                      setTrailerProfile('custom');
                      setTrailerWeightCapacityLb(Number(event.target.value));
                    }}
                    fullWidth
                  />
                </Grid>
              </Grid>

              <Grid container spacing={1.2}>
                <Grid item xs={12} md={4}>
                  <SurfacePanel variant="panel" padding={1}>
                    <Typography variant="caption" color="text.secondary">
                      Floor positions
                    </Typography>
                    <Typography variant="subtitle1">
                      {loadEstimate.floorPositionsRequired} / {loadEstimate.trailerPalletPositions}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={clampPercent(loadEstimate.floorSpacePercent)}
                      color={
                        loadEstimate.floorSpacePercent > 100
                          ? 'error'
                          : loadEstimate.floorSpacePercent > 85
                            ? 'warning'
                            : 'success'
                      }
                    />
                  </SurfacePanel>
                </Grid>
                <Grid item xs={12} md={4}>
                  <SurfacePanel variant="panel" padding={1}>
                    <Typography variant="caption" color="text.secondary">
                      Weight
                    </Typography>
                    <Typography variant="subtitle1">
                      {loadEstimate.totalWeightLb.toLocaleString()} lb • {loadEstimate.weightPercent}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={clampPercent(loadEstimate.weightPercent)}
                      color={
                        loadEstimate.weightPercent > 100
                          ? 'error'
                          : loadEstimate.weightPercent > 85
                            ? 'warning'
                            : 'success'
                      }
                    />
                  </SurfacePanel>
                </Grid>
                <Grid item xs={12} md={4}>
                  <SurfacePanel variant="panel" padding={1}>
                    <Typography variant="caption" color="text.secondary">
                      Estimated max
                    </Typography>
                    <Typography variant="subtitle1">
                      {loadEstimate.maxPalletsEstimated} pallets
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Stack levels used: {loadEstimate.stackLevelsUsed}
                    </Typography>
                  </SurfacePanel>
                </Grid>
              </Grid>
            </Stack>
          </SurfacePanel>

          <Divider />

          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Required driver"
                value={requiredDriver}
                onChange={(event) => setRequiredDriver(event.target.value)}
                placeholder="Driver name, credential, or internal ID"
                fullWidth
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                label="Window start"
                type="time"
                value={timeWindowStart}
                onChange={(event) => setTimeWindowStart(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                label="Window end"
                type="time"
                value={timeWindowEnd}
                onChange={(event) => setTimeWindowEnd(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Vehicle / equipment"
                value={equipmentRequirement}
                onChange={(event) => setEquipmentRequirement(event.target.value)}
                placeholder="Liftgate, reefer, pallet jack, straps, flatbed"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Access restriction"
                value={accessRestriction}
                onChange={(event) => setAccessRestriction(event.target.value)}
                placeholder="Low bridge, narrow street, dock height, gate code"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Handling requirement"
                value={handlingRequirement}
                onChange={(event) => setHandlingRequirement(event.target.value)}
                placeholder="Non-stackable, top load only, fragile, no clamp"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Temperature"
                value={temperatureRequirement}
                onChange={(event) => setTemperatureRequirement(event.target.value)}
                placeholder="34-38 F"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Hazmat / regulated"
                value={hazmatClass}
                onChange={(event) => setHazmatClass(event.target.value)}
                placeholder="Class, permit, food-grade"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Dock appointment"
                value={appointmentReference}
                onChange={(event) => setAppointmentReference(event.target.value)}
                placeholder="Appointment number or receiver rule"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={constraintCodeFor(constraintType)}
                fullWidth
              />
            </Grid>
          </Grid>

          <TextField
            label="Dispatcher note"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What should routing respect before this job is assigned?"
            multiline
            minRows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={resetCreateDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={!message.trim()}
          >
            Save routing constraint
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
