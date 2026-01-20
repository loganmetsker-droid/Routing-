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
  Checkbox,
  FormGroup,
  FormControlLabel,
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
} from '@mui/icons-material';
import { useDrivers, useVehicles } from '../graphql/hooks';
import { getJobs, getRoutes, generateRoute, assignDriverToRoute, updateRouteStatus, connectSSE, reorderRouteStops } from '../services/api';
import MultiRouteMap from '../components/maps/MultiRouteMap';
import ReorderableStopsList from '../components/maps/ReorderableStopsList';

export default function DispatchesPage() {
  const [tab, setTab] = useState(0);
  const [vehicleSelectionOpen, setVehicleSelectionOpen] = useState(false);
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [selectedRouteForDriver, setSelectedRouteForDriver] = useState<any>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRouteForStops, setSelectedRouteForStops] = useState<any>(null);
  const [stopsDialogOpen, setStopsDialogOpen] = useState(false);

  const { data: driversData, loading: driversLoading } = useDrivers();
  const { data: vehiclesData } = useVehicles();

  const drivers = driversData?.drivers || [];
  const vehicles = vehiclesData?.vehicles || [];
  const availableVehicles = vehicles.filter((v: any) => v.status === 'AVAILABLE');

  const loadData = async () => {
    try {
      const [jobsData, routesData] = await Promise.all([getJobs(), getRoutes()]);
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setRoutes(Array.isArray(routesData) ? routesData : []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setJobs([]);
      setRoutes([]);
    }
  };

  useEffect(() => {
    loadData();

    const eventSource = connectSSE((data) => {
      if (data.type === 'route-created' || data.type === 'route-updated' || data.type === 'route-dispatched') {
        loadData();
      }
    });

    return () => eventSource.close();
  }, []);

  const handleToggleVehicle = (vehicleId: string) => {
    if (selectedVehicleIds.includes(vehicleId)) {
      setSelectedVehicleIds(selectedVehicleIds.filter(id => id !== vehicleId));
    } else {
      setSelectedVehicleIds([...selectedVehicleIds, vehicleId]);
    }
  };

  const handleOptimizeRoutes = async () => {
    setVehicleSelectionOpen(false);
    setLoading(true);

    try {
      const pendingJobs = jobs.filter(j => j.status === 'pending');

      for (const vehicleId of selectedVehicleIds) {
        const jobsForVehicle = pendingJobs.slice(0, Math.ceil(pendingJobs.length / selectedVehicleIds.length));
        if (jobsForVehicle.length > 0) {
          await generateRoute(vehicleId, jobsForVehicle.map(j => j.id));
        }
      }

      await loadData();
    } catch (error) {
      console.error('Failed to optimize routes:', error);
      alert('Failed to optimize routes');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDriverAssignment = (route: any) => {
    setSelectedRouteForDriver(route);
    setSelectedDriverId('');
    setAssignDriverDialogOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedDriverId || !selectedRouteForDriver) return;

    try {
      await assignDriverToRoute(selectedRouteForDriver.id, selectedDriverId);
      await loadData();
      setAssignDriverDialogOpen(false);
      setSelectedRouteForDriver(null);
      setSelectedDriverId('');
      setTab(1);
    } catch (error) {
      console.error('Failed to assign driver:', error);
      alert('Failed to assign driver');
    }
  };

  const handleStartRoute = async (routeId: string) => {
    try {
      await updateRouteStatus(routeId, 'dispatched');
      await loadData();
    } catch (error) {
      console.error('Failed to start route:', error);
    }
  };

  const handleCompleteRoute = async (routeId: string) => {
    try {
      await updateRouteStatus(routeId, 'completed');
      await loadData();
    } catch (error) {
      console.error('Failed to complete route:', error);
    }
  };

  const handleOpenStopsDialog = (route: any) => {
    setSelectedRouteForStops(route);
    setStopsDialogOpen(true);
  };

  const handleReorderStops = async (routeId: string, newJobOrder: string[]) => {
    try {
      await reorderRouteStops(routeId, newJobOrder);
      await loadData();
    } catch (error) {
      console.error('Failed to reorder stops:', error);
      throw error;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'success';
      case 'dispatched': return 'primary';
      case 'in_progress': return 'info';
      case 'completed': return 'default';
      default: return 'default';
    }
  };

  const pendingJobsCount = jobs.filter(j => j.status === 'pending').length;
  const plannedRoutes = routes.filter(r => r.status === 'planned');
  const dispatchedRoutes = routes.filter(r => r.status === 'dispatched');

  // Transform routes for multi-route map
  const transformRoutesForMap = () => {
    const activeRoutes = routes.filter(
      r => r.status === 'planned' || r.status === 'dispatched' || r.status === 'in_progress'
    );

    return activeRoutes.map((route: any) => {
      const vehicle = vehicles.find((v: any) => v.id === route.vehicleId);
      const driver = route.driverId ? drivers.find((d: any) => d.id === route.driverId) : null;

      // Generate stops from jobs
      const routeJobs = jobs.filter(j => route.jobIds?.includes(j.id));
      const stops = routeJobs.flatMap((job: any) => [
        {
          lat: job.pickupLocation?.coordinates?.[1] || 37.7749,
          lng: job.pickupLocation?.coordinates?.[0] || -122.4194,
          address: job.pickupAddress || 'Unknown',
          type: 'pickup' as const,
        },
        {
          lat: job.deliveryLocation?.coordinates?.[1] || 37.7749,
          lng: job.deliveryLocation?.coordinates?.[0] || -122.4194,
          address: job.deliveryAddress || 'Unknown',
          type: 'delivery' as const,
        },
      ]);

      return {
        id: route.id,
        color: route.color || '#3B82F6',
        polyline: route.polyline,
        vehicle: vehicle ? {
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          licensePlate: vehicle.licensePlate,
          currentLocation: vehicle.currentLocation,
        } : undefined,
        driver: driver ? {
          firstName: driver.firstName || '',
          lastName: driver.lastName || '',
        } : undefined,
        status: route.status,
        totalDistanceKm: route.totalDistanceKm || route.totalDistance,
        totalDurationMinutes: route.totalDurationMinutes || route.totalDuration,
        eta: route.eta,
        jobCount: route.jobCount || route.jobIds?.length || 0,
        stops,
      };
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Smart Route Dispatch
        </Typography>
        <Button
          variant="contained"
          startIcon={<AutoAwesome />}
          onClick={() => setVehicleSelectionOpen(true)}
          disabled={pendingJobsCount === 0 || availableVehicles.length === 0 || loading}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Auto-Optimize Routes
        </Button>
      </Box>

      <Alert severity="info" icon={<TrendingUp />} sx={{ mb: 3 }}>
        <strong>Smart Routing:</strong> Select vehicles, optimize routes, assign drivers, and dispatch!
      </Alert>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <RouteIcon sx={{ color: 'white', mr: 1 }} />
                <Typography color="white" variant="h6">Active Routes</Typography>
              </Box>
              <Typography variant="h3" color="white" fontWeight={700}>
                {routes.filter(r => r.status === 'dispatched' || r.status === 'in_progress').length}
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

      {/* Multi-Route Map */}
      <Paper sx={{ mb: 3, overflow: 'hidden' }}>
        <MultiRouteMap routes={transformRoutesForMap()} height="500px" />
      </Paper>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Planned Routes" sx={{ textTransform: 'none' }} />
          <Tab label="Dispatched Routes" sx={{ textTransform: 'none' }} />
          <Tab label="Pending Jobs" sx={{ textTransform: 'none' }} />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Grid container spacing={2}>
          {plannedRoutes.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">No planned routes. Click "Auto-Optimize Routes" to create routes!</Alert>
            </Grid>
          ) : (
            plannedRoutes.map((route) => {
              const vehicle = vehicles.find((v: any) => v.id === route.vehicleId);
              const driver = route.driverId ? drivers.find((d: any) => d.id === route.driverId) : null;

              return (
                <Grid item xs={12} md={6} key={route.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">Route #{route.id.slice(0, 8)}</Typography>
                        <Chip label={route.status} color={getStatusColor(route.status) as any} size="small" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>Vehicle:</strong> {vehicle?.make} {vehicle?.model}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>Jobs:</strong> {route.jobIds?.length || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>Distance:</strong> {route.totalDistance?.toFixed(1)} km
                      </Typography>
                      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          startIcon={<RouteIcon />}
                          variant="text"
                          onClick={() => handleOpenStopsDialog(route)}
                          sx={{ textTransform: 'none' }}
                        >
                          Edit Stops
                        </Button>
                        {!driver && (
                          <Button
                            size="small"
                            startIcon={<Person />}
                            variant="outlined"
                            onClick={() => handleOpenDriverAssignment(route)}
                            sx={{ textTransform: 'none' }}
                          >
                            Assign Driver
                          </Button>
                        )}
                        {driver && (
                          <Button
                            size="small"
                            startIcon={<PlayArrow />}
                            variant="contained"
                            onClick={() => handleStartRoute(route.id)}
                            sx={{ textTransform: 'none' }}
                          >
                            Dispatch Route
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
          )}
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={2}>
          {dispatchedRoutes.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">No dispatched routes</Alert>
            </Grid>
          ) : (
            dispatchedRoutes.map((route) => {
              const vehicle = vehicles.find((v: any) => v.id === route.vehicleId);
              const driver = route.driverId ? drivers.find((d: any) => d.id === route.driverId) : null;

              return (
                <Grid item xs={12} md={6} key={route.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">Route #{route.id.slice(0, 8)}</Typography>
                        <Chip label={route.status} color={getStatusColor(route.status) as any} size="small" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>Driver:</strong> {driver ? `${driver.firstName} ${driver.lastName}` : 'N/A'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>Vehicle:</strong> {vehicle?.make} {vehicle?.model}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>Jobs:</strong> {route.jobIds?.length || 0}
                      </Typography>
                      {route.status !== 'completed' && (
                        <Box sx={{ mt: 2 }}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleCompleteRoute(route.id)}
                            sx={{ textTransform: 'none' }}
                          >
                            Complete Route
                          </Button>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
          )}
        </Grid>
      )}

      {tab === 2 && (
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
                    primary={job.customerName}
                    secondary={
                      <>
                        <Typography variant="body2" component="div">Pickup: {job.pickupAddress}</Typography>
                        <Typography variant="body2" component="div">Delivery: {job.deliveryAddress}</Typography>
                      </>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Paper>
      )}

      <Dialog open={vehicleSelectionOpen} onClose={() => setVehicleSelectionOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShipping color="primary" />
            Select Vehicles for Routes
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3, mt: 1 }}>
            Choose which vehicles to use for today's deliveries.
          </Alert>
          {availableVehicles.length === 0 ? (
            <Alert severity="warning">No available vehicles</Alert>
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
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        {vehicle.make} {vehicle.model}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {vehicle.licensePlate}
                      </Typography>
                    </Box>
                  }
                  sx={{
                    border: '1px solid',
                    borderColor: selectedVehicleIds.includes(vehicle.id) ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    mb: 1,
                    p: 1,
                  }}
                />
              ))}
            </FormGroup>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVehicleSelectionOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleOptimizeRoutes}
            disabled={selectedVehicleIds.length === 0 || loading}
            startIcon={<AutoAwesome />}
          >
            Optimize Routes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignDriverDialogOpen} onClose={() => setAssignDriverDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Driver to Route</DialogTitle>
        <DialogContent>
          {selectedRouteForDriver && (
            <Box sx={{ mb: 3, mt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Route:</strong> #{selectedRouteForDriver.id.slice(0, 8)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Jobs:</strong> {selectedRouteForDriver.jobIds?.length || 0}
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
                <MenuItem disabled>Loading...</MenuItem>
              ) : drivers && drivers.length > 0 ? (
                drivers
                  .filter((d: any) => d.status === 'ACTIVE')
                  .map((driver: any) => (
                    <MenuItem key={driver.id} value={driver.id}>
                      {driver.firstName} {driver.lastName}
                    </MenuItem>
                  ))
              ) : (
                <MenuItem disabled>No drivers available</MenuItem>
              )}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDriverDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignDriver} disabled={!selectedDriverId}>
            Assign Driver
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={stopsDialogOpen} onClose={() => setStopsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Reorder Route Stops</DialogTitle>
        <DialogContent>
          {selectedRouteForStops && (
            <ReorderableStopsList
              routeId={selectedRouteForStops.id}
              stops={(() => {
                const stops: any[] = [];
                const routeJobs = jobs.filter(j => selectedRouteForStops.jobIds?.includes(j.id));

                selectedRouteForStops.jobIds?.forEach((jobId: string) => {
                  const job = routeJobs.find(j => j.id === jobId);
                  if (job) {
                    stops.push({
                      jobId: job.id,
                      address: job.pickupAddress,
                      type: 'pickup' as const,
                      customerName: job.customerName,
                    });
                    stops.push({
                      jobId: job.id,
                      address: job.deliveryAddress,
                      type: 'delivery' as const,
                      customerName: job.customerName,
                    });
                  }
                });
                return stops;
              })()}
              routeColor={selectedRouteForStops.color || '#3B82F6'}
              onReorder={handleReorderStops}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStopsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
