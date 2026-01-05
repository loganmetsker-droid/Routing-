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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Tooltip,
} from '@mui/material';
import {
  Add,
  LocalShipping,
  Person,
  Route as RouteIcon,
  Map,
  CheckCircle,
  Warning,
  Schedule,
  SwapHoriz,
  PlayArrow,
  Stop,
} from '@mui/icons-material';
import { useDrivers, useVehicles } from '../graphql/hooks';

export default function DispatchesPage() {
  const [tab, setTab] = useState(0);
  const [createRouteOpen, setCreateRouteOpen] = useState(false);
  const [assignmentStep, setAssignmentStep] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { drivers, loading: driversLoading } = useDrivers();
  const { vehicles, loading: vehiclesLoading } = useVehicles();

  // Mock jobs data for now
  useEffect(() => {
    setJobs([
      {
        id: 'job-1',
        customerName: 'Acme Corp',
        pickupAddress: '123 Main St, San Francisco, CA',
        deliveryAddress: '456 Market St, San Francisco, CA',
        status: 'pending',
        priority: 'high',
        timeWindowStart: '09:00',
        timeWindowEnd: '12:00',
        weight: 50,
        volume: 2.5,
      },
      {
        id: 'job-2',
        customerName: 'Tech Solutions',
        pickupAddress: '789 Oak Ave, Oakland, CA',
        deliveryAddress: '321 Pine St, Berkeley, CA',
        status: 'pending',
        priority: 'normal',
        timeWindowStart: '13:00',
        timeWindowEnd: '16:00',
        weight: 30,
        volume: 1.8,
      },
      {
        id: 'job-3',
        customerName: 'Global Services',
        pickupAddress: '555 Broadway, San Jose, CA',
        deliveryAddress: '888 First St, Palo Alto, CA',
        status: 'pending',
        priority: 'urgent',
        timeWindowStart: '08:00',
        timeWindowEnd: '10:00',
        weight: 75,
        volume: 3.2,
      },
    ]);
  }, []);

  const handleCreateRoute = async () => {
    if (!selectedVehicle || !selectedDriver || selectedJobs.length === 0) {
      return;
    }

    setLoading(true);

    // Simulate API call
    const newRoute = {
      id: `route-${Date.now()}`,
      vehicleId: selectedVehicle,
      driverId: selectedDriver,
      jobIds: selectedJobs,
      status: 'planned',
      totalDistanceKm: 25.4,
      totalDurationMinutes: 145,
      jobCount: selectedJobs.length,
      createdAt: new Date().toISOString(),
    };

    setTimeout(() => {
      setRoutes([...routes, newRoute]);
      setCreateRouteOpen(false);
      setSelectedVehicle('');
      setSelectedDriver('');
      setSelectedJobs([]);
      setAssignmentStep(0);
      setLoading(false);
    }, 1500);
  };

  const toggleJobSelection = (jobId: string) => {
    if (selectedJobs.includes(jobId)) {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    } else {
      setSelectedJobs([...selectedJobs, jobId]);
    }
  };

  const steps = ['Select Vehicle', 'Assign Driver', 'Choose Jobs', 'Review & Create'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'primary';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Route Dispatch
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateRouteOpen(true)}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Create New Route
        </Button>
      </Box>

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
          <Tab label="All Routes" sx={{ textTransform: 'none' }} />
          <Tab label="Pending Jobs" sx={{ textTransform: 'none' }} />
          <Tab label="Completed Routes" sx={{ textTransform: 'none' }} />
        </Tabs>
      </Paper>

      {/* Routes List */}
      {tab === 0 && (
        <Grid container spacing={2}>
          {routes.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">
                No routes created yet. Click "Create New Route" to get started!
              </Alert>
            </Grid>
          ) : (
            routes.map((route) => {
              const vehicle = vehicles?.find((v: any) => v.id === route.vehicleId);
              const driver = drivers?.find((d: any) => d.id === route.driverId);

              return (
                <Grid item xs={12} md={6} key={route.id}>
                  <Card sx={{ borderLeft: 4, borderColor: getStatusColor(route.status) + '.main' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" fontWeight={600}>
                          Route #{route.id.slice(-6)}
                        </Typography>
                        <Chip
                          label={route.status}
                          color={getStatusColor(route.status) as any}
                          size="small"
                        />
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <LocalShipping sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {vehicle?.make} {vehicle?.model}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Person sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {driver?.firstName} {driver?.lastName}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Jobs: {route.jobCount}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Distance: {route.totalDistanceKm} km
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Duration: {Math.floor(route.totalDurationMinutes / 60)}h {route.totalDurationMinutes % 60}m
                          </Typography>
                        </Grid>
                      </Grid>

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
              );
            })
          )}
        </Grid>
      )}

      {/* Pending Jobs */}
      {tab === 1 && (
        <Paper>
          <List>
            {jobs.filter(j => j.status === 'pending').map((job) => (
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
            ))}
          </List>
        </Paper>
      )}

      {/* Create Route Dialog */}
      <Dialog
        open={createRouteOpen}
        onClose={() => setCreateRouteOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Optimized Route</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Stepper activeStep={assignmentStep} sx={{ mb: 3 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Step 1: Select Vehicle */}
            {assignmentStep === 0 && (
              <FormControl fullWidth>
                <InputLabel>Select Vehicle</InputLabel>
                <Select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  label="Select Vehicle"
                >
                  {vehiclesLoading ? (
                    <MenuItem disabled>Loading vehicles...</MenuItem>
                  ) : (
                    vehicles?.filter((v: any) => v.status === 'AVAILABLE').map((vehicle: any) => (
                      <MenuItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.make} {vehicle.model} ({vehicle.licensePlate}) - Capacity: {vehicle.capacityWeightKg || 1000}kg
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            )}

            {/* Step 2: Assign Driver */}
            {assignmentStep === 1 && (
              <FormControl fullWidth>
                <InputLabel>Assign Driver</InputLabel>
                <Select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  label="Assign Driver"
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
            )}

            {/* Step 3: Choose Jobs */}
            {assignmentStep === 2 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Select jobs to include in this route:
                </Typography>
                <List>
                  {jobs.filter(j => j.status === 'pending').map((job) => (
                    <ListItem
                      key={job.id}
                      button
                      selected={selectedJobs.includes(job.id)}
                      onClick={() => toggleJobSelection(job.id)}
                    >
                      <ListItemIcon>
                        {selectedJobs.includes(job.id) ? (
                          <CheckCircle color="success" />
                        ) : (
                          <Map color="disabled" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={job.customerName}
                        secondary={`${job.pickupAddress} → ${job.deliveryAddress}`}
                      />
                      <Chip
                        label={job.priority}
                        color={getPriorityColor(job.priority) as any}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Step 4: Review */}
            {assignmentStep === 3 && (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>
                  Route ready to create! Review the details below.
                </Alert>
                <Typography variant="subtitle2" gutterBottom>Vehicle:</Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {vehicles?.find((v: any) => v.id === selectedVehicle)?.make}{' '}
                  {vehicles?.find((v: any) => v.id === selectedVehicle)?.model}
                </Typography>

                <Typography variant="subtitle2" gutterBottom>Driver:</Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {drivers?.find((d: any) => d.id === selectedDriver)?.firstName}{' '}
                  {drivers?.find((d: any) => d.id === selectedDriver)?.lastName}
                </Typography>

                <Typography variant="subtitle2" gutterBottom>Jobs ({selectedJobs.length}):</Typography>
                {selectedJobs.map((jobId) => {
                  const job = jobs.find(j => j.id === jobId);
                  return (
                    <Typography key={jobId} variant="body2">
                      • {job?.customerName} ({job?.priority} priority)
                    </Typography>
                  );
                })}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateRouteOpen(false)}>Cancel</Button>
          {assignmentStep > 0 && (
            <Button onClick={() => setAssignmentStep(assignmentStep - 1)}>
              Back
            </Button>
          )}
          {assignmentStep < 3 ? (
            <Button
              variant="contained"
              onClick={() => setAssignmentStep(assignmentStep + 1)}
              disabled={
                (assignmentStep === 0 && !selectedVehicle) ||
                (assignmentStep === 1 && !selectedDriver) ||
                (assignmentStep === 2 && selectedJobs.length === 0)
              }
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleCreateRoute}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : null}
            >
              {loading ? 'Creating Route...' : 'Create Route'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
