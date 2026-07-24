import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  CalendarMonthOutlined,
  CloseOutlined,
  DownloadOutlined,
  FmdGoodOutlined,
  GpsFixedOutlined,
  IosShareOutlined,
  MapOutlined,
  MoreVertOutlined,
  OpenInFullOutlined,
  RefreshOutlined,
  ScheduleOutlined,
  SettingsOutlined,
} from '@mui/icons-material';
import { StatusPill, type StatusPillTone } from '../components/StatusPill';
import LoadingState from '../components/ui/LoadingState';
import {
  type RouteRunRecord,
  type RouteRunStopRecord,
  useDispatchBoardQuery,
  useRouteRunDetailQuery,
} from '../features/dispatch/api/routeRunsApi';
import LiveRouteMapPanel from '../components/maps/LiveRouteMapPanel';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import { trovanColors } from '../theme/designTokens';

type PodStatus = 'Delivered' | 'Failed POD' | 'Missing POD';

type PodRow = {
  id: string;
  status: PodStatus;
  tone: StatusPillTone;
  deliveredAt: string;
  deliveredDate: string;
  deliveredTime: string;
  customerName: string;
  customerLocation: string;
  driverName: string;
  driverMeta: string;
  routeLabel: string;
  stopNumber: number;
  jobLabel: string;
  route: RouteRunRecord | null;
  stop: RouteRunStopRecord;
  validation: string;
  recipientName: string;
  recipientTitle: string;
};

function formatDateParts(value?: string | null) {
  if (!value) {
    return { date: '—', time: '—' };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: value, time: '-' };
  }
  return {
    date: date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

function rowStatus(stop: RouteRunStopRecord): { label: PodStatus; tone: StatusPillTone; validation: string } {
  const proof = stop.proofStatus;
  if (proof?.requiredProofComplete) {
    return { label: 'Delivered', tone: 'success', validation: 'Valid POD' };
  }
  if (proof?.proofCaptured || Number(proof?.capturedCount || 0) > 0) {
    return { label: 'Failed POD', tone: 'warning', validation: 'Signature Missing' };
  }
  return { label: 'Missing POD', tone: 'danger', validation: 'Missing' };
}

function buildPodRows(routes: RouteRunRecord[], stops: RouteRunStopRecord[], drivers: { id: string; firstName?: string; lastName?: string }[] = [], vehicles: { id: string; make?: string; model?: string }[] = []): PodRow[] {
  const routesById = new Map(routes.map((route) => [route.id, route]));
  const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const podStops = stops.length ? stops : [];
  return podStops
    .slice()
    .sort((a, b) => {
      const routeCompare = String(a.routeId).localeCompare(String(b.routeId));
      if (routeCompare !== 0) return routeCompare;
      return Number(a.stopSequence || 0) - Number(b.stopSequence || 0);
    })
    .map((stop, index) => {
      const route = routesById.get(stop.routeId) || null;
      const driver = route?.driverId ? driversById.get(route.driverId) : null;
      const vehicle = route?.vehicleId ? vehiclesById.get(route.vehicleId) : null;
      const status = rowStatus(stop);
      const timestamp = stop.actualDeparture || stop.actualArrival || stop.plannedArrival;
      const dateParts = formatDateParts(timestamp);
      const customerName = stop.presentation?.customerName || `Customer ${index + 1}`;
      const city = stop.presentation?.address?.split(',').slice(-2, -1)[0]?.trim() || 'Denver';
      const state = stop.presentation?.address?.split(',').slice(-1)[0]?.trim()?.split(' ')[0] || 'CO';
      return {
        id: stop.id,
        status: status.label,
        tone: status.tone,
        deliveredAt: `${dateParts.date} ${dateParts.time}`,
        deliveredDate: dateParts.date,
        deliveredTime: dateParts.time,
        customerName,
        customerLocation: `${city}, ${state}`,
        driverName: driver ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || driver.id : route?.driverId || 'Driver pending',
        driverMeta: vehicle ? `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.id : route?.vehicleId || 'Vehicle pending',
        routeLabel: route?.id || stop.routeId,
        stopNumber: Number(stop.stopSequence || index + 1),
        jobLabel: stop.jobId,
        route,
        stop,
        validation: status.validation,
        recipientName: stop.presentation?.customerName || 'Not captured',
        recipientTitle: 'Recipient',
      };
    });
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  minWidth = 176,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  minWidth?: number;
}) {
  return (
    <Stack spacing={0.65} sx={{ minWidth }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 850, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Select
        size="small"
        value={value}
        displayEmpty
        inputProps={{ 'aria-label': label }}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>{option}</MenuItem>
        ))}
      </Select>
    </Stack>
  );
}

function SignatureBox({ uri }: { uri?: string | null }) {
  return (
    <Box
      sx={{
        height: 92,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '9px',
        display: 'flex',
        alignItems: 'center',
        px: 2,
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,255,255,0.005))',
      }}
    >
      {uri ? (
        <Box component="img" src={uri} alt="Captured signature" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          No signature artifact captured.
        </Typography>
      )}
    </Box>
  );
}

function DeliveryPhoto({ uri }: { uri?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Box
        sx={{
          height: 138,
          borderRadius: '9px',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          position: 'relative',
          bgcolor: 'background.default',
        }}
      >
        {uri ? (
          <>
            <Box component="img" src={uri} alt="Proof artifact" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <IconButton
              size="small"
              aria-label="Open proof photo"
              onClick={() => setOpen(true)}
              sx={{
                position: 'absolute',
                right: 8,
                bottom: 8,
                width: 28,
                height: 28,
                bgcolor: alpha(trovanColors.brand.navy950, 0.68),
                color: '#fff',
              }}
            >
              <OpenInFullOutlined sx={{ fontSize: 15 }} />
            </IconButton>
          </>
        ) : (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', px: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No photo artifact captured.
            </Typography>
          </Box>
        )}
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth aria-label="Proof photo preview">
        <DialogContent sx={{ p: 1, bgcolor: 'background.default' }}>
          {uri ? (
            <Box
              component="img"
              src={uri}
              alt="Proof artifact enlarged"
              sx={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ProofOfDeliveryPage() {
  const isMobile = useMediaQuery('(max-width:599.95px)');
  const boardQuery = useDispatchBoardQuery();
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const board = boardQuery.data;
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const rows = useMemo(
    () => buildPodRows(board?.routeRuns ?? [], board?.routeRunStops ?? [], drivers, vehicles),
    [board?.routeRuns, board?.routeRunStops, drivers, vehicles],
  );
  const [statusFilter, setStatusFilter] = useState('All');
  const [driverFilter, setDriverFilter] = useState('All Drivers');
  const [customerFilter, setCustomerFilter] = useState('All Customers');
  const [routeFilter, setRouteFilter] = useState('All Routes');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (statusFilter !== 'All' && row.status !== statusFilter) return false;
    if (driverFilter !== 'All Drivers' && row.driverName !== driverFilter) return false;
    if (customerFilter !== 'All Customers' && row.customerName !== customerFilter) return false;
    if (routeFilter !== 'All Routes' && row.routeLabel !== routeFilter) return false;
    return true;
  }), [customerFilter, driverFilter, routeFilter, rows, statusFilter]);
  const selected = filteredRows.find((row) => row.id === selectedId) || filteredRows[0];
  const detailQuery = useRouteRunDetailQuery(selected?.stop.routeId || '');
  const proofArtifacts = (detailQuery.data?.proofArtifacts ?? []).filter((artifact) =>
    artifact.routeRunStopId === selected?.stop.id,
  );
  const signatureArtifact = proofArtifacts.find((artifact) =>
    String(artifact.type).toUpperCase() === 'SIGNATURE',
  );
  const photoArtifact = proofArtifacts.find((artifact) =>
    ['PHOTO', 'IMAGE', 'DOCUMENT', 'BOL'].includes(String(artifact.type).toUpperCase()),
  );
  const stopLocation = selected?.stop.presentation?.location;
  const statusOptions = ['All', 'Delivered', 'Failed POD', 'Missing POD'];
  const driverOptions = ['All Drivers', ...Array.from(new Set(rows.map((row) => row.driverName))).sort()];
  const customerOptions = ['All Customers', ...Array.from(new Set(rows.map((row) => row.customerName))).sort()];
  const routeOptions = ['All Routes', ...Array.from(new Set(rows.map((row) => row.routeLabel))).sort()];

  const handleExport = () => {
    const headers = ['POD ID', 'Status', 'Delivered', 'Customer', 'Driver', 'Route', 'Stop', 'Job'];
    const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      headers.map(escapeCell).join(','),
      ...filteredRows.map((row) =>
        [
          row.id,
          row.status,
          row.deliveredAt,
          row.customerName,
          row.driverName,
          row.routeLabel,
          row.stopNumber,
          row.jobLabel,
        ].map(escapeCell).join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trovan-pod-records.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`${filteredRows.length} POD record${filteredRows.length === 1 ? '' : 's'} exported.`);
  };

  if (boardQuery.isLoading || driversQuery.isLoading || vehiclesQuery.isLoading) {
    return <LoadingState label="Loading proof of delivery..." minHeight="50vh" />;
  }

  return (
    <Box
      data-testid="proof-of-delivery-page"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 420px' },
        gap: 0,
        alignItems: 'stretch',
        minHeight: { xl: 'calc(100vh - 106px)' },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {notice ? (
          <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 1.2 }}>
            {notice}
          </Alert>
        ) : null}
        <Box
          sx={{
            mb: 1.5,
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '13px 0 0 0',
            bgcolor: 'background.paper',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(4, minmax(150px, 1fr))' },
            gap: 1.25,
          }}
        >
          <FilterSelect label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
          <FilterSelect label="Date delivered" value="All dates" options={['All dates']} onChange={() => setNotice('Date filtering will activate when route-run stop history includes delivery dates.')} minWidth={220} />
          <FilterSelect label="Driver" value={driverFilter} options={driverOptions} onChange={setDriverFilter} />
          <FilterSelect label="Customer" value={customerFilter} options={customerOptions} onChange={setCustomerFilter} />
          <FilterSelect label="Route" value={routeFilter} options={routeOptions} onChange={setRouteFilter} />
          <FilterSelect label="Exception state" value="All" options={['All']} onChange={() => setNotice('Exception-state filtering will activate when POD exceptions are stored on proof records.')} />
          <Button variant="outlined" sx={{ alignSelf: 'end' }} startIcon={<MoreVertOutlined />} onClick={() => setNotice('Use the visible POD filters above; additional proof fields are not available yet.')}>
            Filters
          </Button>
          <Stack direction="row" spacing={1.25} sx={{ alignSelf: 'end', justifySelf: 'end' }}>
            <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={handleExport}>
              Export
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setStatusFilter('All');
                setDriverFilter('All Drivers');
                setCustomerFilter('All Customers');
                setRouteFilter('All Routes');
                setNotice('POD filters reset.');
              }}
            >
              Reset
            </Button>
            <Button variant="contained" onClick={() => setNotice(`${filteredRows.length} POD record${filteredRows.length === 1 ? '' : 's'} match the current filters.`)}>Apply Filters</Button>
          </Stack>
        </Box>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRight: { xl: 0 },
            borderRadius: { xs: '13px', xl: '13px 0 0 13px' },
            bgcolor: 'background.paper',
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 1.6, py: 1.35, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="body2" color="text.secondary">
              1 - {Math.max(filteredRows.length, 1)} of {Math.max(rows.length, 1)} PODs
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Typography variant="caption" color="text.secondary" fontWeight={800}>
                Auto refresh
              </Typography>
              <Box
                role="switch"
                tabIndex={0}
                aria-label="Auto refresh proof records"
                aria-checked={autoRefresh}
                onClick={() => {
                  setAutoRefresh((current) => !current);
                  setNotice(`POD auto refresh ${autoRefresh ? 'paused' : 'enabled'}.`);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setAutoRefresh((current) => !current);
                  }
                }}
                sx={{ width: 34, height: 18, borderRadius: 999, bgcolor: autoRefresh ? trovanColors.copper[500] : 'divider', position: 'relative', cursor: 'pointer' }}
              >
                <Box sx={{ position: 'absolute', right: autoRefresh ? 2 : 18, top: 2, width: 14, height: 14, borderRadius: '50%', bgcolor: '#fff' }} />
              </Box>
              <Divider flexItem orientation="vertical" />
              <IconButton size="small" aria-label="Refresh POD records" onClick={() => { void boardQuery.refetch(); setNotice('POD records refreshed.'); }}><RefreshOutlined fontSize="small" /></IconButton>
              <Divider flexItem orientation="vertical" />
              <IconButton size="small" aria-label="POD table settings" onClick={() => setNotice('POD table settings are limited to the visible filters in this release.')}><SettingsOutlined fontSize="small" /></IconButton>
            </Stack>
          </Stack>

          {isMobile ? (
            <Stack data-testid="pod-mobile-list" spacing={1.1} sx={{ p: 1.2 }}>
              {filteredRows.length === 0 ? (
                <Stack spacing={0.75} sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="subtitle1">No proof records found</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Route runs are loaded, but no stops match the current POD filters.
                  </Typography>
                </Stack>
              ) : null}
              {filteredRows.map((row) => {
                const selectedRow = selected?.id === row.id;
                return (
                  <Box
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select proof record ${row.id}`}
                    onClick={() => setSelectedId(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(row.id);
                      }
                    }}
                    sx={{
                      p: 1.45,
                      borderRadius: '11px',
                      border: '1px solid',
                      borderColor: selectedRow ? alpha(trovanColors.copper[500], 0.58) : 'divider',
                      bgcolor: selectedRow ? alpha(trovanColors.copper[500], 0.08) : 'background.paper',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                      <Box>
                        <Typography variant="body2" fontWeight={900}>{row.customerName}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.customerLocation}</Typography>
                      </Box>
                      <StatusPill label={row.status} tone={row.tone} />
                    </Stack>
                    <Box sx={{ mt: 1.15, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={800}>DELIVERED</Typography>
                        <Typography variant="body2">{row.deliveredDate}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.deliveredTime}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={800}>DRIVER</Typography>
                        <Typography variant="body2">{row.driverName}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.driverMeta}</Typography>
                      </Box>
                    </Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ mt: 1.15 }}>
                      <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 850 }}>
                        {row.routeLabel} · Stop {row.stopNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{row.jobLabel}</Typography>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          ) : (
          <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
            <Table stickyHeader size="small" aria-label="Proof of delivery queue">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      disabled
                      inputProps={{ 'aria-label': 'Select all proof records' }}
                    />
                  </TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Delivered</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Driver</TableCell>
                  <TableCell>Route</TableCell>
                  <TableCell>Stop</TableCell>
                  <TableCell>Job</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Stack spacing={0.75} sx={{ py: 3, textAlign: 'center' }}>
                        <Typography variant="subtitle1">No proof records found</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Route runs are loaded, but no stops match the current POD filters.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : null}
                {filteredRows.map((row) => {
                  const selectedRow = selected?.id === row.id;
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      selected={selectedRow}
                      tabIndex={0}
                      aria-label={`Select proof record ${row.id}`}
                      onClick={() => setSelectedId(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedId(row.id);
                        }
                      }}
                      sx={{
                        cursor: 'pointer',
                        '&.Mui-selected td, &.Mui-selected:hover td': {
                          bgcolor: alpha(trovanColors.copper[500], 0.08),
                        },
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selectedRow}
                          inputProps={{ 'aria-label': `Select proof record ${row.id}` }}
                          onChange={() => setSelectedId(row.id)}
                        />
                      </TableCell>
                      <TableCell><StatusPill label={row.status} tone={row.tone} /></TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.deliveredDate}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.deliveredTime}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{row.customerName}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.customerLocation}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.driverName}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.driverMeta}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'primary.main', fontWeight: 800 }}>{row.routeLabel}</TableCell>
                      <TableCell>{row.stopNumber}</TableCell>
                      <TableCell sx={{ color: 'primary.main', fontWeight: 800 }}>{row.jobLabel}</TableCell>
                      <TableCell align="right">›</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          )}

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.6, py: 1.4, borderTop: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={0.75}>
              <Button size="small" variant="contained" sx={{ minWidth: 31, width: 31, px: 0 }} onClick={() => setNotice('Already on the first POD page.')}>
                1
              </Button>
            </Stack>
            <Select
              size="small"
              value="25 per page"
              inputProps={{ 'aria-label': 'Proof records per page' }}
              sx={{ minWidth: 132 }}
              onChange={() => setNotice('POD page size is fixed until server pagination is connected.')}
            >
              <MenuItem value="25 per page">25 per page</MenuItem>
            </Select>
          </Stack>
        </Box>
      </Box>

      <Box
        component="aside"
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: { xs: '13px', xl: '0 13px 13px 0' },
          bgcolor: 'background.paper',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {selected ? (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h3" component="h2">{selected.id.replace(/-stop-.*/, '').replace('route-', 'POD-')}</Typography>
                  <StatusPill label={selected.status} tone={selected.tone} />
                </Stack>
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800 }}>
                  Job {selected.jobLabel} • Customer {selected.customerName} • Route {selected.routeLabel}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  aria-label={`Open route run ${selected.routeLabel}`}
                  component={RouterLink}
                  to={`/route-runs/${selected.stop.routeId}`}
                >
                  <IosShareOutlined fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label="Clear POD selection" onClick={() => { setSelectedId(null); setNotice('POD selection cleared.'); }}><CloseOutlined fontSize="small" /></IconButton>
              </Stack>
            </Stack>

            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.45fr', gap: 1.4 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>Delivery Photo</Typography>
                  <DeliveryPhoto uri={photoArtifact?.uri} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>Signature</Typography>
                  <SignatureBox uri={signatureArtifact?.uri} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Recipient Name</Typography>
                      <Typography variant="body2" fontWeight={700}>{selected.recipientName}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Title</Typography>
                      <Typography variant="body2" fontWeight={700}>{selected.recipientTitle}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                {[
                  [ScheduleOutlined, 'Delivered', `${selected.deliveredDate} CDT`],
                  [FmdGoodOutlined, 'Location', selected.stop.presentation?.address || 'Address pending'],
                  [CalendarMonthOutlined, 'Driver', `${selected.driverName} (${selected.driverMeta})`],
                  [
                    GpsFixedOutlined,
                    'GPS Coordinates',
                    stopLocation
                      ? `${stopLocation.latitude.toFixed(5)}, ${stopLocation.longitude.toFixed(5)}`
                      : 'Not captured',
                  ],
                  [MapOutlined, 'Route', selected.routeLabel],
                  [ScheduleOutlined, 'Captured At', `${selected.deliveredDate} CDT`],
                  [MapOutlined, 'Stop', `${selected.stopNumber} of ${Math.max(filteredRows.length, selected.stopNumber)}`],
                  [GpsFixedOutlined, 'Accuracy', 'Not tracked'],
                ].map(([Icon, label, value]) => {
                  const DetailIcon = Icon as typeof ScheduleOutlined;
                  return (
                    <Stack key={String(label)} direction="row" spacing={1} alignItems="flex-start">
                      <DetailIcon sx={{ color: 'text.secondary', fontSize: 18, mt: 0.25 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">{String(label)}</Typography>
                        <Typography variant="body2" fontWeight={700}>{String(value)}</Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Box>
            </Box>

            <Box
              sx={{
                m: 2,
                height: 142,
                borderRadius: '9px',
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <LiveRouteMapPanel
                routeRuns={board?.routeRuns.filter((route) => route.id === selected.stop.routeId) ?? []}
                routeRunStops={board?.routeRunStops.filter((stop) => stop.routeId === selected.stop.routeId) ?? []}
                vehicles={vehiclesQuery.data ?? []}
                drivers={driversQuery.data ?? []}
                height={142}
                selectedRouteId={selected.stop.routeId}
                showLegend={false}
                emptyTitle="No POD location geometry"
                emptyBody="This stop does not include geocoded location data yet."
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ p: 2, borderRight: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Notes</Typography>
                <Typography variant="body2">{selected.stop.notes || selected.stop.presentation?.instructions || 'No notes captured.'}</Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Attachments ({proofArtifacts.length})</Typography>
                {proofArtifacts.length ? proofArtifacts.map((artifact) => (
                  <Stack key={artifact.id} direction="row" spacing={1} alignItems="center" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.2, p: 1, mb: 1 }}>
                    <DownloadOutlined fontSize="small" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={800} noWrap>{artifact.type}</Typography>
                      <Typography variant="caption" color="text.secondary">{artifact.createdAt ? new Date(artifact.createdAt).toLocaleString() : artifact.id}</Typography>
                    </Box>
                    <IconButton
                      size="small"
                      aria-label={`Open ${artifact.type} artifact`}
                      component={artifact.uri ? 'a' : 'button'}
                      href={artifact.uri || undefined}
                      target={artifact.uri ? '_blank' : undefined}
                      rel={artifact.uri ? 'noreferrer' : undefined}
                      onClick={!artifact.uri ? () => setNotice('This proof artifact does not include a downloadable URI.') : undefined}
                    >
                      <DownloadOutlined fontSize="small" />
                    </IconButton>
                  </Stack>
                )) : (
                  <Typography variant="body2" color="text.secondary">No proof artifacts captured.</Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Validation Status</Typography>
                <StatusPill label={selected.validation} tone={selected.validation === 'Valid POD' ? 'success' : selected.tone} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {selected.validation === 'Valid POD'
                  ? 'Required proof artifacts are complete for this stop.'
                  : 'Review the captured artifacts and stop timeline before accepting this proof.'}
              </Typography>
            </Box>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
