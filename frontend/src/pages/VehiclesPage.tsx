import { useMemo, useState } from 'react';
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
import type { VehicleRecord } from '../services/api.types';
import {
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useVehiclesQuery,
} from '../services/fleetApi';

const VEHICLE_TYPES = [
  'car',
  'pickup',
  'cargo_van',
  'sprinter_van',
  'box_truck',
  'straight_truck',
  'semi_truck',
  'reefer',
  'flatbed',
] as const;

const VEHICLE_META: Record<string, { label: string; weight: string; volume: string; extras: string[] }> = {
  car: { label: 'Car', weight: '400 lb', volume: '60 cu ft', extras: ['Urban only'] },
  pickup: { label: 'Pickup', weight: '1500 lb', volume: '80 cu ft', extras: ['Open bed'] },
  cargo_van: { label: 'Cargo van', weight: '3500 lb', volume: '260 cu ft', extras: ['Parcel ready'] },
  sprinter_van: { label: 'Sprinter van', weight: '4200 lb', volume: '420 cu ft', extras: ['Tall cargo'] },
  box_truck: { label: 'Box truck', weight: '10000 lb', volume: '900 cu ft', extras: ['Dock friendly'] },
  straight_truck: { label: 'Straight truck', weight: '18000 lb', volume: '1200 cu ft', extras: ['Regional route'] },
  semi_truck: { label: 'Semi truck', weight: '45000 lb', volume: 'Trailer dependent', extras: ['Long haul'] },
  reefer: { label: 'Reefer', weight: '12000 lb', volume: '1000 cu ft', extras: ['Refrigeration'] },
  flatbed: { label: 'Flatbed', weight: '22000 lb', volume: 'Open deck', extras: ['Oversized freight'] },
};

const VEHICLE_TYPE_ALIASES: Record<string, keyof typeof VEHICLE_META> = {
  van: 'cargo_van',
  truck: 'box_truck',
  semi_tractor: 'semi_truck',
};

const DASHBOARD_VEHICLE_TYPES = ['cargo_van', 'box_truck', 'straight_truck', 'semi_truck'] as const;

const normalizeVehicleType = (value: string | null | undefined): keyof typeof VEHICLE_META => {
  const normalized = String(value || 'box_truck').trim().toLowerCase();
  if (normalized in VEHICLE_META) {
    return normalized as keyof typeof VEHICLE_META;
  }
  return VEHICLE_TYPE_ALIASES[normalized] || 'box_truck';
};

const emptyForm = {
  make: '',
  model: '',
  year: new Date().getFullYear(),
  licensePlate: '',
  vehicleType: 'box_truck',
  status: 'AVAILABLE',
  vin: '',
  fuelType: 'DIESEL',
  capacity: 1000,
  volumeCapacity: '',
  weightCapacity: '',
  territoryRestriction: '',
  maxRouteMinutes: '',
};

export default function VehiclesPage() {
  const vehiclesQuery = useVehiclesQuery();
  const createVehicleMutation = useCreateVehicleMutation();
  const updateVehicleMutation = useUpdateVehicleMutation();
  const vehicles = vehiclesQuery.data ?? [];
  const loading = vehiclesQuery.isLoading;
  const [filter, setFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const visibleVehicles = useMemo(() => {
    if (filter === 'all') return vehicles;
    return vehicles.filter(
      (vehicle) => normalizeVehicleType(vehicle.vehicleType || vehicle.type) === filter,
    );
  }, [filter, vehicles]);

  const openCreate = () => {
    setEditingVehicle(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (vehicle: VehicleRecord) => {
    setEditingVehicle(vehicle);
    setFormData({
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year || new Date().getFullYear(),
      licensePlate: vehicle.licensePlate || '',
      vehicleType: normalizeVehicleType(vehicle.vehicleType || vehicle.type),
      status: vehicle.status || 'AVAILABLE',
      vin: vehicle.vin || '',
      fuelType: vehicle.fuelType || 'DIESEL',
      capacity: vehicle.capacity || 1000,
      volumeCapacity:
        vehicle.volumeCapacity === null || vehicle.volumeCapacity === undefined
          ? ''
          : String(vehicle.volumeCapacity),
      weightCapacity:
        vehicle.weightCapacity === null || vehicle.weightCapacity === undefined
          ? ''
          : String(vehicle.weightCapacity),
      territoryRestriction: vehicle.territoryRestriction || '',
      maxRouteMinutes:
        vehicle.maxRouteMinutes === null || vehicle.maxRouteMinutes === undefined
          ? ''
          : String(vehicle.maxRouteMinutes),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const parsedVolumeCapacity =
      formData.volumeCapacity === '' ? undefined : Number(formData.volumeCapacity);
    const parsedWeightCapacity =
      formData.weightCapacity === '' ? undefined : Number(formData.weightCapacity);
    const parsedMaxRouteMinutes =
      formData.maxRouteMinutes === '' ? undefined : Number(formData.maxRouteMinutes);
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
      capacityWeightKg: parsedWeightCapacity,
      capacityVolumeM3: parsedVolumeCapacity,
      metadata: {
        territoryRestriction: formData.territoryRestriction || undefined,
        maxRouteMinutes: parsedMaxRouteMinutes,
      },
    };

    try {
      if (editingVehicle) {
        await updateVehicleMutation.mutateAsync({
          id: editingVehicle.id,
          updates: payload,
        });
      } else {
        await createVehicleMutation.mutateAsync(payload);
      }
      setDialogOpen(false);
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
        {DASHBOARD_VEHICLE_TYPES.map((type) => (
          <Grid item xs={12} md={6} xl={3} key={type}>
            <SurfacePanel>
              <Typography variant="subtitle2" color="text.secondary">{VEHICLE_META[type].label}</Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {vehicles.filter((vehicle) => normalizeVehicleType(vehicle.vehicleType || vehicle.type) === type).length}
              </Typography>
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
                const key = normalizeVehicleType(vehicle.vehicleType || vehicle.type);
                const meta = VEHICLE_META[key];
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
            <Grid item xs={12} md={4}><TextField label="Fuel type" value={formData.fuelType} onChange={(event) => setFormData((current) => ({ ...current, fuelType: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Capacity" type="number" value={formData.capacity} onChange={(event) => setFormData((current) => ({ ...current, capacity: Number(event.target.value) }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Volume capacity" value={formData.volumeCapacity} onChange={(event) => setFormData((current) => ({ ...current, volumeCapacity: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Weight capacity" value={formData.weightCapacity} onChange={(event) => setFormData((current) => ({ ...current, weightCapacity: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Territory restriction" value={formData.territoryRestriction} onChange={(event) => setFormData((current) => ({ ...current, territoryRestriction: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Max route minutes" value={formData.maxRouteMinutes} onChange={(event) => setFormData((current) => ({ ...current, maxRouteMinutes: event.target.value }))} fullWidth /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSubmit()}>Save Vehicle</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
