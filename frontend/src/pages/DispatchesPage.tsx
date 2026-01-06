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
  Checkbox,
  FormGroup,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import {
  LocalShipping,
  Person,
  Route as RouteIcon,
  Map as MapIcon,
  Schedule,
  PlayArrow,
  AutoAwesome,
  TrendingUp,
  Warning,
  Visibility,
  Edit,
  DragIndicator,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { useDrivers, useVehicles } from '../graphql/hooks';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Mock geocoding - in production use real geocoding API
const geocodeAddress = (address: string): [number, number] => {
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  // San Francisco Bay Area bounds
  const lat = 37.3 + (hash % 100) / 200; // 37.3 - 37.8
  const lng = -122.5 + (hash % 100) / 200; // -122.5 - -122.0
  return [lat, lng];
};

// Geographic clustering algorithm
const optimizeRoutes = (jobs: any[], selectedVehicles: any[]) => {
  if (selectedVehicles.length === 0 || jobs.length === 0) {
    return [];
  }

  const jobsByRegion: { [key: string]: any[] } = {};

  jobs.forEach(job => {
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

  const optimizedRoutes: any[] = [];
  const regions = Object.keys(jobsByRegion);

  regions.forEach((region, index) => {
    if (index < selectedVehicles.length) {
      const vehicle = selectedVehicles[index];
      const regionJobs = jobsByRegion[region];

      // Add geocoded coordinates to jobs
      const jobsWithCoords = regionJobs.map(job => ({
        ...job,
        pickupCoords: geocodeAddress(job.pickupAddress),
        deliveryCoords: geocodeAddress(job.deliveryAddress),
      }));

      const totalWeight = regionJobs.reduce((sum, job) => sum + (job.weight || 0), 0);
      const vehicleCapacity = vehicle.capacityWeightKg || vehicle.capacity || 1000;
      const estimatedDistance = regionJobs.length * 8 + 5;
      const estimatedDuration = regionJobs.length * 25 + 20;

      optimizedRoutes.push({
        vehicleId: vehicle.id,
        vehicle: vehicle,
        region: region,
        jobs: jobsWithCoords,
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
  const [vehicleSelectionOpen, setVehicleSelectionOpen] = useState(false);
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);
  const [routeDetailOpen, setRouteDetailOpen] = useState(false);
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [selectedRouteForDetail, setSelectedRouteForDetail] = useState<any>(null);
  const [selectedRouteForDriver, setSelectedRouteForDriver] = useState<any>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [optimizedRoutes, setOptimizedRoutes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: driversData, loading: driversLoading } = useDrivers();
  const { data: vehiclesData } = useVehicles();

  const drivers = driversData?.drivers || [];
  const vehicles = vehiclesData?.vehicles || [];
  const availableVehicles = vehicles.filter((v: any) => v.status === 'AVAILABLE');

  // Mock jobs data
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

  const handleOpenVehicleSelection = () => {
    setVehicleSelectionOpen(true);
  };

  const handleToggleVehicle = (vehicleId: string) => {
    if (selectedVehicleIds.includes(vehicleId)) {
      setSelectedVehicleIds(selectedVehicleIds.filter(id => id !== vehicleId));
    } else {
      setSelectedVehicleIds([...selectedVehicleIds, vehicleId]);
    }
  };

  const handleOptimizeRoutes = () => {
    setVehicleSelectionOpen(false);
    setLoading(true);

    setTimeout(() => {
      const pendingJobs = jobs.filter(j => j.status === 'pending');
      const selectedVehicles = availableVehicles.filter((v: any) =>
        selectedVehicleIds.includes(v.id)
      );
      const optimized = optimizeRoutes(pendingJobs, selectedVehicles);
      setOptimizedRoutes(optimized);
      setLoading(false);
      setOptimizeDialogOpen(true);
    }, 1500);
  };

  const handleApproveOptimization = () => {
    const newRoutes = optimizedRoutes.map(opt => ({
      id: `route-${Date.now()}-${Math.random()}`,
      vehicleId: opt.vehicleId,
      vehicle: opt.vehicle,
      driverId: null,
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

    const assignedJobIds = optimizedRoutes.flatMap(opt => opt.jobs.map((j: any) => j.id));
    setJobs(jobs.map(job =>
      assignedJobIds.includes(job.id)
        ? { ...job, status: 'assigned' }
        : job
    ));

    setOptimizeDialogOpen(false);
    setOptimizedRoutes([]);
    setTab(2); // Switch to "Awaiting Drivers" tab
  };

  const handleViewRouteDetail = (route: any) => {
    setSelectedRouteForDetail(route);
    setRouteDetailOpen(true);
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
    setTab(0); // Switch to "Optimized Routes" tab
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

  const pendingJobsCount = jobs.filter(j => j.status === 'pending').length;

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
          onClick={handleOpenVehicleSelection}
          disabled={pendingJobsCount === 0 || availableVehicles.length === 0}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Auto-Optimize Routes
        </Button>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" icon={<TrendingUp />} sx={{ mb: 3 }}>
        <strong>Smart Routing:</strong> Select vehicles, optimize routes, view on map, assign drivers, and dispatch!
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
                {pendingJobsCount}
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
                {availableVehicles.length}
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

                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={<Visibility />}
                        variant="outlined"
                        onClick={() => handleViewRouteDetail(route)}
                        sx={{ textTransform: 'none' }}
                      >
                        View on Map
                      </Button>
                      {route.status === 'planned' && (
                        <Button
                          size="small"
                          startIcon={<PlayArrow />}
                          variant="contained"
                          sx={{ textTransform: 'none' }}
                        >
                          Start Route
                        </Button>
                      )}
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
                    <MapIcon color="primary" />
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
                          Window: {job.timeWindowStart} - {job.timeWindowEnd} | Weight: {job.weight}kg
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
                        <strong>Vehicle:</strong> {route.vehicle?.make} {route.vehicle?.model}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Capacity Utilization:</strong> {route.utilizationPercent}%
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        startIcon={<Visibility />}
                        onClick={() => handleViewRouteDetail(route)}
                        sx={{ textTransform: 'none', flex: 1 }}
                      >
                        View Map
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<Person />}
                        onClick={() => handleOpenDriverAssignment(route)}
                        sx={{ textTransform: 'none', flex: 1 }}
                      >
                        Assign Driver
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Vehicle Selection Dialog */}
      <Dialog
        open={vehicleSelectionOpen}
        onClose={() => setVehicleSelectionOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShipping color="primary" />
            Select Vehicles for Today's Routes
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3, mt: 1 }}>
            Choose which vehicles to use for today's deliveries.
          </Alert>

          {availableVehicles.length === 0 ? (
            <Alert severity="warning">
              No available vehicles. Add vehicles and set status to "Available".
            </Alert>
          ) : (
            <FormGroup>
              {availableVehicles.map((vehicle: any) => (
                <FormControlLabel
                  key={vehicle.id}
                  control={
                    <Checkbox
                      checked={selectedVehicleIds.includes(vehicle.id)}
                      onChange={() => handleToggleVehicle(vehicle.id)}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" fontWeight={600}>
                          {vehicle.make} {vehicle.model}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {vehicle.licensePlate} • Capacity: {vehicle.capacityWeightKg || vehicle.capacity || 1000}kg
                        </Typography>
                      </Box>
                      <Chip
                        label={vehicle.vehicleType || 'TRUCK'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                  sx={{
                    border: '1px solid',
                    borderColor: selectedVehicleIds.includes(vehicle.id) ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    mb: 1,
                    p: 1,
                    backgroundColor: selectedVehicleIds.includes(vehicle.id) ? 'action.selected' : 'transparent',
                  }}
                />
              ))}
            </FormGroup>
          )}

          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Selected:</strong> {selectedVehicleIds.length} vehicle{selectedVehicleIds.length !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Pending Jobs:</strong> {pendingJobsCount}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVehicleSelectionOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleOptimizeRoutes}
            disabled={selectedVehicleIds.length === 0}
            startIcon={<AutoAwesome />}
          >
            Optimize Routes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Optimization Results Dialog */}
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
            System optimized {optimizedRoutes.length} routes. Review and approve.
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

      {/* Route Detail Dialog with Map */}
      <Dialog
        open={routeDetailOpen}
        onClose={() => setRouteDetailOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6">
                {selectedRouteForDetail?.region.toUpperCase()} Territory Route
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedRouteForDetail?.vehicle?.make} {selectedRouteForDetail?.vehicle?.model}
              </Typography>
            </Box>
            <Chip
              label={`${selectedRouteForDetail?.jobCount} stops`}
              color="primary"
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Map */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ height: 500, position: 'relative' }}>
                {selectedRouteForDetail && (
                  <MapContainer
                    center={selectedRouteForDetail.jobs[0]?.deliveryCoords || [37.7749, -122.4194]}
                    zoom={11}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />

                    {/* Route polyline */}
                    <Polyline
                      positions={selectedRouteForDetail.jobs.map((job: any) => job.deliveryCoords)}
                      color={getRegionColor(selectedRouteForDetail.region)}
                      weight={3}
                      opacity={0.7}
                    />

                    {/* Stop markers */}
                    {selectedRouteForDetail.jobs.map((job: any, index: number) => (
                      <Marker key={job.id} position={job.deliveryCoords}>
                        <Popup>
                          <strong>Stop #{index + 1}</strong><br />
                          {job.customerName}<br />
                          {job.deliveryAddress}<br />
                          <em>Window: {job.timeWindowStart} - {job.timeWindowEnd}</em>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                )}
              </Paper>
            </Grid>

            {/* Stop List */}
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom>
                Stop Sequence
              </Typography>
              <List dense>
                {selectedRouteForDetail?.jobs.map((job: any, index: number) => (
                  <ListItem
                    key={job.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemIcon>
                      <Chip
                        label={index + 1}
                        size="small"
                        sx={{
                          bgcolor: getRegionColor(selectedRouteForDetail.region),
                          color: 'white',
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={job.customerName}
                      secondary={
                        <>
                          {job.deliveryAddress}<br />
                          <Chip label={job.priority} size="small" color={getPriorityColor(job.priority) as any} sx={{ mt: 0.5 }} />
                        </>
                      }
                    />
                    <IconButton size="small">
                      <DragIndicator />
                    </IconButton>
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              <Box>
                <Typography variant="body2" color="text.secondary">
                  <strong>Total Distance:</strong> ~{selectedRouteForDetail?.totalDistanceKm} km
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Estimated Time:</strong> ~{selectedRouteForDetail?.totalDurationMinutes} min
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Total Weight:</strong> {selectedRouteForDetail?.totalWeight}kg
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Utilization:</strong> {selectedRouteForDetail?.utilizationPercent}%
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRouteDetailOpen(false)}>Close</Button>
          <Button variant="outlined" startIcon={<Edit />}>
            Edit Route
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
            <Box sx={{ mb: 3, mt: 1 }}>
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
