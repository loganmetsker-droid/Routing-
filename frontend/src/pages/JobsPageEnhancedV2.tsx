import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tabs,
  Tab,
  Autocomplete,
  Checkbox,
  IconButton,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Add,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Edit as EditIcon,
  Clear as ClearIcon,
  Archive as ArchiveIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { getJobs, createJob, getCustomers, updateJob } from '../services/api';
import AddressInput from '../components/forms/AddressInput';
import { Address } from '../types/address';
import { DISPATCH_PLANNER_SELECTION_KEY } from '../types/dispatch';
import { formatAddress } from '../utils/addressValidation';
import { format } from 'date-fns';
import { connectDispatchRealtime } from '../services/socket';
import ModuleHeader from '../components/ui/ModuleHeader';
import StatusPill from '../components/ui/StatusPill';
import InfoCard from '../components/ui/InfoCard';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  defaultAddress?: string;
  defaultAddressStructured?: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    zip: string;
  };
}

interface Job {
  id?: string;
  customerName: string;
  deliveryAddress: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  completedAt?: string;
}

export default function JobsPageEnhancedV2() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [customerTab, setCustomerTab] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [recentCustomerNames, setRecentCustomerNames] = useState<string[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerName: '',
    deliveryAddress: '',
    priority: 'normal',
  });
  const [deliveryAddressData, setDeliveryAddressData] = useState<Address>({
    line1: '',
    line2: null,
    city: '',
    state: '',
    zip: '',
  });
  const [deliveryAddressValid, setDeliveryAddressValid] = useState(false);

  // Filter completed jobs for today
  const completedJobsToday = jobs.filter(
    (job) =>
      job.status === 'completed' &&
      job.completedAt &&
      format(new Date(job.completedAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );

  const nonArchivedJobs = jobs.filter((job) => job.id && job.status !== 'archived');
  const activeJobs = nonArchivedJobs.filter((job) => job.status !== 'completed');
  const visibleJobs = (() => {
    if (activePreset === 'today') {
      const today = format(new Date(), 'yyyy-MM-dd');
      return activeJobs.filter(
        (job) => job.createdAt && format(new Date(job.createdAt), 'yyyy-MM-dd') === today,
      );
    }
    if (activePreset === 'unassigned') {
      return activeJobs.filter((job) => (job.status || 'pending') === 'pending');
    }
    if (activePreset === 'highPriority') {
      return activeJobs.filter((job) => ['high', 'urgent'].includes((job.priority || '').toLowerCase()));
    }
    if (activePreset === 'completed') {
      return nonArchivedJobs.filter((job) => job.status === 'completed');
    }
    return activeJobs;
  })();

  const loadJobs = async () => {
    try {
      const data = await getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  useEffect(() => {
    loadJobs();
    loadCustomers();

    const cached = localStorage.getItem('recentCustomerNames');
    if (cached) {
      setRecentCustomerNames(JSON.parse(cached));
    }

    const eventSource = connectDispatchRealtime((data) => {
      if (data.type === 'job-created' || data.type === 'job-updated') {
        loadJobs();
      }
    });

    return () => eventSource.close();
  }, []);

  // Quick filter presets
  const applyPresetFilter = (preset: string) => {
    setActivePreset(preset);
  };

  const resetFilters = () => {
    setActivePreset(null);
  };

  // Batch operations
  const handleSelectJob = (jobId: string) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleSelectAll = () => {
    if (selectedJobs.length === visibleJobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(visibleJobs.map((job) => job.id!).filter(Boolean));
    }
  };

  const handleBulkAssign = () => {
    if (selectedJobs.length === 0) {
      return;
    }

    sessionStorage.setItem(
      DISPATCH_PLANNER_SELECTION_KEY,
      JSON.stringify({
        selectedJobIds: selectedJobs,
        source: 'jobs',
        createdAt: Date.now(),
      }),
    );
    navigate('/dispatch');
  };

  const handleBulkUnassign = async (jobIds: string[] = selectedJobs) => {
    try {
      await Promise.all(
        jobIds.map((jobId) =>
          updateJob(jobId, { status: 'pending', assignedRouteId: null })
        )
      );
      if (jobIds === selectedJobs) {
        setSelectedJobs([]);
      }
      loadJobs();
    } catch (error) {
      console.error('Failed to unassign jobs:', error);
    }
  };

  const handleBulkArchive = async (jobIds: string[] = selectedJobs) => {
    try {
      await Promise.all(
        jobIds.map((jobId) =>
          updateJob(jobId, { status: 'archived' })
        )
      );
      if (jobIds === selectedJobs) {
        setSelectedJobs([]);
      }
      loadJobs();
    } catch (error) {
      console.error('Failed to archive jobs:', error);
    }
  };

  const handleArchiveAllCompleted = async () => {
    try {
      await Promise.all(
        completedJobsToday.filter(job => job.id).map((job) =>
          updateJob(job.id!, { status: 'archived' })
        )
      );
      loadJobs();
    } catch (error) {
      console.error('Failed to archive completed jobs:', error);
    }
  };

  // Original dialog handlers
  const handleOpenDialog = () => {
    setCreateDialogOpen(true);
    setCustomerTab(0);
    setSelectedCustomer(null);
    setFormData({ customerName: '', deliveryAddress: '', priority: 'normal' });
    setDeliveryAddressData({ line1: '', line2: null, city: '', state: '', zip: '' });
    setDeliveryAddressValid(false);
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setSelectedCustomer(null);
  };

  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    if (customer) {
      setFormData((prev) => ({
        ...prev,
        customerName: customer.name,
      }));

      // Auto-populate delivery address if structured address exists
      if (customer.defaultAddressStructured) {
        const addressData = {
          line1: customer.defaultAddressStructured.line1 || '',
          line2: customer.defaultAddressStructured.line2 || null,
          city: customer.defaultAddressStructured.city || '',
          state: customer.defaultAddressStructured.state || '',
          zip: customer.defaultAddressStructured.zip || '',
        };
        setDeliveryAddressData(addressData);

        // Validate the address - if all required fields are present, mark as valid
        const hasRequiredFields = addressData.line1 && addressData.city && addressData.state && addressData.zip;
        setDeliveryAddressValid(!!hasRequiredFields);
      } else if (customer.defaultAddress) {
        // Fallback: populate line1 with legacy address, user must complete rest
        setDeliveryAddressData({
          line1: customer.defaultAddress,
          line2: null,
          city: '',
          state: '',
          zip: ''
        });
        setDeliveryAddressValid(false);
      } else if (customer.address) {
        // Backward compatibility with older customer payload shape
        setDeliveryAddressData({
          line1: customer.address,
          line2: null,
          city: '',
          state: '',
          zip: ''
        });
        setDeliveryAddressValid(false);
      } else {
        // Reset to empty if no address at all
        setDeliveryAddressData({ line1: '', line2: null, city: '', state: '', zip: '' });
        setDeliveryAddressValid(false);
      }
    } else {
      // Customer deselected - reset form
      setFormData((prev) => ({
        ...prev,
        customerName: '',
      }));
      setDeliveryAddressData({ line1: '', line2: null, city: '', state: '', zip: '' });
      setDeliveryAddressValid(false);
    }
  };

  const handleNewCustomerNameChange = (value: string) => {
    setFormData({ ...formData, customerName: value });

    if (value.trim()) {
      const updated = [value, ...recentCustomerNames.filter((n) => n !== value)].slice(0, 10);
      setRecentCustomerNames(updated);
      localStorage.setItem('recentCustomerNames', JSON.stringify(updated));
    }
  };

  const handleCreateJob = async () => {
    try {
      const jobData = {
        customerId: selectedCustomer?.id,
        customerName: formData.customerName,
        customerPhone: selectedCustomer?.phone,
        customerEmail: selectedCustomer?.email,
        priority: formData.priority,
        deliveryAddress: formatAddress(deliveryAddressData),
        deliveryAddressStructured: deliveryAddressData,
        status: 'pending',
      };
      await createJob(jobData);
      handleCloseDialog();
      loadJobs();
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Grid container spacing={2.25}>
        <Grid item xs={12} lg={8}>
          <ModuleHeader
            title="Jobs Queue"
            subtitle="Select active work and send it directly into route planning."
            onRefresh={loadJobs}
          />
        </Grid>
        <Grid item xs={12} lg={4}>
          <Paper
            sx={{
              p: 2.25,
              borderRadius: 4,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight: 700 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button fullWidth variant="outlined" onClick={loadJobs}>
                Refresh
              </Button>
              <Button fullWidth variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>
                Create Job
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2.25}>
        <Grid item xs={12} sm={4}>
          <InfoCard title="Active Jobs" value={activeJobs.length} subtitle="Open planning queue" statusLabel="Active" statusColor="#2563eb" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <InfoCard title="Selected" value={selectedJobs.length} subtitle="Ready for batch actions" statusLabel="Planner" statusColor="#4f46e5" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <InfoCard title="Completed Today" value={completedJobsToday.length} subtitle="Archive-ready jobs" statusLabel="Completed" statusColor="#059669" />
        </Grid>
      </Grid>

      {/* Quick Filter Chips */}
      <Paper
        sx={{
          p: 1.5,
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          alignItems: 'center',
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Filters:
        </Typography>
        <Chip
          label="Today's Jobs"
          onClick={() => applyPresetFilter('today')}
          color={activePreset === 'today' ? 'primary' : 'default'}
          variant={activePreset === 'today' ? 'filled' : 'outlined'}
        />
        <Chip
          label="Unassigned"
          onClick={() => applyPresetFilter('unassigned')}
          color={activePreset === 'unassigned' ? 'primary' : 'default'}
          variant={activePreset === 'unassigned' ? 'filled' : 'outlined'}
        />
        <Chip
          label="High Priority"
          onClick={() => applyPresetFilter('highPriority')}
          color={activePreset === 'highPriority' ? 'warning' : 'default'}
          variant={activePreset === 'highPriority' ? 'filled' : 'outlined'}
        />
        <Chip
          label="Completed"
          onClick={() => applyPresetFilter('completed')}
          color={activePreset === 'completed' ? 'success' : 'default'}
          variant={activePreset === 'completed' ? 'filled' : 'outlined'}
        />
        {activePreset && <Chip label="Clear Filters" onDelete={resetFilters} size="small" />}
      </Paper>

      {/* Batch Action Toolbar */}
      {selectedJobs.length > 0 && (
        <Paper
          sx={{
            p: 2,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.25),
            borderRadius: 4,
          }}
        >
          <StatusPill label={`${selectedJobs.length} selected`} color="#2563eb" />
          <Button variant="outlined" size="small" onClick={handleBulkAssign}>
            Plan Route ({selectedJobs.length})
          </Button>
          <Button variant="outlined" size="small" onClick={() => void handleBulkUnassign()}>
            Unassign
          </Button>
          <Button variant="outlined" size="small" onClick={() => void handleBulkArchive()}>
            Archive
          </Button>
          <Button variant="text" size="small" onClick={() => setSelectedJobs([])}>
            Clear
          </Button>
        </Paper>
      )}

      {/* Completed Jobs Summary */}
      {completedJobsToday.length > 0 && (
        <Accordion sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }} defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" />
                <Typography>{completedJobsToday.length} Completed Jobs Today</Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchiveAllCompleted();
                }}
              >
                Archive All
              </Button>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>Completed At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {completedJobsToday.map((job) => (
                    <TableRow key={job.id!} sx={{ opacity: 0.7 }}>
                      <TableCell>{job.customerName}</TableCell>
                      <TableCell>{job.deliveryAddress}</TableCell>
                      <TableCell>
                        {job.completedAt && format(new Date(job.completedAt), 'h:mm a')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Select All Checkbox */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Checkbox
          checked={selectedJobs.length === visibleJobs.length && visibleJobs.length > 0}
          indeterminate={selectedJobs.length > 0 && selectedJobs.length < visibleJobs.length}
          onChange={handleSelectAll}
        />
        <Typography variant="body2">Select All ({visibleJobs.length} jobs)</Typography>
      </Box>

      {/* Jobs Grid */}
      <Grid container spacing={3}>
        {visibleJobs.map((job) => (
          <Grid item xs={12} md={6} key={job.id!}>
            <Card
              sx={{
                borderRadius: 4,
                border: '1px solid',
                borderColor: job.id && selectedJobs.includes(job.id) ? alpha(theme.palette.primary.main, 0.4) : 'divider',
                boxShadow: 'none',
                bgcolor: job.id && selectedJobs.includes(job.id) ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
              }}
            >
              <CardContent sx={{ p: 2.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <Checkbox
                    checked={job.id ? selectedJobs.includes(job.id) : false}
                    onChange={() => job.id && handleSelectJob(job.id)}
                    icon={<CheckBoxOutlineBlankIcon />}
                    checkedIcon={<CheckBoxIcon />}
                  />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>{job.customerName}</Typography>
                    <Box sx={{ mt: 1, mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <StatusPill
                        label={job.status || 'pending'}
                        color={
                          (job.status || 'pending') === 'completed'
                            ? '#059669'
                            : (job.status || 'pending') === 'in_progress'
                              ? '#2563eb'
                              : (job.status || 'pending') === 'assigned'
                                ? '#0284c7'
                                : '#d97706'
                        }
                      />
                      <StatusPill
                        label={job.priority || 'normal'}
                        color={
                          (job.priority || 'normal') === 'urgent'
                            ? '#dc2626'
                            : (job.priority || 'normal') === 'high'
                              ? '#d97706'
                              : (job.priority || 'normal') === 'normal'
                                ? '#2563eb'
                                : '#64748b'
                        }
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Delivery:</strong> {job.deliveryAddress}
                    </Typography>
                    {job.createdAt && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 1 }}
                      >
                        Created: {new Date(job.createdAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (job.id) {
                          handleBulkUnassign([job.id]);
                        }
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (job.id) {
                          handleBulkArchive([job.id]);
                        }
                      }}
                    >
                      <ArchiveIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {visibleJobs.length === 0 && (
        <Paper sx={{ mt: 2, p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No jobs match the current filter.
          </Typography>
        </Paper>
      )}

      {/* Create Job Dialog (existing) */}
      <Dialog open={createDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Job</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Tabs value={customerTab} onChange={(_, v) => setCustomerTab(v)} sx={{ mb: 2 }}>
              <Tab label="Existing Customer" />
              <Tab label="New Customer" />
            </Tabs>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {customerTab === 0 ? (
                <>
                  <Autocomplete
                    options={customers}
                    getOptionLabel={(option) => option.name}
                    value={selectedCustomer}
                    onChange={(_, value) => handleCustomerSelect(value)}
                    renderInput={(params) => <TextField {...params} label="Select Customer" required />}
                  />
                  <AddressInput
                    label="Delivery Address"
                    value={deliveryAddressData}
                    onChange={setDeliveryAddressData}
                    onValidationChange={setDeliveryAddressValid}
                    required
                  />
                </>
              ) : (
                <>
                  <Autocomplete
                    freeSolo
                    options={recentCustomerNames}
                    value={formData.customerName}
                    onInputChange={(_, value) => handleNewCustomerNameChange(value)}
                    renderInput={(params) => <TextField {...params} label="Customer Name" required />}
                  />
                  <AddressInput
                    label="Delivery Address"
                    value={deliveryAddressData}
                    onChange={setDeliveryAddressData}
                    onValidationChange={setDeliveryAddressValid}
                    required
                  />
                </>
              )}

              <TextField
                select
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                fullWidth
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </TextField>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateJob}
            disabled={!formData.customerName || !deliveryAddressValid}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
