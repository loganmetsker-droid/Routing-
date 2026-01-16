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
} from '@mui/material';
import {
  CheckCircle,
  LocalShipping,
  Route as RouteIcon,
  AutoAwesome,
  PlayArrow,
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

// Workflow steps: Select Jobs → Select Vehicles → Auto-Optimize → Assign Drivers → Dispatch
const steps = ['Select Jobs', 'Select Vehicles', 'Optimize Routes', 'Assign Drivers', 'Dispatch'];

interface DispatchJob {
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
  jobIds?: string[];
  totalDistance?: number;
  totalDuration?: number;
  status: string;
}

export default function DispatchWorkflowPage() {
  // Workflow state management
  const [activeStep, setActiveStep] = useState(0);

  // Data state
  const [jobs, setJobs] = useState<DispatchJob[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [generatedRoutes, setGeneratedRoutes] = useState<GeneratedRoute[]>([]);

  // Selection state
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [driverAssignments, setDriverAssignments] = useState<Record<string, string>>({});

  // UI state
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });

  // Load data on mount
  useEffect(() => {
    loadAllData();

    // Real-time updates
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

      setJobs(jobsData as DispatchJob[]);
      setVehicles(vehiclesData);
      setDrivers(driversData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
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

  // Step 3: Auto-optimize routes
  const handleOptimizeRoutes = async () => {
    if (selectedJobIds.length === 0 || selectedVehicleIds.length === 0) {
      showSnackbar('Please select jobs and vehicles', 'error');
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
        routes.push(result.route as GeneratedRoute);
      }

      setGeneratedRoutes(routes);
      showSnackbar(`Generated ${routes.length} optimized route(s)`, 'success');
      setActiveStep(3); // Move to driver assignment step
    } catch (error) {
      console.error('Failed to optimize routes:', error);
      showSnackbar('Failed to optimize routes', 'error');
    } finally {
      setOptimizing(false);
    }
  };

  // Step 4: Assign drivers to routes
  const handleAssignDriver = (routeId: string, driverId: string) => {
    setDriverAssignments(prev => ({ ...prev, [routeId]: driverId }));
  };

  const handleConfirmDriverAssignments = async () => {
    try {
      // Assign drivers to all routes
      for (const route of generatedRoutes) {
        const driverId = driverAssignments[route.id];
        if (driverId) {
          await assignDriverToRoute(route.id, driverId);
        }
      }

      showSnackbar('Drivers assigned to routes', 'success');
      setActiveStep(4); // Move to dispatch step
    } catch (error) {
      console.error('Failed to assign drivers:', error);
      showSnackbar('Failed to assign drivers', 'error');
    }
  };

  // Step 5: Dispatch routes
  const handleDispatchAll = async () => {
    setDispatching(true);
    try {
      for (const route of generatedRoutes) {
        await updateRouteStatus(route.id, 'dispatched');
      }

      showSnackbar(`Dispatched ${generatedRoutes.length} route(s)`, 'success');

      // Reset workflow after successful dispatch
      setTimeout(() => {
        setActiveStep(0);
        setSelectedJobIds([]);
        setSelectedVehicleIds([]);
        setGeneratedRoutes([]);
        setDriverAssignments({});
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
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedJobIds([]);
    setSelectedVehicleIds([]);
    setGeneratedRoutes([]);
    setDriverAssignments({});
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
          Dispatch Workflow
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Streamlined workflow: Select jobs → Select vehicles → Optimize routes → Assign drivers → Dispatch
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
              <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
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
                            <Chip label={job.priority} size="small" color="info" />
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
                Selected vehicles will be assigned optimized routes with {selectedJobIds.length} job(s)
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
                  Next: Optimize Routes ({selectedVehicleIds.length} vehicles selected)
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Optimize Routes */}
        {activeStep === 2 && (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Route Optimization
              </Typography>

              <Alert severity="success" icon={<AutoAwesome />} sx={{ mb: 3 }}>
                Ready to generate {selectedVehicleIds.length} optimized route(s) for {selectedJobIds.length} job(s)
              </Alert>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <Typography color="white" variant="subtitle2" gutterBottom>
                      Selected Jobs
                    </Typography>
                    <Typography variant="h3" color="white" fontWeight={700}>
                      {selectedJobIds.length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                    <Typography color="white" variant="subtitle2" gutterBottom>
                      Selected Vehicles
                    </Typography>
                    <Typography variant="h3" color="white" fontWeight={700}>
                      {selectedVehicleIds.length}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={optimizing ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}
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
                <Button onClick={handleReset} color="error">
                  Cancel Workflow
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Assign Drivers */}
        {activeStep === 3 && (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Assign Drivers to Routes
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                Assign a driver to each route before dispatching
              </Alert>

              {generatedRoutes.length === 0 ? (
                <Alert severity="warning">No routes generated</Alert>
              ) : (
                <Grid container spacing={2}>
                  {generatedRoutes.map((route, index) => (
                    <Grid item xs={12} key={route.id}>
                      <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box>
                            <Typography variant="subtitle1" fontWeight={600}>
                              Route {index + 1}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <LocalShipping fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                              {getVehicleName(route.vehicleId)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <RouteIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                              {route.jobIds ? route.jobIds.length : 0} stop(s)
                              {route.totalDistance && ` • ${route.totalDistance.toFixed(1)} km`}
                            </Typography>
                          </Box>
                          <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel>Assign Driver</InputLabel>
                            <Select
                              value={driverAssignments[route.id] || ''}
                              onChange={(e) => handleAssignDriver(route.id, e.target.value)}
                              label="Assign Driver"
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
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button onClick={handleBack}>Back</Button>
                <Button
                  variant="contained"
                  onClick={handleConfirmDriverAssignments}
                  disabled={generatedRoutes.some(r => !driverAssignments[r.id])}
                >
                  Next: Review & Dispatch
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
                All routes have been optimized and drivers assigned. Ready to dispatch!
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
                            <strong>Driver:</strong> {getDriverName(driverAssignments[route.id])}
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

      {/* Snackbar for notifications */}
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
