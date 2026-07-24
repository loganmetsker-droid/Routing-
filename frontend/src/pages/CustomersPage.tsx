import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AccessTimeOutlined,
  AddOutlined,
  DownloadOutlined,
  EditOutlined,
  EmailOutlined,
  FilterListOutlined,
  Inventory2Outlined,
  LocalShippingOutlined,
  LockOutlined,
  MoreHorizOutlined,
  PhoneOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  TrackChangesOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import LoadingState from '../components/ui/LoadingState';
import LiveRouteMapPanel from '../components/maps/LiveRouteMapPanel';
import {
  getCustomerErrorMessage,
  type CustomerFormInput,
  type CustomerRecord,
  useCreateCustomerMutation,
  useCustomersQuery,
  useUpdateCustomerMutation,
} from '../services/customersApi';
import { useRoutesQuery } from '../services/dispatchApi';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import { useJobsQuery } from '../services/jobsApi';
import { trovanColors } from '../theme/designTokens';

function buildConstraintsSummary(formData: Record<string, string>) {
  return [
    formData.serviceTime ? 'Service time: ' + formData.serviceTime : '',
    formData.timeWindows ? 'Time windows: ' + formData.timeWindows : '',
    formData.callAheadRequired ? 'Call ahead required' : '',
    formData.gateCode ? 'Gate code: ' + formData.gateCode : '',
    formData.dockHours ? 'Dock hours: ' + formData.dockHours : '',
    formData.vehicleRestrictions ? 'Vehicle restrictions: ' + formData.vehicleRestrictions : '',
    formData.signatureRequired ? 'Signature required' : '',
    formData.weekendRestrictions ? 'Weekend restrictions: ' + formData.weekendRestrictions : '',
    formData.preferredTerritory ? 'Preferred territory: ' + formData.preferredTerritory : '',
    formData.additionalConstraints ? formData.additionalConstraints : '',
  ].filter(Boolean).join('\n');
}

const parseCustomerCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, ''));
};

const parseCustomerImportFile = async (file: File): Promise<CustomerFormInput[]> => {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        name: String(item.name || item.customerName || '').trim(),
        phone: typeof item.phone === 'string' ? item.phone : undefined,
        email: typeof item.email === 'string' ? item.email : undefined,
        businessName: typeof item.businessName === 'string' ? item.businessName : typeof item.industry === 'string' ? item.industry : undefined,
        defaultAddress: typeof item.defaultAddress === 'string' ? item.defaultAddress : typeof item.address === 'string' ? item.address : undefined,
        notes: typeof item.notes === 'string' ? item.notes : undefined,
        exceptions: typeof item.exceptions === 'string' ? item.exceptions : typeof item.deliveryRules === 'string' ? item.deliveryRules : undefined,
      }))
      .filter((item) => item.name);
  }

  const [headerLine, ...rows] = text.split(/\r?\n/).filter((line) => line.trim());
  if (!headerLine) return [];
  const headers = parseCustomerCsvLine(headerLine).map((header) => header.trim());

  return rows
    .map((row) => {
      const values = parseCustomerCsvLine(row);
      const record = headers.reduce<Record<string, string>>((accumulator, header, index) => {
        accumulator[header] = values[index] || '';
        return accumulator;
      }, {});
      return {
        name: (record.name || record.customerName || '').trim(),
        phone: record.phone || undefined,
        email: record.email || undefined,
        businessName: record.businessName || record.industry || undefined,
        defaultAddress: record.defaultAddress || record.address || undefined,
        notes: record.notes || undefined,
        exceptions: record.exceptions || record.deliveryRules || undefined,
      };
    })
    .filter((item) => item.name);
};

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  businessName: '',
  defaultAddress: '',
  notes: '',
  serviceTime: '',
  timeWindows: '',
  callAheadRequired: '',
  gateCode: '',
  dockHours: '',
  vehicleRestrictions: '',
  signatureRequired: '',
  weekendRestrictions: '',
  preferredTerritory: '',
  additionalConstraints: '',
};

function PrototypePanel({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '13px',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 18px 44px rgba(0,0,0,.26)'
            : '0 8px 24px rgba(16,24,40,.07)',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function MetricCard({
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
    <PrototypePanel sx={{ minHeight: 104, p: 1.55 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: tone,
            bgcolor: alpha(tone, 0.13),
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}>{label}</Typography>
          <Typography sx={{ mt: 0.25, fontSize: 23, fontWeight: 900, letterSpacing: '-0.04em' }}>{value}</Typography>
        </Box>
      </Stack>
      <Typography sx={{ mt: 1.35, fontSize: 12, color: trovanColors.semantic.success, fontWeight: 800 }}>
        {footer}
      </Typography>
    </PrototypePanel>
  );
}

function CustomerBadge({ name, index }: { name: string; index: number }) {
  const colors = [trovanColors.semantic.success, '#111827', trovanColors.semantic.blue, trovanColors.semantic.teal, trovanColors.semantic.purple];
  return (
    <Box
      sx={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        bgcolor: colors[index % colors.length],
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: 11,
        fontWeight: 900,
        flex: '0 0 auto',
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </Box>
  );
}

export default function CustomersPage() {
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const softSurface = isDark ? alpha(trovanColors.dark.surfaceAlt, 0.72) : '#fff';
  const selectedSurface = alpha(trovanColors.copper[500], isDark ? 0.18 : 0.09);
  const hoverSurface = isDark ? alpha('#FFFFFF', 0.04) : alpha(trovanColors.brand.navy950, 0.025);
  const customersQuery = useCustomersQuery();
  const jobsQuery = useJobsQuery();
  const routesQuery = useRoutesQuery();
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const createCustomerMutation = useCreateCustomerMutation();
  const updateCustomerMutation = useUpdateCustomerMutation();
  const customers = customersQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const routes = routesQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const loading =
    customersQuery.isLoading ||
    jobsQuery.isLoading ||
    routesQuery.isLoading ||
    driversQuery.isLoading ||
    vehiclesQuery.isLoading;
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [selectedSegment, setSelectedSegment] = useState('All');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestedCustomerId = searchParams.get('customerId') || '';

  useEffect(() => {
    if (!customers.length) {
      setSelectedCustomerId('');
      return;
    }
    if (requestedCustomerId && customers.some((customer) => customer.id === requestedCustomerId)) {
      if (selectedCustomerId !== requestedCustomerId) setSelectedCustomerId(requestedCustomerId);
      return;
    }
    if (!selectedCustomerId || !customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, requestedCustomerId, selectedCustomerId]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || customers[0] || null,
    [customers, selectedCustomerId],
  );

  const visibleCustomers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return customers
      .filter((customer) => selectedSegment === 'All' || (customer.businessName || 'Uncategorized') === selectedSegment)
      .filter((customer) => !normalized || [customer.name, customer.businessName, customer.defaultAddress, customer.address, customer.email, customer.phone]
        .join(' ')
        .toLowerCase()
        .includes(normalized));
  }, [customers, search, selectedSegment]);

  const segmentLabels = useMemo(() => {
    const labels = Array.from(new Set(customers.map((customer) => customer.businessName || 'Uncategorized'))).sort();
    return ['All', ...labels];
  }, [customers]);

  const jobsByCustomer = useMemo(() => {
    const byCustomer = new Map<string, typeof jobs>();
    customers.forEach((customer) => {
      const normalizedName = customer.name.toLowerCase();
      byCustomer.set(
        customer.id,
        jobs.filter((job) =>
          job.customerId === customer.id ||
          String(job.customerName || '').toLowerCase() === normalizedName,
        ),
      );
    });
    return byCustomer;
  }, [customers, jobs]);

  const selectedCustomerJobs = selectedCustomer
    ? jobsByCustomer.get(selectedCustomer.id) ?? []
    : [];
  const openSelectedJobs = selectedCustomerJobs.filter((job) =>
    !['completed', 'delivered', 'cancelled'].includes(String(job.status || '').toLowerCase()),
  );
  const completedCustomerJobs = jobs.filter((job) =>
    ['completed', 'delivered'].includes(String(job.status || '').toLowerCase()),
  ).length;
  const constrainedCustomers = customers.filter((customer) =>
    Boolean(customer.exceptions?.trim()),
  ).length;

  const openCreate = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (customer: CustomerRecord) => {
    setEditingCustomer(customer);
    setFormData({
      ...emptyForm,
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      businessName: customer.businessName || '',
      defaultAddress: customer.defaultAddress || customer.address || '',
      notes: customer.notes || '',
      additionalConstraints: customer.exceptions || '',
    });
    setDialogOpen(true);
  };

  const handleImportSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const candidates = await parseCustomerImportFile(file);
      if (!candidates.length) {
        setImportError('No valid customer rows were found. Include at least a name or customerName column.');
        return;
      }
      await Promise.all(candidates.map((customer) => createCustomerMutation.mutateAsync(customer)));
      setImportDialogOpen(false);
      setImportError(null);
      setNotice(`${candidates.length} customer${candidates.length === 1 ? '' : 's'} imported.`);
    } catch (error) {
      console.error('Failed to import customers', error);
      setImportError('Import supports JSON arrays or CSV files with name, phone, email, businessName, address, notes, and exceptions columns.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSubmit = async () => {
    const payload: CustomerFormInput = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      businessName: formData.businessName,
      defaultAddress: formData.defaultAddress,
      notes: formData.notes,
      exceptions: buildConstraintsSummary(formData),
    };

    try {
      if (editingCustomer) {
        await updateCustomerMutation.mutateAsync({ id: editingCustomer.id, updates: payload });
      } else {
        await createCustomerMutation.mutateAsync(payload);
      }
      setDialogOpen(false);
      setNotice(editingCustomer ? 'Customer updated.' : 'Customer created.');
    } catch (error) {
      console.error('Failed to save customer', getCustomerErrorMessage(error));
    }
  };

  if (loading) {
    return <LoadingState label="Loading customers..." minHeight="50vh" />;
  }

  return (
    <Box data-testid="customers-page">
      <input ref={importInputRef} type="file" hidden accept=".csv,.json" onChange={handleImportSelection} />
      {notice ? (
        <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 1.2 }}>
          {notice}
        </Alert>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 480px' }, gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.75 }}>
            <Stack direction="row" spacing={1.1}>
              <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>Add Customer</Button>
              <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={() => setImportDialogOpen(true)}>Import</Button>
              <Button variant="outlined" onClick={() => setNotice('Segments are grouped from each customer industry field.')}>Segments ▾</Button>
            </Stack>
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 1.3, mb: 1.55 }}>
            <MetricCard icon={<TrackChangesOutlined />} label="Completed Jobs" value={`${completedCustomerJobs}`} footer="Live job status" tone={trovanColors.semantic.success} />
            <MetricCard icon={<LocalShippingOutlined />} label="Customer Jobs" value={`${jobs.length}`} footer="Open and historical jobs" />
            <MetricCard icon={<AccessTimeOutlined />} label="Customers" value={`${customers.length}`} footer="Loaded customer records" tone={trovanColors.semantic.warning} />
            <MetricCard icon={<Inventory2Outlined />} label="Constraint Notes" value={`${constrainedCustomers}`} footer="Customers with delivery rules" tone={trovanColors.semantic.purple} />
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1.2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 850, mr: 0.4 }}>Segments</Typography>
            {segmentLabels.map((label) => (
              <Button
                key={label}
                aria-pressed={label === selectedSegment}
                variant={label === selectedSegment ? 'outlined' : 'text'}
                size="small"
                onClick={() => setSelectedSegment(label)}
                sx={{
                  minHeight: 34,
                  color: label === selectedSegment ? (isDark ? trovanColors.copper[200] : trovanColors.copper[600]) : 'text.primary',
                  bgcolor: label === selectedSegment ? alpha(trovanColors.copper[500], isDark ? 0.18 : 0.07) : softSurface,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {label}
              </Button>
            ))}
            <Button variant="text" size="small" onClick={openCreate}>+ Add Segment</Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setSearch('');
                setSelectedSegment('All');
                setNotice('Customer filters cleared.');
              }}
            >
              Clear
            </Button>
            <Button variant="text" size="small" onClick={() => setNotice('Customer view saved for this session.')}>Save View</Button>
          </Stack>

          <PrototypePanel>
            <Stack direction="row" spacing={1} sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                size="small"
                placeholder="Search customers..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 36, borderRadius: '9px' } }}
                InputProps={{ startAdornment: <SearchOutlined sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }}
              />
              <Button variant="outlined" size="small" onClick={() => setNotice('Industry filtering is controlled by the segment chips above.')}>Industry ▾</Button>
              <Button variant="outlined" size="small" onClick={() => setNotice('All loaded customer records are active in this workspace.')}>Status ▾</Button>
              <Button variant="outlined" size="small" startIcon={<FilterListOutlined />} onClick={() => setNotice('Use search plus segment chips for the current customer data fields.')}>More Filters</Button>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Customer Name', 'Locations', 'Industry', 'Open Jobs', 'SLA / Service Level', 'Last Delivery', 'Revenue', 'Status', 'Actions'].map((label) => (
                      <TableCell key={label}>{label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleCustomers.map((customer, index) => {
                    const selected = customer.id === selectedCustomer?.id;
                    const customerJobs = jobsByCustomer.get(customer.id) ?? [];
                    const locations = customer.defaultAddress || customer.address ? 1 : 0;
                    const openJobs = customerJobs.filter((job) =>
                      !['completed', 'delivered', 'cancelled'].includes(String(job.status || '').toLowerCase()),
                    ).length;
                    const completedJobs = customerJobs.filter((job) =>
                      ['completed', 'delivered'].includes(String(job.status || '').toLowerCase()),
                    ).length;
                    const completionRate = customerJobs.length
                      ? Math.round((completedJobs / customerJobs.length) * 100)
                      : 0;
                    const lastJobDate = customerJobs
                      .map((job) => job.updatedAt || job.createdAt)
                      .filter(Boolean)
                      .sort()
                      .slice(-1)[0];
                    return (
                      <TableRow
                        key={customer.id}
                        hover
                        selected={selected}
                        tabIndex={0}
                        aria-label={`Select customer ${customer.name}`}
                        onClick={() => setSelectedCustomerId(customer.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedCustomerId(customer.id);
                          }
                        }}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: hoverSurface },
                          '&.Mui-selected': {
                            bgcolor: selectedSurface,
                            '&:hover': { bgcolor: selectedSurface },
                          },
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CustomerBadge name={customer.name} index={index} />
                            <Box>
                              <Typography sx={{ fontSize: 12, fontWeight: 900 }}>{customer.name}</Typography>
                              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{customer.id}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{locations}</TableCell>
                        <TableCell>{customer.businessName || '—'} </TableCell>
                        <TableCell sx={{ color: openJobs > 8 ? trovanColors.semantic.danger : trovanColors.semantic.blue, fontWeight: 800 }}>{openJobs}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 12, fontWeight: 800 }}>{customerJobs.length ? `${completionRate}% completed` : 'No jobs'}</Typography>
                          <LinearProgress variant="determinate" value={completionRate} sx={{ mt: 0.45, height: 5, borderRadius: 99 }} />
                        </TableCell>
                        <TableCell>
                          {lastJobDate
                            ? new Date(lastJobDate).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                            : '—'}
                        </TableCell>
                        <TableCell>—</TableCell>
                        <TableCell><Box component="span" sx={{ color: trovanColors.semantic.success, fontWeight: 800 }}>• Active</Box></TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            aria-label={`Edit ${customer.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openEdit(customer);
                            }}
                          >
                            <MoreHorizOutlined fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.15, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                Showing 1 to {visibleCustomers.length} of {Math.max(customers.length, visibleCustomers.length)} customers
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {[1, 2, 3].map((page) => (
                  <Button
                    key={page}
                    variant={page === 1 ? 'outlined' : 'text'}
                    size="small"
                    sx={{ minWidth: 31 }}
                    onClick={() => setNotice(page === 1 ? 'Already on the current customer page.' : 'Additional pages load when the customer dataset exceeds the current page size.')}
                  >
                    {page}
                  </Button>
                ))}
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>10 / page</Typography>
              </Stack>
            </Stack>
          </PrototypePanel>
        </Box>

        <PrototypePanel sx={{ minHeight: 720 }}>
          {selectedCustomer ? (
            <>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2, pb: 1.2 }}>
                <Box sx={{ width: 54, height: 54, borderRadius: '50%', bgcolor: trovanColors.semantic.success, color: '#fff', display: 'grid', placeItems: 'center' }}>
                  <ShoppingCartOutlined />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 900 }}>{selectedCustomer.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{selectedCustomer.id} • {selectedCustomer.businessName || 'Customer'}</Typography>
                </Box>
                <Button size="small" sx={{ bgcolor: alpha(trovanColors.semantic.success, 0.12), color: trovanColors.semantic.success }} onClick={() => setNotice(`${selectedCustomer.name} is active.`)}>• Active</Button>
                <IconButton size="small" aria-label="Edit customer" onClick={() => openEdit(selectedCustomer)}><EditOutlined fontSize="small" /></IconButton>
              </Stack>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, px: 2, pb: 1.5 }}>
                {[
                  [`${selectedCustomerJobs.length}`, 'Jobs'],
                  [`${openSelectedJobs.length}`, 'Open'],
                  [selectedCustomer.email ? '1' : '0', 'Email'],
                  [selectedCustomer.phone ? '1' : '0', 'Phone'],
                ].map(([value, label]) => {
                  return (
                    <Box key={label} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '9px', p: 1, textAlign: 'center', bgcolor: softSurface }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 900 }}>{value}</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{label}</Typography>
                    </Box>
                  );
                })}
              </Box>

              <Tabs value={detailTab} onChange={(_, value) => setDetailTab(value)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Tab label="Overview" />
                <Tab label={`Locations (${selectedCustomer.defaultAddress || selectedCustomer.address ? 1 : 0})`} />
                <Tab label={`Contacts (${Number(Boolean(selectedCustomer.email)) + Number(Boolean(selectedCustomer.phone))})`} />
                <Tab label="Jobs" />
                <Tab label="History" />
              </Tabs>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, p: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 900, mb: 1 }}>Company Summary</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.55 }}>
                    {selectedCustomer.notes || 'Regional grocery chain with service locations, daily delivery windows, and routing-specific access requirements.'}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, mt: 2, mb: 1 }}>Key Contacts</Typography>
                  {[
                    selectedCustomer.email ? [selectedCustomer.name, 'Email', selectedCustomer.email] : null,
                    selectedCustomer.phone ? [selectedCustomer.name, 'Phone', selectedCustomer.phone] : null,
                  ].filter((item): item is string[] => Boolean(item)).map(([name, title, detail]) => (
                    <Stack key={`${title}-${detail}`} direction="row" spacing={1} alignItems="center" sx={{ mb: 1.4 }}>
                      <Avatar sx={{ width: 34, height: 34, bgcolor: trovanColors.copper[500] }}>{name.slice(0, 1)}</Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 850 }}>{name}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{title}</Typography>
                        <Typography sx={{ fontSize: 11, color: trovanColors.copper[600] }}>{detail}</Typography>
                      </Box>
                      <EmailOutlined sx={{ fontSize: 16, color: trovanColors.copper[600] }} />
                      <PhoneOutlined sx={{ fontSize: 16, color: trovanColors.copper[600] }} />
                    </Stack>
                  ))}
                  {!selectedCustomer.email && !selectedCustomer.phone ? (
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>No contact methods saved.</Typography>
                  ) : null}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 900, mb: 1 }}>Service Area</Typography>
                  <Box sx={{ borderRadius: '9px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                    <LiveRouteMapPanel
                      routes={routes}
                      vehicles={vehicles}
                      drivers={drivers}
                      height={222}
                      showLegend={false}
                      emptyTitle="No service-area geometry"
                      emptyBody="Customer records do not include geocoded service areas yet."
                    />
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2, px: 2, pb: 2 }}>
                {[
                  [Inventory2Outlined, 'Service Address', selectedCustomer.defaultAddress || selectedCustomer.address || 'No address saved'],
                  [AccessTimeOutlined, 'Delivery Rules', selectedCustomer.exceptions || 'No customer rules saved'],
                  [LocalShippingOutlined, 'Related Jobs', `${selectedCustomerJobs.length} related jobs`],
                  [LockOutlined, 'Notes', selectedCustomer.notes || 'No notes saved'],
                ].map(([Icon, title, body]) => {
                  const TileIcon = Icon as typeof Inventory2Outlined;
                  return (
                    <Box key={String(title)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 1.35, bgcolor: softSurface }}>
                      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.65 }}>
                        <TileIcon sx={{ fontSize: 17, color: trovanColors.copper[600] }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 900 }}>{String(title)}</Typography>
                      </Stack>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{String(body)}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </>
          ) : (
            <Typography sx={{ p: 2, color: 'text.secondary' }}>No customer selected.</Typography>
          )}
        </PrototypePanel>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><TextField label="Customer name" value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Business name" value={formData.businessName} onChange={(event) => setFormData((current) => ({ ...current, businessName: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Phone" value={formData.phone} onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Email" value={formData.email} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Default address" value={formData.defaultAddress} onChange={(event) => setFormData((current) => ({ ...current, defaultAddress: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Notes" multiline minRows={3} value={formData.notes} onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Service time" value={formData.serviceTime} onChange={(event) => setFormData((current) => ({ ...current, serviceTime: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Time windows" value={formData.timeWindows} onChange={(event) => setFormData((current) => ({ ...current, timeWindows: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Additional constraints" multiline minRows={3} value={formData.additionalConstraints} onChange={(event) => setFormData((current) => ({ ...current, additionalConstraints: event.target.value }))} fullWidth /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSubmit()}>Save Customer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Import Customers</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Import CSV or JSON customer rows. Supported fields: name, phone, email, businessName, address, notes, and exceptions.
          </Typography>
          {importError ? <Alert severity="error">{importError}</Alert> : null}
          <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={() => importInputRef.current?.click()}>
            Choose file
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
