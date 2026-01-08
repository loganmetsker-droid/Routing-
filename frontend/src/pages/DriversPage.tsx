import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Avatar,
} from '@mui/material';
import { Add, Edit, Person } from '@mui/icons-material';
import { motion } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { x: -20, opacity: 0 },
  show: { x: 0, opacity: 1 },
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    licenseNumber: '',
    licenseType: 'CLASS_C',
    assignedVehicleId: '',
    notes: '',
    status: 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadDrivers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/drivers`);
      const data = await response.json();
      setDrivers(data.drivers || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
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

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadDrivers(), loadVehicles()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDialog = (driver?: any) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({
        firstName: driver.firstName || '',
        lastName: driver.lastName || '',
        email: driver.email || '',
        phone: driver.phone || '',
        licenseNumber: driver.licenseNumber || '',
        licenseType: driver.licenseType || 'CLASS_C',
        assignedVehicleId: driver.assignedVehicleId || '',
        notes: driver.notes || '',
        status: driver.status || 'ACTIVE',
      });
    } else {
      setEditingDriver(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        licenseNumber: '',
        licenseType: 'CLASS_C',
        assignedVehicleId: '',
        notes: '',
        status: 'ACTIVE',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingDriver(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingDriver) {
        await fetch(`${API_BASE_URL}/api/drivers/${editingDriver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch(`${API_BASE_URL}/api/drivers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      handleCloseDialog();
      await loadDrivers();
    } catch (error) {
      console.error('Error saving driver:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'OFF_DUTY':
        return 'warning';
      case 'INACTIVE':
        return 'error';
      default:
        return 'default';
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Drivers
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          data-testid="add-driver-button"
          sx={{
            textTransform: 'none',
            borderRadius: 2,
          }}
        >
          Add Driver
        </Button>
      </Box>

      <motion.div variants={container} initial="hidden" animate="show">
        <TableContainer
          component={Paper}
          sx={{
            boxShadow: 2,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Table>
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Driver</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>License Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Assigned Vehicle</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {drivers.length > 0 ? (
                drivers.map((driver: any) => (
                  <TableRow
                    key={driver.id}
                    component={motion.tr}
                    variants={item}
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                          {getInitials(driver.firstName, driver.lastName)}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight={500}>
                            {driver.firstName} {driver.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {driver.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{driver.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={driver.licenseType || 'CLASS_C'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {driver.assignedVehicleId ? (
                        (() => {
                          const assignedVehicle = vehicles.find((v: any) => v.id === driver.assignedVehicleId);
                          return assignedVehicle ? (
                            <Typography variant="body2">
                              {assignedVehicle.make} {assignedVehicle.model}
                              <br />
                              <Typography variant="caption" color="text.secondary">
                                {assignedVehicle.licensePlate}
                              </Typography>
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Vehicle not found
                            </Typography>
                          );
                        })()
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not assigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={driver.status}
                        color={getStatusColor(driver.status)}
                        size="small"
                        sx={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(driver)}
                        sx={{
                          '&:hover': {
                            bgcolor: 'primary.light',
                            color: 'primary.contrastText',
                          },
                          transition: 'all 0.2s',
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Box sx={{ py: 4 }}>
                      <Person sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                      <Typography variant="h6" color="textSecondary">
                        No drivers found
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Click "Add Driver" to create your first driver
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>
          {editingDriver ? 'Edit Driver' : 'Add New Driver'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="License Number"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="License Type"
              name="licenseType"
              select
              value={formData.licenseType}
              onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
              fullWidth
            >
              <MenuItem value="CLASS_A">Class A (CDL)</MenuItem>
              <MenuItem value="CLASS_B">Class B (CDL)</MenuItem>
              <MenuItem value="CLASS_C">Class C</MenuItem>
            </TextField>
            <TextField
              label="Assigned Vehicle"
              name="assignedVehicleId"
              select
              value={formData.assignedVehicleId}
              onChange={(e) => setFormData({ ...formData, assignedVehicleId: e.target.value })}
              fullWidth
            >
              <MenuItem value="">None</MenuItem>
              {vehicles.map((vehicle: any) => (
                <MenuItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.make} {vehicle.model} - {vehicle.licensePlate}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Additional notes about the driver..."
            />
            <TextField
              label="Status"
              name="status"
              select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              fullWidth
            >
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="OFF_DUTY">Off Duty</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting}
            data-testid="save-driver-button"
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {submitting ? 'Saving...' : editingDriver ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
