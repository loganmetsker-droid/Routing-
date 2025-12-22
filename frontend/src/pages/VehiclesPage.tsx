import { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
} from '@mui/material';
import {
  Add,
  DirectionsCar,
  Build,
  LocalShipping,
  Edit,
} from '@mui/icons-material';
import {
  useVehicles,
  useVehiclesByType,
  useVehiclesNeedingMaintenance,
  useCreateVehicle,
  useUpdateVehicle,
} from '../graphql/hooks';
import { motion } from 'framer-motion';

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
  hidden: { scale: 0.9, opacity: 0 },
  show: { scale: 1, opacity: 1 },
};

export default function VehiclesPage() {
  const [tab, setTab] = useState(0);
  const [selectedType, setSelectedType] = useState('truck');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    vehicleType: 'TRUCK',
    status: 'AVAILABLE',
    vin: '',
    fuelType: 'DIESEL',
    capacity: 1000,
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: allVehicles, loading: loadingAll } = useVehicles();
  const { data: byTypeData, loading: loadingByType } = useVehiclesByType(selectedType);
  const { data: maintenanceData, loading: loadingMaintenance } = useVehiclesNeedingMaintenance();
  const [createVehicle] = useCreateVehicle();
  const [updateVehicle] = useUpdateVehicle();

  const handleOpenDialog = (vehicle?: any) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year || new Date().getFullYear(),
        licensePlate: vehicle.licensePlate || '',
        vehicleType: vehicle.vehicleType || 'TRUCK',
        status: vehicle.status || 'AVAILABLE',
        vin: vehicle.vin || '',
        fuelType: vehicle.fuelType || 'DIESEL',
        capacity: vehicle.capacity || 1000,
      });
    } else {
      setEditingVehicle(null);
      setFormData({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        licensePlate: '',
        vehicleType: 'TRUCK',
        status: 'AVAILABLE',
        vin: '',
        fuelType: 'DIESEL',
        capacity: 1000,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingVehicle(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingVehicle) {
        await updateVehicle({
          variables: {
            id: editingVehicle.id,
            input: formData,
          },
        });
      } else {
        await createVehicle({
          variables: {
            input: formData,
          },
        });
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving vehicle:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getVehicles = () => {
    if (tab === 0) return allVehicles?.vehicles || [];
    if (tab === 1) return byTypeData?.vehicles || [];
    return maintenanceData?.vehicles || [];
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE':
        return 'success';
      case 'IN_ROUTE':
        return 'primary';
      case 'MAINTENANCE':
        return 'warning';
      case 'OFF_DUTY':
        return 'default';
      default:
        return 'default';
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'TRUCK':
        return <LocalShipping sx={{ fontSize: 40, color: 'primary.main' }} />;
      case 'VAN':
        return <DirectionsCar sx={{ fontSize: 40, color: 'secondary.main' }} />;
      default:
        return <DirectionsCar sx={{ fontSize: 40, color: 'grey.500' }} />;
    }
  };

  const loading = loadingAll || loadingByType || loadingMaintenance;
  const vehicles = getVehicles();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Fleet Management
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          data-testid="add-vehicle-button"
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Add Vehicle
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="All Vehicles" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label="By Type" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Needs Maintenance" sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {tab === 1 && (
        <FormControl sx={{ mb: 3, minWidth: 200 }}>
          <InputLabel>Vehicle Type</InputLabel>
          <Select
            value={selectedType}
            label="Vehicle Type"
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <MenuItem value="truck">Truck</MenuItem>
            <MenuItem value="van">Van</MenuItem>
            <MenuItem value="car">Car</MenuItem>
          </Select>
        </FormControl>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={48} />
        </Box>
      ) : vehicles.length > 0 ? (
        <motion.div variants={container} initial="hidden" animate="show">
          <Grid container spacing={3}>
            {vehicles.map((vehicle: any) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={vehicle.id}>
                <motion.div variants={item}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box
                          sx={{
                            bgcolor: 'grey.100',
                            borderRadius: 2,
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {getVehicleIcon(vehicle.vehicleType)}
                        </Box>
                        <Chip
                          label={vehicle.status}
                          color={getStatusColor(vehicle.status)}
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                      </Box>
                      <Typography variant="h6" fontWeight={600} gutterBottom>
                        {vehicle.make} {vehicle.model}
                      </Typography>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        {vehicle.year} • {vehicle.vehicleType}
                      </Typography>
                      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="caption" color="textSecondary">
                          License Plate: <strong>{vehicle.licensePlate}</strong>
                        </Typography>
                        {vehicle.capacity && (
                          <Typography variant="caption" color="textSecondary">
                            Capacity: <strong>{vehicle.capacity} lbs</strong>
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2 }}>
                      <Button
                        size="small"
                        startIcon={<Build />}
                        sx={{ textTransform: 'none' }}
                      >
                        Maintenance
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(vehicle)}
                        sx={{
                          ml: 'auto',
                          '&:hover': {
                            bgcolor: 'primary.light',
                            color: 'primary.contrastText',
                          },
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </CardActions>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </motion.div>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <DirectionsCar sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No vehicles found
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Add your first vehicle to start managing your fleet
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
            Add Vehicle
          </Button>
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>
          {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Make"
                  name="make"
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Model"
                  name="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Year"
                  name="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="License Plate"
                  name="licensePlate"
                  value={formData.licensePlate}
                  onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="VIN"
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Vehicle Type"
                  select
                  value={formData.vehicleType}
                  onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="TRUCK">Truck</MenuItem>
                  <MenuItem value="VAN">Van</MenuItem>
                  <MenuItem value="CAR">Car</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Fuel Type"
                  select
                  value={formData.fuelType}
                  onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="DIESEL">Diesel</MenuItem>
                  <MenuItem value="GASOLINE">Gasoline</MenuItem>
                  <MenuItem value="ELECTRIC">Electric</MenuItem>
                  <MenuItem value="HYBRID">Hybrid</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Capacity (lbs)"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Status"
                  select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="AVAILABLE">Available</MenuItem>
                  <MenuItem value="IN_ROUTE">In Route</MenuItem>
                  <MenuItem value="MAINTENANCE">Maintenance</MenuItem>
                  <MenuItem value="OFF_DUTY">Off Duty</MenuItem>
                </TextField>
              </Grid>
            </Grid>
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
            data-testid="save-vehicle-button"
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {submitting ? 'Saving...' : editingVehicle ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
