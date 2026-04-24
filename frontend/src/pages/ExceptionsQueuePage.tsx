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
  Grid,
  List,
  ListItem,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
import { trovanColors } from '../theme/designTokens';

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
      routeRun.totalDistanceKm != null ? `${routeRun.totalDistanceKm.toFixed(1)} km` : 'Pending',
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
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'>('ALL');
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [routeId, setRouteId] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

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
  const selectedRouteRun = selectedException?.routeId
    ? routeRunById.get(selectedException.routeId)
    : undefined;
  const selectedRouteSummary = summarizeRoute(selectedRouteRun);
  const selectedRouteMap = useMemo(() => buildRouteMap(selectedRouteRun), [selectedRouteRun]);

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
    try {
      await createExceptionMutation.mutateAsync({
        routeId: routeId || undefined,
        code: code.trim().toUpperCase(),
        message: message.trim(),
        details: { source: 'exceptions-queue' },
      });
      setDialogOpen(false);
      setRouteId('');
      setCode('');
      setMessage('');
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
        title="Exception queue"
        subtitle="Review delivery risk, coordinate route context, and resolve issues from a single operational workspace."
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
            <Button size="small" variant={filter === 'ALL' ? 'contained' : 'outlined'} onClick={() => setFilter('ALL')}>
              All {items.length}
            </Button>
            <Button size="small" variant={filter === 'OPEN' ? 'contained' : 'outlined'} onClick={() => setFilter('OPEN')}>
              Open {counts.open}
            </Button>
            <Button
              size="small"
              variant={filter === 'ACKNOWLEDGED' ? 'contained' : 'outlined'}
              onClick={() => setFilter('ACKNOWLEDGED')}
            >
              Acknowledged {counts.acknowledged}
            </Button>
            <Button
              size="small"
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
                  return (
                    <ListItem
                      key={item.id}
                      disableGutters
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
                          {item.routeId ? <StatusPill label={`Route ${item.routeId.slice(0, 8)}`} /> : null}
                          {item.routeRunStopId ? (
                            <StatusPill
                              label={`Stop ${item.routeRunStopId.slice(0, 8)}`}
                              tone="info"
                            />
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(item.createdAt)}
                        </Typography>
                      </Stack>
                    </ListItem>
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
                        bgcolor: '#FFFFFF',
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Exception</DialogTitle>
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
          <TextField
            label="Code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="DELAY"
            fullWidth
          />
          <TextField
            label="Message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            multiline
            minRows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={!code.trim() || !message.trim()}
          >
            Create exception
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
