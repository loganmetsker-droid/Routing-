import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import { getDrivers, getVehicles } from '../services/api';
import {
  DispatchExceptionRecord,
  RouteRunRecord,
  RouteRunStopRecord,
  dispatchRouteRun,
  getDispatchBoardV2,
  reassignRouteRun,
  startRouteRun,
} from '../features/dispatch/api/routeRunsApi';

function statusColor(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced', 'resolved'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'error';
  if (['in_progress', 'arrived', 'assigned', 'ready_for_dispatch'].includes(normalized)) return 'info';
  if (['open', 'rescheduled'].includes(normalized)) return 'warning';
  return 'default';
}

export default function DispatchBoardOpsPage() {
  const [loading, setLoading] = useState(true);
  const [savingRouteId, setSavingRouteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeRuns, setRouteRuns] = useState<RouteRunRecord[]>([]);
  const [routeRunStops, setRouteRunStops] = useState<RouteRunStopRecord[]>([]);
  const [exceptions, setExceptions] = useState<DispatchExceptionRecord[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedDriverByRoute, setSelectedDriverByRoute] = useState<Record<string, string>>({});

  const loadBoard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [board, nextDrivers, nextVehicles] = await Promise.all([
        getDispatchBoardV2(),
        getDrivers(),
        getVehicles(),
      ]);
      setRouteRuns(board.routeRuns || []);
      setRouteRunStops(board.routeRunStops || []);
      setExceptions(board.exceptions || []);
      setDrivers(Array.isArray(nextDrivers) ? nextDrivers : []);
      setVehicles(Array.isArray(nextVehicles) ? nextVehicles : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dispatch board.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBoard();
  }, []);

  const stopCountByRoute = useMemo(() => routeRunStops.reduce<Record<string, number>>((acc, stop) => {
    acc[stop.routeId] = (acc[stop.routeId] || 0) + 1;
    return acc;
  }, {}), [routeRunStops]);

  const servicedCountByRoute = useMemo(() => routeRunStops.reduce<Record<string, number>>((acc, stop) => {
    if (stop.status === 'SERVICED') acc[stop.routeId] = (acc[stop.routeId] || 0) + 1;
    return acc;
  }, {}), [routeRunStops]);

  const exceptionCountByRoute = useMemo(() => exceptions.reduce<Record<string, number>>((acc, item) => {
    if (item.routeId) acc[item.routeId] = (acc[item.routeId] || 0) + 1;
    return acc;
  }, {}), [exceptions]);

  const driverNameById = useMemo(() => Object.fromEntries(drivers.map((driver) => [driver.id, [driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.name || driver.id])), [drivers]);
  const vehicleNameById = useMemo(() => Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle.licensePlate || `${vehicle.make || 'Vehicle'} ${vehicle.model || ''}`.trim() || vehicle.id])), [vehicles]);

  const routeBuckets = useMemo(() => ({
    ready: routeRuns.filter((route) => ['assigned', 'planned'].includes(String(route.status).toLowerCase())),
    active: routeRuns.filter((route) => ['in_progress'].includes(String(route.status).toLowerCase())),
    completed: routeRuns.filter((route) => ['completed'].includes(String(route.status).toLowerCase())),
  }), [routeRuns]);

  const handleRouteAction = async (routeId: string, action: 'dispatch' | 'start' | 'assign') => {
    setSavingRouteId(routeId);
    setError(null);
    try {
      if (action === 'dispatch') {
        await dispatchRouteRun(routeId);
      } else if (action === 'start') {
        await startRouteRun(routeId);
      } else {
        await reassignRouteRun(routeId, { driverId: selectedDriverByRoute[routeId] || undefined, reason: 'dispatch board assignment' });
      }
      await loadBoard();
    } catch (err: any) {
      setError(err?.message || 'Dispatch action failed.');
    } finally {
      setSavingRouteId(null);
    }
  };

  if (loading) {
    return <LoadingState label="Loading dispatch board..." minHeight="50vh" />;
  }

  const renderRouteCard = (route: RouteRunRecord) => {
    const stopCount = stopCountByRoute[route.id] || 0;
    const servicedCount = servicedCountByRoute[route.id] || 0;
    const percent = stopCount ? Math.round((servicedCount / stopCount) * 100) : 0;
    return (
      <SurfacePanel key={route.id} sx={{ bgcolor: 'rgba(255,248,242,1)' }} data-testid={`dispatch-route-card-${route.id}`}>
        <Stack spacing={1.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Box>
              <Typography variant="h6">Route {route.id.slice(0, 8)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {vehicleNameById[route.vehicleId || ''] || route.vehicleId || 'Vehicle pending'}
                {' • '}
                {driverNameById[route.driverId || ''] || route.driverId || 'Driver pending'}
              </Typography>
            </Box>
            <Chip label={route.status} color={statusColor(route.status)} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {stopCount} stops • {servicedCount} serviced • {percent}% complete • {exceptionCountByRoute[route.id] || 0} exceptions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Number(route.totalDistanceKm || 0).toFixed(1)} km • {route.totalDurationMinutes || 0} min
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              select
              size="small"
              label="Assign driver"
              value={selectedDriverByRoute[route.id] ?? route.driverId ?? ''}
              onChange={(event) => setSelectedDriverByRoute((current) => ({ ...current, [route.id]: event.target.value }))}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {drivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>{driverNameById[driver.id]}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" disabled={savingRouteId === route.id} onClick={() => void handleRouteAction(route.id, 'assign')} data-testid={`dispatch-route-assign-button-${route.id}`}>Save assignment</Button>
            <Button variant="outlined" disabled={savingRouteId === route.id} onClick={() => void handleRouteAction(route.id, 'dispatch')} data-testid={`dispatch-route-dispatch-button-${route.id}`}>Dispatch</Button>
            <Button variant="contained" disabled={savingRouteId === route.id} onClick={() => void handleRouteAction(route.id, 'start')} data-testid={`dispatch-route-start-button-${route.id}`}>Start</Button>
            <Button component={RouterLink} to={`/route-runs/${route.id}`} variant="text" data-testid={`dispatch-route-open-detail-${route.id}`}>Open detail</Button>
          </Stack>
        </Stack>
      </SurfacePanel>
    );
  };

  return (
    <Box data-testid="dispatch-board-page">
      <PageHeader
        eyebrow="Operations"
        title="Dispatch Board"
        subtitle="Live execution board for published route runs, stop progress, assignment changes, and exception triage."
        actions={<Button component={RouterLink} to="/exceptions" variant="outlined">Exceptions Queue</Button>}
      />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Grid container spacing={2.5}>
        <Grid item xs={12} xl={3}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Board Summary</Typography>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">Ready: {routeBuckets.ready.length}</Typography>
                <Typography variant="body2" color="text.secondary">Active: {routeBuckets.active.length}</Typography>
                <Typography variant="body2" color="text.secondary">Completed: {routeBuckets.completed.length}</Typography>
                <Typography variant="body2" color="text.secondary">Open exceptions: {exceptions.filter((item) => item.status === 'OPEN').length}</Typography>
              </Stack>
            </SurfacePanel>
            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Active Exceptions</Typography>
              <List disablePadding>
                {exceptions.slice(0, 8).map((item) => (
                  <ListItem key={item.id} disableGutters component={RouterLink} to="/exceptions" sx={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <ListItemText primary={item.code} secondary={item.message} />
                    <Chip size="small" label={item.status} color={statusColor(item.status)} />
                  </ListItem>
                ))}
                {exceptions.length === 0 ? <Typography variant="body2" color="text.secondary">No active exceptions.</Typography> : null}
              </List>
            </SurfacePanel>
          </Stack>
        </Grid>
        <Grid item xs={12} xl={9}>
          <Grid container spacing={2.5}>
            {[
              { title: 'Ready To Dispatch', routes: routeBuckets.ready },
              { title: 'In Progress', routes: routeBuckets.active },
              { title: 'Completed', routes: routeBuckets.completed },
            ].map((bucket) => (
              <Grid item xs={12} md={4} key={bucket.title}>
                <SurfacePanel>
                  <Typography variant="h5" sx={{ mb: 1.5 }}>{bucket.title}</Typography>
                  <Stack spacing={1.5}>
                    {bucket.routes.length === 0 ? <Typography variant="body2" color="text.secondary">No route runs in this lane.</Typography> : bucket.routes.map(renderRouteCard)}
                  </Stack>
                </SurfacePanel>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
