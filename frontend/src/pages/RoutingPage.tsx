import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  Add,
  AutoMode,
  Delete,
  Edit,
  LocalShipping,
  Navigation,
  PlayArrow,
  Place,
  Route as RouteIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Vehicle {
  id: string;
  name?: string;
  make?: string;
  model?: string;
  licensePlate?: string;
  status: string;
}

interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  status: string;
}

interface Job {
  id: string;
  customerName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  status: string;
}

interface Route {
  id: string;
  name: string;
  vehicleId?: string | null;
  driverId?: string | null;
  stops: string[];
  status: string;
  jobIds?: string[];
  totalDistance?: number;
  totalDuration?: number;
  createdAt: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

export default function RoutingPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    vehicleId: '',
    driverId: '',
    stops: [''] as string[],
  });
  const [submitting, setSubmitting] = useState(false);

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);
      const [routesRes, vehiclesRes, driversRes, jobsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/routes`),
        fetch(`${API_BASE_URL}/api/vehicles`),
        fetch(`${API_BASE_URL}/api/drivers`),
        fetch(`${API_BASE_URL}/api/jobs`),
      ]);

      const [routesData, vehiclesData, driversData, jobsData] = await Promise.all([
        routesRes.json(),
        vehiclesRes.json(),
        driversRes.json(),
        jobsRes.json(),
      ]);

      setRoutes(routesData.routes || []);
      setVehicles(vehiclesData.vehicles || []);
      setDrivers(driversData.drivers || []);
      setJobs(jobsData.jobs || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-generate routes
  const handleAutoGenerateRoutes = async () => {
    try {
      setGenerating(true);

      // Get available vehicles and unassigned jobs
      const availableVehicles = vehicles.filter(v => v.status !== 'INACTIVE' && v.status !== 'in_route');
      const unassignedJobs = jobs.filter(j => j.status === 'pending');

      if (availableVehicles.length === 0) {
        alert('No available vehicles. Please add vehicles or make them available.');
        return;
      }

      if (unassignedJobs.length === 0) {
        alert('No unassigned jobs to route.');
        return;
      }

      // Simple distribution: round-robin job assignment
      const jobsPerVehicle = Math.ceil(unassignedJobs.length / availableVehicles.length);

      for (let i = 0; i < availableVehicles.length; i++) {
        const vehicle = availableVehicles[i];
        const vehicleJobs = unassignedJobs.slice(i * jobsPerVehicle, (i + 1) * jobsPerVehicle);

        if (vehicleJobs.length === 0) continue;

        // Create route with jobs
        await fetch(`${API_BASE_URL}/api/routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicleId: vehicle.id,
            jobIds: vehicleJobs.map(j => j.id),
          }),
        });
      }

      await loadData();
      alert(`Successfully generated ${Math.min(availableVehicles.length, Math.ceil(unassignedJobs.length / jobsPerVehicle))} routes!`);
    } catch (error) {
      console.error('Error generating routes:', error);
      alert('Failed to generate routes. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Dialog handlers
  const handleOpenDialog = (route?: Route) => {
    if (route) {
      setEditingRoute(route);
      setFormData({
        name: route.name || '',
        vehicleId: route.vehicleId || '',
        driverId: route.driverId || '',
        stops: route.stops && route.stops.length > 0 ? route.stops : [''],
      });
    } else {
      setEditingRoute(null);
      setFormData({
        name: '',
        vehicleId: '',
        driverId: '',
        stops: [''],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRoute(null);
  };

  const handleAddStop = () => {
    setFormData({ ...formData, stops: [...formData.stops, ''] });
  };

  const handleRemoveStop = (index: number) => {
    const newStops = formData.stops.filter((_, i) => i !== index);
    setFormData({ ...formData, stops: newStops.length > 0 ? newStops : [''] });
  };

  const handleStopChange = (index: number, value: string) => {
    const newStops = [...formData.stops];
    newStops[index] = value;
    setFormData({ ...formData, stops: newStops });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a route name');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        vehicleId: formData.vehicleId || null,
        driverId: formData.driverId || null,
        stops: formData.stops.filter(s => s.trim() !== ''),
        status: editingRoute ? editingRoute.status : 'pending',
      };

      if (editingRoute) {
        await fetch(`${API_BASE_URL}/api/routes/${editingRoute.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${API_BASE_URL}/api/routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      handleCloseDialog();
      await loadData();
    } catch (error) {
      console.error('Error saving route:', error);
      alert('Failed to save route. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;

    try {
      // Note: Backend doesn't have DELETE endpoint yet, so we'll update status instead
      await fetch(`${API_BASE_URL}/api/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      await loadData();
    } catch (error) {
      console.error('Error deleting route:', error);
      alert('Failed to delete route.');
    }
  };

  const handleDispatchRoute = async (routeId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dispatched' }),
      });
      await loadData();
    } catch (error) {
      console.error('Error dispatching route:', error);
      alert('Failed to dispatch route.');
    }
  };

  // Helper functions
  const getVehicleName = (vehicleId?: string | null) => {
    if (!vehicleId) return 'No vehicle assigned';
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return 'Unknown vehicle';
    return vehicle.name || `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.licensePlate || 'Vehicle';
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'default';
      case 'planned': return 'info';
      case 'dispatched': return 'primary';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const activeRoutes = routes.filter(r => r.status !== 'cancelled' && r.status !== 'completed');
  const completedRoutes = routes.filter(r => r.status === 'completed');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Routing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Auto-generate efficient routes or create custom routes manually
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <AutoMode />}
            onClick={handleAutoGenerateRoutes}
            disabled={generating}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              boxShadow: 3,
            }}
          >
            {generating ? 'Generating...' : 'Auto-Generate Routes'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
            }}
          >
            Create Manual Route
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ boxShadow: 2, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <RouteIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>{activeRoutes.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Active Routes</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ boxShadow: 2, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <LocalShipping sx={{ fontSize: 40, color: 'success.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>{vehicles.filter(v => v.status === 'available' || v.status === 'AVAILABLE').length}</Typography>
                  <Typography variant="body2" color="text.secondary">Available Vehicles</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ boxShadow: 2, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Place sx={{ fontSize: 40, color: 'warning.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>{jobs.filter(j => j.status === 'pending').length}</Typography>
                  <Typography variant="body2" color="text.secondary">Pending Jobs</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ boxShadow: 2, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Navigation sx={{ fontSize: 40, color: 'info.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight={700}>{completedRoutes.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Completed Today</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Active Routes */}
      <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
        Active Routes
      </Typography>

      {activeRoutes.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2, boxShadow: 1 }}>
          <RouteIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Active Routes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Click "Auto-Generate Routes" to automatically create optimized routes, or create a manual route.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AutoMode />}
            onClick={handleAutoGenerateRoutes}
            disabled={generating}
            sx={{ textTransform: 'none' }}
          >
            Auto-Generate Routes
          </Button>
        </Paper>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show">
          <Grid container spacing={3}>
            {activeRoutes.map((route) => (
              <Grid item xs={12} md={6} lg={4} key={route.id}>
                <motion.div variants={item}>
                  <Card
                    sx={{
                      boxShadow: 3,
                      borderRadius: 2,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6,
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6" fontWeight={600} noWrap sx={{ maxWidth: '70%' }}>
                          {route.name || 'Unnamed Route'}
                        </Typography>
                        <Chip
                          label={route.status || 'pending'}
                          color={getStatusColor(route.status)}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>

                      <Divider sx={{ mb: 2 }} />

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LocalShipping fontSize="small" sx={{ color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {getVehicleName(route.vehicleId)}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Place fontSize="small" sx={{ color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {route.stops?.length || route.jobIds?.length || 0} stop(s)
                          </Typography>
                        </Box>

                        {route.totalDistance !== undefined && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Navigation fontSize="small" sx={{ color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {route.totalDistance.toFixed(1)} km
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {route.stops && route.stops.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Stops:
                          </Typography>
                          <List dense sx={{ mt: 0.5 }}>
                            {route.stops.slice(0, 3).map((stop, idx) => (
                              <ListItem key={idx} sx={{ py: 0.25, px: 0 }}>
                                <ListItemText
                                  primary={
                                    <Typography variant="caption" noWrap>
                                      {idx + 1}. {stop}
                                    </Typography>
                                  }
                                />
                              </ListItem>
                            ))}
                            {route.stops.length > 3 && (
                              <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                                +{route.stops.length - 3} more
                              </Typography>
                            )}
                          </List>
                        </Box>
                      )}
                    </CardContent>

                    <Divider />

                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Tooltip title="Edit Route">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(route)}
                          sx={{ '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' } }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {route.status !== 'dispatched' && route.status !== 'in_progress' && (
                        <Tooltip title="Dispatch Route">
                          <IconButton
                            size="small"
                            onClick={() => handleDispatchRoute(route.id)}
                            sx={{ '&:hover': { bgcolor: 'success.light', color: 'success.contrastText' } }}
                          >
                            <PlayArrow fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      <Tooltip title="Delete Route">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteRoute(route.id)}
                          sx={{ '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' } }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </motion.div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRoute ? 'Edit Route' : 'Create Manual Route'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Route Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <FormControl fullWidth>
              <InputLabel>Vehicle</InputLabel>
              <Select
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                label="Vehicle"
              >
                <MenuItem value="">None</MenuItem>
                {vehicles.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.name || `${v.make || ''} ${v.model || ''}`.trim() || v.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Driver</InputLabel>
              <Select
                value={formData.driverId}
                onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                label="Driver"
              >
                <MenuItem value="">None</MenuItem>
                {drivers.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Stops:
              </Typography>
              {formData.stops.map((stop, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    label={`Stop ${index + 1}`}
                    fullWidth
                    value={stop}
                    onChange={(e) => handleStopChange(index, e.target.value)}
                    size="small"
                  />
                  <IconButton
                    color="error"
                    onClick={() => handleRemoveStop(index)}
                    disabled={formData.stops.length === 1}
                  >
                    <Delete />
                  </IconButton>
                </Box>
              ))}
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddStop}
                startIcon={<Add />}
                sx={{ textTransform: 'none', mt: 1 }}
              >
                Add Stop
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={submitting || !formData.name.trim()}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {submitting ? 'Saving...' : editingRoute ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
