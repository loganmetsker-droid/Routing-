import { useMemo, useState } from 'react';
import {
  AddAlertOutlined,
  CalendarTodayOutlined,
  CheckCircleOutlineOutlined,
  FilterListOutlined,
  LocalShippingOutlined,
  MailOutlineOutlined,
  PersonOutlineOutlined,
  PhoneOutlined,
  SearchOutlined,
  ShieldOutlined,
  StarOutlined,
  TrackChangesOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
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
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LoadingState from '../components/ui/LoadingState';
import type { DriverRecord } from '../services/api.types';
import {
  useCreateDriverMutation,
  useDriversQuery,
  useUpdateDriverMutation,
  useVehiclesQuery,
} from '../services/fleetApi';
import { trovanColors } from '../theme/designTokens';

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

function Panel({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '13px',
        boxShadow: '0 8px 24px rgba(16,24,40,.07)',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function DriverMetric({
  icon,
  label,
  value,
  footer,
  tone = trovanColors.copper[500],
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  footer: string;
  tone?: string;
}) {
  return (
    <Panel sx={{ minHeight: 104, p: 1.55 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', color: tone, bgcolor: alpha(tone, 0.12) }}>
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}>{label}</Typography>
          <Typography sx={{ mt: 0.25, fontSize: 23, fontWeight: 900, letterSpacing: '-0.04em' }}>{value}</Typography>
        </Box>
      </Stack>
      <Typography sx={{ mt: 1.35, fontSize: 12, color: 'text.secondary', fontWeight: 800 }}>
        {footer}
      </Typography>
    </Panel>
  );
}

function driverReadinessScore(driver: DriverRecord) {
  const checks = [
    Boolean(driver.firstName && driver.lastName),
    Boolean(driver.phone),
    Boolean(driver.email),
    Boolean(driver.licenseNumber),
    String(driver.status || '').toUpperCase() === 'ACTIVE',
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function currentWeekLabels() {
  const formatter = new Intl.DateTimeFormat([], { weekday: 'short', day: 'numeric' });
  const today = new Date();
  const start = new Date(today);
  const day = today.getDay() || 7;
  start.setDate(today.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return formatter.format(date);
  });
}

function statusLabel(driver: DriverRecord, hasVehicle: boolean) {
  const status = String(driver.status || '').toUpperCase();
  if (status === 'OFF_DUTY' || status === 'INACTIVE') return 'Off Shift';
  if (!driver.phone || !driver.licenseNumber) return 'Compliance';
  if (hasVehicle) return 'En Route';
  return 'Available';
}

function statusColor(label: string) {
  if (label === 'Available') return 'success';
  if (label === 'En Route') return 'info';
  if (label === 'Compliance') return 'warning';
  if (label === 'Off Shift') return 'default';
  return 'default';
}

export default function DriversPage() {
  const isMobile = useMediaQuery('(max-width:599.95px)');
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const createDriverMutation = useCreateDriverMutation();
  const updateDriverMutation = useUpdateDriverMutation();
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const loading = driversQuery.isLoading || vehiclesQuery.isLoading;
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverRecord | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) || drivers[0] || null,
    [drivers, selectedDriverId],
  );

  const visibleDrivers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return drivers.filter((driver) => {
      const status = String(driver.status || '').toUpperCase();
      const hasVehicle = Boolean(driver.assignedVehicleId);
      const hasIssue = !driver.licenseNumber || !driver.phone;
      const matchesSearch = !normalizedSearch || [
        driver.firstName,
        driver.lastName,
        driver.email,
        driver.phone,
        driver.licenseNumber,
        driver.assignedVehicleId,
      ].join(' ').toLowerCase().includes(normalizedSearch);
      if (!matchesSearch) return false;
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
  }, [drivers, filter, search]);

  const openCreate = () => {
    setSaveError(null);
    setEditingDriver(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (driver: DriverRecord) => {
    setSaveError(null);
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
      setSaveError(null);
      if (editingDriver) {
        await updateDriverMutation.mutateAsync({ id: editingDriver.id, updates: formData });
      } else {
        await createDriverMutation.mutateAsync(formData);
      }
      setDialogOpen(false);
      setNotice(editingDriver ? 'Driver updated.' : 'Driver added.');
    } catch (error) {
      setSaveError('Driver could not be saved. Check the required fields and try again.');
    }
  };

  if (loading) {
    return <LoadingState label="Loading drivers..." minHeight="50vh" />;
  }

  const selectedVehicle = selectedDriver
    ? vehicles.find((vehicle) => vehicle.id === selectedDriver.assignedVehicleId)
    : null;
  const activeDrivers = drivers.filter((driver) => String(driver.status || '').toUpperCase() === 'ACTIVE');
  const onRouteDrivers = activeDrivers.filter((driver) => Boolean(driver.assignedVehicleId));
  const availableDrivers = activeDrivers.filter((driver) => !driver.assignedVehicleId);
  const offShiftDrivers = drivers.filter((driver) => ['OFF_DUTY', 'INACTIVE'].includes(String(driver.status || '').toUpperCase()));
  const complianceIssues = drivers.filter((driver) => !driver.phone || !driver.licenseNumber);
  const utilizationPercent = activeDrivers.length ? Math.round((onRouteDrivers.length / activeDrivers.length) * 100) : 0;
  const weekLabels = currentWeekLabels();
  const selectedReadiness = selectedDriver ? driverReadinessScore(selectedDriver) : 0;
  const driverAlerts = [
    complianceIssues.length
      ? ['Compliance Missing', `${complianceIssues.length} driver${complianceIssues.length === 1 ? '' : 's'} need phone or license data`, 'High', trovanColors.semantic.danger]
      : null,
    availableDrivers.length
      ? ['Available Capacity', `${availableDrivers.length} active driver${availableDrivers.length === 1 ? '' : 's'} without an assigned vehicle`, 'Review', trovanColors.semantic.warning]
      : null,
    offShiftDrivers.length
      ? ['Off Shift', `${offShiftDrivers.length} driver${offShiftDrivers.length === 1 ? '' : 's'} unavailable`, 'Info', trovanColors.semantic.blue]
      : null,
  ].filter((item): item is string[] => Boolean(item));

  return (
    <Box data-testid="drivers-page">
      {notice ? (
        <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 1.2 }}>
          {notice}
        </Alert>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 430px' }, gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' }, gap: 1.3, mb: 1.55 }}>
            <DriverMetric icon={<PersonOutlineOutlined />} label="Available Drivers" value={String(availableDrivers.length)} footer="Active without vehicle" />
            <DriverMetric icon={<TrackChangesOutlined />} label="On Route" value={String(onRouteDrivers.length)} footer="Assigned vehicle" tone={trovanColors.semantic.teal} />
            <DriverMetric icon={<WarningAmberOutlined />} label="Off Shift" value={String(offShiftDrivers.length)} footer="Inactive/off duty" tone={trovanColors.semantic.purple} />
            <DriverMetric icon={<AddAlertOutlined />} label="Overtime Risk" value="—" footer="Hours feed not connected" tone={trovanColors.semantic.warning} />
            <DriverMetric icon={<ShieldOutlined />} label="Compliance Issues" value={String(complianceIssues.length)} footer="Missing phone/license" tone={trovanColors.semantic.danger} />
            <DriverMetric icon={<PersonOutlineOutlined />} label="Utilization" value={`${utilizationPercent}%`} footer={`${onRouteDrivers.length}/${activeDrivers.length || 0} active drivers`} tone={trovanColors.semantic.success} />
          </Box>

          <Panel>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={1.2} sx={{ px: 1.7, py: 1.35, borderBottom: '1px solid #e3e8ef' }}>
              <Typography sx={{ fontSize: 16, fontWeight: 900 }}>Driver Roster</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  size="small"
                  placeholder="Search drivers..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  sx={{ width: { xs: '100%', sm: 260 }, '& .MuiOutlinedInput-root': { height: 36, borderRadius: '9px' } }}
                  InputProps={{ startAdornment: <SearchOutlined sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }}
                />
                <Button variant="outlined" size="small" onClick={openCreate}>Add Driver</Button>
                <Button variant="outlined" size="small" startIcon={<FilterListOutlined />} onClick={() => setNotice('Use the status chips and search box to filter real driver records.')}>Filters</Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ px: 1.7, py: 1, borderBottom: '1px solid #e3e8ef' }}>
              {[
                ['all', 'All Statuses'],
                ['available', 'Available'],
                ['onRoute', 'En Route'],
                ['offShift', 'Off Shift'],
                ['issue', 'Issues'],
              ].map(([key, label]) => (
                <Chip
                  key={key}
                  clickable
                  aria-pressed={filter === key}
                  label={label}
                  color={filter === key ? 'primary' : 'default'}
                  onClick={() => setFilter(key as FilterKey)}
                  sx={{ borderRadius: '999px' }}
                />
              ))}
            </Stack>

            {isMobile ? (
              <Stack data-testid="drivers-mobile-list" spacing={1.1} sx={{ p: 1.2 }}>
                {visibleDrivers.map((driver, index) => {
                  const vehicle = vehicles.find((item) => item.id === driver.assignedVehicleId);
                  const label = statusLabel(driver, Boolean(vehicle));
                  const readiness = driverReadinessScore(driver);
                  const selected = driver.id === selectedDriver?.id;
                  return (
                    <Box
                      key={driver.id}
                      role="group"
                      aria-label={`${`${driver.firstName || ''} ${driver.lastName || ''}`.trim() || driver.id} driver record`}
                      sx={{
                        p: 1.5,
                        borderRadius: '11px',
                        border: '1px solid',
                        borderColor: selected ? alpha(trovanColors.copper[500], 0.58) : 'divider',
                        bgcolor: selected ? alpha(trovanColors.copper[500], 0.07) : 'background.paper',
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                        <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: index % 2 ? trovanColors.copper[500] : trovanColors.semantic.blue }}>
                            {(driver.firstName || 'D').slice(0, 1)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 900 }}>{driver.firstName} {driver.lastName}</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{driver.id}</Typography>
                          </Box>
                        </Stack>
                        <Chip size="small" label={label} color={statusColor(label)} />
                      </Stack>
                      <Box sx={{ mt: 1.35, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.1 }}>
                        <Box>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 800 }}>VEHICLE</Typography>
                          <Typography sx={{ mt: 0.2, fontSize: 13, fontWeight: 750 }}>{vehicle ? `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.id : 'Unassigned'}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 800 }}>SHIFT</Typography>
                          <Typography sx={{ mt: 0.2, fontSize: 13, fontWeight: 750 }}>{String(driver.status || 'ACTIVE').replace(/_/g, ' ')}</Typography>
                        </Box>
                      </Box>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.35 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ mb: 0.5, fontSize: 11, color: 'text.secondary', fontWeight: 800 }}>READINESS {readiness}%</Typography>
                          <LinearProgress
                            variant="determinate"
                            value={readiness}
                            aria-label={`${driver.firstName || 'Driver'} ${driver.lastName || ''} readiness`}
                            sx={{ height: 6, borderRadius: 99 }}
                          />
                        </Box>
                        <Button
                          size="small"
                          variant={selected ? 'contained' : 'outlined'}
                          aria-pressed={selected}
                          onClick={() => setSelectedDriverId(driver.id)}
                        >
                          {selected ? 'Selected' : 'Select'}
                        </Button>
                        <Button size="small" variant="outlined" onClick={(event) => { event.stopPropagation(); openEdit(driver); }}>
                          Edit
                        </Button>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Driver', 'Status', 'Vehicle', 'Route', 'Shift', 'Hours Today', 'ETA Back', 'Utilization', 'Safety Score', 'Actions'].map((label) => (
                      <TableCell key={label}>{label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleDrivers.map((driver, index) => {
                    const vehicle = vehicles.find((item) => item.id === driver.assignedVehicleId);
                    const label = statusLabel(driver, Boolean(vehicle));
                    const readiness = driverReadinessScore(driver);
                    return (
                      <TableRow
                        key={driver.id}
                        hover
                        selected={driver.id === selectedDriver?.id}
                        tabIndex={0}
                        aria-label={`Select driver ${`${driver.firstName || ''} ${driver.lastName || ''}`.trim() || driver.id}`}
                        onClick={() => setSelectedDriverId(driver.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedDriverId(driver.id);
                          }
                        }}
                        sx={{ cursor: 'pointer', '&.Mui-selected': { bgcolor: alpha(trovanColors.copper[500], 0.08) } }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 26, height: 26, bgcolor: index % 2 ? trovanColors.copper[500] : trovanColors.semantic.blue }}>
                              {(driver.firstName || 'D').slice(0, 1)}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontSize: 12, fontWeight: 900 }}>{driver.firstName} {driver.lastName}</Typography>
                              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{driver.id}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell><Chip size="small" label={label} color={statusColor(label)} /></TableCell>
                        <TableCell>{vehicle ? `${vehicle.id} ${vehicle.model || ''}` : '—'}</TableCell>
                        <TableCell>{vehicle ? 'Assigned' : '—'}</TableCell>
                        <TableCell>{String(driver.status || 'ACTIVE').replace(/_/g, ' ')}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>
                          <LinearProgress
                            variant="determinate"
                            value={readiness}
                            aria-label={`${driver.firstName || 'Driver'} ${driver.lastName || ''} utilization`}
                            sx={{ height: 5, borderRadius: 99, width: 94 }}
                          />
                        </TableCell>
                        <TableCell><Chip size="small" label={readiness} color={readiness < 80 ? 'warning' : 'success'} /></TableCell>
                        <TableCell>
                          <Button size="small" variant="text" onClick={(event) => { event.stopPropagation(); openEdit(driver); }}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            )}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, py: 1.15, borderTop: '1px solid #e3e8ef' }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Showing 1 to {visibleDrivers.length} of {drivers.length} drivers</Typography>
              <Stack direction="row" spacing={1}>{[1, 2, 3].map((page) => <Button key={page} variant={page === 1 ? 'outlined' : 'text'} size="small" sx={{ minWidth: 31 }} onClick={() => setNotice(page === 1 ? 'Already on the current driver page.' : 'Additional driver pages appear when the roster exceeds this page size.')}>{page}</Button>)}</Stack>
            </Stack>
          </Panel>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 0.9fr 0.95fr' }, gap: 1.3, mt: 1.5 }}>
            <Panel sx={{ p: 1.55 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontWeight: 900 }}>Weekly Schedule</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Current week</Typography>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.6, mt: 1.6 }}>
                {weekLabels.map((day, index) => (
                  <Box key={day} sx={{ textAlign: 'center', p: 0.9, borderRadius: '9px', bgcolor: index === 1 ? alpha(trovanColors.semantic.blue, 0.08) : 'transparent' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 850 }}>{day}</Typography>
                    <Typography sx={{ mt: 1, color: trovanColors.semantic.success, fontWeight: 900 }}>{activeDrivers.length}</Typography>
                    <Typography sx={{ mt: 1, color: trovanColors.semantic.blue, fontWeight: 900 }}>{onRouteDrivers.length}</Typography>
                  </Box>
                ))}
              </Box>
            </Panel>

            <Panel sx={{ p: 1.55 }}>
              <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 900 }}>Driver Readiness (Top 5)</Typography><Button size="small" onClick={() => setNotice('Scorecard is derived from saved driver readiness fields.')}>This Week ▾</Button></Stack>
              {drivers.slice(0, 5).map((driver, index) => (
                <Stack key={driver.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.6 }}>
                  <Typography sx={{ width: 20, fontSize: 12 }}>{index + 1}</Typography>
                  <Avatar sx={{ width: 22, height: 22 }}>{(driver.firstName || 'D').slice(0, 1)}</Avatar>
                  <Typography sx={{ flex: 1, fontSize: 12 }}>{driver.firstName} {driver.lastName}</Typography>
                  <Chip size="small" color={driverReadinessScore(driver) < 80 ? 'warning' : 'success'} label={driverReadinessScore(driver)} />
                </Stack>
              ))}
            </Panel>

            <Panel sx={{ p: 1.55 }}>
              <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 900 }}>Alerts</Typography><Button size="small" onClick={() => setFilter('issue')}>View all</Button></Stack>
              {driverAlerts.length ? driverAlerts.map(([title, body, level, color]) => (
                <Stack key={title} direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                  <WarningAmberOutlined sx={{ color: String(color) }} />
                  <Box sx={{ flex: 1 }}><Typography sx={{ fontSize: 12, fontWeight: 850 }}>{title}</Typography><Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{body}</Typography></Box>
                  <Typography sx={{ color: String(color), fontSize: 11, fontWeight: 900 }}>{level}</Typography>
                </Stack>
              )) : <Typography sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}>No driver alerts from saved roster data.</Typography>}
            </Panel>
          </Box>
        </Box>

        <Panel sx={{ minHeight: 800, p: 2 }}>
          {selectedDriver ? (
            <>
              <Stack direction="row" spacing={1.4} alignItems="flex-start">
                <Avatar sx={{ width: 62, height: 62, bgcolor: trovanColors.copper[500] }}>{(selectedDriver.firstName || 'S').slice(0, 1)}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 900 }}>{selectedDriver.firstName} {selectedDriver.lastName}</Typography>
                  <Chip size="small" color="success" label={selectedVehicle ? 'En Route' : 'Available'} sx={{ mt: 0.6 }} />
                </Box>
              </Stack>
              <Stack spacing={0.8} sx={{ mt: 1.7, color: 'text.secondary' }}>
                <Stack direction="row" spacing={1}><PhoneOutlined fontSize="small" /><Typography sx={{ fontSize: 13 }}>{selectedDriver.phone || 'Phone pending'}</Typography></Stack>
                <Stack direction="row" spacing={1}><MailOutlineOutlined fontSize="small" /><Typography sx={{ fontSize: 13 }}>{selectedDriver.email || 'Email pending'}</Typography></Stack>
                <Stack direction="row" spacing={1}><StarOutlined fontSize="small" /><Typography sx={{ fontSize: 13 }}>Readiness {selectedReadiness}%</Typography></Stack>
              </Stack>

              <Box sx={{ borderTop: '1px solid #e3e8ef', mt: 2, pt: 1.5 }}>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 900 }}>Credentials</Typography><Button size="small" onClick={() => openEdit(selectedDriver)}>Edit</Button></Stack>
                {[
                  ['License Type', selectedDriver.licenseType || 'Not recorded', Boolean(selectedDriver.licenseType)],
                  ['License Number', selectedDriver.licenseNumber || 'Missing', Boolean(selectedDriver.licenseNumber)],
                  ['Status', String(selectedDriver.status || 'ACTIVE').replace(/_/g, ' '), String(selectedDriver.status || '').toUpperCase() === 'ACTIVE'],
                ].map(([cert, value, ok]) => (
                  <Stack key={String(cert)} direction="row" alignItems="center" spacing={1} sx={{ py: 0.7 }}>
                    <ShieldOutlined sx={{ color: trovanColors.semantic.warning, fontSize: 17 }} />
                    <Typography sx={{ flex: 1, fontSize: 12 }}>{String(cert)}: {String(value)}</Typography>
                    <Chip size="small" color={ok ? 'success' : 'warning'} label={ok ? 'Saved' : 'Needed'} />
                  </Stack>
                ))}
              </Box>

              <Box sx={{ borderTop: '1px solid #e3e8ef', mt: 1.5, pt: 1.5 }}>
                <Typography sx={{ fontWeight: 900, mb: 1 }}>Hours Of Service (Today)</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ width: 110, height: 110, borderRadius: '50%', background: `conic-gradient(${trovanColors.semantic.blue} 0 0%, #e3e8ef 0% 100%)`, display: 'grid', placeItems: 'center' }}>
                    <Box sx={{ width: 78, height: 78, borderRadius: '50%', bgcolor: 'background.paper', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                      <Typography sx={{ fontWeight: 900, fontSize: 21 }}>—</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>DRIVE</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    {['Drive Time Used', 'Drive Time Left', 'Shift Time Left'].map((label) => (
                      <Box key={label} sx={{ mb: 1.1 }}>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={0}
                          aria-label={label}
                          sx={{ height: 4, borderRadius: 99 }}
                        />
                      </Box>
                    ))}
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Hours-of-service telemetry is not connected yet.</Typography>
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ borderTop: '1px solid #e3e8ef', mt: 1.5, pt: 1.5 }}>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 900 }}>Current Assignment</Typography><Button size="small" onClick={() => setNotice(selectedVehicle ? 'Route detail opens from dispatch once route-run assignment is available.' : 'No route assignment for this driver.')}>View route</Button></Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1 }}>
                  {[
                    [CalendarTodayOutlined, 'Route', selectedVehicle ? 'Assigned vehicle route' : '—'],
                    [LocalShippingOutlined, 'Vehicle', selectedVehicle ? `${selectedVehicle.id} (${selectedVehicle.model})` : '—'],
                    [TrackChangesOutlined, 'Next Stop', '—'],
                    [CheckCircleOutlineOutlined, 'ETA', '—'],
                  ].map(([Icon, label, value]) => {
                    const AssignmentIcon = Icon as typeof CalendarTodayOutlined;
                    return (
                      <Box key={String(label)} sx={{ p: 1, border: '1px solid #e3e8ef', borderRadius: '9px' }}>
                        <AssignmentIcon sx={{ color: 'text.secondary', fontSize: 17 }} />
                        <Typography sx={{ color: 'text.secondary', fontSize: 11 }}>{String(label)}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 850 }}>{String(value)}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <Box sx={{ borderTop: '1px solid #e3e8ef', mt: 1.5, pt: 1.5 }}>
                <Typography sx={{ fontWeight: 900, mb: 1 }}>Performance (This Week)</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                  {[
                    ['Readiness', `${selectedReadiness}%`, [12, 20, 16, 24, 18, 28, 22]],
                    ['Assigned Vehicle', selectedVehicle ? 'Yes' : 'No', selectedVehicle ? [20, 20, 20, 20, 20, 20, 20] : [4, 4, 4, 4, 4, 4, 4]],
                    ['Compliance', selectedDriver.licenseNumber && selectedDriver.phone ? 'Ready' : 'Needs info', selectedDriver.licenseNumber && selectedDriver.phone ? [20, 22, 20, 22, 20, 22, 20] : [8, 8, 8, 8, 8, 8, 8]],
                  ].map(([label, value, bars]) => (
                    <Box key={String(label)} sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{String(label)}</Typography>
                      <Typography sx={{ fontSize: 20, color: trovanColors.semantic.success, fontWeight: 900 }}>{String(value)}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.35, justifyContent: 'center', alignItems: 'end', height: 30 }}>
                        {(bars as number[]).map((height, index) => <Box key={index} sx={{ width: 5, height, bgcolor: alpha(trovanColors.semantic.success, 0.55) }} />)}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </>
          ) : (
            <Typography color="text.secondary">No driver selected.</Typography>
          )}
        </Panel>
      </Box>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setSaveError(null); }} fullWidth maxWidth="sm">
        <DialogTitle>{editingDriver ? 'Edit Driver' : 'Add Driver'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          {saveError ? <Alert severity="error">{saveError}</Alert> : null}
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
          <Button onClick={() => { setDialogOpen(false); setSaveError(null); }}>Cancel</Button>
          <Button variant="contained" disabled={createDriverMutation.isPending || updateDriverMutation.isPending} onClick={() => void handleSubmit()}>
            {createDriverMutation.isPending || updateDriverMutation.isPending ? 'Saving…' : 'Save Driver'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
