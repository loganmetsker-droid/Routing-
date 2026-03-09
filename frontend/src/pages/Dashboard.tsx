import { useEffect, useState, useMemo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Avatar,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  DirectionsCar,
  Person,
  LocalShipping,
  Route as RouteIcon,
  Refresh,
  TrendingUp,
  CheckCircle,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import { motion } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_BASE_URL = (import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '').replace(/\/api$/, '');

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Distinct colors for routes
const ROUTE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#95E1D3',
  '#F38181', '#7FDBFF', '#B4A7D6', '#FFD93D', '#6BCF7F', '#FF9F1C',
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

  const loadData = async () => {
    try {
      const [driversRes, vehiclesRes, jobsRes, routesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/drivers`),
        fetch(`${API_BASE_URL}/api/vehicles`),
        fetch(`${API_BASE_URL}/api/jobs`),
        fetch(`${API_BASE_URL}/api/dispatch/routes`),
      ]);

      // Parse JSON with error handling for each response
      const driversData = driversRes.ok ? await driversRes.json() : { drivers: [] };
      const vehiclesData = vehiclesRes.ok ? await vehiclesRes.json() : { vehicles: [] };
      const jobsData = jobsRes.ok ? await jobsRes.json() : { jobs: [] };
      const routesData = routesRes.ok ? await routesRes.json() : { routes: [] };

      // Normalize responses - handle both array and wrapped object formats
      setDrivers(Array.isArray(driversData) ? driversData : (driversData?.drivers || []));
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.vehicles || []));
      setJobs(Array.isArray(jobsData) ? jobsData : (jobsData?.jobs || []));
      setRoutes(Array.isArray(routesData) ? routesData : (routesData?.routes || []));
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

    return [
      {
        title: 'Active Drivers',
        value: activeDrivers,
        total: totalDrivers,
        percentage: totalDrivers > 0 ? Math.round((activeDrivers / totalDrivers) * 100) : 0,
        gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        glowColor: 'rgba(99, 102, 241, 0.4)',
        icon: Person,
        trend: '+12%',
        trendUp: true,
      },
      {
        title: 'Available Vehicles',
        value: availableVehicles,
        total: totalVehicles,
        percentage: totalVehicles > 0 ? Math.round((availableVehicles / totalVehicles) * 100) : 0,
        gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #ef4444 100%)',
        glowColor: 'rgba(236, 72, 153, 0.4)',
        icon: DirectionsCar,
        trend: '+5%',
        trendUp: true,
      },
      {
        title: 'Active Jobs',
        value: activeJobs,
        total: totalJobs,
        percentage: totalJobs > 0 ? Math.round((activeJobs / totalJobs) * 100) : 0,
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #10b981 100%)',
        glowColor: 'rgba(59, 130, 246, 0.4)',
        icon: LocalShipping,
        trend: '+18%',
        trendUp: true,
      },
      {
        title: 'Routes Today',
        value: totalRoutes,
        total: totalRoutes,
        percentage: 100,
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 50%, #f97316 100%)',
        glowColor: 'rgba(245, 158, 11, 0.4)',
        icon: RouteIcon,
        trend: '+8%',
        trendUp: true,
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

      // Simple mock positions for routes without coordinates
      const positions = route.stops && Array.isArray(route.stops) && route.stops.length > 0
        ? route.stops.map(() => ({
            lat: 39.0997 + (Math.random() - 0.5) * 0.1,
            lng: -94.5786 + (Math.random() - 0.5) * 0.1,
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
      };
    });
  }, [routes, vehicles]);

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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Welcome back! Here's what's happening today.
          </Typography>
        </Box>
        <IconButton
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': { bgcolor: 'primary.dark' },
            transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)',
            transition: 'transform 0.5s',
          }}
        >
          <Refresh />
        </IconButton>
      </Box>

      {/* Stats Cards */}
      <motion.div variants={container} initial="hidden" animate="show">
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {stats.map((stat) => {
            const IconComponent = stat.icon;
            return (
              <Grid item xs={12} sm={6} lg={3} key={stat.title}>
                <motion.div variants={item}>
                  <Card
                    sx={{
                      background: stat.gradient,
                      color: 'white',
                      height: '100%',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'translateY(-12px) scale(1.02)',
                        boxShadow: `0 20px 40px -10px ${stat.glowColor}, 0 0 20px ${stat.glowColor}`,
                      },
                      '&:active': {
                        transform: 'translateY(-8px) scale(1.01)',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '140px',
                        height: '140px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)',
                        transform: 'translate(30%, -30%)',
                      },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: -60,
                        left: -60,
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)',
                      },
                    }}
                  >
                    <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.2)',
                            borderRadius: 2,
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconComponent sx={{ fontSize: 32 }} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TrendingUp sx={{ fontSize: 20 }} />
                          <Typography variant="body2" fontWeight={600}>
                            {stat.trend}
                          </Typography>
                        </Box>
                      </Box>

                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        {stat.title}
                      </Typography>

                      <Typography variant="h3" fontWeight={700} sx={{ mb: 1 }}>
                        {stat.value}
                        {stat.total !== stat.value && (
                          <Typography component="span" variant="h6" sx={{ opacity: 0.7, ml: 1 }}>
                            / {stat.total}
                          </Typography>
                        )}
                      </Typography>

                      <LinearProgress
                        variant="determinate"
                        value={stat.percentage}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'rgba(255,255,255,0.2)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: 'white',
                            borderRadius: 3,
                          },
                        }}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      </motion.div>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Map View */}
        <Grid item xs={12} lg={8}>
          <motion.div variants={item} initial="hidden" animate="show">
            <Paper sx={{ p: 3, height: 600, borderRadius: 3, boxShadow: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Active Routes Map
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {mapRoutes.length} route{mapRoutes.length !== 1 ? 's' : ''} currently active
                  </Typography>
                </Box>
                <Chip icon={<CheckCircle />} label="Live" color="success" size="small" />
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Route Legend */}
              <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {mapRoutes.slice(0, 6).map((route: any) => (
                  <Chip
                    key={route.id}
                    label={`${route.vehicle} (${route.vehiclePlate})`}
                    size="small"
                    sx={{
                      bgcolor: route.color,
                      color: 'white',
                      fontWeight: 600,
                      '& .MuiChip-label': { px: 1.5 },
                    }}
                  />
                ))}
                {mapRoutes.length > 6 && (
                  <Chip label={`+${mapRoutes.length - 6} more`} size="small" variant="outlined" />
                )}
              </Box>

              {/* Map */}
              <Box
                sx={{
                  height: 440,
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {mapRoutes.map((route: any) => {
                    if (!route.positions || route.positions.length === 0) return null;

                    const positions = route.positions.map((pos: any) => [pos.lat, pos.lng]);

                    return (
                      <div key={route.id}>
                        <Polyline
                          positions={positions}
                          pathOptions={{ color: route.color, weight: 5, opacity: 0.8 }}
                        >
                          <LeafletTooltip sticky>
                            <div style={{ textAlign: 'center' }}>
                              <strong>{route.vehicle}</strong><br />
                              {route.vehiclePlate}<br />
                              {route.stopCount} stops • {route.totalDistance}km
                            </div>
                          </LeafletTooltip>
                        </Polyline>

                        {positions.map((pos: any, idx: number) => (
                          <Marker key={`${route.id}-${idx}`} position={pos}>
                            <Popup>
                              <Box sx={{ minWidth: 200 }}>
                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                  Stop {idx + 1} of {route.stopCount}
                                </Typography>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="body2">
                                  <strong>Vehicle:</strong> {route.vehicle}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Plate:</strong> {route.vehiclePlate}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Status:</strong>{' '}
                                  <Chip
                                    label={route.status}
                                    size="small"
                                    color={route.status === 'completed' ? 'success' : 'primary'}
                                  />
                                </Typography>
                              </Box>
                            </Popup>
                          </Marker>
                        ))}
                      </div>
                    );
                  })}
                </MapContainer>
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        {/* Route Summary */}
        <Grid item xs={12} lg={4}>
          <motion.div variants={item} initial="hidden" animate="show">
            <Paper sx={{ p: 3, height: 600, borderRadius: 3, boxShadow: 3, overflow: 'auto' }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Route Summary
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Vehicle assignments and details
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {mapRoutes.length > 0 ? (
                  mapRoutes.map((route: any, index: number) => (
                    <Card
                      key={route.id}
                      sx={{
                        border: '2px solid',
                        borderColor: route.color,
                        borderRadius: 2,
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow: 3,
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                          <Avatar
                            sx={{
                              bgcolor: route.color,
                              width: 40,
                              height: 40,
                              fontWeight: 700,
                            }}
                          >
                            {index + 1}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {route.vehicle}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {route.vehiclePlate}
                            </Typography>
                          </Box>
                          <Chip
                            label={route.status}
                            size="small"
                            color={route.status === 'completed' ? 'success' : 'primary'}
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>

                        <Divider sx={{ my: 1.5 }} />

                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Stops
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {route.stopCount}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Distance
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {route.totalDistance} km
                            </Typography>
                          </Grid>
                        </Grid>
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
            </Paper>
          </motion.div>
        </Grid>

        {/* Recent Jobs Table */}
        <Grid item xs={12}>
          <motion.div variants={item} initial="hidden" animate="show">
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Recent Jobs
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Latest delivery and pickup jobs
              </Typography>

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
                            <Chip
                              label={job.priority}
                              size="small"
                              color={
                                job.priority === 'urgent'
                                  ? 'error'
                                  : job.priority === 'high'
                                  ? 'warning'
                                  : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={job.status}
                              size="small"
                              color={
                                job.status === 'completed'
                                  ? 'success'
                                  : job.status === 'in_progress'
                                  ? 'primary'
                                  : 'warning'
                              }
                              sx={{ fontWeight: 600 }}
                            />
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
            </Paper>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
}
