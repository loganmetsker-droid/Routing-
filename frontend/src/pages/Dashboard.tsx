import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, Grid, LinearProgress, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import { KpiTile } from '../components/KpiTile';
import LoadingState from '../components/ui/LoadingState';
import { getDrivers, getVehicles, getJobs, getRoutes, getDispatchOptimizerHealth, type OptimizerHealth } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [optimizerHealth, setOptimizerHealth] = useState<OptimizerHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [driversData, vehiclesData, jobsData, routesData, healthData] = await Promise.all([
          getDrivers(),
          getVehicles(),
          getJobs(),
          getRoutes(),
          getDispatchOptimizerHealth(),
        ]);
        if (!mounted) return;
        setDrivers(Array.isArray(driversData) ? driversData : []);
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
        setJobs(Array.isArray(jobsData) ? jobsData : []);
        setRoutes(Array.isArray(routesData) ? routesData : []);
        setOptimizerHealth(healthData);
      } catch (error) {
        console.error('Failed to load dashboard', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const jobsToday = jobs.filter((job) => String(job.createdAt || '').slice(0, 10) === todayKey).length;
    const unassigned = jobs.filter((job) => (job.status || 'pending') === 'pending').length;
    const activeRoutes = routes.filter((route) => ['assigned', 'in_progress', 'active', 'live'].includes(String(route.status))).length;
    const atRisk =
      routes.filter((route) => ['requested', 'approved'].includes(String(route.rerouteState))).length +
      jobs.filter((job) => ['high', 'urgent'].includes(String(job.priority).toLowerCase()) && (job.status || 'pending') !== 'completed').length;
    return { jobsToday, unassigned, activeRoutes, atRisk };
  }, [jobs, routes, todayKey]);

  const resourceHealth = useMemo(() => {
    const activeDrivers = drivers.filter((driver) => String(driver.status).toUpperCase() === 'ACTIVE').length;
    const availableVehicles = vehicles.filter((vehicle) => String(vehicle.status).toUpperCase() === 'AVAILABLE').length;
    const driverCapacity = drivers.length ? Math.round((activeDrivers / drivers.length) * 100) : 0;
    const fleetCapacity = vehicles.length ? Math.round((availableVehicles / vehicles.length) * 100) : 0;
    return { activeDrivers, availableVehicles, driverCapacity, fleetCapacity };
  }, [drivers, vehicles]);

  const activityFeed = useMemo(
    () =>
      jobs.slice(0, 5).map((job) => ({
        id: job.id,
        title: job.customerName || 'New customer job',
        meta: (job.deliveryAddress || 'Address pending') + ' • ' + (job.priority || 'normal') + ' priority',
        status: job.status || 'pending',
      })),
    [jobs],
  );

  const routingSummary = useMemo(() => {
    const ready = routes.filter((route) => ['draft', 'planned', 'review'].includes(String(route.status))).length;
    const live = routes.filter((route) => ['assigned', 'in_progress', 'active', 'live'].includes(String(route.status))).length;
    const completed = routes.filter((route) => String(route.status) === 'completed').length;
    return { ready, live, completed };
  }, [routes]);

  if (loading) {
    return <LoadingState label="Loading dashboard..." minHeight="50vh" />;
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        subtitle="What needs attention today, where capacity is tightening, and which workflow to open next."
        actions={
          <>
            <Button variant="contained" onClick={() => navigate('/jobs?create=true')}>
              Create Job
            </Button>
            <Button variant="outlined" onClick={() => navigate('/routing')}>
              Go to Routing
            </Button>
            <Chip
              label={optimizerHealth?.status === 'healthy' ? 'System healthy' : 'Needs review'}
              color={optimizerHealth?.status === 'healthy' ? 'success' : 'warning'}
            />
          </>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={6} xl={3}><KpiTile label="Jobs Today" value={stats.jobsToday} meta="New work created today" /></Grid>
        <Grid item xs={12} md={6} xl={3}><KpiTile label="Unassigned" value={stats.unassigned} meta="Still waiting for routing" tone={stats.unassigned > 0 ? 'warning' : 'success'} /></Grid>
        <Grid item xs={12} md={6} xl={3}><KpiTile label="Active Routes" value={stats.activeRoutes} meta="Published or live runs" tone="success" /></Grid>
        <Grid item xs={12} md={6} xl={3}><KpiTile label="At Risk" value={stats.atRisk} meta="Exceptions, reroutes, or urgent backlog" tone={stats.atRisk > 0 ? 'danger' : 'success'} /></Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} lg={7}>
          <SurfacePanel>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">Today in Operations</Typography>
                <Typography variant="body2" color="text.secondary">
                  Route planning should happen before dispatch publish. Keep the queue moving from jobs into routing, then publish reviewed plans into Dispatch.
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <SurfacePanel sx={{ bgcolor: 'rgba(250, 241, 234, 0.48)' }}>
                    <Typography variant="subtitle2" color="text.secondary">Queue pressure</Typography>
                    <Typography variant="h4" sx={{ mt: 1 }}>{stats.unassigned}</Typography>
                    <Typography variant="body2" color="text.secondary">Jobs still waiting for scenario selection.</Typography>
                  </SurfacePanel>
                </Grid>
                <Grid item xs={12} md={4}>
                  <SurfacePanel sx={{ bgcolor: 'rgba(255, 248, 242, 1)' }}>
                    <Typography variant="subtitle2" color="text.secondary">Driver availability</Typography>
                    <Typography variant="h4" sx={{ mt: 1 }}>{resourceHealth.activeDrivers}/{drivers.length || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Drivers available for assignment right now.</Typography>
                  </SurfacePanel>
                </Grid>
                <Grid item xs={12} md={4}>
                  <SurfacePanel sx={{ bgcolor: 'rgba(243, 236, 228, 0.75)' }}>
                    <Typography variant="subtitle2" color="text.secondary">Fleet readiness</Typography>
                    <Typography variant="h4" sx={{ mt: 1 }}>{resourceHealth.availableVehicles}/{vehicles.length || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Vehicles available before route publish.</Typography>
                  </SurfacePanel>
                </Grid>
              </Grid>
            </Stack>
          </SurfacePanel>
        </Grid>
        <Grid item xs={12} lg={5}>
          <SurfacePanel>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">Routing Summary</Typography>
                <Typography variant="body2" color="text.secondary">
                  Keep routing separate from dispatch. Review draft scenarios, then push approved plans into the board.
                </Typography>
              </Box>
              <Stack spacing={1.5}>
                {[
                  { label: 'Draft / review routes', value: routingSummary.ready, color: 'warning.main' },
                  { label: 'Live routes', value: routingSummary.live, color: 'success.main' },
                  { label: 'Completed routes', value: routingSummary.completed, color: 'info.main' },
                ].map((item) => (
                  <Box key={item.label}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                      <Typography variant="body2">{item.label}</Typography>
                      <Typography variant="body2" sx={{ color: item.color }}>{item.value}</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={Math.min(100, item.value * 18)} sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(233, 222, 211, 0.7)' }} />
                  </Box>
                ))}
              </Stack>
              <Button variant="text" onClick={() => navigate('/routing')}>Open routing workspace</Button>
            </Stack>
          </SurfacePanel>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={7}>
          <SurfacePanel>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">Activity Feed</Typography>
                <Typography variant="body2" color="text.secondary">Recent customer demand and status changes.</Typography>
              </Box>
              <List disablePadding>
                {activityFeed.map((entry) => (
                  <ListItem key={entry.id} disableGutters sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <ListItemText primary={entry.title} secondary={entry.meta} primaryTypographyProps={{ fontWeight: 600 }} />
                    <Chip label={String(entry.status).replace(/_/g, ' ')} size="small" />
                  </ListItem>
                ))}
              </List>
            </Stack>
          </SurfacePanel>
        </Grid>
        <Grid item xs={12} lg={5}>
          <SurfacePanel>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">Operational Health</Typography>
                <Typography variant="body2" color="text.secondary">
                  Confidence indicators keep the workspace honest. Raise visibility on stale telemetry, reroutes, and capacity stress.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={String(resourceHealth.driverCapacity) + '% driver coverage'} color="success" variant="outlined" />
                <Chip label={String(resourceHealth.fleetCapacity) + '% fleet ready'} color="info" variant="outlined" />
                <Chip label={String(stats.atRisk) + ' items need review'} color={stats.atRisk ? 'warning' : 'success'} variant="outlined" />
              </Stack>
              <SurfacePanel sx={{ bgcolor: 'rgba(255, 248, 242, 1)' }}>
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: stats.atRisk ? 'warning.main' : 'success.main', mt: 0.5, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle1">{optimizerHealth?.message || 'Optimizer healthy and ready for scenario runs.'}</Typography>
                    <Typography variant="body2" color="text.secondary">Status: {optimizerHealth?.status || 'unknown'}</Typography>
                  </Box>
                </Stack>
              </SurfacePanel>
            </Stack>
          </SurfacePanel>
        </Grid>
      </Grid>
    </Box>
  );
}
