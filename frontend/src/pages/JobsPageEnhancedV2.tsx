import { useState, useEffect } from 'react';
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
import { getJobs, createJob, connectSSE } from '../services/api';
import AddressInput from '../components/forms/AddressInput';
import { Address } from '../types/address';
import { formatAddress } from '../utils/addressValidation';
import { format } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [customerTab, setCustomerTab] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [recentCustomerNames, setRecentCustomerNames] = useState<string[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState('');

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

  // Active jobs (not completed)
  const activeJobs = jobs.filter((job) => job.id && job.status !== 'completed' && job.status !== 'archived');

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
      const response = await fetch(`${API_BASE_URL}/api/customers`);
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadDrivers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/drivers`);
      const data = await response.json();
      setDrivers(data.drivers || []);
    } catch (error) {
      console.error('Failed to load drivers:', error);
    }
  };

  useEffect(() => {
    loadJobs();
    loadCustomers();
    loadDrivers();

    const cached = localStorage.getItem('recentCustomerNames');
    if (cached) {
      setRecentCustomerNames(JSON.parse(cached));
    }

    const eventSource = connectSSE((data) => {
      if (data.type === 'job-created' || data.type === 'job-updated') {
        loadJobs();
      }
    });

    return () => eventSource.close();
  }, []);

  // Quick filter presets
  const applyPresetFilter = (preset: string) => {
    setActivePreset(preset);
    // In a real implementation, you would apply filters to the jobs list
    // For now, this is a placeholder
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
    if (selectedJobs.length === activeJobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(activeJobs.map((job) => job.id!).filter(Boolean));
    }
  };

  const handleBulkAssign = () => {
    setAssignDriverDialogOpen(true);
  };

  const handleBulkUnassign = async () => {
    try {
      await Promise.all(
        selectedJobs.map((jobId) =>
          fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending', driverId: null }),
          })
        )
      );
      setSelectedJobs([]);
      loadJobs();
    } catch (error) {
      console.error('Failed to unassign jobs:', error);
    }
  };

  const handleBulkArchive = async () => {
    try {
      await Promise.all(
        selectedJobs.map((jobId) =>
          fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'archived' }),
          })
        )
      );
      setSelectedJobs([]);
      loadJobs();
    } catch (error) {
      console.error('Failed to archive jobs:', error);
    }
  };

  const handleArchiveAllCompleted = async () => {
    try {
      await Promise.all(
        completedJobsToday.filter(job => job.id).map((job) =>
          fetch(`${API_BASE_URL}/api/jobs/${job.id!}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'archived' }),
          })
        )
      );
      loadJobs();
    } catch (error) {
      console.error('Failed to archive completed jobs:', error);
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedDriver) return;

    try {
      await Promise.all(
        selectedJobs.map((jobId) =>
          fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverId: selectedDriver, status: 'assigned' }),
          })
        )
      );
      setAssignDriverDialogOpen(false);
      setSelectedJobs([]);
      setSelectedDriver('');
      loadJobs();
    } catch (error) {
      console.error('Failed to assign driver:', error);
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
        customerName: formData.customerName,
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'assigned':
        return 'info';
      case 'in_progress':
        return 'primary';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
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
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Jobs Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Filter, assign, and manage jobs efficiently
          </Typography>
        </Box>
        <Box>
          <Button variant="outlined" onClick={loadJobs} sx={{ mr: 1 }}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>
            Create Job
          </Button>
        </Box>
      </Box>

      {/* Quick Filter Chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
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
        {activePreset && (
          <Chip label="Clear Filters" onDelete={resetFilters} size="small" />
        )}
      </Box>

      {/* Batch Action Toolbar */}
      {selectedJobs.length > 0 && (
        <Paper
          sx={{
            mb: 2,
            p: 2,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            bgcolor: 'action.selected',
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" fontWeight="bold">
            {selectedJobs.length} selected
          </Typography>
          <Button variant="outlined" size="small" onClick={handleBulkAssign}>
            Assign to Driver
          </Button>
          <Button variant="outlined" size="small" onClick={handleBulkUnassign}>
            Unassign
          </Button>
          <Button variant="outlined" size="small" onClick={handleBulkArchive}>
            Archive
          </Button>
          <Button variant="text" size="small" onClick={() => setSelectedJobs([])}>
            Clear
          </Button>
        </Paper>
      )}

      {/* Completed Jobs Summary */}
      {completedJobsToday.length > 0 && (
        <Accordion sx={{ mb: 2 }} defaultExpanded={false}>
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
          checked={selectedJobs.length === activeJobs.length && activeJobs.length > 0}
          indeterminate={selectedJobs.length > 0 && selectedJobs.length < activeJobs.length}
          onChange={handleSelectAll}
        />
        <Typography variant="body2">Select All ({activeJobs.length} jobs)</Typography>
      </Box>

      {/* Jobs Grid */}
      <Grid container spacing={3}>
        {activeJobs.map((job) => (
          <Grid item xs={12} md={6} key={job.id!}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <Checkbox
                    checked={job.id ? selectedJobs.includes(job.id) : false}
                    onChange={() => job.id && handleSelectJob(job.id)}
                    icon={<CheckBoxOutlineBlankIcon />}
                    checkedIcon={<CheckBoxIcon />}
                  />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">{job.customerName}</Typography>
                    <Box sx={{ mt: 1, mb: 2 }}>
                      <Chip
                        label={job.status || 'pending'}
                        color={getStatusColor(job.status || 'pending') as any}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <Chip
                        label={job.priority || 'normal'}
                        color={getPriorityColor(job.priority || 'normal') as any}
                        size="small"
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
                    <IconButton size="small" onClick={() => handleBulkUnassign()}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (job.id) {
                          setSelectedJobs([job.id]);
                          handleBulkArchive();
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

      {/* Assign Driver Dialog */}
      <Dialog
        open={assignDriverDialogOpen}
        onClose={() => setAssignDriverDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Assign Driver to Selected Jobs</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              select
              label="Select Driver"
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              fullWidth
              required
            >
              {drivers
                .filter((d) => d.status === 'available')
                .map((driver) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </MenuItem>
                ))}
            </TextField>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              {selectedJobs.length} job(s) will be assigned to the selected driver
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDriverDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignDriver} disabled={!selectedDriver}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
