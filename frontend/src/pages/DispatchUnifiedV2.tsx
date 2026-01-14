import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
  AlertTitle,
  Checkbox,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  AutoAwesome,
  Refresh,
  PlayArrow,
  ErrorOutline,
  CheckCircle,
} from '@mui/icons-material';
import {
  getJobs,
  getRoutes,
  getVehicles,
  getDrivers,
  assignDriverToRoute,
  updateRouteStatus,
  generateRoute,
  updateJob,
  updateRoute,
  connectSSE,
} from '../services/api';
import VehicleRouteCard from '../components/dispatch/VehicleRouteCard';
import LiveStatusColumn from '../components/dispatch/LiveStatusColumn';

// ==================== INTERFACES ====================

interface Job {
  id: string;
  customerName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  status: string;
  priority?: string;
  assignedRouteId?: string;
  assignedVehicleId?: string;
  stopSequence?: number;
}

interface Route {
  id: string;
  vehicleId?: string;
  driverId?: string;
  jobIds?: string[];
  status: string;
  totalDistance?: number;
  totalDuration?: number;
  estimatedCapacity?: number;
  optimizedStops?: OptimizedStop[];
  optimizedAt?: string;
}

interface OptimizedStop {
  jobId: string;
  sequence: number;
  address: string;
  estimatedArrival?: string;
  distanceFromPrevious?: number;
}

interface Vehicle {
  id: string;
  make?: string;
  model?: string;
  licensePlate?: string;
  status: string;
  capacity?: number;
}

interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
  status: string;
  currentHours?: number;
  maxHours?: number;
}

interface DriverSuggestion extends Driver {
  available: boolean;
  currentJobCount: number;
  score: number;
  reason: string;
}

// ==================== MAIN COMPONENT ====================

export default function DispatchUnifiedV2() {
  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [optimizingRouteId, setOptimizingRouteId] = useState<string | null>(null);
  const [dispatchingRouteId, setDispatchingRouteId] = useState<string | null>(null);

  // Dialogs
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [selectedRouteForDriver, setSelectedRouteForDriver] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // ==================== DATA LOADING ====================

  useEffect(() => {
    loadData();
    const eventSource = connectSSE((event) => {
      if (event.type === 'job-updated' || event.type === 'route-updated') {
        loadData();
      }
    });
    return () => eventSource?.close();
  }, []);

  const loadData = async () => {
    try {
      const [jobsData, routesData, vehiclesData, driversData] = await Promise.all([
        getJobs(),
        getRoutes(),
        getVehicles(),
        getDrivers(),
      ]);
      setJobs((jobsData as any)?.jobs || jobsData || []);
      setRoutes((routesData as any)?.routes || routesData || []);
      setVehicles((vehiclesData as any)?.vehicles || vehiclesData || []);
      setDrivers((driversData as any)?.drivers || driversData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==================== COMPUTED DATA ====================

  const unassignedJobs = jobs.filter((job) => job.status === 'pending' && !job.assignedRouteId);

  const activeRoutes = routes.filter(
    (route) => route.status !== 'dispatched' && route.status !== 'completed'
  );

  const readyToDispatchRoutes = activeRoutes.filter(
    (route) =>
      (route.status === 'optimized' || route.status === 'ready') &&
      route.vehicleId &&
      route.driverId &&
      route.jobIds &&
      route.jobIds.length > 0
  );

  // ==================== CONFLICT DETECTION ====================

  interface RouteConflict {
    routeId: string;
    type: 'driver' | 'vehicle';
    severity: 'high' | 'medium';
    message: string;
  }

  const detectConflicts = (): RouteConflict[] => {
    const conflicts: RouteConflict[] = [];

    // Check for driver conflicts
    const driverRouteMap = new Map<string, string[]>();
    activeRoutes.forEach((route) => {
      if (route.driverId) {
        if (!driverRouteMap.has(route.driverId)) {
          driverRouteMap.set(route.driverId, []);
        }
        driverRouteMap.get(route.driverId)!.push(route.id);
      }
    });

    driverRouteMap.forEach((routeIds, driverId) => {
      if (routeIds.length > 1) {
        const driver = drivers.find((d) => d.id === driverId);
        conflicts.push({
          routeId: routeIds[0],
          type: 'driver',
          severity: 'high',
          message: `Driver ${driver?.firstName} ${driver?.lastName} assigned to ${routeIds.length} routes`,
        });
      }
    });

    // Check for vehicle conflicts
    const vehicleRouteMap = new Map<string, string[]>();
    activeRoutes.forEach((route) => {
      if (route.vehicleId) {
        if (!vehicleRouteMap.has(route.vehicleId)) {
          vehicleRouteMap.set(route.vehicleId, []);
        }
        vehicleRouteMap.get(route.vehicleId)!.push(route.id);
      }
    });

    vehicleRouteMap.forEach((routeIds, vehicleId) => {
      if (routeIds.length > 1) {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        conflicts.push({
          routeId: routeIds[0],
          type: 'vehicle',
          severity: 'high',
          message: `Vehicle ${vehicle?.licensePlate} assigned to ${routeIds.length} routes`,
        });
      }
    });

    return conflicts;
  };

  const conflicts = detectConflicts();

  // ==================== AUTO-ASSIGN LOGIC ====================

  const handleAutoAssign = async () => {
    if (selectedJobIds.length === 0) return;

    setAutoAssigning(true);
    try {
      // Find available vehicle
      const availableVehicle = vehicles.find((v) => {
        const assignedRoute = routes.find((r) => r.vehicleId === v.id && r.status !== 'completed');
        return !assignedRoute;
      });

      if (!availableVehicle) {
        alert('No available vehicles');
        return;
      }

      // Create route
      const response = await generateRoute(availableVehicle.id, selectedJobIds);
      const newRoute = (response as any).route || response;

      // Update jobs
      for (const jobId of selectedJobIds) {
        await updateJob(jobId, {
          status: 'assigned',
          assignedRouteId: newRoute.id,
          assignedVehicleId: availableVehicle.id,
        });
      }

      // Immediately optimize
      await handleOptimizeRoute(newRoute.id);

      setSelectedJobIds([]);
      await loadData();
    } catch (error) {
      console.error('Auto-assign failed:', error);
      alert('Failed to auto-assign jobs');
    } finally {
      setAutoAssigning(false);
    }
  };

  // ==================== OPTIMIZATION LOGIC ====================

  const handleOptimizeRoute = async (routeId: string) => {
    setOptimizingRouteId(routeId);
    try {
      const route = routes.find((r) => r.id === routeId);
      if (!route || !route.vehicleId || !route.jobIds || route.jobIds.length === 0) {
        throw new Error('Invalid route');
      }

      // Simulate optimization (replace with real API call)
      const optimizedDistance = Math.random() * 50 + 10;
      const optimizedDuration = Math.random() * 120 + 30;
      const optimizedStops: OptimizedStop[] = route.jobIds.map((jobId, idx) => ({
        jobId,
        sequence: idx,
        address: jobs.find((j) => j.id === jobId)?.deliveryAddress || '',
      }));

      await updateRoute(routeId, {
        status: 'optimized',
        totalDistance: optimizedDistance,
        totalDuration: optimizedDuration,
        optimizedStops,
        estimatedCapacity: route.jobIds.length * 100, // Simulated
      });

      // Update job stop sequences
      for (let i = 0; i < route.jobIds.length; i++) {
        await updateJob(route.jobIds[i], {
          stopSequence: i,
        });
      }

      await loadData();
    } catch (error) {
      console.error('Optimization failed:', error);
      alert('Failed to optimize route');
    } finally {
      setOptimizingRouteId(null);
    }
  };

  // ==================== DRIVER ASSIGNMENT ====================

  const getSuggestedDrivers = (_route: Route): DriverSuggestion[] => {
    const routeDriverAssignments = routes
      .filter((r) => r.status === 'active' || r.status === 'dispatched')
      .reduce((acc, r) => {
        if (r.driverId) acc[r.driverId] = (acc[r.driverId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return drivers
      .filter((d) => d.status === 'active' || d.status === 'available' || d.status === 'ACTIVE')
      .map((d) => {
        const currentJobCount = routeDriverAssignments[d.id] || 0;
        const available = currentJobCount === 0;
        const hoursOk = !d.maxHours || (d.currentHours || 0) < d.maxHours;

        let score = 100;
        let reason = 'Available';

        if (!available) {
          score -= 30;
          reason = `Already assigned (${currentJobCount} routes)`;
        }
        if (!hoursOk) {
          score -= 50;
          reason = 'Near max hours';
        }

        score -= currentJobCount * 10;

        return {
          ...d,
          available,
          currentJobCount,
          score,
          reason,
        };
      })
      .sort((a, b) => b.score - a.score);
  };

  const handleAssignDriverClick = (routeId: string) => {
    setSelectedRouteForDriver(routeId);
    setAssignDriverDialogOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedRouteForDriver || !selectedDriverId) return;

    try {
      await assignDriverToRoute(selectedRouteForDriver, selectedDriverId);
      await updateRoute(selectedRouteForDriver, { status: 'ready' });
      setAssignDriverDialogOpen(false);
      setSelectedDriverId('');
      setSelectedRouteForDriver(null);
      await loadData();
    } catch (error) {
      console.error('Driver assignment failed:', error);
      alert('Failed to assign driver');
    }
  };

  const handleRemoveDriver = async (routeId: string) => {
    try {
      await updateRoute(routeId, { driverId: undefined, status: 'optimized' });
      await loadData();
    } catch (error) {
      console.error('Remove driver failed:', error);
    }
  };

  // ==================== DISPATCH ====================

  const handleDispatch = async (routeId: string) => {
    setDispatchingRouteId(routeId);
    try {
      await updateRouteStatus(routeId, 'dispatched');
      await loadData();
    } catch (error) {
      console.error('Dispatch failed:', error);
      alert('Failed to dispatch route');
    } finally {
      setDispatchingRouteId(null);
    }
  };

  // ==================== JOB SELECTION ====================

  const handleJobToggle = (jobId: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleSelectAllJobs = () => {
    if (selectedJobIds.length === unassignedJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(unassignedJobs.map((j) => j.id));
    }
  };

  // ==================== RENDER ====================

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedRoute = selectedRouteForDriver
    ? routes.find((r) => r.id === selectedRouteForDriver)
    : null;
  const suggestedDrivers = selectedRoute ? getSuggestedDrivers(selectedRoute) : [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Dispatch Control Center</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadData}>
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Alert severity="error">
            <AlertTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorOutline />
                <span>
                  {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected
                </span>
              </Box>
            </AlertTitle>
            <Stack spacing={0.5}>
              {conflicts.map((conflict, idx) => (
                <Typography key={idx} variant="body2">
                  • {conflict.message}
                </Typography>
              ))}
            </Stack>
          </Alert>
        </Box>
      )}

      {/* 4-Column Layout */}
      <Grid container spacing={2}>
        {/* Column 1: Unassigned Jobs */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Unassigned Jobs ({unassignedJobs.length})</Typography>
              <Checkbox
                checked={selectedJobIds.length === unassignedJobs.length && unassignedJobs.length > 0}
                indeterminate={
                  selectedJobIds.length > 0 && selectedJobIds.length < unassignedJobs.length
                }
                onChange={handleSelectAllJobs}
              />
            </Box>

            {unassignedJobs.length === 0 ? (
              <Alert severity="info">No unassigned jobs</Alert>
            ) : (
              <Stack spacing={1}>
                {unassignedJobs.map((job) => (
                  <Card
                    key={job.id}
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      border: selectedJobIds.includes(job.id) ? 2 : 1,
                      borderColor: selectedJobIds.includes(job.id) ? 'primary.main' : 'divider',
                    }}
                    onClick={() => handleJobToggle(job.id)}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {job.customerName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            📍 {job.deliveryAddress || 'No address'}
                          </Typography>
                        </Box>
                        <Chip
                          label={job.priority || 'normal'}
                          size="small"
                          color={
                            job.priority === 'urgent'
                              ? 'error'
                              : job.priority === 'high'
                              ? 'warning'
                              : 'default'
                          }
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}

            <Box sx={{ mt: 2 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={autoAssigning ? <CircularProgress size={20} /> : <AutoAwesome />}
                onClick={handleAutoAssign}
                disabled={selectedJobIds.length === 0 || autoAssigning}
              >
                Auto-Assign Selected
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Column 2: Vehicles & Routes */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Vehicles & Routes ({vehicles.length})
            </Typography>

            <Stack spacing={2}>
              {vehicles.map((vehicle) => {
                const route = routes.find((r) => r.vehicleId === vehicle.id && r.status !== 'completed');
                const driver = route?.driverId ? drivers.find((d) => d.id === route.driverId) : null;
                const routeJobs = route?.jobIds
                  ? jobs.filter((j) => route.jobIds?.includes(j.id))
                  : [];

                return (
                  <VehicleRouteCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    route={route || null}
                    jobs={routeJobs}
                    driver={driver || null}
                    onOptimize={handleOptimizeRoute}
                    onAssignDriver={handleAssignDriverClick}
                    onRemoveDriver={handleRemoveDriver}
                    optimizing={optimizingRouteId === route?.id}
                  />
                );
              })}
            </Stack>
          </Paper>
        </Grid>

        {/* Column 3: Ready to Dispatch */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Ready to Dispatch ({readyToDispatchRoutes.length})
            </Typography>

            {readyToDispatchRoutes.length === 0 ? (
              <Alert severity="info">No routes ready for dispatch</Alert>
            ) : (
              <Stack spacing={2}>
                {readyToDispatchRoutes.map((route) => {
                  const vehicle = vehicles.find((v) => v.id === route.vehicleId);
                  const driver = drivers.find((d) => d.id === route.driverId);

                  return (
                    <Card key={route.id} variant="outlined" sx={{ borderColor: 'success.main', borderWidth: 2 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <CheckCircle color="success" />
                          <Typography variant="subtitle2" fontWeight="bold">
                            Route {route.id.slice(0, 8)}
                          </Typography>
                        </Box>

                        <Typography variant="body2">
                          <strong>Vehicle:</strong> {vehicle?.make} {vehicle?.model}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Driver:</strong> {driver?.firstName} {driver?.lastName}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Jobs:</strong> {route.jobIds?.length || 0}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Distance:</strong> {route.totalDistance?.toFixed(1) || 0} mi
                        </Typography>
                        <Typography variant="body2">
                          <strong>Duration:</strong>{' '}
                          {route.totalDuration ? `${Math.floor(route.totalDuration / 60)}h ${Math.round(route.totalDuration % 60)}m` : '0m'}
                        </Typography>

                        <Button
                          fullWidth
                          variant="contained"
                          color="success"
                          startIcon={
                            dispatchingRouteId === route.id ? (
                              <CircularProgress size={20} />
                            ) : (
                              <PlayArrow />
                            )
                          }
                          onClick={() => handleDispatch(route.id)}
                          disabled={dispatchingRouteId === route.id}
                          sx={{ mt: 2 }}
                        >
                          DISPATCH
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Column 4: Live Status */}
        <Grid item xs={12} md={2}>
          <Box sx={{ height: '70vh', overflow: 'auto' }}>
            <LiveStatusColumn drivers={drivers} vehicles={vehicles} routes={activeRoutes} />
          </Box>
        </Grid>
      </Grid>

      {/* Assign Driver Dialog */}
      <Dialog open={assignDriverDialogOpen} onClose={() => setAssignDriverDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Driver to Route</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Driver</InputLabel>
            <Select
              value={selectedDriverId}
              label="Select Driver"
              onChange={(e) => setSelectedDriverId(e.target.value)}
            >
              {suggestedDrivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>
                      {driver.firstName} {driver.lastName}
                    </span>
                    <Chip
                      label={driver.reason}
                      size="small"
                      color={driver.available ? 'success' : 'warning'}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDriverDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignDriver} disabled={!selectedDriverId}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
