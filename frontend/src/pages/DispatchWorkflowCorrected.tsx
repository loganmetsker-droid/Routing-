import { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Snackbar,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CheckCircle,
  LocalShipping,
  Route as RouteIcon,
  AutoAwesome,
  PlayArrow,
  Warning,
  Info as InfoIcon,
  Person,
  Assignment,
  Speed,
} from '@mui/icons-material';
import {
  getJobs,
  getVehicles,
  getDrivers,
  generateRoute,
  assignDriverToRoute,
  updateRouteStatus,
} from '../services/api';
import { connectDispatchRealtime } from '../services/socket';

// CORRECTED Workflow: Select Jobs → Select Vehicles → Assign Drivers → Optimize Routes → Dispatch
const steps = ['Select Jobs', 'Select Vehicles', 'Assign Drivers', 'Optimize Routes', 'Dispatch'];

interface DispatchJobCorrected {
  id: string;
  customerName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  status: string;
  priority?: string;
  pickupLocation?: { coordinates?: number[] };
  deliveryLocation?: { coordinates?: number[] };
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
}

interface GeneratedRoute {
  id: string;
  vehicleId: string;
  driverId?: string; // Driver assigned BEFORE optimization
  jobIds?: string[];
  totalDistance?: number;
  totalDuration?: number;
  status: string;
}

export default function DispatchWorkflowCorrected() {
  // Workflow state management
  const [activeStep, setActiveStep] = useState(0);

  // Data state
  const [jobs, setJobs] = useState<DispatchJobCorrected[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [generatedRoutes, setGeneratedRoutes] = useState<GeneratedRoute[]>([]);

  // Selection state
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

  // CORRECTED: Driver assignments happen BEFORE route optimization
  const [vehicleDriverAssignments, setVehicleDriverAssignments] = useState<Record<string, string>>({});

  // UI state
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' | 'warning' });

  // Auto-assignment dialog
  const [autoAssignDialogOpen, setAutoAssignDialogOpen] = useState(false);
  const [suggestedAssignments, setSuggestedAssignments] = useState<Record<string, string>>({});

  // Load data on mount
  useEffect(() => {
    loadAllData();

    // Real-time updates
    const eventSource = connectDispatchRealtime((data) => {
      if (data.type === 'job-created' || data.type === 'job-updated' || data.type === 'route-created') {
        loadAllData();
      }
    });

    return () => eventSource.close();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [jobsData, vehiclesData, driversData] = await Promise.all([
        getJobs(),
        getVehicles(),
        getDrivers(),
      ]);

      setJobs(jobsData as DispatchJobCorrected[]);
      setVehicles(vehiclesData);
      setDrivers(driversData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  // Step 1: Select jobs to dispatch
  const handleToggleJob = (jobId: string) => {
    setSelectedJobIds(prev =>
      prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
    );
  };

  const handleSelectAllJobs = () => {
    const pendingJobs = jobs.filter(j => j.status === 'pending');
    setSelectedJobIds(pendingJobs.map(j => j.id));
  };

  // Step 2: Select vehicles
  const handleToggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds(prev =>
      prev.includes(vehicleId) ? prev.filter(id => id !== vehicleId) : [...prev, vehicleId]
    );
  };

  const handleSelectAllVehicles = () => {
    const available = vehicles.filter(v => v.status === 'AVAILABLE' || v.status === 'available');
    setSelectedVehicleIds(available.map(v => v.id));
  };

  // Step 3: Assign drivers to vehicles (BEFORE optimization)
  const handleAssignDriver = (vehicleId: string, driverId: string) => {
    setVehicleDriverAssignments(prev => ({ ...prev, [vehicleId]: driverId }));
  };

  // Auto-assignment suggestion based on availability
  const handleSuggestAutoAssignment = () => {
    const availableDrivers = drivers.filter(d => d.status === 'ACTIVE');
    const unassignedVehicles = selectedVehicleIds.filter(vId => !vehicleDriverAssignments[vId]);

    if (unassignedVehicles.length === 0) {
      showSnackbar('All vehicles already have drivers assigned', 'info');
      return;
    }

    if (availableDrivers.length === 0) {
      showSnackbar('No available drivers for assignment', 'error');
      return;
    }

    // Simple round-robin assignment suggestion
    const suggestions: Record<string, string> = {};
    unassignedVehicles.forEach((vehicleId, index) => {
      const driverIndex = index % availableDrivers.length;
      suggestions[vehicleId] = availableDrivers[driverIndex].id;
    });

    setSuggestedAssignments(suggestions);
    setAutoAssignDialogOpen(true);
  };

  const handleApplyAutoAssignment = () => {
    setVehicleDriverAssignments(prev => ({ ...prev, ...suggestedAssignments }));
    setAutoAssignDialogOpen(false);
    showSnackbar(`Auto-assigned ${Object.keys(suggestedAssignments).length} driver(s)`, 'success');
  };

  // Validation before moving to optimization step
  const handleProceedToOptimization = () => {
    // Check if all selected vehicles have drivers assigned
    const unassignedVehicles = selectedVehicleIds.filter(vId => !vehicleDriverAssignments[vId]);

    if (unassignedVehicles.length > 0) {
      showSnackbar(`${unassignedVehicles.length} vehicle(s) still need driver assignment`, 'warning');
      return;
    }

    // All vehicles have drivers, proceed to optimization
    setActiveStep(3);
  };

  // Step 4: Optimize routes (drivers already assigned)
  const handleOptimizeRoutes = async () => {
    if (selectedJobIds.length === 0 || selectedVehicleIds.length === 0) {
      showSnackbar('Please select jobs and vehicles', 'error');
      return;
    }

    // Final validation: ensure all vehicles have drivers
    const unassignedVehicles = selectedVehicleIds.filter(vId => !vehicleDriverAssignments[vId]);
    if (unassignedVehicles.length > 0) {
      showSnackbar('Cannot optimize: All vehicles must have drivers assigned first', 'error');
      return;
    }

    setOptimizing(true);
    try {
      const routes: GeneratedRoute[] = [];

      // Distribute jobs evenly across selected vehicles
      const jobsPerVehicle = Math.ceil(selectedJobIds.length / selectedVehicleIds.length);

      for (let i = 0; i < selectedVehicleIds.length; i++) {
        const vehicleId = selectedVehicleIds[i];
        const vehicleJobs = selectedJobIds.slice(i * jobsPerVehicle, (i + 1) * jobsPerVehicle);

        if (vehicleJobs.length === 0) continue;

        // Generate optimized route for this vehicle
        const result = await generateRoute(vehicleId, vehicleJobs);

        // IMPORTANT: Driver is already assigned, add to route
        const driverId = vehicleDriverAssignments[vehicleId];
        routes.push({
          ...result.route,
          driverId, // Driver assignment included in route
        } as GeneratedRoute);

        // Assign driver to the generated route immediately
        if (driverId) {
          await assignDriverToRoute(result.route.id!, driverId);
        }
      }

      setGeneratedRoutes(routes);
      showSnackbar(`Generated ${routes.length} optimized route(s) with drivers assigned`, 'success');
      setActiveStep(4); // Move to dispatch step
    } catch (error) {
      console.error('Failed to optimize routes:', error);
      showSnackbar('Failed to optimize routes', 'error');
    } finally {
      setOptimizing(false);
    }
  };

  // Step 5: Dispatch routes
  const handleDispatchAll = async () => {
    // Final validation before dispatch
    if (generatedRoutes.length === 0) {
      showSnackbar('No routes to dispatch', 'error');
      return;
    }

    // Check that all routes have drivers
    const routesWithoutDrivers = generatedRoutes.filter(r => !r.driverId);
    if (routesWithoutDrivers.length > 0) {
      showSnackbar(`${routesWithoutDrivers.length} route(s) missing driver assignment`, 'error');
      return;
    }

    setDispatching(true);
    try {
      for (const route of generatedRoutes) {
        await updateRouteStatus(route.id, 'in_progress');
      }

      showSnackbar(`Dispatched ${generatedRoutes.length} route(s)`, 'success');

      // Reset workflow after successful dispatch
      setTimeout(() => {
        setActiveStep(0);
        setSelectedJobIds([]);
        setSelectedVehicleIds([]);
        setVehicleDriverAssignments({});
        setGeneratedRoutes([]);
        loadAllData();
      }, 2000);
    } catch (error) {
      console.error('Failed to dispatch routes:', error);
      showSnackbar('Failed to dispatch routes', 'error');
    } finally {
      setDispatching(false);
    }
  };

  const handleNext = () => {
    // Validation based on current step
    if (activeStep === 0 && selectedJobIds.length === 0) {
      showSnackbar('Please select at least one job', 'error');
      return;
    }
    if (activeStep === 1 && selectedVehicleIds.length === 0) {
      showSnackbar('Please select at least one vehicle', 'error');
      return;
    }
    if (activeStep === 2) {
      // Special handling for driver assignment step
      handleProceedToOptimization();
      return;
    }

    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedJobIds([]);
    setSelectedVehicleIds([]);
    setVehicleDriverAssignments({});
    setGeneratedRoutes([]);
  };

  // Helper functions
  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return 'Unknown';
    return `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.licensePlate || 'Vehicle';
  };

  const getDriverName = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return 'Unknown';
    return `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Driver';
  };

  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE' || v.status === 'available');
  const availableDrivers = drivers.filter(d => d.status === 'ACTIVE');

  // Check for unassigned vehicles in driver assignment step
  const unassignedVehiclesCount = selectedVehicleIds.filter(vId => !vehicleDriverAssignments[vId]).length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Dispatch Workflow (Corrected)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Streamlined workflow: Jobs → Vehicles → Drivers → Optimize → Dispatch
        </Typography>
      </Box>

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Stepper activeStep={activeStep}>
          {steps.map((label, index) => (
            <Step key={label} completed={activeStep > index}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      <Box>
        {/* Step 0: Select Jobs */}
        {activeStep === 0 && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight={600}>
                  Select Jobs to Dispatch
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSelectAllJobs}
                  disabled={pendingJobs.length === 0}
                >
                  Select All ({pendingJobs.length})
                </Button>
              </Box>

              {pendingJobs.length === 0 ? (
                <Alert severity="info">No pending jobs available</Alert>
              ) : (
                <FormGroup>
                  {pendingJobs.map((job) => (
                    <FormControlLabel
                      key={job.id}
                      control={
                        <Checkbox
                          checked={selectedJobIds.includes(job.id)}
                          onChange={() => handleToggleJob(job.id)}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body1" fontWeight={600}>
                            {job.customerName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {job.deliveryAddress}
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <Chip label={job.priority || 'normal'} size="small" color="info" />
                          </Box>
                        </Box>
                      }
                      sx={{
                        border: '1px solid',
                        borderColor: selectedJobIds.includes(job.id) ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        p: 2,
                        mb: 1,
                      }}
                    />
                  ))}
                </FormGroup>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button disabled>Back</Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={selectedJobIds.length === 0}
                >
                  Next: Select Vehicles ({selectedJobIds.length} jobs selected)
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Select Vehicles */}
        {activeStep === 1 && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight={600}>
                  Select Vehicles
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSelectAllVehicles}
                  disabled={availableVehicles.length === 0}
                >
                  Select All ({availableVehicles.length})
                </Button>
              </Box>

              <Alert severity="info" sx={{ mb: 3 }}>
                Selected vehicles will be assigned drivers in the next step, then routes will be optimized
              </Alert>

              {availableVehicles.length === 0 ? (
                <Alert severity="warning">No available vehicles</Alert>
              ) : (
                <FormGroup>
                  {availableVehicles.map((vehicle) => (
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
                        p: 2,
                        mb: 1,
                      }}
                    />
                  ))}
                </FormGroup>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button onClick={handleBack}>Back</Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={selectedVehicleIds.length === 0}
                >
                  Next: Assign Drivers ({selectedVehicleIds.length} vehicles selected)
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Assign Drivers (CORRECTED: Before optimization) */}
        {activeStep === 2 && (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Assign Drivers to Vehicles
              </Typography>

              <Alert severity="warning" icon={<InfoIcon />} sx={{ mb: 3 }}>
                <strong>Important:</strong> All vehicles must have drivers assigned before route optimization.
                {unassignedVehiclesCount > 0 && ` ${unassignedVehiclesCount} vehicle(s) still need assignment.`}
              </Alert>

              {unassignedVehiclesCount > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Button
                    variant="outlined"
                    color="info"
                    startIcon={<AutoAwesome />}
                    onClick={handleSuggestAutoAssignment}
                    disabled={availableDrivers.length === 0}
                  >
                    Suggest Auto-Assignment
                  </Button>
                </Box>
              )}

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Vehicle</strong></TableCell>
                      <TableCell><strong>Assign Driver</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedVehicleIds.map((vehicleId) => {
                      const assignedDriverId = vehicleDriverAssignments[vehicleId];
                      const isAssigned = !!assignedDriverId;

                      return (
                        <TableRow key={vehicleId}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LocalShipping color="action" />
                              <Typography>{getVehicleName(vehicleId)}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                              <InputLabel>Select Driver</InputLabel>
                              <Select
                                value={assignedDriverId || ''}
                                onChange={(e) => handleAssignDriver(vehicleId, e.target.value)}
                                label="Select Driver"
                              >
                                <MenuItem value="">
                                  <em>None</em>
                                </MenuItem>
                                {availableDrivers.map((driver) => (
                                  <MenuItem key={driver.id} value={driver.id}>
                                    {getDriverName(driver.id)}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            {isAssigned ? (
                              <Chip
                                label="Assigned"
                                color="success"
                                size="small"
                                icon={<CheckCircle />}
                              />
                            ) : (
                              <Chip
                                label="Unassigned"
                                color="warning"
                                size="small"
                                icon={<Warning />}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button onClick={handleBack}>Back</Button>
                <Button
                  variant="contained"
                  onClick={handleProceedToOptimization}
                  disabled={unassignedVehiclesCount > 0}
                  startIcon={unassignedVehiclesCount > 0 ? <Warning /> : <CheckCircle />}
                >
                  {unassignedVehiclesCount > 0
                    ? `Assign ${unassignedVehiclesCount} More Driver(s)`
                    : 'Next: Optimize Routes'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Optimize Routes */}
        {activeStep === 3 && (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Route Optimization
              </Typography>

              <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 3 }}>
                All vehicles have drivers assigned. Ready to optimize routes!
              </Alert>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <Typography color="white" variant="subtitle2" gutterBottom>
                      Selected Jobs
                    </Typography>
                    <Typography variant="h3" color="white" fontWeight={700}>
                      {selectedJobIds.length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                    <Typography color="white" variant="subtitle2" gutterBottom>
                      Vehicles with Drivers
                    </Typography>
                    <Typography variant="h3" color="white" fontWeight={700}>
                      {selectedVehicleIds.length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
                    <Typography color="white" variant="subtitle2" gutterBottom>
                      Drivers Assigned
                    </Typography>
                    <Typography variant="h3" color="white" fontWeight={700}>
                      {Object.keys(vehicleDriverAssignments).length}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={optimizing ? <CircularProgress size={20} color="inherit" /> : <Speed />}
                onClick={handleOptimizeRoutes}
                disabled={optimizing}
                sx={{ py: 2, fontSize: '1.1rem' }}
              >
                {optimizing ? 'Optimizing Routes...' : 'Generate Optimized Routes'}
              </Button>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button onClick={handleBack} disabled={optimizing}>
                  Back
                </Button>
                <Button onClick={handleReset} color="error" disabled={optimizing}>
                  Cancel Workflow
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Dispatch */}
        {activeStep === 4 && (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Ready to Dispatch
              </Typography>

              <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 3 }}>
                All routes optimized with drivers assigned. Ready to dispatch!
              </Alert>

              <List>
                {generatedRoutes.map((route, index) => (
                  <ListItem
                    key={route.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <ListItemIcon>
                      <Badge badgeContent={route.jobIds ? route.jobIds.length : 0} color="primary">
                        <RouteIcon color="primary" />
                      </Badge>
                    </ListItemIcon>
                    <ListItemText
                      primary={`Route ${index + 1}`}
                      secondary={
                        <>
                          <Typography variant="body2" component="span">
                            <strong>Driver:</strong> {route.driverId ? getDriverName(route.driverId) : 'Not Assigned'}
                          </Typography>
                          <br />
                          <Typography variant="body2" component="span">
                            <strong>Vehicle:</strong> {getVehicleName(route.vehicleId)}
                          </Typography>
                          <br />
                          <Typography variant="body2" component="span">
                            <strong>Stops:</strong> {route.jobIds ? route.jobIds.length : 0}
                            {route.totalDistance && ` • ${route.totalDistance.toFixed(1)} km`}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>

              <Button
                fullWidth
                variant="contained"
                color="success"
                size="large"
                startIcon={dispatching ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
                onClick={handleDispatchAll}
                disabled={dispatching}
                sx={{ mt: 3, py: 2, fontSize: '1.1rem' }}
              >
                {dispatching ? 'Dispatching...' : `Dispatch ${generatedRoutes.length} Route(s)`}
              </Button>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button onClick={handleBack} disabled={dispatching}>
                  Back
                </Button>
                <Button onClick={handleReset} color="error" disabled={dispatching}>
                  Cancel
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Auto-Assignment Dialog */}
      <Dialog open={autoAssignDialogOpen} onClose={() => setAutoAssignDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome color="primary" />
            Auto-Assignment Suggestions
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Based on driver availability, we suggest the following assignments:
          </Alert>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Vehicle</strong></TableCell>
                  <TableCell><strong>Suggested Driver</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(suggestedAssignments).map(([vehicleId, driverId]) => (
                  <TableRow key={vehicleId}>
                    <TableCell>{getVehicleName(vehicleId)}</TableCell>
                    <TableCell>
                      <Chip
                        label={getDriverName(driverId)}
                        color="info"
                        icon={<Person />}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoAssignDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleApplyAutoAssignment}
            startIcon={<Assignment />}
          >
            Apply Suggestions
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
