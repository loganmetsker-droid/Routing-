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
  FormControlLabel,
  Checkbox,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  AlertTitle,
} from '@mui/material';
import {
  Route as RouteIcon,
  AutoAwesome,
  PlayArrow,
  ArrowBack,
  AutoFixHigh,
} from '@mui/icons-material';
import {
  getJobs,
  getVehicles,
  getDrivers,
  generateRoute,
  assignDriverToRoute,
  updateRouteStatus,
  connectSSE,
} from '../services/api';

// Workflow: Select Jobs → Select Vehicles → Assign Drivers → Optimize Routes → Dispatch
const steps = ['Select Jobs', 'Select Vehicles', 'Assign Drivers', 'Optimize Routes', 'Dispatch'];

interface DispatchJob {
  id: string;
  customerName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  status: string;
  priority?: string;
  estimatedDistance?: number;
  estimatedDuration?: number;
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
  maxHours?: number;
  currentHours?: number;
}

interface GeneratedRoute {
  id: string;
  vehicleId: string;
  driverId?: string;
  jobIds?: string[];
  totalDistance?: number;
  totalDuration?: number;
  status: string;
}

interface WorkflowState {
  activeStep: number;
  selectedJobIds: string[];
  selectedVehicleIds: string[];
  vehicleDriverAssignments: Record<string, string>;
  generatedRoutes: GeneratedRoute[];
}

// Session storage key
const WORKFLOW_STORAGE_KEY = 'dispatchWorkflowState';

export default function DispatchWorkflowEnhanced() {
  // Initialize state from sessionStorage
  const [workflowState, setWorkflowState] = useState<WorkflowState>(() => {
    const saved = sessionStorage.getItem(WORKFLOW_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          activeStep: 0,
          selectedJobIds: [],
          selectedVehicleIds: [],
          vehicleDriverAssignments: {},
          generatedRoutes: [],
        };
      }
    }
    return {
      activeStep: 0,
      selectedJobIds: [],
      selectedVehicleIds: [],
      vehicleDriverAssignments: {},
      generatedRoutes: [],
    };
  });

  // Data state
  const [jobs, setJobs] = useState<DispatchJob[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Save workflow state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflowState));
  }, [workflowState]);

  // Load data on mount
  useEffect(() => {
    loadAllData();

    const eventSource = connectSSE((data) => {
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

      setJobs((jobsData.jobs || []) as DispatchJob[]);
      setVehicles(vehiclesData.vehicles || []);
      setDrivers(driversData.drivers || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setSnackbarMessage('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Update workflow state helper
  const updateWorkflow = (updates: Partial<WorkflowState>) => {
    setWorkflowState((prev) => ({ ...prev, ...updates }));
  };

  // Calculate preview metrics
  const selectedJobs = jobs.filter((j) => workflowState.selectedJobIds.includes(j.id));
  const estimatedDistance = selectedJobs.reduce((acc, job) => acc + (job.estimatedDistance || 5), 0);
  const estimatedDuration = selectedJobs.reduce((acc, job) => acc + (job.estimatedDuration || 30), 0);
  const avgJobsPerVehicle = workflowState.selectedVehicleIds.length > 0
    ? Math.ceil(workflowState.selectedJobIds.length / workflowState.selectedVehicleIds.length)
    : 0;

  // Calculate warnings
  const warnings: string[] = [];

  if (workflowState.selectedJobIds.length > 0 && workflowState.selectedVehicleIds.length === 0) {
    warnings.push('No vehicles selected');
  }

  if (workflowState.selectedVehicleIds.length > 0) {
    const unassignedCount = workflowState.selectedVehicleIds.filter(
      (vId) => !workflowState.vehicleDriverAssignments[vId]
    ).length;
    if (unassignedCount > 0 && workflowState.activeStep >= 2) {
      warnings.push(`${unassignedCount} vehicles need driver assignment`);
    }
  }

  // Calculate driver workload
  const driverWorkload = Object.entries(workflowState.vehicleDriverAssignments).reduce((acc, [vehicleId, driverId]) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return acc;

    if (!acc[driverId]) {
      acc[driverId] = {
        driver,
        vehicleCount: 0,
        estimatedHours: 0,
      };
    }

    acc[driverId].vehicleCount += 1;
    // Estimate hours based on jobs assigned to this vehicle
    const vehicleIndex = workflowState.selectedVehicleIds.indexOf(vehicleId);
    if (vehicleIndex !== -1) {
      const jobsForVehicle = Math.ceil(workflowState.selectedJobIds.length / workflowState.selectedVehicleIds.length);
      acc[driverId].estimatedHours += (jobsForVehicle * 0.5); // Rough estimate: 30 min per job
    }

    return acc;
  }, {} as Record<string, { driver: Driver; vehicleCount: number; estimatedHours: number }>);

  // Check for overtime
  Object.values(driverWorkload).forEach((workload) => {
    const maxHours = workload.driver.maxHours || 8;
    const currentHours = workload.driver.currentHours || 0;
    if (currentHours + workload.estimatedHours > maxHours) {
      warnings.push(
        `${workload.driver.firstName} ${workload.driver.lastName} may exceed ${maxHours}hr limit`
      );
    }
  });

  // Step navigation with Back button support
  const handleNext = () => {
    if (workflowState.activeStep === 2) {
      // Validate driver assignments before proceeding
      const unassigned = workflowState.selectedVehicleIds.filter(
        (vId) => !workflowState.vehicleDriverAssignments[vId]
      );
      if (unassigned.length > 0) {
        setSnackbarMessage(`${unassigned.length} vehicles need driver assignment`);
        return;
      }
    }
    updateWorkflow({ activeStep: workflowState.activeStep + 1 });
  };

  const handleBack = () => {
    updateWorkflow({ activeStep: Math.max(0, workflowState.activeStep - 1) });
  };

  const handleReset = () => {
    sessionStorage.removeItem(WORKFLOW_STORAGE_KEY);
    setWorkflowState({
      activeStep: 0,
      selectedJobIds: [],
      selectedVehicleIds: [],
      vehicleDriverAssignments: {},
      generatedRoutes: [],
    });
    setSnackbarMessage('Workflow reset');
  };

  // Auto-assign drivers evenly
  const handleAutoAssign = () => {
    const availableDrivers = drivers.filter((d) => d.status === 'ACTIVE');
    const assignments: Record<string, string> = {};

    workflowState.selectedVehicleIds.forEach((vehicleId, index) => {
      const driverIndex = index % availableDrivers.length;
      assignments[vehicleId] = availableDrivers[driverIndex].id;
    });

    updateWorkflow({ vehicleDriverAssignments: assignments });
    setSnackbarMessage(`Auto-assigned ${Object.keys(assignments).length} drivers (equal distribution)`);
  };

  // Optimize routes
  const handleOptimizeRoutes = async () => {
    if (workflowState.selectedJobIds.length === 0 || workflowState.selectedVehicleIds.length === 0) {
      setSnackbarMessage('Please select jobs and vehicles');
      return;
    }

    setOptimizing(true);
    try {
      const routes: GeneratedRoute[] = [];
      const jobsPerVehicle = Math.ceil(workflowState.selectedJobIds.length / workflowState.selectedVehicleIds.length);

      for (let i = 0; i < workflowState.selectedVehicleIds.length; i++) {
        const vehicleId = workflowState.selectedVehicleIds[i];
        const vehicleJobs = workflowState.selectedJobIds.slice(i * jobsPerVehicle, (i + 1) * jobsPerVehicle);

        if (vehicleJobs.length === 0) continue;

        const result = await generateRoute(vehicleId, vehicleJobs);
        const driverId = workflowState.vehicleDriverAssignments[vehicleId];

        routes.push({
          ...result.route,
          driverId,
        } as GeneratedRoute);

        if (driverId) {
          await assignDriverToRoute(result.route.id!, driverId);
        }
      }

      updateWorkflow({ generatedRoutes: routes, activeStep: 4 });
      setSnackbarMessage(`Generated ${routes.length} optimized routes`);
    } catch (error) {
      console.error('Failed to optimize routes:', error);
      setSnackbarMessage('Failed to optimize routes');
    } finally {
      setOptimizing(false);
    }
  };

  // Dispatch all routes
  const handleDispatchAll = async () => {
    if (workflowState.generatedRoutes.length === 0) {
      setSnackbarMessage('No routes to dispatch');
      return;
    }

    setDispatching(true);
    try {
      await Promise.all(
        workflowState.generatedRoutes.map((route) =>
          updateRouteStatus(route.id, 'dispatched')
        )
      );

      setSnackbarMessage(`Dispatched ${workflowState.generatedRoutes.length} routes successfully!`);

      // Clear workflow after successful dispatch
      sessionStorage.removeItem(WORKFLOW_STORAGE_KEY);
      setWorkflowState({
        activeStep: 0,
        selectedJobIds: [],
        selectedVehicleIds: [],
        vehicleDriverAssignments: {},
        generatedRoutes: [],
      });

      loadAllData();
    } catch (error) {
      console.error('Failed to dispatch routes:', error);
      setSnackbarMessage('Failed to dispatch routes');
    } finally {
      setDispatching(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const availableVehicles = vehicles.filter((v) => v.status === 'AVAILABLE' || v.status === 'available');
  const availableDrivers = drivers.filter((d) => d.status === 'ACTIVE');

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Dispatch Workflow (Corrected)</Typography>
          <Typography variant="body2" color="text.secondary">
            Streamlined workflow: Jobs → Vehicles → Drivers → Optimize → Dispatch
          </Typography>
        </Box>
        <Button variant="outlined" color="warning" onClick={handleReset}>
          Reset Workflow
        </Button>
      </Box>

      {/* Progress persisted notification */}
      {workflowState.activeStep > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Progress saved. You can safely navigate away and return later.
        </Alert>
      )}

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={workflowState.activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Preview Metrics (show after step 0) */}
      {workflowState.activeStep > 0 && workflowState.selectedJobIds.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50', border: 1, borderColor: 'primary.200' }}>
          <Typography variant="h6" gutterBottom>
            Selection Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Jobs Selected
                </Typography>
                <Typography variant="h4">{workflowState.selectedJobIds.length}</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Est. Distance
                </Typography>
                <Typography variant="h4">{estimatedDistance.toFixed(1)} mi</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Est. Duration
                </Typography>
                <Typography variant="h4">{(estimatedDuration / 60).toFixed(1)} hrs</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Avg Jobs/Vehicle
                </Typography>
                <Typography variant="h4">{avgJobsPerVehicle}</Typography>
              </Box>
            </Grid>
          </Grid>

          {warnings.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <AlertTitle>Warnings:</AlertTitle>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}
        </Paper>
      )}

      {/* Step Content */}
      <Paper sx={{ p: 3 }}>
        {/* Step 0: Select Jobs */}
        {workflowState.activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Jobs to Dispatch
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => updateWorkflow({ selectedJobIds: pendingJobs.map((j) => j.id) })}
              sx={{ mb: 2 }}
            >
              Select All ({pendingJobs.length})
            </Button>

            <Grid container spacing={2}>
              {pendingJobs.map((job) => (
                <Grid item xs={12} md={6} key={job.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={workflowState.selectedJobIds.includes(job.id)}
                            onChange={() => {
                              const isSelected = workflowState.selectedJobIds.includes(job.id);
                              updateWorkflow({
                                selectedJobIds: isSelected
                                  ? workflowState.selectedJobIds.filter((id) => id !== job.id)
                                  : [...workflowState.selectedJobIds, job.id],
                              });
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="subtitle1">{job.customerName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {job.deliveryAddress}
                            </Typography>
                            <Chip label={job.priority || 'normal'} size="small" sx={{ mt: 0.5 }} />
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {pendingJobs.length === 0 && (
              <Alert severity="info">No pending jobs available for dispatch</Alert>
            )}
          </Box>
        )}

        {/* Step 1: Select Vehicles */}
        {workflowState.activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Vehicles
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Selected vehicles will be assigned drivers in the next step, then routes will be optimized
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => updateWorkflow({ selectedVehicleIds: availableVehicles.map((v) => v.id) })}
              sx={{ mb: 2 }}
            >
              Select All ({availableVehicles.length})
            </Button>

            <Grid container spacing={2}>
              {availableVehicles.map((vehicle) => (
                <Grid item xs={12} md={4} key={vehicle.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={workflowState.selectedVehicleIds.includes(vehicle.id)}
                            onChange={() => {
                              const isSelected = workflowState.selectedVehicleIds.includes(vehicle.id);
                              updateWorkflow({
                                selectedVehicleIds: isSelected
                                  ? workflowState.selectedVehicleIds.filter((id) => id !== vehicle.id)
                                  : [...workflowState.selectedVehicleIds, vehicle.id],
                              });
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="subtitle1">
                              {vehicle.make} {vehicle.model}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {vehicle.licensePlate}
                            </Typography>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {availableVehicles.length === 0 && (
              <Alert severity="warning">No available vehicles</Alert>
            )}
          </Box>
        )}

        {/* Step 2: Assign Drivers */}
        {workflowState.activeStep === 2 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Assign Drivers to Vehicles</Typography>
              <Button
                variant="contained"
                startIcon={<AutoFixHigh />}
                onClick={handleAutoAssign}
                disabled={availableDrivers.length === 0}
              >
                Auto-Assign (Equal Distribution)
              </Button>
            </Box>

            {/* Driver Workload Visualization */}
            {Object.keys(driverWorkload).length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Driver Workload Distribution
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(driverWorkload).map(([driverId, workload]) => {
                    const maxHours = workload.driver.maxHours || 8;
                    const currentHours = workload.driver.currentHours || 0;
                    const totalHours = currentHours + workload.estimatedHours;
                    const workloadPercent = (totalHours / maxHours) * 100;

                    return (
                      <Grid item xs={12} md={6} key={driverId}>
                        <Card>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography>
                                {workload.driver.firstName} {workload.driver.lastName}
                              </Typography>
                              <Chip
                                label={`${workload.vehicleCount} vehicle(s)`}
                                color={
                                  workloadPercent > 100
                                    ? 'error'
                                    : workloadPercent > 90
                                    ? 'warning'
                                    : 'success'
                                }
                                size="small"
                              />
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(workloadPercent, 100)}
                              color={
                                workloadPercent > 100
                                  ? 'error'
                                  : workloadPercent > 90
                                  ? 'warning'
                                  : 'success'
                              }
                            />
                            <Typography variant="caption" color="text.secondary">
                              {totalHours.toFixed(1)} hrs / {maxHours} hrs
                            </Typography>
                            {workloadPercent > 100 && (
                              <Alert severity="error" sx={{ mt: 1 }}>
                                Overtime: {(workloadPercent - 100).toFixed(0)}% over capacity
                              </Alert>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}

            {/* Vehicle-Driver Assignment Grid */}
            <Grid container spacing={2}>
              {workflowState.selectedVehicleIds.map((vehicleId) => {
                const vehicle = vehicles.find((v) => v.id === vehicleId);
                const assignedDriverId = workflowState.vehicleDriverAssignments[vehicleId];

                return (
                  <Grid item xs={12} md={6} key={vehicleId}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom>
                          {vehicle?.make} {vehicle?.model}
                        </Typography>
                        <FormControl fullWidth size="small">
                          <InputLabel>Assign Driver</InputLabel>
                          <Select
                            value={assignedDriverId || ''}
                            onChange={(e) => {
                              const newAssignments = { ...workflowState.vehicleDriverAssignments };
                              if (e.target.value) {
                                newAssignments[vehicleId] = e.target.value;
                              } else {
                                delete newAssignments[vehicleId];
                              }
                              updateWorkflow({ vehicleDriverAssignments: newAssignments });
                            }}
                            label="Assign Driver"
                          >
                            <MenuItem value="">
                              <em>None</em>
                            </MenuItem>
                            {availableDrivers.map((driver) => (
                              <MenuItem key={driver.id} value={driver.id}>
                                {driver.firstName} {driver.lastName}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* Step 3: Optimize Routes */}
        {workflowState.activeStep === 3 && (
          <Box textAlign="center" py={4}>
            <RouteIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Ready to Optimize Routes
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {workflowState.selectedJobIds.length} jobs will be optimized across{' '}
              {workflowState.selectedVehicleIds.length} vehicles with drivers assigned
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={optimizing ? <CircularProgress size={20} /> : <AutoAwesome />}
              onClick={handleOptimizeRoutes}
              disabled={optimizing}
            >
              {optimizing ? 'Optimizing...' : 'Optimize Routes'}
            </Button>
          </Box>
        )}

        {/* Step 4: Dispatch */}
        {workflowState.activeStep === 4 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Dispatch Routes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {workflowState.generatedRoutes.length} optimized route(s) ready for dispatch
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              {workflowState.generatedRoutes.map((route, index) => {
                const vehicle = vehicles.find((v) => v.id === route.vehicleId);
                const driver = drivers.find((d) => d.id === route.driverId);

                return (
                  <Grid item xs={12} md={6} key={route.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6">Route {index + 1}</Typography>
                        <Box sx={{ mt: 2 }}>
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
                            <strong>Distance:</strong> {route.totalDistance?.toFixed(1)} km
                          </Typography>
                          <Typography variant="body2">
                            <strong>Duration:</strong> {route.totalDuration?.toFixed(0)} min
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            <Box textAlign="center">
              <Button
                variant="contained"
                size="large"
                color="success"
                startIcon={dispatching ? <CircularProgress size={20} /> : <PlayArrow />}
                onClick={handleDispatchAll}
                disabled={dispatching}
              >
                {dispatching ? 'Dispatching...' : `Dispatch All ${workflowState.generatedRoutes.length} Routes`}
              </Button>
            </Box>
          </Box>
        )}

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={handleBack}
            disabled={workflowState.activeStep === 0}
          >
            Back
          </Button>
          {workflowState.activeStep < 3 && (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={
                (workflowState.activeStep === 0 && workflowState.selectedJobIds.length === 0) ||
                (workflowState.activeStep === 1 && workflowState.selectedVehicleIds.length === 0)
              }
            >
              Next: {steps[workflowState.activeStep + 1]}
            </Button>
          )}
        </Box>
      </Paper>

      {/* Snackbar */}
      {snackbarMessage && (
        <Alert severity="info" sx={{ mt: 2 }} onClose={() => setSnackbarMessage('')}>
          {snackbarMessage}
        </Alert>
      )}
    </Box>
  );
}
