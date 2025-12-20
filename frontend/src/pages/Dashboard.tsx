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
} from '@mui/material';
import {
  DirectionsCar,
  Person,
  LocalShipping,
  Route as RouteIcon,
  Refresh,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import { useDrivers, useVehicles, useJobs, useRoutes } from '../graphql/hooks';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

    return [
      {
        title: 'Active Drivers',
        value: activeDrivers,
        total: driversData?.drivers?.length || 0,
        color: '#1976d2',
        icon: Person,
        trend: '+12%',
        trendUp: true,
      },
      {
        title: 'Available Vehicles',
        value: availableVehicles,
        total: vehiclesData?.vehicles?.length || 0,
        color: '#2e7d32',
        icon: DirectionsCar,
        trend: '+5%',
        trendUp: true,
      },
      {
        title: 'Active Jobs',
        value: activeJobs,
        total: jobsData?.jobs?.length || 0,
        color: '#ed6c02',
        icon: LocalShipping,
        trend: '-3%',
        trendUp: false,
      },
      {
        title: 'Routes Today',
        value: routesData?.routes?.length || 0,
        total: routesData?.routes?.length || 0,
        color: '#9c27b0',
        icon: RouteIcon,
        trend: '+8%',
        trendUp: true,
      },
    ];
  }, [driversData, vehiclesData, jobsData, routesData]);

  // Prepare data for charts
  const activityData = useMemo(() => {
    return [
      { time: '00:00', jobs: 5, routes: 2 },
      { time: '04:00', jobs: 8, routes: 4 },
      { time: '08:00', jobs: 25, routes: 12 },
      { time: '12:00', jobs: 35, routes: 18 },
      { time: '16:00', jobs: 28, routes: 15 },
      { time: '20:00', jobs: 15, routes: 8 },
    ];
  }, []);

  const vehicleTypeData = useMemo(() => {
    const vehicles = vehiclesData?.vehicles || [];
    const typeCounts = vehicles.reduce((acc: any, v: any) => {
      acc[v.vehicleType] = (acc[v.vehicleType] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(typeCounts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [vehiclesData]);

  // Prepare map data
  const mapRoutes = useMemo(() => {
    return (routesData?.routes || []).slice(0, 5).map((route: any) => ({
      id: route.id,
      positions: route.waypoints || [],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      status: route.status,
    }));
  }, [routesData]);

  const mapCenter: [number, number] = useMemo(() => {
    if (mapRoutes.length > 0 && mapRoutes[0].positions.length > 0) {
      const firstRoute = mapRoutes[0].positions[0];
      return [firstRoute.lat || firstRoute.latitude || 43.7311,
              firstRoute.lng || firstRoute.longitude || 7.4174];
    }
    return [43.7311, 7.4174]; // Monaco default
  }, [mapRoutes]);

  // Recent jobs for table
  const recentJobs = useMemo(() => {
    return (jobsData?.jobs || []).slice(0, 5);
  }, [jobsData]);

  const isLoading = driversLoading || vehiclesLoading || jobsLoading || routesLoading;

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Dashboard
        </Typography>
        <IconButton
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          sx={{
            transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)',
            transition: 'transform 0.5s',
          }}
        >
          <Refresh />
        </IconButton>
      </Box>

      {/* Stats Cards */}
      <motion.div variants={container} initial="hidden" animate="show">
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {stats.map((stat) => {
            const IconComponent = stat.icon;
            return (
              <Grid item xs={12} sm={6} md={3} key={stat.title}>
                <motion.div variants={item}>
                  <Card
                    sx={{
                      height: '100%',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      },
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box
                          sx={{
                            bgcolor: `${stat.color}15`,
                            borderRadius: 2,
                            p: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconComponent sx={{ color: stat.color, fontSize: 24 }} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {stat.trendUp ? (
                            <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                          ) : (
                            <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                          )}
                          <Typography
                            variant="caption"
                            sx={{ color: stat.trendUp ? 'success.main' : 'error.main' }}
                          >
                            {stat.trend}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography color="textSecondary" variant="body2" gutterBottom>
                        {stat.title}
                      </Typography>
                      <Typography variant="h4" fontWeight={700} sx={{ color: stat.color }}>
                        {isLoading ? '...' : stat.value}
                        <Typography component="span" variant="body1" color="textSecondary" sx={{ ml: 1 }}>
                          / {stat.total}
                        </Typography>
                      </Typography>
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
        {/* Map View - Left Column */}
        <Grid item xs={12} lg={8}>
          <motion.div variants={item} initial="hidden" animate="show">
            <Paper sx={{ p: 2, height: 500 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Active Routes Map
              </Typography>
              <Box sx={{ height: 430, borderRadius: 1, overflow: 'hidden' }}>
                <MapContainer
                  center={mapCenter}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
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
                        <Polyline
                          positions={positions}
                          color={route.color}
                          weight={3}
                          opacity={0.7}
                        />
                        {positions.map((pos: any, idx: number) => (
                          <Marker key={idx} position={pos}>
                            <Popup>
                              <div>
                                <strong>Route {route.id.slice(0, 8)}</strong>
                                <br />
                                Waypoint {idx + 1}
                                <br />
                                Status: <Chip label={route.status} size="small" />
                              </div>
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

        {/* Charts - Right Column */}
        <Grid item xs={12} lg={4}>
          <Grid container spacing={3}>
            {/* Vehicle Distribution Pie Chart */}
            <Grid item xs={12}>
              <motion.div variants={item} initial="hidden" animate="show">
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Fleet Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={vehicleTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {vehicleTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
              </motion.div>
            </Grid>

            {/* Activity Chart */}
            <Grid item xs={12}>
              <motion.div variants={item} initial="hidden" animate="show">
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    Today's Activity
                  </Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="jobs"
                        stackId="1"
                        stroke="#ed6c02"
                        fill="#ed6c02"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="routes"
                        stackId="1"
                        stroke="#9c27b0"
                        fill="#9c27b0"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>
              </motion.div>
            </Grid>
          </Grid>
        </Grid>

        {/* Recent Jobs Table */}
        <Grid item xs={12}>
          <motion.div variants={item} initial="hidden" animate="show">
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Recent Jobs
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Job ID</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Pickup Time</TableCell>
                      <TableCell>Delivery Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentJobs.length > 0 ? (
                      recentJobs.map((job: any) => (
                        <TableRow
                          key={job.id}
                          sx={{
                            '&:hover': { bgcolor: 'action.hover' },
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <TableCell>{job.id.slice(0, 8)}...</TableCell>
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
                                  : 'default'
                              }
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
                        <TableCell colSpan={5} align="center">
                          <Typography color="textSecondary">No recent jobs</Typography>
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
