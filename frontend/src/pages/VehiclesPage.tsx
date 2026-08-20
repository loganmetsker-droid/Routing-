import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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
  Switch,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import type { VehicleRecord } from '../services/api.types';
import type { FleetOperatingRule, VehicleRoutingProfile } from '@shared/contracts';
import {
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useVehiclesQuery,
  useDriversQuery,
} from '../services/fleetApi';
import { useRoutesQuery } from '../services/dispatchApi';

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

const POUNDS_PER_KILOGRAM = 2.2046226218;
const CUBIC_FEET_PER_CUBIC_METER = 35.3146667;

const kilogramsToPounds = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * POUNDS_PER_KILOGRAM : null;
};

const poundsToKilograms = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / POUNDS_PER_KILOGRAM : undefined;
};

const cubicMetersToFeet = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * CUBIC_FEET_PER_CUBIC_METER : null;
};

const cubicFeetToMeters = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / CUBIC_FEET_PER_CUBIC_METER : undefined;
};

const roundedDisplay = (value: number | null) =>
  value === null ? '' : String(Math.round(value * 10) / 10);

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
  volumeCapacity: '',
  weightCapacity: '',
  territoryRestriction: '',
  maxRouteMinutes: '',
  interiorLengthIn: '',
  interiorWidthIn: '',
  interiorHeightIn: '',
  doorHeightIn: '',
  maxPalletPositions: '',
  maxPalletWeightLb: '',
  maxStackHeightIn: '',
  maxStackLevels: '',
  features: '',
  handlingCapabilities: '',
  blockedDriverIds: [] as string[],
  allowedDriverIds: [] as string[],
  operatingRules: [] as FleetOperatingRule[],
};

const optionalNumericField = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const commaSeparatedValues = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const routingProfileFor = (vehicle: VehicleRecord): VehicleRoutingProfile =>
  vehicle.routingProfile || {};

export default function VehiclesPage() {
  const vehiclesQuery = useVehiclesQuery();
  const driversQuery = useDriversQuery();
  const routesQuery = useRoutesQuery();
  const createVehicleMutation = useCreateVehicleMutation();
  const updateVehicleMutation = useUpdateVehicleMutation();
  const vehicles = vehiclesQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const routes = routesQuery.data ?? [];
  const loading = vehiclesQuery.isLoading;
  const [filter, setFilter] = useState('all');
  const [fleetSearch, setFleetSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fleetSort, setFleetSort] = useState('exceptions');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [notice, setNotice] = useState<string | null>(null);

  const activeRoutes = useMemo(
    () => routes.filter(
      (route) => !['completed', 'cancelled'].includes(String(route.status).toLowerCase()),
    ),
    [routes],
  );
  const routeByVehicleId = useMemo(
    () => new Map(activeRoutes.map((route) => [route.vehicleId, route])),
    [activeRoutes],
  );
  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers],
  );
  const exceptionCountByVehicleId = useMemo(
    () => new Map(
      activeRoutes.map((route) => [
        route.vehicleId,
        (route.planningWarnings?.length || 0) + (route.exceptionCategory ? 1 : 0),
      ]),
    ),
    [activeRoutes],
  );
  const vehicleCountByType = useMemo(() => {
    const counts = new Map<string, number>();
    vehicles.forEach((vehicle) => {
      const type = normalizeVehicleType(vehicle.vehicleType || vehicle.type);
      counts.set(type, (counts.get(type) || 0) + 1);
    });
    return counts;
  }, [vehicles]);

  const visibleVehicles = useMemo(() => {
    const query = fleetSearch.trim().toLowerCase();
    return vehicles
      .filter(
        (vehicle) =>
          filter === 'all' ||
          normalizeVehicleType(vehicle.vehicleType || vehicle.type) === filter,
      )
      .filter((vehicle) => {
        const route = routeByVehicleId.get(vehicle.id);
        const driver = route?.driverId ? driverById.get(route.driverId) : null;
        if (statusFilter === 'active_route' && !route) return false;
        if (statusFilter === 'exceptions' && !exceptionCountByVehicleId.get(vehicle.id)) return false;
        if (
          !['all', 'active_route', 'exceptions'].includes(statusFilter) &&
          String(vehicle.status).toLowerCase() !== statusFilter
        ) return false;
        if (!query) return true;
        return [
          vehicle.make,
          vehicle.model,
          vehicle.licensePlate,
          vehicle.vehicleType,
          driver?.firstName,
          driver?.lastName,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((left, right) => {
        if (fleetSort === 'exceptions') {
          return (exceptionCountByVehicleId.get(right.id) || 0) -
            (exceptionCountByVehicleId.get(left.id) || 0);
        }
        if (fleetSort === 'route_state') {
          return Number(Boolean(routeByVehicleId.get(right.id))) - Number(Boolean(routeByVehicleId.get(left.id)));
        }
        if (fleetSort === 'pallet_capacity') {
          return Number(routingProfileFor(right).cargo?.maxPalletPositions || 0) -
            Number(routingProfileFor(left).cargo?.maxPalletPositions || 0);
        }
        return `${left.make} ${left.model}`.localeCompare(`${right.make} ${right.model}`);
      });
  }, [driverById, exceptionCountByVehicleId, filter, fleetSearch, fleetSort, routeByVehicleId, statusFilter, vehicles]);

  const openCreate = () => {
    setEditingVehicle(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (vehicle: VehicleRecord) => {
    const routingProfile = routingProfileFor(vehicle);
    const cargo = routingProfile.cargo || {};
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
      volumeCapacity: roundedDisplay(
        cubicMetersToFeet(vehicle.capacityVolumeM3 ?? vehicle.volumeCapacity),
      ),
      weightCapacity: roundedDisplay(
        kilogramsToPounds(vehicle.capacityWeightKg ?? vehicle.weightCapacity),
      ),
      territoryRestriction: vehicle.territoryRestriction || '',
      maxRouteMinutes:
        vehicle.maxRouteMinutes === null || vehicle.maxRouteMinutes === undefined
          ? ''
          : String(vehicle.maxRouteMinutes),
      interiorLengthIn: cargo.interiorLengthIn ? String(cargo.interiorLengthIn) : '',
      interiorWidthIn: cargo.interiorWidthIn ? String(cargo.interiorWidthIn) : '',
      interiorHeightIn: cargo.interiorHeightIn ? String(cargo.interiorHeightIn) : '',
      doorHeightIn: cargo.doorHeightIn ? String(cargo.doorHeightIn) : '',
      maxPalletPositions: cargo.maxPalletPositions ? String(cargo.maxPalletPositions) : '',
      maxPalletWeightLb: cargo.maxPalletWeightLb ? String(cargo.maxPalletWeightLb) : '',
      maxStackHeightIn: cargo.maxStackHeightIn ? String(cargo.maxStackHeightIn) : '',
      maxStackLevels: cargo.maxStackLevels ? String(cargo.maxStackLevels) : '',
      features: (routingProfile.features || []).join(', '),
      handlingCapabilities: (routingProfile.handlingCapabilities || []).join(', '),
      blockedDriverIds: [...(routingProfile.blockedDriverIds || [])],
      allowedDriverIds: [...(routingProfile.allowedDriverIds || [])],
      operatingRules: [...(routingProfile.operatingRules || [])],
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const parsedVolumeCapacity =
      formData.volumeCapacity === '' ? undefined : cubicFeetToMeters(formData.volumeCapacity);
    const parsedWeightCapacity =
      formData.weightCapacity === '' ? undefined : poundsToKilograms(formData.weightCapacity);
    const parsedMaxRouteMinutes =
      formData.maxRouteMinutes === '' ? undefined : Number(formData.maxRouteMinutes);
    const payload = {
      make: formData.make,
      model: formData.model,
      year: formData.year,
      licensePlate: formData.licensePlate,
      vehicleType: formData.vehicleType,
      status: formData.status,
      vin: formData.vin.trim() || undefined,
      fuelType: formData.fuelType,
      capacityWeightKg: parsedWeightCapacity,
      capacityVolumeM3: parsedVolumeCapacity,
      metadata: {
        territoryRestriction: formData.territoryRestriction || undefined,
        maxRouteMinutes: parsedMaxRouteMinutes,
      },
      routingProfile: {
        cargo: {
          interiorLengthIn: optionalNumericField(formData.interiorLengthIn),
          interiorWidthIn: optionalNumericField(formData.interiorWidthIn),
          interiorHeightIn: optionalNumericField(formData.interiorHeightIn),
          doorHeightIn: optionalNumericField(formData.doorHeightIn),
          maxPalletPositions: optionalNumericField(formData.maxPalletPositions),
          maxPalletWeightLb: optionalNumericField(formData.maxPalletWeightLb),
          maxStackHeightIn: optionalNumericField(formData.maxStackHeightIn),
          maxStackLevels: optionalNumericField(formData.maxStackLevels),
        },
        features: commaSeparatedValues(formData.features),
        handlingCapabilities: commaSeparatedValues(formData.handlingCapabilities),
        blockedDriverIds: formData.blockedDriverIds,
        allowedDriverIds: formData.allowedDriverIds,
        operatingRules: formData.operatingRules,
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
      setNotice(editingVehicle ? 'Vehicle updated.' : 'Vehicle added.');
    } catch (error) {
      console.error('Failed to save vehicle', error);
    }
  };

  if (loading) {
    return <LoadingState label="Loading vehicles..." minHeight="50vh" />;
  }

  return (
    <Box>
      <PageHeader eyebrow="Resources" title="Vehicles" subtitle="Fleet capacity, readiness, and route eligibility." actions={<Button variant="contained" onClick={openCreate}>Add Vehicle</Button>} />
      {notice ? (
        <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 1.2 }}>
          {notice}
        </Alert>
      ) : null}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          label="Search fleet"
          placeholder="Vehicle, plate, driver"
          value={fleetSearch}
          onChange={(event) => setFleetSearch(event.target.value)}
          sx={{ minWidth: { lg: 260 } }}
        />
        <TextField
          select
          size="small"
          label="Operating state"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          sx={{ minWidth: { lg: 190 } }}
        >
          <MenuItem value="all">All states</MenuItem>
          <MenuItem value="active_route">Active route</MenuItem>
          <MenuItem value="exceptions">Active exceptions</MenuItem>
          <MenuItem value="available">Available</MenuItem>
          <MenuItem value="in_route">In route</MenuItem>
          <MenuItem value="maintenance">Maintenance</MenuItem>
          <MenuItem value="off_duty">Off duty</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Sort"
          value={fleetSort}
          onChange={(event) => setFleetSort(event.target.value)}
          sx={{ minWidth: { lg: 190 } }}
        >
          <MenuItem value="exceptions">Exceptions first</MenuItem>
          <MenuItem value="route_state">Active routes first</MenuItem>
          <MenuItem value="pallet_capacity">Pallet capacity</MenuItem>
          <MenuItem value="name">Vehicle name</MenuItem>
        </TextField>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip clickable aria-pressed={filter === 'all'} label={`All ${vehicles.length}`} color={filter === 'all' ? 'primary' : 'default'} onClick={() => setFilter('all')} />
        {VEHICLE_TYPES.map((type) => (
          <Chip
            key={type}
            clickable
            aria-pressed={filter === type}
            label={`${VEHICLE_META[type].label} ${vehicleCountByType.get(type) || 0}`}
            color={filter === type ? 'primary' : 'default'}
            onClick={() => setFilter(type)}
          />
        ))}
      </Stack>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        {[
          {
            label: 'Available now',
            value: vehicles.filter((vehicle) => String(vehicle.status).toLowerCase() === 'available').length,
            detail: `${vehicles.length} total vehicles`,
          },
          {
            label: 'Active routes',
            value: activeRoutes.length,
            detail: `${activeRoutes.reduce((sum, route) => sum + (route.jobIds?.length || route.jobCount || 0), 0)} planned stops`,
          },
          {
            label: 'Active exceptions',
            value: Array.from(exceptionCountByVehicleId.values()).reduce((sum, count) => sum + count, 0),
            detail: 'Sorted to the top by default',
          },
          {
            label: 'Load-fit ready',
            value: vehicles.filter((vehicle) =>
              Boolean(
                vehicle.capacityWeightKg &&
                vehicle.capacityVolumeM3 &&
                routingProfileFor(vehicle).cargo?.maxPalletPositions,
              ),
            ).length,
            detail: 'Weight, volume, and pallet limits set',
          },
        ].map((metric) => (
          <Grid item xs={12} sm={6} xl={3} key={metric.label}>
            <SurfacePanel>
              <Typography variant="subtitle2" color="text.secondary">{metric.label}</Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {metric.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">{metric.detail}</Typography>
            </SurfacePanel>
          </Grid>
        ))}
      </Grid>

      <SurfacePanel sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h5">Fleet Directory</Typography>
          <Typography variant="body2" color="text.secondary">Vehicle type, capacity, status, and operational attributes from saved fleet records.</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vehicle</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Operational profile</TableCell>
                <TableCell>Current route</TableCell>
                <TableCell>Exceptions</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleVehicles.map((vehicle) => {
                const key = normalizeVehicleType(vehicle.vehicleType || vehicle.type);
                const meta = VEHICLE_META[key];
                const routingProfile = routingProfileFor(vehicle);
                const configuredRuleCount = (routingProfile.operatingRules || []).filter(
                  (rule) => rule.active !== false,
                ).length;
                const route = routeByVehicleId.get(vehicle.id);
                const driver = route?.driverId ? driverById.get(route.driverId) : null;
                const exceptionCount = exceptionCountByVehicleId.get(vehicle.id) || 0;
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
                        <Typography variant="body2">Weight: {vehicle.capacityWeightKg ? `${Math.round(Number(vehicle.capacityWeightKg) * POUNDS_PER_KILOGRAM).toLocaleString()} lb` : meta.weight}</Typography>
                        <Typography variant="body2">Volume: {vehicle.capacityVolumeM3 ? `${Math.round(Number(vehicle.capacityVolumeM3) * CUBIC_FEET_PER_CUBIC_METER).toLocaleString()} cu ft` : meta.volume}</Typography>
                        <Typography variant="caption" color="text.secondary">{vehicle.territoryRestriction || 'Territory open'} • {vehicle.maxRouteMinutes || 'Route duration ready'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {routingProfile.cargo?.maxPalletPositions
                            ? `${routingProfile.cargo.maxPalletPositions} pallet positions`
                            : 'Pallet fit pending'}
                          {' • '}
                          {configuredRuleCount
                            ? `${configuredRuleCount} operating ${configuredRuleCount === 1 ? 'rule' : 'rules'}`
                            : 'No vehicle rules'}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {route ? (
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {String(route.workflowStatus || route.status).replace(/_/g, ' ')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {driver
                              ? `${driver.firstName} ${driver.lastName}`
                              : 'Driver unassigned'}
                            {' • '}
                            {route.jobIds?.length || route.jobCount || 0} stops
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">At depot / unassigned</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={exceptionCount ? 'warning' : 'success'}
                        variant={exceptionCount ? 'filled' : 'outlined'}
                        label={exceptionCount ? `${exceptionCount} active` : 'Clear'}
                      />
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
            <Grid item xs={12} md={6}><TextField label="Volume capacity (cu ft)" type="number" value={formData.volumeCapacity} onChange={(event) => setFormData((current) => ({ ...current, volumeCapacity: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Payload capacity (lb)" type="number" value={formData.weightCapacity} onChange={(event) => setFormData((current) => ({ ...current, weightCapacity: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Territory restriction" value={formData.territoryRestriction} onChange={(event) => setFormData((current) => ({ ...current, territoryRestriction: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Max route minutes" value={formData.maxRouteMinutes} onChange={(event) => setFormData((current) => ({ ...current, maxRouteMinutes: event.target.value }))} fullWidth /></Grid>
          </Grid>

          <Divider />
          <Box>
            <Typography variant="h6">Cargo envelope and pallet fit</Typography>
            <Typography variant="body2" color="text.secondary">
              These measurements power rough floor-position and stack-height estimates. They are planning guidance, not an axle-weight or securement certification.
            </Typography>
          </Box>
          <Grid container spacing={2} data-testid="vehicle-cargo-profile-fields">
            <Grid item xs={6} md={3}><TextField label="Interior length (in)" type="number" value={formData.interiorLengthIn} onChange={(event) => setFormData((current) => ({ ...current, interiorLengthIn: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={6} md={3}><TextField label="Interior width (in)" type="number" value={formData.interiorWidthIn} onChange={(event) => setFormData((current) => ({ ...current, interiorWidthIn: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={6} md={3}><TextField label="Interior height (in)" type="number" value={formData.interiorHeightIn} onChange={(event) => setFormData((current) => ({ ...current, interiorHeightIn: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={6} md={3}><TextField label="Door height (in)" type="number" value={formData.doorHeightIn} onChange={(event) => setFormData((current) => ({ ...current, doorHeightIn: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={6} md={3}><TextField label="Pallet positions" type="number" value={formData.maxPalletPositions} onChange={(event) => setFormData((current) => ({ ...current, maxPalletPositions: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={6} md={3}><TextField label="Max pallet weight (lb)" type="number" value={formData.maxPalletWeightLb} onChange={(event) => setFormData((current) => ({ ...current, maxPalletWeightLb: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={6} md={3}><TextField label="Max stack height (in)" type="number" value={formData.maxStackHeightIn} onChange={(event) => setFormData((current) => ({ ...current, maxStackHeightIn: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={6} md={3}><TextField label="Max stack levels" type="number" value={formData.maxStackLevels} onChange={(event) => setFormData((current) => ({ ...current, maxStackLevels: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Vehicle features" helperText="Comma-separated: liftgate, pallet jack, side door" value={formData.features} onChange={(event) => setFormData((current) => ({ ...current, features: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Handling capabilities" helperText="Comma-separated: refrigerated, frozen, hazmat" value={formData.handlingCapabilities} onChange={(event) => setFormData((current) => ({ ...current, handlingCapabilities: event.target.value }))} fullWidth /></Grid>
          </Grid>

          <Divider />
          <Box>
            <Typography variant="h6">Driver eligibility</Typography>
            <Typography variant="body2" color="text.secondary">
              Use an allow list for dedicated equipment or a block list for specific driver–vehicle exceptions.
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                select
                label="Only allow these drivers"
                value={formData.allowedDriverIds}
                onChange={(event) => setFormData((current) => ({ ...current, allowedDriverIds: typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value }))}
                SelectProps={{ multiple: true }}
                fullWidth
              >
                {drivers.map((driver) => <MenuItem key={driver.id} value={driver.id}>{driver.firstName} {driver.lastName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                label="Never assign these drivers"
                value={formData.blockedDriverIds}
                onChange={(event) => setFormData((current) => ({ ...current, blockedDriverIds: typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value }))}
                SelectProps={{ multiple: true }}
                fullWidth
              >
                {drivers.map((driver) => <MenuItem key={driver.id} value={driver.id}>{driver.firstName} {driver.lastName}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>

          <Divider />
          <Stack spacing={1.25} data-testid="vehicle-operating-rules">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Box>
                <Typography variant="h6">Vehicle operating rules</Typography>
                <Typography variant="body2" color="text.secondary">Write handling or operating instructions for review. Use the structured capacity, feature, and driver fields above for rules that must block an assignment automatically.</Typography>
              </Box>
              <Button
                variant="outlined"
                onClick={() => setFormData((current) => ({
                  ...current,
                  operatingRules: [
                    ...current.operatingRules,
                    {
                      id: `vehicle-rule-${Date.now()}`,
                      label: '',
                      instruction: '',
                      severity: 'warning',
                      active: true,
                    },
                  ],
                }))}
              >
                Add rule
              </Button>
            </Stack>
            {formData.operatingRules.map((rule, index) => (
              <Grid container spacing={1.5} key={rule.id} alignItems="center">
                <Grid item xs={12} md={3}><TextField label="Rule name" value={rule.label} onChange={(event) => setFormData((current) => ({ ...current, operatingRules: current.operatingRules.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} fullWidth /></Grid>
                <Grid item xs={12} md={5}><TextField label="Instruction" value={rule.instruction} onChange={(event) => setFormData((current) => ({ ...current, operatingRules: current.operatingRules.map((item, itemIndex) => itemIndex === index ? { ...item, instruction: event.target.value } : item) }))} fullWidth /></Grid>
                <Grid item xs={6} md={2}><TextField select label="Severity" value={rule.severity} onChange={(event) => setFormData((current) => ({ ...current, operatingRules: current.operatingRules.map((item, itemIndex) => itemIndex === index ? { ...item, severity: event.target.value as FleetOperatingRule['severity'] } : item) }))} fullWidth><MenuItem value="warning">Advisory</MenuItem><MenuItem value="hard">Required review</MenuItem></TextField></Grid>
                <Grid item xs={6} md={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <FormControlLabel control={<Switch checked={rule.active !== false} onChange={(event) => setFormData((current) => ({ ...current, operatingRules: current.operatingRules.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item) }))} />} label="Active" />
                    <Button color="error" size="small" onClick={() => setFormData((current) => ({ ...current, operatingRules: current.operatingRules.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</Button>
                  </Stack>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSubmit()}>Save Vehicle</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
