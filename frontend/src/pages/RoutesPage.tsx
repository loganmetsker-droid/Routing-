import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { motion } from 'framer-motion';
import { Add, Edit, Delete } from '@mui/icons-material';

const API_BASE_URL = import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Vehicle {
  id: string;
  name?: string;
  make?: string;
  model?: string;
  type?: string;
  vehicleType?: string;
  capacity?: number;
  status: string;
}

interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  status: string;
}

interface Route {
  id: string;
  name: string;
  vehicleId?: string;
  driverId?: string;
  stops: string[];
  status: string;
  createdAt: string;
}

const RoutesPage: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeName, setRouteName] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [stops, setStops] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadRoutes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dispatch/routes`);
      const data = await response.json();
      setRoutes(data.routes || []);
    } catch (error) {
      console.error('Error loading routes:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/vehicles`);
      const data = await response.json();
      setVehicles(data.vehicles || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadDrivers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/drivers`);
      const data = await response.json();
      setDrivers(data.drivers || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadRoutes(), loadVehicles(), loadDrivers()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDialog = (route?: Route) => {
    if (route) {
      setEditingRoute(route);
      setRouteName(route.name);
      setVehicleId(route.vehicleId || '');
      setDriverId(route.driverId || '');
      setStops(route.stops || []);
    } else {
      setEditingRoute(null);
      setRouteName('');
      setVehicleId('');
      setDriverId('');
      setStops([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRoute(null);
  };

  const handleAddStop = () => setStops([...stops, '']);

  const handleRemoveStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
  };

  const handleStopChange = (index: number, value: string) => {
    const newStops = [...stops];
    newStops[index] = value;
    setStops(newStops);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: routeName,
        vehicleId: vehicleId || null,
        driverId: driverId || null,
        stops: stops.filter(s => s.trim() !== ''),
        status: editingRoute ? editingRoute.status : 'pending',
      };

      if (editingRoute) {
        await fetch(`${API_BASE_URL}/api/dispatch/routes/${editingRoute.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${API_BASE_URL}/api/dispatch/routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setOpenDialog(false);
      await loadRoutes();
    } catch (error) {
      console.error('Error saving route:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getVehicleName = (vehicleId?: string) => {
    if (!vehicleId) return '-';
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return '-';
    return vehicle.name || `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || '-';
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return '-';
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return '-';
    return driver.name || `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || '-';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Routes
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
          }}
        >
          Add Route
        </Button>
      </Box>

      <Box mt={3}>
        {routes.map((route) => (
          <motion.div
            key={route.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              border: '1px solid #ccc',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px',
              backgroundColor: '#fff',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">{route.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Vehicle: {getVehicleName(route.vehicleId)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Driver: {getDriverName(route.driverId)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Stops: {route.stops && route.stops.length > 0 ? route.stops.join(', ') : '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {route.status}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Edit />}
                onClick={() => handleOpenDialog(route)}
                sx={{ textTransform: 'none' }}
              >
                Edit
              </Button>
            </Box>
          </motion.div>
        ))}
        {routes.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="textSecondary">
              No routes found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Click "Add Route" to create your first route
            </Typography>
          </Box>
        )}
      </Box>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRoute ? 'Edit Route' : 'Add Route'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Route Name"
            fullWidth
            margin="normal"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            required
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Vehicle</InputLabel>
            <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <MenuItem value="">None</MenuItem>
              {vehicles.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.name || `${v.make || ''} ${v.model || ''}`.trim() || v.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Driver</InputLabel>
            <Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <MenuItem value="">None</MenuItem>
              {drivers.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box mt={2}>
            <Typography variant="subtitle1" gutterBottom>
              Stops:
            </Typography>
            {stops.map((stop, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  label={`Stop ${index + 1}`}
                  fullWidth
                  margin="dense"
                  value={stop}
                  onChange={(e) => handleStopChange(index, e.target.value)}
                />
                <IconButton
                  color="error"
                  onClick={() => handleRemoveStop(index)}
                  sx={{ mt: 1 }}
                >
                  <Delete />
                </IconButton>
              </Box>
            ))}
            <Button
              variant="outlined"
              onClick={handleAddStop}
              sx={{ mt: 1, textTransform: 'none' }}
            >
              Add Stop
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={submitting || !routeName}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {submitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoutesPage;
