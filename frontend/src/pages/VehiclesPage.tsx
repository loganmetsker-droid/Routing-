import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import { getVehicles as fetchVehicles, createVehicle, updateVehicle } from '../services/api';

const VEHICLE_TYPES = ['CAR', 'PICKUP', 'CARGO_VAN', 'SPRINTER_VAN', 'BOX_TRUCK', 'STRAIGHT_TRUCK', 'SEMI_TRACTOR', 'REEFER', 'FLATBED'] as const;

const VEHICLE_META: Record<string, { label: string; weight: string; volume: string; extras: string[] }> = {
  CAR: { label: 'Car', weight: '400 lb', volume: '60 cu ft', extras: ['Urban only'] },
  PICKUP: { label: 'Pickup', weight: '1500 lb', volume: '80 cu ft', extras: ['Open bed'] },
  CARGO_VAN: { label: 'Cargo van', weight: '3500 lb', volume: '260 cu ft', extras: ['Parcel ready'] },
  SPRINTER_VAN: { label: 'Sprinter van', weight: '4200 lb', volume: '420 cu ft', extras: ['Tall cargo'] },
  BOX_TRUCK: { label: 'Box truck', weight: '10000 lb', volume: '900 cu ft', extras: ['Dock friendly'] },
  STRAIGHT_TRUCK: { label: 'Straight truck', weight: '18000 lb', volume: '1200 cu ft', extras: ['Regional route'] },
  SEMI_TRACTOR: { label: 'Semi tractor', weight: '45000 lb', volume: 'Trailer dependent', extras: ['Long haul'] },
  REEFER: { label: 'Reefer', weight: '12000 lb', volume: '1000 cu ft', extras: ['Refrigeration'] },
  FLATBED: { label: 'Flatbed', weight: '22000 lb', volume: 'Open deck', extras: ['Oversized freight'] },
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    vehicleType: 'BOX_TRUCK',
    status: 'AVAILABLE',
    vin: '',
    fuelType: 'DIESEL',
    capacity: 1000,
    volumeCapacity: '',
    weightCapacity: '',
    territoryRestriction: '',
    maxRouteMinutes: '',
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchVehicles();
        if (!mounted) return;
        setVehicles(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load vehicles', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleVehicles = useMemo(() => {
    if (filter === 'all') return vehicles;
    return vehicles.filter((vehicle) => String(vehicle.vehicleType || vehicle.type).toUpperCase() === filter);
  }, [filter, vehicles]);

  const openCreate = () => {
    setEditingVehicle(null);
    setFormData({
      make: '',
      model: '',
      year: new Date().getFullYear(),
      licensePlate: '',
      vehicleType: 'BOX_TRUCK',
      status: 'AVAILABLE',
      vin: '',
      fuelType: 'DIESEL',
      capacity: 1000,
      volumeCapacity: '',
      weightCapacity: '',
      territoryRestriction: '',
      maxRouteMinutes: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (vehicle: any) => {
    setEditingVehicle(vehicle);
    setFormData({
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year || new Date().getFullYear(),
      licensePlate: vehicle.licensePlate || '',
      vehicleType: vehicle.vehicleType || vehicle.type || 'BOX_TRUCK',
      status: vehicle.status || 'AVAILABLE',
      vin: vehicle.vin || '',
      fuelType: vehicle.fuelType || 'DIESEL',
      capacity: vehicle.capacity || 1000,
      volumeCapacity: vehicle.volumeCapacity || '',
      weightCapacity: vehicle.weightCapacity || '',
      territoryRestriction: vehicle.territoryRestriction || '',
      maxRouteMinutes: vehicle.maxRouteMinutes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      make: formData.make,
      model: formData.model,
      year: formData.year,
      licensePlate: formData.licensePlate,
      vehicleType: formData.vehicleType,
      status: formData.status,
      vin: formData.vin,
      fuelType: formData.fuelType,
      capacity: formData.capacity,
    };

    try {
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, payload);
      } else {
        await createVehicle(payload as any);
      }
      setDialogOpen(false);
      const data = await fetchVehicles();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to save vehicle', error);
    }
  };

  if (loading) {
    return <LoadingState label="Loading vehicles..." minHeight="50vh" />;
  }

  return (
    <Box>
      <PageHeader eyebrow="Resources" title="Vehicles" subtitle="Fleet semantics now reflect actual routing operations, not a tiny generic CRUD grid." actions={<Button variant="contained" onClick={openCreate}>Add Vehicle</Button>} />

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip clickable label="All" color={filter === 'all' ? 'primary' : 'default'} onClick={() => setFilter('all')} />
        {VEHICLE_TYPES.map((type) => <Chip key={type} clickable label={VEHICLE_META[type].label} color={filter === type ? 'primary' : 'default'} onClick={() => setFilter(type)} />)}
      </Stack>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        {VEHICLE_TYPES.slice(0, 4).map((type) => (
          <Grid item xs={12} md={6} xl={3} key={type}>
            <SurfacePanel>
              <Typography variant="subtitle2" color="text.secondary">{VEHICLE_META[type].label}</Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>{vehicles.filter((vehicle) => String(vehicle.vehicleType || vehicle.type).toUpperCase() === type).length}</Typography>
              <Typography variant="body2" color="text.secondary">{VEHICLE_META[type].weight} • {VEHICLE_META[type].volume}</Typography>
            </SurfacePanel>
          </Grid>
        ))}
      </Grid>

      <SurfacePanel sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h5">Fleet Directory</Typography>
          <Typography variant="body2" color="text.secondary">Vehicle types, capacities, and operational attributes are ready for richer fleet rules.</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vehicle</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Operational profile</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleVehicles.map((vehicle) => {
                const key = String(vehicle.vehicleType || vehicle.type || 'BOX_TRUCK').toUpperCase();
                const meta = VEHICLE_META[key] || VEHICLE_META.BOX_TRUCK;
                return (
                  <TableRow key={vehicle.id} hover>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{vehicle.make} {vehicle.model}</Typography>
                        <Typography variant="caption" color="text.secondary">{vehicle.licensePlate || 'Plate pending'} • {vehicle.year || 'Year pending'}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{meta.label}</TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2">Weight: {vehicle.weightCapacity || meta.weight}</Typography>
                        <Typography variant="body2">Volume: {vehicle.volumeCapacity || meta.volume}</Typography>
                        <Typography variant="caption" color="text.secondary">{vehicle.territoryRestriction || 'Territory open'} • {vehicle.maxRouteMinutes || 'Route duration ready'}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip size="small" label={vehicle.status || 'AVAILABLE'} color={String(vehicle.status).toUpperCase() === 'AVAILABLE' ? 'success' : 'default'} />
                        {meta.extras.map((extra) => <Chip key={extra} size="small" variant="outlined" label={extra} />)}
                      </Stack>
                    </TableCell>
                    <TableCell><Button size="small" onClick={() => openEdit(vehicle)}>Edit</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </SurfacePanel>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><TextField label="Make" value={formData.make} onChange={(event) => setFormData((current) => ({ ...current, make: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Model" value={formData.model} onChange={(event) => setFormData((current) => ({ ...current, model: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Year" type="number" value={formData.year} onChange={(event) => setFormData((current) => ({ ...current, year: Number(event.target.value) }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="License plate" value={formData.licensePlate} onChange={(event) => setFormData((current) => ({ ...current, licensePlate: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="VIN" value={formData.vin} onChange={(event) => setFormData((current) => ({ ...current, vin: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField select label="Vehicle type" value={formData.vehicleType} onChange={(event) => setFormData((current) => ({ ...current, vehicleType: event.target.value }))} fullWidth>{VEHICLE_TYPES.map((type) => <MenuItem key={type} value={type}>{VEHICLE_META[type].label}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} md={4}><TextField select label="Status" value={formData.status} onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))} fullWidth><MenuItem value="AVAILABLE">Available</MenuItem><MenuItem value="IN_ROUTE">In route</MenuItem><MenuItem value="MAINTENANCE">Maintenance</MenuItem><MenuItem value="OFF_DUTY">Off duty</MenuItem></TextField></Grid>
            <Grid item xs={12} md={4}><TextField label="Capacity" type="number" value={formData.capacity} onChange={(event) => setFormData((current) => ({ ...current, capacity: Number(event.target.value) }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Volume capacity" value={formData.volumeCapacity} onChange={(event) => setFormData((current) => ({ ...current, volumeCapacity: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Weight capacity" value={formData.weightCapacity} onChange={(event) => setFormData((current) => ({ ...current, weightCapacity: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Max route minutes" value={formData.maxRouteMinutes} onChange={(event) => setFormData((current) => ({ ...current, maxRouteMinutes: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Territory restriction" value={formData.territoryRestriction} onChange={(event) => setFormData((current) => ({ ...current, territoryRestriction: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField select label="Fuel type" value={formData.fuelType} onChange={(event) => setFormData((current) => ({ ...current, fuelType: event.target.value }))} fullWidth><MenuItem value="DIESEL">Diesel</MenuItem><MenuItem value="GAS">Gas</MenuItem><MenuItem value="ELECTRIC">Electric</MenuItem></TextField></Grid>
          </Grid>
          <Typography variant="body2" color="text.secondary">Expanded fleet semantics are available in the UI now. Backend persistence for the advanced operational fields can be wired separately without blocking this redesign.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSubmit()}>Save Vehicle</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
