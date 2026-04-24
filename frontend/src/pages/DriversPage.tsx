import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import type { DriverRecord } from '../services/api.types';
import {
  useCreateDriverMutation,
  useDriversQuery,
  useUpdateDriverMutation,
  useVehiclesQuery,
} from '../services/fleetApi';

type FilterKey = 'all' | 'available' | 'onRoute' | 'offShift' | 'issue';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  licenseNumber: '',
  licenseType: 'CLASS_C',
  assignedVehicleId: '',
  notes: '',
  status: 'ACTIVE',
};

export default function DriversPage() {
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const createDriverMutation = useCreateDriverMutation();
  const updateDriverMutation = useUpdateDriverMutation();
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const loading = driversQuery.isLoading || vehiclesQuery.isLoading;
  const [filter, setFilter] = useState<FilterKey>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverRecord | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const visibleDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const status = String(driver.status || '').toUpperCase();
      const hasVehicle = Boolean(driver.assignedVehicleId);
      const hasIssue = !driver.licenseNumber || !driver.phone;
      switch (filter) {
        case 'available':
          return status === 'ACTIVE' && !hasVehicle;
        case 'onRoute':
          return status === 'ACTIVE' && hasVehicle;
        case 'offShift':
          return ['OFF_DUTY', 'INACTIVE'].includes(status);
        case 'issue':
          return hasIssue;
        default:
          return true;
      }
    });
  }, [drivers, filter]);

  const openCreate = () => {
    setEditingDriver(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (driver: DriverRecord) => {
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
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingDriver) {
        await updateDriverMutation.mutateAsync({
          id: editingDriver.id,
          updates: formData,
        });
      } else {
        await createDriverMutation.mutateAsync(formData);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save driver', error);
    }
  };

  if (loading) {
    return <LoadingState label="Loading drivers..." minHeight="50vh" />;
  }

  return (
    <Box>
      <PageHeader eyebrow="Resources" title="Drivers" subtitle="Operational roster with fast filtering for availability, route assignment, and personnel issues." actions={<Button variant="contained" onClick={openCreate}>Add Driver</Button>} />

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        {[
          ['all', 'All'],
          ['available', 'Available'],
          ['onRoute', 'On route'],
          ['offShift', 'Off shift'],
          ['issue', 'Issue'],
        ].map(([key, label]) => (
          <Chip key={key} clickable label={label} color={filter === key ? 'primary' : 'default'} onClick={() => setFilter(key as FilterKey)} />
        ))}
      </Stack>

      <SurfacePanel sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h5">Driver Directory</Typography>
          <Typography variant="body2" color="text.secondary">{visibleDrivers.length} drivers in the current filter.</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Driver</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assigned vehicle</TableCell>
                <TableCell>License</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleDrivers.map((driver) => {
                const vehicle = vehicles.find((item) => item.id === driver.assignedVehicleId);
                const hasIssue = !driver.licenseNumber || !driver.phone;
                return (
                  <TableRow key={driver.id} hover>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{driver.firstName} {driver.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">{driver.email || 'No email'}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={driver.status || 'ACTIVE'} color={String(driver.status).toUpperCase() === 'ACTIVE' ? 'success' : 'default'} />
                        {hasIssue ? <Chip size="small" label="Issue" color="warning" variant="outlined" /> : null}
                      </Stack>
                    </TableCell>
                    <TableCell>{vehicle ? vehicle.make + ' ' + vehicle.model + ' • ' + vehicle.licensePlate : 'Not assigned'}</TableCell>
                    <TableCell>{driver.licenseType || 'CLASS_C'} {driver.licenseNumber ? '• ' + driver.licenseNumber : ''}</TableCell>
                    <TableCell>{driver.phone || 'Missing'}</TableCell>
                    <TableCell><Button size="small" onClick={() => openEdit(driver)}>Edit</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </SurfacePanel>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingDriver ? 'Edit Driver' : 'Add Driver'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="First name" value={formData.firstName} onChange={(event) => setFormData((current) => ({ ...current, firstName: event.target.value }))} fullWidth />
            <TextField label="Last name" value={formData.lastName} onChange={(event) => setFormData((current) => ({ ...current, lastName: event.target.value }))} fullWidth />
          </Stack>
          <TextField label="Email" value={formData.email} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} />
          <TextField label="Phone" value={formData.phone} onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))} />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="License number" value={formData.licenseNumber} onChange={(event) => setFormData((current) => ({ ...current, licenseNumber: event.target.value }))} fullWidth />
            <TextField select label="License type" value={formData.licenseType} onChange={(event) => setFormData((current) => ({ ...current, licenseType: event.target.value }))} fullWidth>
              <MenuItem value="CLASS_C">Class C</MenuItem>
              <MenuItem value="CLASS_B">Class B</MenuItem>
              <MenuItem value="CLASS_A">Class A</MenuItem>
            </TextField>
          </Stack>
          <TextField select label="Assigned vehicle" value={formData.assignedVehicleId} onChange={(event) => setFormData((current) => ({ ...current, assignedVehicleId: event.target.value }))}>
            <MenuItem value="">None</MenuItem>
            {vehicles.map((vehicle) => <MenuItem key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} • {vehicle.licensePlate}</MenuItem>)}
          </TextField>
          <TextField select label="Status" value={formData.status} onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="OFF_DUTY">Off shift</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
          <TextField label="Notes" multiline minRows={3} value={formData.notes} onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSubmit()}>Save Driver</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
