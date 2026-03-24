import { useEffect, useState, useMemo } from 'react';
import {
  Grid,
  Typography,
  Box,
  Button,
  Stack,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  DirectionsCar,
  Person,
  LocalShipping,
  Route as RouteIcon,
  AddTask,
  Route,
  Insights,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import ModuleHeader from '../components/ui/ModuleHeader';
import AICommandBox from '../components/ui/AICommandBox';
import InfoCard from '../components/ui/InfoCard';
import MapPanel from '../components/map/MapPanel';
import DetailTray from '../components/ui/DetailTray';
import StatusPill from '../components/ui/StatusPill';
import { moduleAccents } from '../theme/tokens';
import { getDrivers, getVehicles, getJobs, getRoutes, getDispatchOptimizerHealth, OptimizerHealth } from '../services/api';

const ROUTE_COLORS = [
  '#3b82f6', '#14b8a6', '#f59e0b', '#84cc16', '#8b5cf6', '#4f46e5',
  '#0ea5e9', '#22c55e', '#f97316', '#06b6d4', '#6366f1', '#0284c7',
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

export default function Dashboard() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [optimizerHealth, setOptimizerHealth] = useState<OptimizerHealth | null>(null);

  const loadData = async () => {
    try {
      const [driversData, vehiclesData, jobsData, routesData] = await Promise.all([
        getDrivers(),
        getVehicles(),
        getJobs(),
        getRoutes(),
      ]);
      const healthData = await getDispatchOptimizerHealth();

      setDrivers(Array.isArray(driversData) ? driversData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setRoutes(Array.isArray(routesData) ? routesData : []);
      setOptimizerHealth(healthData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Ensure state is always arrays even on error
      setDrivers([]);
      setVehicles([]);
      setJobs([]);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    // Ensure all inputs are arrays to prevent crashes
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const safeDrivers = Array.isArray(drivers) ? drivers : [];
    const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
    const safeRoutes = Array.isArray(routes) ? routes : [];

    const activeJobs = safeJobs.filter((j: any) =>
      j.status === 'pending' || j.status === 'in_progress'
    ).length;

    const activeDrivers = safeDrivers.filter((d: any) =>
      d.status === 'ACTIVE' || d.status === 'active'
    ).length;

    const availableVehicles = safeVehicles.filter((v: any) =>
      v.status === 'available' || v.status === 'AVAILABLE'
    ).length;

    const totalDrivers = safeDrivers.length;
    const totalVehicles = safeVehicles.length;
    const totalJobs = safeJobs.length;
    const totalRoutes = safeRoutes.length;
    const activeDriverPct = totalDrivers > 0 ? Math.round((activeDrivers / totalDrivers) * 100) : 0;
    const availableVehiclePct = totalVehicles > 0 ? Math.round((availableVehicles / totalVehicles) * 100) : 0;
    const activeJobsPct = totalJobs > 0 ? Math.round((activeJobs / totalJobs) * 100) : 0;

    return [
      {
        title: 'Active Drivers',
        value: activeDrivers,
        total: totalDrivers,
        subtitle: 'Drivers on live assignments',
        statusLabel: `${activeDriverPct}%`,
        statusColor: moduleAccents.drivers,
        icon: Person,
      },
      {
        title: 'Available Vehicles',
        value: availableVehicles,
        total: totalVehicles,
        subtitle: 'Ready for dispatch',
        statusLabel: `${availableVehiclePct}%`,
        statusColor: moduleAccents.vehicles,
        icon: DirectionsCar,
      },
      {
        title: 'Active Jobs',
        value: activeJobs,
        total: totalJobs,
        subtitle: 'Pending + in progress',
        statusLabel: `${activeJobsPct}%`,
        statusColor: moduleAccents.jobs,
        icon: LocalShipping,
      },
      {
        title: 'Routes Today',
        value: totalRoutes,
        subtitle: 'Active route plans',
        statusLabel: 'Live',
        statusColor: moduleAccents.dispatch,
        icon: RouteIcon,
      },
    ];
  }, [drivers, vehicles, jobs, routes]);

  // Prepare map data with vehicle assignments
  const mapRoutes = useMemo(() => {
    // Ensure routes and vehicles are arrays to prevent crashes
    const safeRoutes = Array.isArray(routes) ? routes : [];
    const safeVehicles = Array.isArray(vehicles) ? vehicles : [];

    return safeRoutes.map((route: any, index: number) => {
      const assignedVehicle = safeVehicles.find((v: any) => v.id === route.vehicleId);

      const stops = route.optimizedStops || route.routeData?.route || [];
      const positions = Array.isArray(stops) && stops.length > 0
        ? stops.map((stop: any, i: number) => ({
            lat: 39.0997 + (i * 0.012) + (((index * 7 + i * 3) % 9) - 4) * 0.004,
            lng: -94.5786 + (i * 0.01) + (((index * 5 + i * 2) % 7) - 3) * 0.004,
          }))
        : [];

      return {
        id: route.id,
        positions: positions,
        color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        status: route.status || 'pending',
        vehicle: assignedVehicle?.name || `${assignedVehicle?.make || ''} ${assignedVehicle?.model || ''}`.trim() || 'Unassigned',
        vehiclePlate: assignedVehicle?.licensePlate || 'N/A',
        totalDistance: route.totalDistance || 0,
        stopCount: positions.length,
        dataQuality: route.dataQuality || 'live',
        rerouteState: route.rerouteState || null,
        plannerDiagnostics: route.plannerDiagnostics || route.routeData?.planner_diagnostics || {},
      };
    });
  }, [routes, vehicles]);
  const usingSimulatedRoutes = mapRoutes.some((route: any) => route.dataQuality === 'simulated');
  const usingDegradedRoutes = mapRoutes.some((route: any) => route.dataQuality === 'degraded');
  const pendingReroutes = mapRoutes.filter((route: any) => route.rerouteState === 'requested' || route.rerouteState === 'approved').length;
  const routesWithDiagnostics = mapRoutes.filter(
    (route: any) =>
      Array.isArray(route?.plannerDiagnostics?.advancedConstraints?.reasonCodes) &&
      route.plannerDiagnostics.advancedConstraints.reasonCodes.length > 0,
  ).length;

  const mapCenter: [number, number] = useMemo(() => {
    if (mapRoutes.length > 0 && mapRoutes[0].positions.length > 0) {
      const firstRoute = mapRoutes[0].positions[0];
      return [firstRoute.lat, firstRoute.lng];
    }
    return [39.0997, -94.5786]; // Kansas City default
  }, [mapRoutes]);

  const mapZoom = useMemo(() => {
    return mapRoutes.length > 0 ? 12 : 5;
  }, [mapRoutes]);

  // Recent jobs for table
  const recentJobs = useMemo(() => {
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    return safeJobs.slice(0, 6);
  }, [jobs]);

  const quickActions = [
    { label: 'Create Job', icon: <AddTask fontSize="small" /> },
    { label: 'Plan Routes', icon: <Route fontSize="small" /> },
    { label: 'View Insights', icon: <Insights fontSize="small" /> },
  ];

  const getPriorityColor = (priority: string) => {
    if (priority === 'urgent') return '#dc2626';
    if (priority === 'high') return '#d97706';
    return '#64748b';
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return '#059669';
    if (status === 'in_progress') return '#2563eb';
    return '#b45309';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <motion.div variants={container} initial="hidden" animate="show">
        <Grid container spacing={2.25} sx={{ mb: 2.25 }}>
          <Grid item xs={12} lg={7}>
            <motion.div variants={item}>
              <ModuleHeader
                title="Command Center"
                subtitle={`Map-first view of fleet movement, route health, and active delivery demand. Optimizer: ${optimizerHealth?.status || 'unknown'}.`}
                onRefresh={handleRefreshAll}
                isRefreshing={isRefreshing}
              />
            </motion.div>
          </Grid>
          <Grid item xs={12} lg={5}>
            <motion.div variants={item}>
              <AICommandBox />
            </motion.div>
          </Grid>
        </Grid>

        <Grid container spacing={2.25} sx={{ mb: 2.25 }}>
          <Grid item xs={12}>
            <motion.div variants={item}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.25 }}>
                  Quick Actions
                </Typography>
                <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                  {quickActions.map((action) => (
                    <Button key={action.label} variant="outlined" startIcon={action.icon} size="small" sx={{ borderRadius: 2 }}>
                      {action.label}
                    </Button>
                  ))}
                  <StatusPill
                    label={`Optimizer ${optimizerHealth?.status || 'unknown'}`}
                    color={optimizerHealth?.status === 'healthy' ? '#059669' : optimizerHealth?.status === 'degraded' ? '#d97706' : '#dc2626'}
                  />
                  {usingSimulatedRoutes ? <StatusPill label="Simulated routes" color="#64748b" /> : null}
                  {!usingSimulatedRoutes && usingDegradedRoutes ? <StatusPill label="Degraded routes" color="#d97706" /> : null}
                  {pendingReroutes > 0 ? <StatusPill label={`${pendingReroutes} reroute pending`} color="#f97316" /> : null}
                  {routesWithDiagnostics > 0 ? <StatusPill label={`${routesWithDiagnostics} routes with diagnostics`} color="#0ea5e9" /> : null}
                </Stack>
              </Box>
            </motion.div>
          </Grid>
        </Grid>

        <Grid container spacing={2.25} sx={{ mb: 2.25 }}>
          {stats.map((stat) => {
            const IconComponent = stat.icon;
            return (
              <Grid item xs={12} sm={6} lg={3} key={stat.title}>
                <motion.div variants={item}>
                  <InfoCard
                    title={stat.title}
                    value={stat.value}
                    total={stat.total}
                    subtitle={stat.subtitle}
                    statusLabel={stat.statusLabel}
                    statusColor={stat.statusColor}
                    icon={<IconComponent fontSize="small" />}
                  />
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      </motion.div>

      <Grid container spacing={2.25}>
        <Grid item xs={12} lg={8}>
          <motion.div variants={item} initial="hidden" animate="show">
            <MapPanel mapCenter={mapCenter} mapZoom={mapZoom} mapRoutes={mapRoutes} />
          </motion.div>
        </Grid>

        <Grid item xs={12} lg={4}>
          <motion.div variants={item} initial="hidden" animate="show">
            <DetailTray title="Route Summary" subtitle="Vehicle assignments and route health" height={620}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {mapRoutes.length > 0 ? (
                  mapRoutes.map((route: any, index: number) => (
                    <Card
                      key={route.id}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 3,
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
                          <StatusPill label={`R${index + 1}`} color={route.color} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {route.vehicle}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {route.vehiclePlate}
                            </Typography>
                          </Box>
                          <StatusPill label={route.status} color={getStatusColor(route.status)} />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {route.stopCount} stops • {route.totalDistance} km
                        </Typography>
                        {route.rerouteState ? (
                          <Box sx={{ mt: 1 }}>
                            <StatusPill label={`reroute ${route.rerouteState}`} color="#f97316" />
                          </Box>
                        ) : null}
                        {Array.isArray(route?.plannerDiagnostics?.advancedConstraints?.reasonCodes) &&
                        route.plannerDiagnostics.advancedConstraints.reasonCodes.length > 0 ? (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                            diagnostics: {route.plannerDiagnostics.advancedConstraints.reasonCodes.slice(0, 2).join(', ')}
                          </Typography>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <RouteIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No active routes
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Routes will appear here when created
                    </Typography>
                  </Box>
                )}
              </Box>
            </DetailTray>
          </motion.div>
        </Grid>

        <Grid item xs={12}>
          <motion.div variants={item} initial="hidden" animate="show">
            <DetailTray title="Recent Jobs" subtitle="Latest delivery and pickup activity">
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Pickup</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Delivery</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentJobs.length > 0 ? (
                      recentJobs.map((job: any) => (
                        <TableRow
                          key={job.id}
                          sx={{
                            '&:hover': {
                              bgcolor: 'action.hover',
                              cursor: 'pointer',
                            },
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {job.customerName}
                            </Typography>
                          </TableCell>
                          <TableCell>{job.pickupAddress || 'Use Last Stop'}</TableCell>
                          <TableCell>{job.deliveryAddress}</TableCell>
                          <TableCell>
                            <StatusPill label={job.priority || 'normal'} color={getPriorityColor(job.priority)} />
                          </TableCell>
                          <TableCell>
                            <StatusPill label={job.status || 'pending'} color={getStatusColor(job.status)} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                          <LocalShipping sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                          <Typography color="text.secondary">No recent jobs</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </DetailTray>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
}
