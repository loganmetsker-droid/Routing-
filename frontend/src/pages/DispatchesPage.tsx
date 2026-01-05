import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  LocalShipping,
  Person,
  Route as RouteIcon,
  Map,
  Schedule,
  PlayArrow,
  AutoAwesome,
  TrendingUp,
  Warning,
} from '@mui/icons-material';
import { useDrivers, useVehicles } from '../graphql/hooks';

// Simple geographic clustering algorithm
const optimizeRoutes = (jobs: any[], vehicles: any[]) => {
  const availableVehicles = vehicles.filter((v: any) => v.status === 'AVAILABLE');

  if (availableVehicles.length === 0 || jobs.length === 0) {
    return [];
  }

  // Group jobs by geographic region (simplified - in production use proper geocoding)
  const jobsByRegion: { [key: string]: any[] } = {};

  jobs.forEach(job => {
    // Simple region detection based on address keywords
    const address = job.deliveryAddress.toLowerCase();
    let region = 'central';

    if (address.includes('north') || address.includes('oakland') || address.includes('berkeley')) {
      region = 'north';
    } else if (address.includes('south') || address.includes('san jose') || address.includes('palo alto')) {
      region = 'south';
    } else if (address.includes('east')) {
      region = 'east';
    } else if (address.includes('west')) {
      region = 'west';
    }

    if (!jobsByRegion[region]) {
      jobsByRegion[region] = [];
    }
    jobsByRegion[region].push(job);
  });

  // Assign vehicles to regions
  const optimizedRoutes: any[] = [];
  const regions = Object.keys(jobsByRegion);

  regions.forEach((region, index) => {
    if (index < availableVehicles.length) {
      const vehicle = availableVehicles[index];
      const regionJobs = jobsByRegion[region];

      // Calculate total weight and check capacity
      const totalWeight = regionJobs.reduce((sum, job) => sum + (job.weight || 0), 0);
      const vehicleCapacity = vehicle.capacityWeightKg || 1000;

      // Estimate distance (simplified - in production use real routing API)
      const estimatedDistance = regionJobs.length * 8 + 5; // ~8km per stop + 5km base
      const estimatedDuration = regionJobs.length * 25 + 20; // ~25min per stop + 20min base

      optimizedRoutes.push({
        vehicleId: vehicle.id,
        vehicle: vehicle,
        region: region,
        jobs: regionJobs,
        totalWeight: totalWeight,
        capacity: vehicleCapacity,
        utilizationPercent: Math.round((totalWeight / vehicleCapacity) * 100),
        estimatedDistance: estimatedDistance,
        estimatedDuration: estimatedDuration,
        isOverCapacity: totalWeight > vehicleCapacity,
      });
    }
  });

  return optimizedRoutes;
};

export default function DispatchesPage() {
  const [tab, setTab] = useState(0);
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [selectedRouteForDriver, setSelectedRouteForDriver] = useState<any>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [routes, setRoutes] = useState<any[]>([]);
  const [optimizedRoutes, setOptimizedRoutes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: driversData, loading: driversLoading } = useDrivers();
  const { data: vehiclesData } = useVehicles();

  const drivers = driversData?.drivers || [];
  const vehicles = vehiclesData?.vehicles || [];

  // Mock jobs data with better geographic distribution
  useEffect(() => {
    setJobs([
      {
        id: 'job-1',
        customerName: 'Oakland Industries',
        pickupAddress: '123 Main St, Oakland, CA',
        deliveryAddress: '456 Broadway, Oakland, CA',
        status: 'pending',
        priority: 'high',
        timeWindowStart: '09:00',
        timeWindowEnd: '12:00',
        weight: 150,
        volume: 2.5,
      },
      {
        id: 'job-2',
        customerName: 'Berkeley Tech',
        pickupAddress: '789 Oak Ave, Berkeley, CA',
        deliveryAddress: '321 University Ave, Berkeley, CA',
        status: 'pending',
        priority: 'normal',
        timeWindowStart: '10:00',
        timeWindowEnd: '14:00',
        weight: 80,
        volume: 1.8,
      },
      {
        id: 'job-3',
        customerName: 'San Jose Manufacturing',
        pickupAddress: '555 First St, San Jose, CA',
        deliveryAddress: '888 Market St, San Jose, CA',
        status: 'pending',
        priority: 'urgent',
        timeWindowStart: '08:00',
        timeWindowEnd: '11:00',
        weight: 200,
        volume: 3.2,
      },
      {
        id: 'job-4',
        customerName: 'Palo Alto Systems',
        pickupAddress: '100 University Ave, Palo Alto, CA',
        deliveryAddress: '200 Hamilton Ave, Palo Alto, CA',
        status: 'pending',
        priority: 'normal',
        timeWindowStart: '13:00',
        timeWindowEnd: '16:00',
        weight: 120,
        volume: 2.0,
      },
      {
        id: 'job-5',
        customerName: 'North Bay Logistics',
        pickupAddress: '300 Shattuck Ave, Oakland, CA',
        deliveryAddress: '400 Telegraph Ave, Oakland, CA',
        status: 'pending',
        priority: 'high',
        timeWindowStart: '09:00',
        timeWindowEnd: '12:00',
        weight: 90,
        volume: 1.5,
      },
      {
        id: 'job-6',
        customerName: 'South Valley Transport',
        pickupAddress: '600 The Alameda, San Jose, CA',
        deliveryAddress: '700 Stevens Creek Blvd, San Jose, CA',
        status: 'pending',
        priority: 'normal',
        timeWindowStart: '14:00',
        timeWindowEnd: '17:00',
        weight: 110,
        volume: 2.2,
      },
    ]);
  }, []);

  const handleOptimizeRoutes = () => {
    setLoading(true);

    // Simulate optimization calculation
    setTimeout(() => {
      const pendingJobs = jobs.filter(j => j.status === 'pending');
      const optimized = optimizeRoutes(pendingJobs, vehicles);
      setOptimizedRoutes(optimized);
      setLoading(false);
      setOptimizeDialogOpen(true);
    }, 1500);
  };

  const handleApproveOptimization = () => {
    // Convert optimized routes to actual routes
    const newRoutes = optimizedRoutes.map(opt => ({
      id: `route-${Date.now()}-${Math.random()}`,
      vehicleId: opt.vehicleId,
      vehicle: opt.vehicle,
      driverId: null, // Will be assigned by user
      driver: null,
      region: opt.region,
      jobIds: opt.jobs.map((j: any) => j.id),
      jobs: opt.jobs,
      status: 'awaiting_driver',
      totalDistanceKm: opt.estimatedDistance,
      totalDurationMinutes: opt.estimatedDuration,
      jobCount: opt.jobs.length,
      totalWeight: opt.totalWeight,
      utilizationPercent: opt.utilizationPercent,
      createdAt: new Date().toISOString(),
    }));

    setRoutes([...routes, ...newRoutes]);

    // Update job statuses
    const assignedJobIds = optimizedRoutes.flatMap(opt => opt.jobs.map((j: any) => j.id));
    setJobs(jobs.map(job =>
      assignedJobIds.includes(job.id)
        ? { ...job, status: 'assigned' }
        : job
    ));

    setOptimizeDialogOpen(false);
    setOptimizedRoutes([]);
  };

  const handleOpenDriverAssignment = (route: any) => {
    setSelectedRouteForDriver(route);
    setSelectedDriverId('');
    setAssignDriverDialogOpen(true);
  };

  const handleAssignDriver = () => {
    if (!selectedDriverId || !selectedRouteForDriver) return;

    const driver = drivers.find((d: any) => d.id === selectedDriverId);

    setRoutes(routes.map(route =>
      route.id === selectedRouteForDriver.id
        ? { ...route, driverId: selectedDriverId, driver: driver, status: 'planned' }
        : route
    ));

    setAssignDriverDialogOpen(false);
    setSelectedRouteForDriver(null);
    setSelectedDriverId('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'success';
      case 'awaiting_driver': return 'warning';
      case 'in_progress': return 'info';
      case 'completed': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'normal': return 'info';
      default: return 'default';
    }
  };

  const getRegionColor = (region: string) => {
    switch (region) {
      case 'north': return '#667eea';
      case 'south': return '#f093fb';
      case 'east': return '#4facfe';
      case 'west': return '#fa709a';
      default: return '#888';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Smart Route Dispatch
        </Typography>
        <Button
          variant="contained"
          startIcon={<AutoAwesome />}
          onClick={handleOptimizeRoutes}
          disabled={jobs.filter(j => j.status === 'pending').length === 0 || loading}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          {loading ? 'Optimizing...' : 'Auto-Optimize Routes'}
        </Button>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" icon={<TrendingUp />} sx={{ mb: 3 }}>
        <strong>Smart Routing:</strong> The system automatically assigns vehicles to territories based on geographic optimization.
        No overlapping routes - maximizing efficiency! You assign drivers to optimized routes.
      </Alert>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <RouteIcon sx={{ color: 'white', mr: 1 }} />
                <Typography color="white" variant="h6">Active Routes</Typography>
              </Box>
              <Typography variant="h3" color="white" fontWeight={700}>
                {routes.filter(r => r.status === 'in_progress').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Schedule sx={{ color: 'white', mr: 1 }} />
                <Typography color="white" variant="h6">Pending Jobs</Typography>
              </Box>
              <Typography variant="h3" color="white" fontWeight={700}>
                {jobs.filter(j => j.status === 'pending').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocalShipping sx={{ color: 'white', mr: 1 }} />
                <Typography color="white" variant="h6">Available Vehicles</Typography>
              </Box>
              <Typography variant="h3" color="white" fontWeight={700}>
                {vehicles?.filter((v: any) => v.status === 'AVAILABLE').length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Person sx={{ color: 'white', mr: 1 }} />
                <Typography color="white" variant="h6">Available Drivers</Typography>
              </Box>
              <Typography variant="h3" color="white" fontWeight={700}>
                {drivers?.filter((d: any) => d.status === 'ACTIVE').length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Optimized Routes" sx={{ textTransform: 'none' }} />
          <Tab label="Pending Jobs" sx={{ textTransform: 'none' }} />
          <Tab label="Awaiting Drivers" sx={{ textTransform: 'none' }} />
        </Tabs>
      </Paper>

      {/* Optimized Routes Tab */}
      {tab === 0 && (
        <Grid container spacing={2}>
          {routes.filter(r => r.status === 'planned' || r.status === 'in_progress').length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">
                No active routes. Click "Auto-Optimize Routes" to create optimized delivery routes!
              </Alert>
            </Grid>
          ) : (
            routes.filter(r => r.status === 'planned' || r.status === 'in_progress').map((route) => (
              <Grid item xs={12} md={6} key={route.id}>
                <Card sx={{ borderLeft: 4, borderColor: getRegionColor(route.region) }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={600}>
                          {route.region.toUpperCase()} Territory
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Route #{route.id.slice(-6)}
                        </Typography>
                      </Box>
                      <Chip
                        label={route.status.replace('_', ' ')}
                        color={getStatusColor(route.status) as any}
                        size="small"
                      />
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <LocalShipping sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {route.vehicle?.make} {route.vehicle?.model}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Person sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {route.driver ? `${route.driver.firstName} ${route.driver.lastName}` : 'Not assigned'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Jobs: {route.jobCount}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Distance: ~{route.totalDistanceKm} km
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Capacity: {route.utilizationPercent}%
                        </Typography>
                      </Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Deliveries:
                    </Typography>
                    {route.jobs.slice(0, 3).map((job: any) => (
                      <Typography key={job.id} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        • {job.customerName}
                      </Typography>
                    ))}
                    {route.jobs.length > 3 && (
                      <Typography variant="caption" color="text.secondary">
                        + {route.jobs.length - 3} more
                      </Typography>
                    )}

                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      {route.status === 'planned' && (
                        <Button
                          size="small"
                          startIcon={<PlayArrow />}
                          variant="outlined"
                          sx={{ textTransform: 'none' }}
                        >
                          Start Route
                        </Button>
                      )}
                      <Button size="small" variant="text" sx={{ textTransform: 'none' }}>
                        View Details
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Pending Jobs Tab */}
      {tab === 1 && (
        <Paper>
          <List>
            {jobs.filter(j => j.status === 'pending').length === 0 ? (
              <ListItem>
                <ListItemText primary="No pending jobs" secondary="All jobs have been assigned to routes" />
              </ListItem>
            ) : (
              jobs.filter(j => j.status === 'pending').map((job) => (
                <ListItem key={job.id} divider>
                  <ListItemIcon>
                    <Map color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight={600}>{job.customerName}</Typography>
                        <Chip
                          label={job.priority}
                          color={getPriorityColor(job.priority) as any}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" component="div">
                          Pickup: {job.pickupAddress}
                        </Typography>
                        <Typography variant="body2" component="div">
                          Delivery: {job.deliveryAddress}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Window: {job.timeWindowStart} - {job.timeWindowEnd} | Weight: {job.weight}kg | Volume: {job.volume}m³
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Paper>
      )}

      {/* Awaiting Drivers Tab */}
      {tab === 2 && (
        <Grid container spacing={2}>
          {routes.filter(r => r.status === 'awaiting_driver').length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">
                No routes awaiting driver assignment.
              </Alert>
            </Grid>
          ) : (
            routes.filter(r => r.status === 'awaiting_driver').map((route) => (
              <Grid item xs={12} md={6} key={route.id}>
                <Card sx={{ borderLeft: 4, borderColor: 'warning.main' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={600}>
                          {route.region.toUpperCase()} Territory
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {route.jobCount} stops • ~{route.totalDistanceKm}km
                        </Typography>
                      </Box>
                      <Chip
                        label="Needs Driver"
                        color="warning"
                        size="small"
                        icon={<Warning />}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>Vehicle:</strong> {route.vehicle?.make} {route.vehicle?.model} ({route.vehicle?.licensePlate})
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Capacity Utilization:</strong> {route.utilizationPercent}%
                      </Typography>
                    </Box>

                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<Person />}
                      onClick={() => handleOpenDriverAssignment(route)}
                      sx={{ textTransform: 'none' }}
                    >
                      Assign Driver
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Optimization Dialog */}
      <Dialog
        open={optimizeDialogOpen}
        onClose={() => !loading && setOptimizeDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome color="primary" />
            Optimized Route Plan
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 3 }}>
            System has automatically optimized {optimizedRoutes.length} routes based on geographic territories.
            Review and approve to create these routes.
          </Alert>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Territory</strong></TableCell>
                  <TableCell><strong>Vehicle</strong></TableCell>
                  <TableCell><strong>Stops</strong></TableCell>
                  <TableCell><strong>Distance</strong></TableCell>
                  <TableCell><strong>Weight</strong></TableCell>
                  <TableCell><strong>Utilization</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {optimizedRoutes.map((route, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Chip
                        label={route.region.toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: getRegionColor(route.region),
                          color: 'white'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {route.vehicle.make} {route.vehicle.model}<br />
                      <Typography variant="caption" color="text.secondary">
                        {route.vehicle.licensePlate}
                      </Typography>
                    </TableCell>
                    <TableCell>{route.jobs.length}</TableCell>
                    <TableCell>~{route.estimatedDistance} km</TableCell>
                    <TableCell>
                      {route.totalWeight}kg / {route.capacity}kg
                      {route.isOverCapacity && (
                        <Chip label="Over capacity!" color="error" size="small" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${route.utilizationPercent}%`}
                        color={route.utilizationPercent > 90 ? 'error' : route.utilizationPercent > 70 ? 'warning' : 'success'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptimizeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleApproveOptimization}
            disabled={optimizedRoutes.some(r => r.isOverCapacity)}
          >
            Approve & Create Routes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Driver Assignment Dialog */}
      <Dialog
        open={assignDriverDialogOpen}
        onClose={() => setAssignDriverDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Assign Driver to Route</DialogTitle>
        <DialogContent>
          {selectedRouteForDriver && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Route:</strong> {selectedRouteForDriver.region.toUpperCase()} Territory
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Vehicle:</strong> {selectedRouteForDriver.vehicle?.make} {selectedRouteForDriver.vehicle?.model}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Stops:</strong> {selectedRouteForDriver.jobCount} deliveries
              </Typography>
            </Box>
          )}

          <FormControl fullWidth>
            <InputLabel>Select Driver</InputLabel>
            <Select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              label="Select Driver"
            >
              {driversLoading ? (
                <MenuItem disabled>Loading drivers...</MenuItem>
              ) : (
                drivers?.filter((d: any) => d.status === 'ACTIVE').map((driver: any) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {driver.firstName} {driver.lastName} ({driver.email})
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDriverDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAssignDriver}
            disabled={!selectedDriverId}
          >
            Assign Driver
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
