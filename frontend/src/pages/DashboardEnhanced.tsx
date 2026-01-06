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
} from '@mui/material';
import {
  DirectionsCar,
  Person,
  LocalShipping,
  Route as RouteIcon,
  Refresh,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from '@mui/icons-material';
import { useDrivers, useVehicles, useJobs, useRoutes } from '../graphql/hooks';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Distinct colors for routes - more vibrant and distinguishable
const ROUTE_COLORS = [
  '#FF6B6B', // Coral Red
  '#4ECDC4', // Turquoise
  '#FFE66D', // Yellow
  '#A8E6CF', // Mint Green
  '#FF8B94', // Pink
  '#95E1D3', // Aqua
  '#F38181', // Salmon
  '#7FDBFF', // Sky Blue
  '#B4A7D6', // Lavender
  '#FFD93D', // Golden Yellow
  '#6BCF7F', // Green
  '#FF9F1C', // Orange
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

export default function Dashboard() {
  const { data: driversData, loading: driversLoading, refetch: refetchDrivers } = useDrivers();
  const { data: vehiclesData, loading: vehiclesLoading, refetch: refetchVehicles } = useVehicles();
  const { data: jobsData, loading: jobsLoading, refetch: refetchJobs } = useJobs();
  const { data: routesData, loading: routesLoading, refetch: refetchRoutes } = useRoutes();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchDrivers(),
      refetchVehicles(),
      refetchJobs(),
      refetchRoutes(),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const activeJobs = jobsData?.jobs?.filter((j: any) =>
      j.status === 'PENDING' || j.status === 'IN_PROGRESS'
    ).length || 0;

    const activeDrivers = driversData?.drivers?.filter((d: any) =>
      d.status === 'ACTIVE'
    ).length || 0;

    const availableVehicles = vehiclesData?.vehicles?.filter((v: any) =>
      v.status === 'AVAILABLE'
    ).length || 0;

    const totalDrivers = driversData?.drivers?.length || 0;
    const totalVehicles = vehiclesData?.vehicles?.length || 0;
    const totalJobs = jobsData?.jobs?.length || 0;
    const totalRoutes = routesData?.routes?.length || 0;

    return [
      {
        title: 'Active Drivers',
        value: activeDrivers,
        total: totalDrivers,
        percentage: totalDrivers > 0 ? Math.round((activeDrivers / totalDrivers) * 100) : 0,
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        icon: Person,
        trend: '+12%',
        trendUp: true,
      },
      {
        title: 'Available Vehicles',
        value: availableVehicles,
        total: totalVehicles,
        percentage: totalVehicles > 0 ? Math.round((availableVehicles / totalVehicles) * 100) : 0,
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        icon: DirectionsCar,
        trend: '+5%',
        trendUp: true,
      },
      {
        title: 'Active Jobs',
        value: activeJobs,
        total: totalJobs,
        percentage: totalJobs > 0 ? Math.round((activeJobs / totalJobs) * 100) : 0,
        gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        icon: LocalShipping,
        trend: '+18%',
        trendUp: true,
      },
      {
        title: 'Routes Today',
        value: totalRoutes,
        total: totalRoutes,
        percentage: 100,
        gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        icon: RouteIcon,
        trend: '+8%',
        trendUp: true,
      },
    ];
  }, [driversData, vehiclesData, jobsData, routesData]);

  // Prepare map data with vehicle assignments
  const mapRoutes = useMemo(() => {
    const routes = routesData?.routes || [];
    const vehicles = vehiclesData?.vehicles || [];

    return routes.map((route: any, index: number) => {
      // Find assigned vehicle
      const assignedVehicle = vehicles.find((v: any) => v.id === route.vehicleId);

      return {
        id: route.id,
        positions: route.waypoints || [],
        color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        status: route.status,
        vehicle: assignedVehicle ? `${assignedVehicle.make} ${assignedVehicle.model}` : 'Unassigned',
        vehiclePlate: assignedVehicle?.licensePlate || 'N/A',
        totalDistance: route.totalDistance || 0,
        stopCount: (route.waypoints || []).length,
      };
    });
  }, [routesData, vehiclesData]);

  const mapCenter: [number, number] = useMemo(() => {
    if (mapRoutes.length > 0 && mapRoutes[0].positions.length > 0) {
      const firstRoute = mapRoutes[0].positions[0];
      return [
        firstRoute.lat || firstRoute.latitude || 37.7749,
        firstRoute.lng || firstRoute.longitude || -122.4194
      ];
    }
    return [37.7749, -122.4194]; // San Francisco default
  }, [mapRoutes]);

  // Recent jobs for table
  const recentJobs = useMemo(() => {
    return (jobsData?.jobs || []).slice(0, 6);
  }, [jobsData]);

  const isLoading = driversLoading || vehiclesLoading || jobsLoading || routesLoading;

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
                      transition: 'transform 0.3s, box-shadow 0.3s',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: 6,
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)',
                        transform: 'translate(30%, -30%)',
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
                          {stat.trendUp ? (
                            <TrendingUp sx={{ fontSize: 20 }} />
                          ) : (
                            <TrendingDown sx={{ fontSize: 20 }} />
                          )}
                          <Typography variant="body2" fontWeight={600}>
                            {stat.trend}
                          </Typography>
                        </Box>
                      </Box>

                      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                        {stat.title}
                      </Typography>

                      <Typography variant="h3" fontWeight={700} sx={{ mb: 1 }}>
                        {isLoading ? '...' : stat.value}
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
        {/* Map View - Takes full width on mobile, 8 columns on desktop */}
        <Grid item xs={12} lg={8}>
          <motion.div variants={item} initial="hidden" animate="show">
            <Paper
              sx={{
                p: 3,
                height: 600,
                borderRadius: 3,
                boxShadow: 3,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Active Routes Map
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {mapRoutes.length} route{mapRoutes.length !== 1 ? 's' : ''} currently active
                  </Typography>
                </Box>
                <Chip
                  icon={<CheckCircle />}
                  label="Live"
                  color="success"
                  size="small"
                />
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Route Legend */}
              <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {mapRoutes.slice(0, 6).map((route: any, index: number) => (
                  <Chip
                    key={route.id}
                    label={`${route.vehicle} (${route.vehiclePlate})`}
                    size="small"
                    sx={{
                      bgcolor: route.color,
                      color: 'white',
                      fontWeight: 600,
                      '& .MuiChip-label': {
                        px: 1.5,
                      },
                    }}
                  />
                ))}
                {mapRoutes.length > 6 && (
                  <Chip
                    label={`+${mapRoutes.length - 6} more`}
                    size="small"
                    variant="outlined"
                  />
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
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {mapRoutes.map((route: any) => {
                    if (!route.positions || route.positions.length === 0) return null;

                    const positions = route.positions.map((pos: any) => [
                      pos.lat || pos.latitude,
                      pos.lng || pos.longitude,
                    ]);

                    return (
                      <div key={route.id}>
                        {/* Route Polyline */}
                        <Polyline
                          positions={positions}
                          pathOptions={{
                            color: route.color,
                            weight: 5,
                            opacity: 0.8,
                          }}
                        >
                          <LeafletTooltip sticky>
                            <div style={{ textAlign: 'center' }}>
                              <strong>{route.vehicle}</strong><br />
                              {route.vehiclePlate}<br />
                              {route.stopCount} stops • {route.totalDistance}km
                            </div>
                          </LeafletTooltip>
                        </Polyline>

                        {/* Waypoint Markers */}
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
                                    color={route.status === 'COMPLETED' ? 'success' : 'primary'}
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

        {/* Route Summary - Right Column */}
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
                            color={route.status === 'COMPLETED' ? 'success' : 'primary'}
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
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 8,
                    }}
                  >
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
                      <TableCell sx={{ fontWeight: 700 }}>Job ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Pickup Time</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Delivery Time</TableCell>
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
                              {job.id.slice(0, 8)}...
                            </Typography>
                          </TableCell>
                          <TableCell>{job.jobType || 'Standard'}</TableCell>
                          <TableCell>
                            <Chip
                              label={job.status}
                              size="small"
                              color={
                                job.status === 'COMPLETED'
                                  ? 'success'
                                  : job.status === 'IN_PROGRESS'
                                  ? 'primary'
                                  : job.status === 'PENDING'
                                  ? 'warning'
                                  : 'default'
                              }
                              sx={{ fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell>
                            {job.scheduledPickupTime
                              ? new Date(job.scheduledPickupTime).toLocaleString()
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {job.scheduledDeliveryTime
                              ? new Date(job.scheduledDeliveryTime).toLocaleString()
                              : 'N/A'}
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
