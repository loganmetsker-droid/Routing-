import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
  Alert,
  Checkbox,
  SelectChangeEvent,
  Snackbar,
  Badge,
} from '@mui/material';
import {
  DragIndicator,
  CheckCircle,
  Warning,
  LocalShipping,
  Person,
  SwapHoriz,
  Done,
  Search,
  Clear,
  Edit,
  Refresh,
  ErrorOutline,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import {
  getJobs,
  getRoutes,
  getVehicles,
  getDrivers,
  assignDriverToRoute,
  updateJobStatus,
  reorderRouteStops,
  connectSSE,
} from '../services/api';

// ==================== INTERFACES ====================

interface Job {
  id: string;
  customerName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  status: string;
  priority?: string;
  assignedRouteId?: string;
  createdAt?: string;
}

interface Route {
  id: string;
  vehicleId?: string;
  driverId?: string;
  jobIds?: string[];
  status: string;
  totalDistance?: number;
  totalDuration?: number;
  createdAt?: string;
  dispatchedAt?: string;
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
}

// Enriched route with job and assignment details
interface EnrichedRoute extends Route {
  vehicle?: Vehicle;
  driver?: Driver;
  jobs: Job[];
  conflicts: string[]; // List of conflict messages
}

// ==================== MAIN COMPONENT ====================

export default function RouteOptimizationPage() {
  // ===== State Management =====
  const [routes, setRoutes] = useState<Route[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected route for editing
  const [selectedRoute, setSelectedRoute] = useState<EnrichedRoute | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Filters
  const [filterDriver, setFilterDriver] = useState<string>('all');
  const [filterVehicle, setFilterVehicle] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');

  // Batch selection
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);

  // Batch reassignment dialog
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchDriver, setBatchDriver] = useState<string>('');

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // ===== Data Loading =====

  /**
   * Load all data from backend (routes, jobs, vehicles, drivers)
   * Enriches routes with job details and assignments
   */
  const loadData = async () => {
    try {
      setLoading(true);
      const [routesData, jobsData, vehiclesData, driversData] = await Promise.all([
        getRoutes(),
        getJobs(),
        getVehicles(),
        getDrivers(),
      ]);

      setRoutes((routesData.routes || []) as Route[]);
      setJobs((jobsData.jobs || []) as Job[]);
      setVehicles(vehiclesData.vehicles || []);
      setDrivers(driversData.drivers || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Connect to SSE for real-time updates
   * Automatically reloads data when backend state changes
   */
  useEffect(() => {
    loadData();

    const eventSource = connectSSE((data) => {
      console.log('SSE update received:', data);
      loadData(); // Reload data on any backend update
    });

    return () => {
      eventSource.close();
    };
  }, []);

  // ===== Helper Functions =====

  /**
   * Show snackbar notification
   */
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  /**
   * Enrich routes with jobs, vehicle, driver, and conflict detection
   */
  const enrichRoutes = (): EnrichedRoute[] => {
    return routes.map((route) => {
      const vehicle = vehicles.find((v) => v.id === route.vehicleId);
      const driver = drivers.find((d) => d.id === route.driverId);

      // Get jobs for this route
      const routeJobs = (route.jobIds || [])
        .map((jobId) => jobs.find((j) => j.id === jobId))
        .filter((j): j is Job => j !== undefined);

      // Detect conflicts
      const conflicts: string[] = [];

      // Check for missing driver assignment
      if (!route.driverId && route.status !== 'pending') {
        conflicts.push('No driver assigned');
      }

      // Check for missing vehicle assignment
      if (!route.vehicleId) {
        conflicts.push('No vehicle assigned');
      }

      // Check for driver status
      if (driver && driver.status !== 'ACTIVE' && driver.status !== 'available') {
        conflicts.push(`Driver is ${driver.status}`);
      }

      // Check for vehicle capacity (if specified)
      if (vehicle?.capacity && routeJobs.length > vehicle.capacity) {
        conflicts.push(`Exceeds vehicle capacity (${routeJobs.length}/${vehicle.capacity})`);
      }

      // Check for unassigned jobs in route
      const unassignedJobs = routeJobs.filter((j) => j.status === 'pending' && !j.assignedRouteId);
      if (unassignedJobs.length > 0) {
        conflicts.push(`${unassignedJobs.length} job(s) not properly assigned`);
      }

      return {
        ...route,
        vehicle,
        driver,
        jobs: routeJobs,
        conflicts,
      };
    });
  };

  /**
   * Filter routes based on current filter selections
   */
  const getFilteredRoutes = (): EnrichedRoute[] => {
    let filtered = enrichRoutes();

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter((r) => r.status !== 'completed' && r.status !== 'cancelled');
    } else if (filterStatus === 'with_conflicts') {
      filtered = filtered.filter((r) => r.conflicts.length > 0);
    } else if (filterStatus !== 'all') {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    // Driver filter
    if (filterDriver === 'unassigned') {
      filtered = filtered.filter((r) => !r.driverId);
    } else if (filterDriver !== 'all') {
      filtered = filtered.filter((r) => r.driverId === filterDriver);
    }

    // Vehicle filter
    if (filterVehicle === 'unassigned') {
      filtered = filtered.filter((r) => !r.vehicleId);
    } else if (filterVehicle !== 'all') {
      filtered = filtered.filter((r) => r.vehicleId === filterVehicle);
    }

    // Search filter (customer name, job address)
    if (searchTerm) {
      filtered = filtered.filter((r) =>
        r.jobs.some(
          (j) =>
            j.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            j.deliveryAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            j.pickupAddress?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    return filtered;
  };

  /**
   * Get driver display name
   */
  const getDriverName = (driverId?: string): string => {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return 'Unknown Driver';
    return `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Driver';
  };

  /**
   * Get vehicle display name
   */
  const getVehicleName = (vehicleId?: string): string => {
    if (!vehicleId) return 'Unassigned';
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return 'Unknown Vehicle';
    return `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.licensePlate || 'Vehicle';
  };

  /**
   * Get status color for chips
   */
  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'warning';
      case 'planned':
        return 'info';
      case 'dispatched':
        return 'primary';
      case 'in_progress':
        return 'primary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  // ===== Event Handlers =====

  /**
   * Handle selecting a route for editing
   */
  const handleSelectRoute = (route: EnrichedRoute) => {
    setSelectedRoute(route);
    setEditDialogOpen(true);
  };

  /**
   * Handle drag-and-drop reordering of stops within a route
   */
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !selectedRoute) return;

    const { source, destination } = result;

    // Reorder jobs locally
    const reorderedJobs = Array.from(selectedRoute.jobs);
    const [movedJob] = reorderedJobs.splice(source.index, 1);
    reorderedJobs.splice(destination.index, 0, movedJob);

    // Update local state immediately for responsiveness
    setSelectedRoute({
      ...selectedRoute,
      jobs: reorderedJobs,
      jobIds: reorderedJobs.map((j) => j.id),
    });

    // Persist to backend
    try {
      const newJobOrder = reorderedJobs.map((j) => j.id);
      await reorderRouteStops(selectedRoute.id, newJobOrder);
      showSnackbar('Stop order updated successfully', 'success');
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Failed to reorder stops:', error);
      showSnackbar('Failed to reorder stops', 'error');
      // Revert on error
      await loadData();
    }
  };

  /**
   * Handle reassigning driver to selected route
   */
  const handleReassignDriver = async (routeId: string, driverId: string) => {
    try {
      await assignDriverToRoute(routeId, driverId);
      showSnackbar('Driver reassigned successfully', 'success');
      await loadData();
    } catch (error) {
      console.error('Failed to reassign driver:', error);
      showSnackbar('Failed to reassign driver', 'error');
    }
  };

  /**
   * Handle batch checkbox selection
   */
  const handleSelectRoute_Checkbox = (routeId: string) => {
    setSelectedRouteIds((prev) =>
      prev.includes(routeId) ? prev.filter((id) => id !== routeId) : [...prev, routeId]
    );
  };

  /**
   * Handle batch reassignment (driver or vehicle)
   */
  const handleBatchReassign = async () => {
    if (selectedRouteIds.length === 0) {
      showSnackbar('No routes selected', 'warning');
      return;
    }

    try {
      // Reassign driver to all selected routes
      if (batchDriver) {
        for (const routeId of selectedRouteIds) {
          await assignDriverToRoute(routeId, batchDriver);
        }
      }

      // Note: Vehicle reassignment would require a backend endpoint
      // For now, we only support driver reassignment

      showSnackbar(`${selectedRouteIds.length} route(s) updated successfully`, 'success');
      setSelectedRouteIds([]);
      setBatchDialogOpen(false);
      setBatchDriver('');
      await loadData();
    } catch (error) {
      console.error('Failed to batch reassign:', error);
      showSnackbar('Failed to batch reassign', 'error');
    }
  };

  /**
   * Handle marking stops/jobs as completed
   */
  const handleMarkJobCompleted = async (jobId: string) => {
    try {
      await updateJobStatus(jobId, 'completed');
      showSnackbar('Job marked as completed', 'success');
      await loadData();
    } catch (error) {
      console.error('Failed to mark job as completed:', error);
      showSnackbar('Failed to mark job as completed', 'error');
    }
  };

  /**
   * Handle batch mark as completed
   */
  const handleBatchMarkCompleted = async () => {
    if (selectedRouteIds.length === 0) {
      showSnackbar('No routes selected', 'warning');
      return;
    }

    try {
      // Get all jobs in selected routes
      const selectedRoutes = routes.filter((r) => selectedRouteIds.includes(r.id));
      const allJobIds = selectedRoutes.flatMap((r) => r.jobIds || []);

      // Mark all jobs as completed
      for (const jobId of allJobIds) {
        await updateJobStatus(jobId, 'completed');
      }

      showSnackbar(`${allJobIds.length} job(s) marked as completed`, 'success');
      setSelectedRouteIds([]);
      await loadData();
    } catch (error) {
      console.error('Failed to batch mark as completed:', error);
      showSnackbar('Failed to batch mark as completed', 'error');
    }
  };

  // ===== Render =====

  const filteredRoutes = getFilteredRoutes();
  const hasConflicts = filteredRoutes.some((r) => r.conflicts.length > 0);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      {/* ===== Header ===== */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Route Optimization
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View, optimize, and manage routes with driver and vehicle assignments
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadData}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* ===== Conflict Warning Banner ===== */}
      {hasConflicts && (
        <Alert
          severity="warning"
          icon={<Warning />}
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setFilterStatus('with_conflicts')}
            >
              View Conflicts
            </Button>
          }
        >
          <strong>{filteredRoutes.filter((r) => r.conflicts.length > 0).length} route(s) have conflicts.</strong> Fix
          them before dispatch to avoid issues.
        </Alert>
      )}

      {/* ===== Filters ===== */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e: SelectChangeEvent) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Routes</MenuItem>
                <MenuItem value="active">Active Routes</MenuItem>
                <MenuItem value="with_conflicts">With Conflicts</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="dispatched">Dispatched</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Driver</InputLabel>
              <Select
                value={filterDriver}
                onChange={(e: SelectChangeEvent) => setFilterDriver(e.target.value)}
                label="Driver"
              >
                <MenuItem value="all">All Drivers</MenuItem>
                <MenuItem value="unassigned">Unassigned</MenuItem>
                {drivers.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {getDriverName(d.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Vehicle</InputLabel>
              <Select
                value={filterVehicle}
                onChange={(e: SelectChangeEvent) => setFilterVehicle(e.target.value)}
                label="Vehicle"
              >
                <MenuItem value="all">All Vehicles</MenuItem>
                <MenuItem value="unassigned">Unassigned</MenuItem>
                {vehicles.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {getVehicleName(v.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search customers, addresses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
                endAdornment: searchTerm && (
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <Clear fontSize="small" />
                  </IconButton>
                ),
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ===== Batch Actions Toolbar ===== */}
      {selectedRouteIds.length > 0 && (
        <Paper
          sx={{
            p: 2,
            mb: 3,
            bgcolor: 'primary.light',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="body1" fontWeight={600}>
            {selectedRouteIds.length} route(s) selected
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<SwapHoriz />}
              onClick={() => setBatchDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              Reassign
            </Button>
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<Done />}
              onClick={handleBatchMarkCompleted}
              sx={{ textTransform: 'none' }}
            >
              Mark Completed
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSelectedRouteIds([])}
              sx={{ textTransform: 'none' }}
            >
              Deselect All
            </Button>
          </Box>
        </Paper>
      )}

      {/* ===== Routes Table ===== */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedRouteIds.length === filteredRoutes.length && filteredRoutes.length > 0}
                  indeterminate={selectedRouteIds.length > 0 && selectedRouteIds.length < filteredRoutes.length}
                  onChange={(e) =>
                    setSelectedRouteIds(e.target.checked ? filteredRoutes.map((r) => r.id) : [])
                  }
                />
              </TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Driver</strong></TableCell>
              <TableCell><strong>Vehicle</strong></TableCell>
              <TableCell><strong>Stops</strong></TableCell>
              <TableCell><strong>Distance</strong></TableCell>
              <TableCell><strong>Conflicts</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRoutes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    No routes found matching the current filters
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRoutes.map((route) => (
                <TableRow
                  key={route.id}
                  hover
                  selected={selectedRouteIds.includes(route.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedRouteIds.includes(route.id)}
                      onChange={() => handleSelectRoute_Checkbox(route.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={route.status} color={getStatusColor(route.status)} size="small" />
                  </TableCell>
                  <TableCell>
                    {route.driverId ? (
                      <Chip
                        icon={<Person />}
                        label={getDriverName(route.driverId)}
                        color="info"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<Warning />}
                        label="Unassigned"
                        color="warning"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {route.vehicleId ? (
                      <Chip
                        icon={<LocalShipping />}
                        label={getVehicleName(route.vehicleId)}
                        color="default"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<Warning />}
                        label="Unassigned"
                        color="warning"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge badgeContent={route.jobs.length} color="primary">
                      <Typography variant="body2">{route.jobs.length} stop(s)</Typography>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {route.totalDistance ? `${route.totalDistance.toFixed(1)} km` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {route.conflicts.length > 0 ? (
                      <Tooltip title={route.conflicts.join(', ')}>
                        <Chip
                          icon={<ErrorOutline />}
                          label={`${route.conflicts.length} issue(s)`}
                          color="error"
                          size="small"
                        />
                      </Tooltip>
                    ) : (
                      <Chip icon={<CheckCircle />} label="OK" color="success" size="small" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View & Edit Stops">
                      <IconButton size="small" color="primary" onClick={() => handleSelectRoute(route)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ===== Edit Route Dialog (Drag-and-Drop Stops) ===== */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Edit Route Stops</Typography>
            {selectedRoute && selectedRoute.conflicts.length > 0 && (
              <Chip
                icon={<Warning />}
                label={`${selectedRoute.conflicts.length} conflict(s)`}
                color="error"
                size="small"
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedRoute && (
            <>
              {/* Route Details */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Driver</InputLabel>
                    <Select
                      value={selectedRoute.driverId || ''}
                      onChange={(e) => handleReassignDriver(selectedRoute.id, e.target.value)}
                      label="Driver"
                    >
                      <MenuItem value="">Unassigned</MenuItem>
                      {drivers
                        .filter((d) => d.status === 'ACTIVE' || d.status === 'available')
                        .map((d) => (
                          <MenuItem key={d.id} value={d.id}>
                            {getDriverName(d.id)}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Vehicle"
                    value={getVehicleName(selectedRoute.vehicleId)}
                    InputProps={{ readOnly: true }}
                    helperText="Vehicle assignment cannot be changed here"
                  />
                </Grid>
              </Grid>

              {/* Conflicts Alert */}
              {selectedRoute.conflicts.length > 0 && (
                <Alert severity="error" icon={<ErrorOutline />} sx={{ mb: 2 }}>
                  <strong>Conflicts:</strong>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                    {selectedRoute.conflicts.map((conflict, idx) => (
                      <li key={idx}>{conflict}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              {/* Drag-and-Drop Stop List */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                <DragIndicator fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                Stops (Drag to reorder)
              </Typography>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="stops">
                  {(provided) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{ mt: 1 }}
                    >
                      {selectedRoute.jobs.length === 0 ? (
                        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
                          <Typography variant="body2" color="text.secondary">
                            No stops in this route
                          </Typography>
                        </Paper>
                      ) : (
                        selectedRoute.jobs.map((job, index) => (
                          <Draggable key={job.id} draggableId={job.id} index={index}>
                            {(provided, snapshot) => (
                              <Paper
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                sx={{
                                  p: 2,
                                  mb: 1,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                                  borderLeft: '4px solid',
                                  borderColor: job.status === 'completed' ? 'success.main' : 'primary.main',
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                                  <DragIndicator sx={{ color: 'text.secondary' }} />
                                  <Typography variant="h6" color="text.secondary">
                                    {index + 1}
                                  </Typography>
                                  <Box>
                                    <Typography variant="body1" fontWeight={600}>
                                      {job.customerName}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {job.deliveryAddress || 'No address'}
                                    </Typography>
                                  </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                  <Chip
                                    label={job.status}
                                    color={getStatusColor(job.status)}
                                    size="small"
                                  />
                                  {job.status !== 'completed' && (
                                    <Tooltip title="Mark as Completed">
                                      <IconButton
                                        size="small"
                                        color="success"
                                        onClick={() => handleMarkJobCompleted(job.id)}
                                      >
                                        <CheckCircle />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </Paper>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </DragDropContext>

              {/* Route Stats */}
              {selectedRoute.totalDistance && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Total Distance
                      </Typography>
                      <Typography variant="h6">{selectedRoute.totalDistance.toFixed(1)} km</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Total Stops
                      </Typography>
                      <Typography variant="h6">{selectedRoute.jobs.length}</Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ===== Batch Reassignment Dialog ===== */}
      <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Batch Reassign {selectedRouteIds.length} Route(s)</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" icon={<InfoIcon />}>
              Assign a new driver to all selected routes at once.
            </Alert>

            <FormControl fullWidth>
              <InputLabel>New Driver</InputLabel>
              <Select
                value={batchDriver}
                onChange={(e: SelectChangeEvent) => setBatchDriver(e.target.value)}
                label="New Driver"
              >
                <MenuItem value="">None (Unassign)</MenuItem>
                {drivers
                  .filter((d) => d.status === 'ACTIVE' || d.status === 'available')
                  .map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {getDriverName(d.id)}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleBatchReassign} disabled={!batchDriver}>
            Reassign
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Snackbar ===== */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
