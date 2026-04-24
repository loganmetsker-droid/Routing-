import {
  LocalShippingOutlined,
  ReportProblemOutlined,
  RouteOutlined,
  SpeedOutlined,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MultiRouteMap from '../components/maps/MultiRouteMap';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import { useDispatchBoardQuery } from '../features/dispatch/api/routeRunsApi';
import { buildDispatchMapRoutes } from '../features/dispatch/utils/opsMapData';
import { useRoutesQuery } from '../services/dispatchApi';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import { useJobsQuery } from '../services/jobsApi';
import { trovanColors } from '../theme/designTokens';

type MetricCard = {
  label: string;
  value: string | number;
  note: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  icon: typeof LocalShippingOutlined;
};

function metricTone(value: number) {
  if (value >= 6) return 'danger';
  if (value >= 3) return 'warning';
  return 'accent';
}

function statusTone(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced', 'resolved'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'danger';
  if (['assigned', 'ready_for_dispatch', 'in_progress', 'arrived'].includes(normalized)) return 'info';
  if (['open', 'rescheduled', 'urgent'].includes(normalized)) return 'warning';
  return 'default';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const jobsQuery = useJobsQuery();
  const routesQuery = useRoutesQuery();
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const boardQuery = useDispatchBoardQuery();

  const jobs = jobsQuery.data ?? [];
  const routes = routesQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const board = boardQuery.data;

  const loading =
    jobsQuery.isLoading ||
    routesQuery.isLoading ||
    driversQuery.isLoading ||
    vehiclesQuery.isLoading ||
    boardQuery.isLoading;

  const todayKey = new Date().toISOString().slice(0, 10);

  const dashboardState = useMemo(() => {
    const urgentJobs = jobs.filter((job) =>
      ['high', 'urgent'].includes(String(job.priority || '').toLowerCase()),
    );
    const activeRoutes = routes.filter((route) =>
      ['assigned', 'ready_for_dispatch', 'in_progress'].includes(
        String(route.workflowStatus || route.status || '').toLowerCase(),
      ),
    );
    const todayJobs = jobs.filter(
      (job) => String(job.createdAt || '').slice(0, 10) === todayKey,
    );
    const readyDrivers = drivers.filter((driver) =>
      ['active', 'on_duty', 'on_route'].includes(
        String(driver.status || '').toLowerCase(),
      ),
    );
    const readyVehicles = vehicles.filter((vehicle) =>
      ['available', 'active', 'ready'].includes(
        String(vehicle.status || '').toLowerCase(),
      ),
    );
    const openExceptions =
      board?.exceptions?.filter((item) => item.status === 'OPEN') ?? [];

    const metricCards: MetricCard[] = [
      {
        label: 'Live routes',
        value: activeRoutes.length,
        note: `${routes.length} total planned or active`,
        tone: activeRoutes.length ? 'info' : 'default',
        icon: RouteOutlined,
      },
      {
        label: 'Jobs waiting',
        value: jobs.filter((job) => !job.assignedRouteId).length,
        note: `${todayJobs.length} landed today`,
        tone: urgentJobs.length ? 'warning' : 'default',
        icon: LocalShippingOutlined,
      },
      {
        label: 'At risk',
        value: openExceptions.length + urgentJobs.length,
        note: `${openExceptions.length} open exceptions`,
        tone: metricTone(openExceptions.length + urgentJobs.length),
        icon: ReportProblemOutlined,
      },
      {
        label: 'Today readiness',
        value: `${drivers.length ? Math.round((readyDrivers.length / drivers.length) * 100) : 0}%`,
        note: `${readyVehicles.length}/${vehicles.length || 0} vehicles ready`,
        tone: readyVehicles.length >= Math.max(1, vehicles.length - 1) ? 'success' : 'accent',
        icon: SpeedOutlined,
      },
    ];

    const urgentQueue = urgentJobs.slice(0, 6).map((job) => ({
      id: job.id,
      title: job.customerName || 'Priority job',
      detail: job.deliveryAddress || 'Address pending',
      status: String(job.status || 'pending'),
    }));

    const routeFeed = routes.slice(0, 7).map((route) => ({
      id: route.id,
      label: route.vehicleId ? `Route ${route.id.slice(0, 8)}` : route.id,
      detail: `${route.jobIds?.length || 0} stops • ${Number(route.totalDistanceKm || 0).toFixed(1)} km`,
      status: String(route.workflowStatus || route.status || 'planned'),
    }));

    const activity = [
      ...openExceptions.slice(0, 3).map((item) => ({
        id: item.id,
        title: item.code,
        detail: item.message,
        tone: 'warning' as const,
      })),
      ...todayJobs.slice(0, 2).map((job) => ({
        id: job.id,
        title: `Job ${job.id.slice(0, 8)}`,
        detail: `${job.customerName || 'Customer'} added to intake`,
        tone: 'accent' as const,
      })),
    ];

    return {
      metricCards,
      urgentQueue,
      routeFeed,
      activity,
      openExceptions,
    };
  }, [board?.exceptions, drivers, jobs, routes, todayKey, vehicles]);

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

  if (loading) {
    return <LoadingState label="Loading dashboard..." minHeight="50vh" />;
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        subtitle="Live execution pressure, route readiness, and the next actions that matter."
        actions={
          <>
            <Button variant="contained" onClick={() => navigate('/jobs?create=true')}>
              New job
            </Button>
            <Button variant="outlined" onClick={() => navigate('/routing')}>
              Open routing
            </Button>
            <Button variant="outlined" onClick={() => navigate('/dispatch')}>
              Open dispatch
            </Button>
          </>
        }
      />

      <Grid container spacing={1.2} sx={{ mb: 1.35 }}>
        {dashboardState.metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Grid item xs={12} sm={6} xl={3} key={card.label}>
              <SurfacePanel variant="panel" padding={1.45}>
                <Stack spacing={0.9}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {card.label}
                    </Typography>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(trovanColors.copper[500], 0.08),
                        color: trovanColors.copper[600],
                      }}
                    >
                      <Icon sx={{ fontSize: 14 }} />
                    </Box>
                  </Stack>
                  <Typography variant="h5" sx={{ lineHeight: 1.05 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {card.note}
                  </Typography>
                </Stack>
              </SurfacePanel>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={1.5}>
        <Grid item xs={12} xl={3}>
          <Stack spacing={1.5}>
            <SurfacePanel variant="panel" padding={0}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6">Urgent queue</Typography>
                <Typography variant="body2" color="text.secondary">
                  High-priority work that still needs routing or dispatch attention.
                </Typography>
              </Box>
              <List disablePadding>
                {dashboardState.urgentQueue.length === 0 ? (
                  <ListItem sx={{ py: 2.5 }}>
                    <ListItemText
                      primary="No urgent jobs waiting"
                      secondary="The intake queue is clear right now."
                    />
                  </ListItem>
                ) : (
                  dashboardState.urgentQueue.map((entry) => (
                    <ListItem
                      key={entry.id}
                      sx={{
                        py: 1.5,
                        px: 2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        alignItems: 'flex-start',
                      }}
                    >
                      <ListItemText
                        primary={entry.title}
                        secondary={entry.detail}
                        primaryTypographyProps={{ fontWeight: 700 }}
                      />
                      <StatusPill
                        label={entry.status.replace(/_/g, ' ')}
                        tone={statusTone(entry.status)}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </SurfacePanel>

            <SurfacePanel variant="subtle" padding={1.5}>
              <Typography variant="h6" sx={{ mb: 1.25 }}>
                Needs attention
              </Typography>
              <Stack spacing={1.1}>
                {dashboardState.activity.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No new alerts or intake activity.
                  </Typography>
                ) : (
                  dashboardState.activity.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        px: 1,
                        py: 0.85,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {item.title}
                        </Typography>
                        <StatusPill
                          label={item.tone === 'warning' ? 'Review' : 'New'}
                          tone={item.tone === 'warning' ? 'warning' : 'accent'}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {item.detail}
                      </Typography>
                    </Box>
                  ))
                )}
              </Stack>
            </SurfacePanel>
          </Stack>
        </Grid>

        <Grid item xs={12} xl={6}>
          <Stack spacing={1.5}>
            <SurfacePanel variant="canvas" padding={0} sx={{ overflow: 'hidden' }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ px: 2, py: 1.4, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Box>
                  <Typography variant="h6">Live operations map</Typography>
                  <Typography variant="body2" color="text.secondary">
                    A shared view across active, assigned, and in-progress route geometry.
                  </Typography>
                </Box>
                <StatusPill
                  label={`${mapRoutes.length} routes`}
                  tone={mapRoutes.length ? 'accent' : 'default'}
                />
              </Stack>
              <Box sx={{ height: 460 }}>
                {mapRoutes.length ? (
                  <MultiRouteMap routes={mapRoutes} height="460px" />
                ) : (
                  <Box sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      No route geometry is available yet. Publish a plan to populate the live map.
                    </Typography>
                  </Box>
                )}
              </Box>
            </SurfacePanel>

            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <SurfacePanel variant="subtle" padding={1.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                    Throughput
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.75 }}>
                    {jobs.filter((job) => String(job.status).toLowerCase() === 'completed').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Jobs completed from the current queue snapshot.
                  </Typography>
                </SurfacePanel>
              </Grid>
              <Grid item xs={12} md={4}>
                <SurfacePanel variant="subtle" padding={1.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                    SLA pressure
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.75 }}>
                    {dashboardState.openExceptions.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Open delivery exceptions affecting today&apos;s routes.
                  </Typography>
                </SurfacePanel>
              </Grid>
              <Grid item xs={12} md={4}>
                <SurfacePanel variant="subtle" padding={1.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                    Capacity
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.75 }}>
                    {vehicles.filter((vehicle) => String(vehicle.status).toLowerCase() === 'available').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Vehicles available for additional work or rebalancing.
                  </Typography>
                </SurfacePanel>
              </Grid>
            </Grid>
          </Stack>
        </Grid>

        <Grid item xs={12} xl={3}>
          <Stack spacing={1.5}>
            <SurfacePanel variant="panel" padding={0}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6">Route feed</Typography>
                <Typography variant="body2" color="text.secondary">
                  Current route state, stop count, and dispatch readiness.
                </Typography>
              </Box>
              <List disablePadding>
                {dashboardState.routeFeed.length === 0 ? (
                  <ListItem sx={{ py: 2.5 }}>
                    <ListItemText
                      primary="No route activity"
                      secondary="Generate or publish work to populate the live feed."
                    />
                  </ListItem>
                ) : (
                  dashboardState.routeFeed.map((route) => (
                    <ListItem
                      key={route.id}
                      sx={{
                        py: 1.5,
                        px: 2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        alignItems: 'flex-start',
                      }}
                    >
                      <ListItemText
                        primary={route.label}
                        secondary={route.detail}
                        primaryTypographyProps={{ fontWeight: 700 }}
                      />
                      <StatusPill
                        label={route.status.replace(/_/g, ' ')}
                        tone={statusTone(route.status)}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </SurfacePanel>

            <SurfacePanel variant="subtle">
              <Stack spacing={1.1}>
                <Typography variant="h6">Next actions</Typography>
                <Button variant="outlined" fullWidth onClick={() => navigate('/routing')}>
                  Review draft routes
                </Button>
                <Button variant="outlined" fullWidth onClick={() => navigate('/dispatch')}>
                  Open dispatch board
                </Button>
                <Button variant="outlined" fullWidth onClick={() => navigate('/exceptions')}>
                  Resolve exception queue
                </Button>
              </Stack>
            </SurfacePanel>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
