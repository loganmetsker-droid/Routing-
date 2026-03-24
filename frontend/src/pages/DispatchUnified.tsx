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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Stack,
  LinearProgress,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  LocalShipping,
  Person,
  Refresh,
  FilterList,
  PlayArrow,
  SwapHoriz,
  ErrorOutline,
} from '@mui/icons-material';
import {
  getJobs,
  getRoutes,
  getVehicles,
  getDrivers,
  assignDriverToRoute,
  updateRouteStatus,
  generateRoute,
} from '../services/api';
import { connectDispatchRealtime } from '../services/socket';

// ==================== INTERFACES ====================

interface Job {
  id: string;
  customerName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  status: string;
  priority?: string;
  assignedRouteId?: string;
}

interface Route {
  id: string;
  vehicleId?: string;
  driverId?: string;
  jobIds?: string[];
  status: string;
  totalDistance?: number;
  totalDuration?: number;
}

interface Vehicle {
  id: string;
  make?: string;
  model?: string;
  licensePlate?: string;
  status: string;
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

const STORAGE_KEY = 'dispatchUnifiedState';

// ==================== MAIN COMPONENT ====================

export default function DispatchUnified() {
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
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [selectedRouteForDriver, setSelectedRouteForDriver] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Filters (persisted)
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.filters || { date: 'today', status: 'all', priority: 'all' };
      } catch {
        return { date: 'today', status: 'all', priority: 'all' };
      }
    }
    return { date: 'today', status: 'all', priority: 'all' };
  });

  // ==================== DATA LOADING ====================

  useEffect(() => {
    loadData();
    const eventSource = connectDispatchRealtime((event) => {
      if (event.type === 'job-updated' || event.type === 'route-updated') {
        loadData();
      }
    });
    return () => eventSource?.close();
  }, []);

  // Persist filters
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ filters }));
  }, [filters]);

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

  const unassignedJobs = jobs.filter((job) =>
    job.status === 'pending' && !job.assignedRouteId
  );

  const assignedRoutes = routes.filter((route) =>
    route.status !== 'completed' && route.status !== 'cancelled'
  );

  const readyToDispatchRoutes = assignedRoutes.filter((route) =>
    route.vehicleId && route.driverId && route.jobIds && route.jobIds.length > 0
  );

  // ==================== DRIVER SUGGESTION LOGIC ====================

  const getSuggestedDrivers = (_route: Route): DriverSuggestion[] => {
    // Filter jobs belonging to this route (for future proximity calculations)
    // const routeJobs = jobs.filter((j) => _route.jobIds?.includes(j.id));
    const routeDriverAssignments = routes
      .filter((r) => r.status === 'assigned' || r.status === 'in_progress')
      .reduce((acc, r) => {
        if (r.driverId) acc[r.driverId] = (acc[r.driverId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return drivers
      .filter((d) => d.status === 'active')
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

        // Boost score for drivers with fewer jobs
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

  // ==================== CONFLICT DETECTION ====================

  interface RouteConflict {
    routeId: string;
    type: 'driver' | 'vehicle' | 'timing';
    severity: 'high' | 'medium' | 'low';
    message: string;
    affectedRoutes: string[];
  }

  const detectConflicts = (): RouteConflict[] => {
    const conflicts: RouteConflict[] = [];

    // Check for driver conflicts (same driver, multiple active routes)
    const driverRouteMap = new Map<string, string[]>();
    assignedRoutes.forEach((route) => {
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
          affectedRoutes: routeIds,
        });
      }
    });

    // Check for vehicle conflicts
    const vehicleRouteMap = new Map<string, string[]>();
    assignedRoutes.forEach((route) => {
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
          affectedRoutes: routeIds,
        });
      }
    });

    // Check for driver hours exceeding limits
    drivers.forEach((driver) => {
      if (driver.maxHours && driver.currentHours && driver.currentHours > driver.maxHours * 0.9) {
        const driverRoutes = assignedRoutes.filter((r) => r.driverId === driver.id);
        if (driverRoutes.length > 0) {
          conflicts.push({
            routeId: driverRoutes[0].id,
            type: 'timing',
            severity: driver.currentHours > driver.maxHours ? 'high' : 'medium',
            message: `${driver.firstName} ${driver.lastName} at ${((driver.currentHours / driver.maxHours) * 100).toFixed(0)}% of max hours`,
            affectedRoutes: driverRoutes.map((r) => r.id),
          });
        }
      }
    });

    return conflicts;
  };

  const conflicts = detectConflicts();

  // ==================== AUTO-ASSIGN LOGIC ====================

  const handleAutoAssign = async () => {
    if (selectedJobIds.length === 0) {
      alert('Please select jobs to auto-assign');
      return;
    }

    setAutoAssigning(true);
    try {
      // Find available vehicle
      const availableVehicle = vehicles.find((v) => v.status === 'available');
      if (!availableVehicle) {
        alert('No available vehicles');
        return;
      }

      // Generate route with selected jobs
      const routeResponse = await generateRoute(availableVehicle.id, selectedJobIds);
      const newRoute = routeResponse.route as Route;

      // Auto-suggest best driver
      const suggestions = getSuggestedDrivers(newRoute);
      if (suggestions.length > 0 && suggestions[0].available && newRoute.id) {
        await assignDriverToRoute(newRoute.id, suggestions[0].id);
      }

      // Clear selection and reload
      setSelectedJobIds([]);
      await loadData();
    } catch (error) {
      console.error('Auto-assign failed:', error);
      alert('Auto-assign failed. Please try manually.');
    } finally {
      setAutoAssigning(false);
    }
  };

  // ==================== ROUTE OPTIMIZATION ====================

  const handleOptimizeRoute = async (routeId: string) => {
    setOptimizingRouteId(routeId);
    try {
      // Call backend to reorder stops for efficiency
      // This is a placeholder - implement based on your backend API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadData();
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setOptimizingRouteId(null);
    }
  };

  // ==================== DISPATCH VALIDATION ====================

  const validateRoute = (route: Route): string[] => {
    const errors: string[] = [];
    if (!route.vehicleId) errors.push('No vehicle assigned');
    if (!route.driverId) errors.push('No driver assigned');
    if (!route.jobIds || route.jobIds.length === 0) errors.push('No jobs assigned');
    return errors;
  };

  const handleDispatchRoute = async (routeId: string) => {
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    const errors = validateRoute(route);
    if (errors.length > 0) {
      alert(`Cannot dispatch:\n${errors.join('\n')}`);
      return;
    }

    setDispatchingRouteId(routeId);
    try {
      await updateRouteStatus(routeId, 'in_progress');
      await loadData();
    } catch (error) {
      console.error('Dispatch failed:', error);
      alert('Dispatch failed');
    } finally {
      setDispatchingRouteId(null);
    }
  };

  // ==================== DRIVER ASSIGNMENT ====================

  const handleAssignDriverClick = (routeId: string) => {
    setSelectedRouteForDriver(routeId);
    setAssignDriverDialogOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedRouteForDriver || !selectedDriverId) return;

    try {
      await assignDriverToRoute(selectedRouteForDriver, selectedDriverId);
      setAssignDriverDialogOpen(false);
      setSelectedDriverId('');
      setSelectedRouteForDriver(null);
      await loadData();
    } catch (error) {
      console.error('Driver assignment failed:', error);
      alert('Failed to assign driver');
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
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={() => setFilterDialogOpen(true)}
          >
            Filters
          </Button>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadData}>
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Alert
            severity="error"
            sx={{ mb: 1 }}
          >
            <AlertTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorOutline />
                <span>{conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected</span>
              </Box>
            </AlertTitle>
            <Stack spacing={0.5}>
              {conflicts.slice(0, 3).map((conflict, idx) => (
                <Typography key={idx} variant="body2">
                  • {conflict.message}
                </Typography>
              ))}
              {conflicts.length > 3 && (
                <Typography variant="body2" color="text.secondary">
                  ... and {conflicts.length - 3} more
                </Typography>
              )}
            </Stack>
          </Alert>
        </Box>
      )}

      {/* Driver Workload Summary */}
      {drivers.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Driver Workload
            </Typography>
            <Grid container spacing={2}>
              {drivers.slice(0, 6).map((driver) => {
                const driverRoutes = assignedRoutes.filter((r) => r.driverId === driver.id);
                const isAvailable = driverRoutes.length === 0;
                const hoursPercent = driver.maxHours
                  ? ((driver.currentHours || 0) / driver.maxHours) * 100
                  : 0;

                return (
                  <Grid item xs={12} sm={6} md={4} lg={2} key={driver.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderColor: isAvailable ? 'success.main' : 'warning.main',
                        borderWidth: 2,
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Person fontSize="small" />
                          <Typography variant="body2" fontWeight="bold" noWrap>
                            {driver.firstName} {driver.lastName?.charAt(0)}.
                          </Typography>
                        </Box>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {driverRoutes.length} route{driverRoutes.length !== 1 ? 's' : ''}
                        </Typography>
                        {driver.maxHours && (
                          <Box sx={{ mt: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="caption">Hours</Typography>
                              <Typography variant="caption">{hoursPercent.toFixed(0)}%</Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(hoursPercent, 100)}
                              color={hoursPercent > 90 ? 'error' : hoursPercent > 75 ? 'warning' : 'primary'}
                              sx={{ height: 4, borderRadius: 2 }}
                            />
                          </Box>
                        )}
                        <Chip
                          label={isAvailable ? 'Available' : 'Busy'}
                          size="small"
                          color={isAvailable ? 'success' : 'warning'}
                          sx={{ mt: 1, width: '100%' }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        </Box>
      )}

      {/* 3-Column Layout */}
      <Grid container spacing={3}>
        {/* Column 1: Unassigned Jobs */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Unassigned Jobs ({unassignedJobs.length})
              </Typography>
              <Checkbox
                checked={selectedJobIds.length === unassignedJobs.length && unassignedJobs.length > 0}
                indeterminate={selectedJobIds.length > 0 && selectedJobIds.length < unassignedJobs.length}
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
                          color={job.priority === 'high' ? 'error' : job.priority === 'urgent' ? 'warning' : 'default'}
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

        {/* Column 2: Assigned Routes */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Assigned Routes ({assignedRoutes.length})
            </Typography>

            {assignedRoutes.length === 0 ? (
              <Alert severity="info">No assigned routes yet</Alert>
            ) : (
              <Stack spacing={2}>
                {assignedRoutes.map((route) => {
                  const vehicle = vehicles.find((v) => v.id === route.vehicleId);
                  const driver = drivers.find((d) => d.id === route.driverId);
                  const errors = validateRoute(route);

                  return (
                    <Card key={route.id} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight="bold">
                          Route {route.id.slice(0, 8)}
                        </Typography>

                        <Box sx={{ mt: 1, mb: 1 }}>
                          <Typography variant="caption" display="block">
                            <LocalShipping fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                            Vehicle: {vehicle ? `${vehicle.make} ${vehicle.model}` : '⚠️ None'}
                          </Typography>
                          <Typography variant="caption" display="block">
                            <Person fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                            Driver: {driver ? `${driver.firstName} ${driver.lastName}` : '⚠️ None'}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Jobs: {route.jobIds?.length || 0}
                          </Typography>
                        </Box>

                        {errors.length > 0 && (
                          <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
                            {errors.join(', ')}
                          </Alert>
                        )}

                        <Stack direction="row" spacing={1}>
                          {!route.driverId && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Person />}
                              onClick={() => handleAssignDriverClick(route.id)}
                            >
                              Assign Driver
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={optimizingRouteId === route.id ? <CircularProgress size={16} /> : <SwapHoriz />}
                            onClick={() => handleOptimizeRoute(route.id)}
                            disabled={optimizingRouteId === route.id}
                          >
                            Optimize
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Column 3: Ready to Dispatch */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '70vh', overflow: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Ready to Dispatch ({readyToDispatchRoutes.length})
            </Typography>

            {readyToDispatchRoutes.length === 0 ? (
              <Alert severity="info">No routes ready to dispatch</Alert>
            ) : (
              <Stack spacing={2}>
                {readyToDispatchRoutes.map((route) => {
                  const vehicle = vehicles.find((v) => v.id === route.vehicleId);
                  const driver = drivers.find((d) => d.id === route.driverId);

                  return (
                    <Card key={route.id} variant="outlined" sx={{ borderColor: 'success.main', borderWidth: 2 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <CheckCircle color="success" sx={{ mr: 1 }} />
                          <Typography variant="subtitle2" fontWeight="bold">
                            Route {route.id.slice(0, 8)}
                          </Typography>
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                          Driver: {driver?.firstName} {driver?.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Vehicle: {vehicle?.licensePlate}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {route.jobIds?.length || 0} stops, {route.totalDistance || 0} mi
                        </Typography>

                        <Button
                          fullWidth
                          variant="contained"
                          color="success"
                          startIcon={dispatchingRouteId === route.id ? <CircularProgress size={20} /> : <PlayArrow />}
                          onClick={() => handleDispatchRoute(route.id)}
                          disabled={dispatchingRouteId === route.id}
                          sx={{ mt: 2 }}
                        >
                          Dispatch
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Filter Dialog */}
      <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Filter Options</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Date</InputLabel>
              <Select
                value={filters.date}
                label="Date"
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="assigned">Assigned</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={filters.priority}
                label="Priority"
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilterDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Assign Driver Dialog */}
      <Dialog open={assignDriverDialogOpen} onClose={() => setAssignDriverDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Driver to Route</DialogTitle>
        <DialogContent>
          {suggestedDrivers.length === 0 ? (
            <Alert severity="warning">No available drivers</Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Select Driver</InputLabel>
                <Select
                  value={selectedDriverId}
                  label="Select Driver"
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                >
                  {suggestedDrivers.map((driver) => (
                    <MenuItem key={driver.id} value={driver.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        {driver.score >= 90 && <span style={{ marginRight: 8 }}>⭐</span>}
                        <span>
                          {driver.firstName} {driver.lastName}
                        </span>
                        <Chip
                          label={driver.reason}
                          size="small"
                          color={driver.available ? 'success' : 'warning'}
                          sx={{ ml: 'auto' }}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedDriverId && (
                <Alert severity="info">
                  {suggestedDrivers.find((d) => d.id === selectedDriverId)?.reason}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDriverDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAssignDriver} variant="contained" disabled={!selectedDriverId}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
