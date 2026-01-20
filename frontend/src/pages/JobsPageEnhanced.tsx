import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  Autocomplete,
  Snackbar,
  Alert,
  IconButton,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Toolbar,
  alpha,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add,
  Info,
  Archive,
  Unarchive,
  PersonOff,
  PersonAdd,
  SwapHoriz,
  Search,
  Clear,
  Done,
} from '@mui/icons-material';
import { getJobs, createJob, connectSSE, updateJobStatus, getDrivers, getRoutes } from '../services/api';
import AddressInput from '../components/forms/AddressInput';
import { Address } from '../types/address';
import { formatAddress } from '../utils/addressValidation';

const API_BASE_URL = import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface JobEnhanced {
  id: string;
  customerName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  status: string;
  priority?: string;
  createdAt?: string;
  archived?: boolean;
  archivedAt?: string;
  assignedRouteId?: string;
  driverId?: string;
  driverName?: string;
}

interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
  status: string;
}

export default function JobsPageEnhanced() {
  const [jobs, setJobs] = useState<JobEnhanced[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [customerTab, setCustomerTab] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pickupMode, setPickupMode] = useState('last_stop');
  const [recentCustomerNames, setRecentCustomerNames] = useState<string[]>([]);

  // Batch selection state
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedDriverForReassign, setSelectedDriverForReassign] = useState<string>('');

  // Filtering state
  const [filterDriver, setFilterDriver] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active'); // 'active', 'all', 'completed'
  const [filterDate, setFilterDate] = useState<string>('');
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });

  const [formData, setFormData] = useState({
    customerName: '',
    pickupAddress: '',
    deliveryAddress: '',
    priority: 'normal',
  });

  const [pickupAddressData, setPickupAddressData] = useState<Address>({
    line1: '',
    line2: null,
    city: '',
    state: '',
    zip: '',
  });

  const [deliveryAddressData, setDeliveryAddressData] = useState<Address>({
    line1: '',
    line2: null,
    city: '',
    state: '',
    zip: '',
  });

  const [pickupAddressValid, setPickupAddressValid] = useState(false);
  const [deliveryAddressValid, setDeliveryAddressValid] = useState(false);

  // Load jobs with driver enrichment
  const loadJobs = async () => {
    try {
      const [jobsData, routesData] = await Promise.all([
        getJobs(),
        getRoutes(),
      ]);

      // Enrich jobs with driver information from routes
      const enrichedJobs = jobsData.map((job: any) => {
        const route = routesData.find((r: any) => r.id === job.assignedRouteId);
        const driver = route?.driverId ? drivers.find((d: Driver) => d.id === route.driverId) : null;

        return {
          ...job,
          driverId: route?.driverId,
          driverName: driver ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() : undefined,
        } as JobEnhanced;
      });

      setJobs(enrichedJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      showSnackbar('Failed to load jobs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load drivers
  const loadDrivers = async () => {
    try {
      const driversData = await getDrivers();
      setDrivers(driversData);
    } catch (error) {
      console.error('Failed to load drivers:', error);
    }
  };

  // Load customers
  const loadCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers`);
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  useEffect(() => {
    loadDrivers();
    loadCustomers();

    // Load recent customer names from local storage
    const cached = localStorage.getItem('recentCustomerNames');
    if (cached) {
      setRecentCustomerNames(JSON.parse(cached));
    }
  }, []);

  useEffect(() => {
    if (drivers.length > 0) {
      loadJobs();
    }
  }, [drivers]);

  useEffect(() => {
    // Real-time updates via SSE
    const eventSource = connectSSE((data) => {
      if (data.type === 'job-created' || data.type === 'job-updated' || data.type === 'route-updated') {
        loadJobs();
      }
    });

    return () => eventSource.close();
  }, [drivers]);

  // Check if it's a new day and auto-archive completed jobs
  useEffect(() => {
    const checkAndArchiveDaily = () => {
      const lastArchiveDate = localStorage.getItem('lastArchiveDate');
      const today = new Date().toDateString();

      if (lastArchiveDate !== today) {
        handleAutoArchiveCompleted();
        localStorage.setItem('lastArchiveDate', today);
      }
    };

    // Check on mount
    checkAndArchiveDaily();

    // Check every hour
    const interval = setInterval(checkAndArchiveDaily, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [jobs]);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Create job dialog handlers
  const handleOpenDialog = () => {
    setCreateDialogOpen(true);
    setCustomerTab(0);
    setSelectedCustomer(null);
    setPickupMode('last_stop');
    setFormData({ customerName: '', pickupAddress: '', deliveryAddress: '', priority: 'normal' });
    setPickupAddressData({ line1: '', line2: null, city: '', state: '', zip: '' });
    setDeliveryAddressData({ line1: '', line2: null, city: '', state: '', zip: '' });
    setPickupAddressValid(false);
    setDeliveryAddressValid(false);
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setSelectedCustomer(null);
    setPickupMode('last_stop');
  };

  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    if (customer) {
      setFormData({
        ...formData,
        customerName: customer.name,
        deliveryAddress: customer.address,
      });
    }
  };

  const handleNewCustomerNameChange = (value: string) => {
    setFormData({ ...formData, customerName: value });

    if (value.trim()) {
      const updated = [value, ...recentCustomerNames.filter(n => n !== value)].slice(0, 10);
      setRecentCustomerNames(updated);
      localStorage.setItem('recentCustomerNames', JSON.stringify(updated));
    }
  };

  // Create new job
  const handleCreateJob = async () => {
    try {
      const jobData = {
        customerName: formData.customerName,
        priority: formData.priority,
        pickupAddress: pickupMode === 'last_stop' ? '' : formatAddress(pickupAddressData),
        deliveryAddress: formatAddress(deliveryAddressData),
        pickupAddressStructured: pickupMode === 'custom' ? pickupAddressData : null,
        deliveryAddressStructured: deliveryAddressData,
        status: 'pending',
      };

      await createJob(jobData);
      handleCloseDialog();
      await loadJobs();
      showSnackbar('Job created successfully', 'success');
    } catch (error) {
      console.error('Failed to create job:', error);
      showSnackbar('Failed to create job', 'error');
    }
  };

  // Archive operations
  const handleArchiveJob = async (jobId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true, archivedAt: new Date().toISOString() }),
      });

      await loadJobs();
      showSnackbar('Job archived', 'success');
    } catch (error) {
      console.error('Failed to archive job:', error);
      showSnackbar('Failed to archive job', 'error');
    }
  };

  const handleUnarchiveJob = async (jobId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false, archivedAt: null }),
      });

      await loadJobs();
      showSnackbar('Job restored', 'success');
    } catch (error) {
      console.error('Failed to restore job:', error);
      showSnackbar('Failed to restore job', 'error');
    }
  };

  // Auto-archive all completed jobs at start of new day
  const handleAutoArchiveCompleted = async () => {
    const completedJobs = jobs.filter(j => j.status === 'completed' && !j.archived);

    if (completedJobs.length === 0) return;

    try {
      for (const job of completedJobs) {
        await fetch(`${API_BASE_URL}/api/jobs/${job.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: true, archivedAt: new Date().toISOString() }),
        });
      }

      await loadJobs();
      showSnackbar(`${completedJobs.length} completed job(s) auto-archived for new day`, 'info');
    } catch (error) {
      console.error('Failed to auto-archive jobs:', error);
    }
  };

  // Batch selection handlers
  const handleSelectAll = () => {
    const filteredJobs = getFilteredJobs();
    setSelectedJobIds(filteredJobs.map(j => j.id));
  };

  const handleDeselectAll = () => {
    setSelectedJobIds([]);
  };

  const handleToggleJob = (jobId: string) => {
    setSelectedJobIds(prev =>
      prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
    );
  };

  // Unassign jobs (remove from route)
  const handleUnassignJobs = async () => {
    if (selectedJobIds.length === 0) {
      showSnackbar('No jobs selected', 'error');
      return;
    }

    try {
      for (const jobId of selectedJobIds) {
        // Set status back to pending and remove route assignment
        await updateJobStatus(jobId, 'pending', undefined);
      }

      await loadJobs();
      setSelectedJobIds([]);
      showSnackbar(`${selectedJobIds.length} job(s) unassigned`, 'success');
    } catch (error) {
      console.error('Failed to unassign jobs:', error);
      showSnackbar('Failed to unassign jobs', 'error');
    }
  };

  // Reassign jobs to different driver
  const handleOpenReassignDialog = () => {
    if (selectedJobIds.length === 0) {
      showSnackbar('No jobs selected', 'error');
      return;
    }
    setReassignDialogOpen(true);
    setSelectedDriverForReassign('');
  };

  const handleCloseReassignDialog = () => {
    setReassignDialogOpen(false);
    setSelectedDriverForReassign('');
  };

  const handleConfirmReassign = async () => {
    if (!selectedDriverForReassign) {
      showSnackbar('Please select a driver', 'error');
      return;
    }

    try {
      // For each selected job, update its route to the new driver
      for (const jobId of selectedJobIds) {
        const job = jobs.find(j => j.id === jobId);
        if (job?.assignedRouteId) {
          // Update the route's driver assignment
          await fetch(`${API_BASE_URL}/api/dispatch/routes/${job.assignedRouteId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverId: selectedDriverForReassign }),
          });
        }
      }

      await loadJobs();
      setSelectedJobIds([]);
      handleCloseReassignDialog();
      showSnackbar(`${selectedJobIds.length} job(s) reassigned`, 'success');
    } catch (error) {
      console.error('Failed to reassign jobs:', error);
      showSnackbar('Failed to reassign jobs', 'error');
    }
  };

  // Mark jobs as completed
  const handleMarkCompleted = async () => {
    if (selectedJobIds.length === 0) {
      showSnackbar('No jobs selected', 'error');
      return;
    }

    try {
      for (const jobId of selectedJobIds) {
        await updateJobStatus(jobId, 'completed');
      }

      await loadJobs();
      setSelectedJobIds([]);
      showSnackbar(`${selectedJobIds.length} job(s) marked completed`, 'success');
    } catch (error) {
      console.error('Failed to mark jobs completed:', error);
      showSnackbar('Failed to mark jobs completed', 'error');
    }
  };

  // Filtering logic
  const getFilteredJobs = () => {
    let filtered = jobs;

    // Filter by archive status
    if (filterStatus === 'active') {
      filtered = filtered.filter(j => !j.archived && j.status !== 'completed');
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter(j => !j.archived && j.status === 'completed');
    } else if (filterStatus === 'archived') {
      filtered = filtered.filter(j => j.archived);

      // Archive search
      if (archiveSearchTerm) {
        filtered = filtered.filter(j =>
          j.customerName.toLowerCase().includes(archiveSearchTerm.toLowerCase()) ||
          j.deliveryAddress?.toLowerCase().includes(archiveSearchTerm.toLowerCase())
        );
      }
    }

    // Filter by driver
    if (filterDriver !== 'all') {
      if (filterDriver === 'unassigned') {
        filtered = filtered.filter(j => !j.driverId);
      } else {
        filtered = filtered.filter(j => j.driverId === filterDriver);
      }
    }

    // Filter by date
    if (filterDate) {
      filtered = filtered.filter(j =>
        j.createdAt && new Date(j.createdAt).toDateString() === new Date(filterDate).toDateString()
      );
    }

    return filtered;
  };

  const filteredJobs = getFilteredJobs();
  const paginatedJobs = filteredJobs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'assigned': return 'info';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'normal': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return 'Unknown';
    return `${driver.firstName || ''} ${driver.lastName || ''}`.trim();
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
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Jobs Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Filter, assign, and manage jobs efficiently
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenDialog}
          sx={{ textTransform: 'none' }}
        >
          Create Job
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e: SelectChangeEvent) => {
                  setFilterStatus(e.target.value);
                  setPage(0);
                }}
                label="Status"
              >
                <MenuItem value="active">Active Jobs</MenuItem>
                <MenuItem value="completed">Completed Jobs</MenuItem>
                <MenuItem value="archived">Archived Jobs</MenuItem>
                <MenuItem value="all">All Jobs</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Driver</InputLabel>
              <Select
                value={filterDriver}
                onChange={(e: SelectChangeEvent) => {
                  setFilterDriver(e.target.value);
                  setPage(0);
                }}
                label="Driver"
              >
                <MenuItem value="all">All Drivers</MenuItem>
                <MenuItem value="unassigned">Unassigned</MenuItem>
                {drivers.map(d => (
                  <MenuItem key={d.id} value={d.id}>
                    {getDriverName(d.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Filter by Date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {filterStatus === 'archived' && (
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search Archives"
                value={archiveSearchTerm}
                onChange={(e) => setArchiveSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                  endAdornment: archiveSearchTerm && (
                    <IconButton size="small" onClick={() => setArchiveSearchTerm('')}>
                      <Clear />
                    </IconButton>
                  ),
                }}
              />
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Batch Actions Toolbar */}
      {selectedJobIds.length > 0 && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            bgcolor: theme => alpha(theme.palette.primary.main, 0.1),
            border: theme => `1px solid ${theme.palette.primary.main}`,
          }}
        >
          <Toolbar sx={{ px: 0 }}>
            <Typography variant="subtitle1" sx={{ flex: '1 1 100%' }}>
              {selectedJobIds.length} job(s) selected
            </Typography>
            <Tooltip title="Unassign from drivers">
              <Button
                startIcon={<PersonOff />}
                onClick={handleUnassignJobs}
                sx={{ mr: 1, textTransform: 'none' }}
              >
                Unassign
              </Button>
            </Tooltip>
            <Tooltip title="Reassign to different driver">
              <Button
                startIcon={<SwapHoriz />}
                onClick={handleOpenReassignDialog}
                sx={{ mr: 1, textTransform: 'none' }}
              >
                Reassign
              </Button>
            </Tooltip>
            <Tooltip title="Mark as completed">
              <Button
                startIcon={<Done />}
                onClick={handleMarkCompleted}
                sx={{ mr: 1, textTransform: 'none' }}
              >
                Complete
              </Button>
            </Tooltip>
            <Button onClick={handleDeselectAll} sx={{ textTransform: 'none' }}>
              Deselect All
            </Button>
          </Toolbar>
        </Paper>
      )}

      {/* Jobs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedJobIds.length > 0 && selectedJobIds.length < filteredJobs.length}
                  checked={filteredJobs.length > 0 && selectedJobIds.length === filteredJobs.length}
                  onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                />
              </TableCell>
              <TableCell><strong>Customer</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Priority</strong></TableCell>
              <TableCell><strong>Driver</strong></TableCell>
              <TableCell><strong>Delivery Address</strong></TableCell>
              <TableCell><strong>Created</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    {filterStatus === 'archived' ? 'No archived jobs' : 'No jobs found'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedJobs.map((job) => (
                <TableRow key={job.id} hover selected={selectedJobIds.includes(job.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedJobIds.includes(job.id)}
                      onChange={() => handleToggleJob(job.id)}
                    />
                  </TableCell>
                  <TableCell>{job.customerName}</TableCell>
                  <TableCell>
                    <Chip
                      label={job.status}
                      color={getStatusColor(job.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={job.priority || 'normal'}
                      color={getPriorityColor(job.priority || 'normal') as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={job.driverName || 'Unassigned'}
                      variant={job.driverName ? 'filled' : 'outlined'}
                      size="small"
                      icon={job.driverName ? <PersonAdd /> : <PersonOff />}
                    />
                  </TableCell>
                  <TableCell>{job.deliveryAddress}</TableCell>
                  <TableCell>
                    {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    {job.archived ? (
                      <Tooltip title="Restore from archive">
                        <IconButton size="small" onClick={() => handleUnarchiveJob(job.id)}>
                          <Unarchive />
                        </IconButton>
                      </Tooltip>
                    ) : job.status === 'completed' ? (
                      <Tooltip title="Archive job">
                        <IconButton size="small" onClick={() => handleArchiveJob(job.id)}>
                          <Archive />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredJobs.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Create Job Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Job</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {customerTab === 0 ? (
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => option.name}
                value={selectedCustomer}
                onChange={(_, value) => handleCustomerSelect(value)}
                renderInput={(params) => (
                  <TextField {...params} label="Select Customer" required />
                )}
              />
            ) : (
              <>
                <Autocomplete
                  freeSolo
                  options={recentCustomerNames}
                  value={formData.customerName}
                  onInputChange={(_, value) => handleNewCustomerNameChange(value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Customer Name" required />
                  )}
                />
                <Box sx={{ mt: 2 }}>
                  <AddressInput
                    label="Delivery Address"
                    value={deliveryAddressData}
                    onChange={setDeliveryAddressData}
                    onValidationChange={setDeliveryAddressValid}
                    required
                  />
                </Box>
              </>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <TextField
                select
                label="Pickup Address"
                value={pickupMode}
                onChange={(e) => setPickupMode(e.target.value)}
                fullWidth
                required
              >
                <MenuItem value="last_stop">Use Last Stop</MenuItem>
                <MenuItem value="custom">Custom Address</MenuItem>
              </TextField>
              <Tooltip title="Routing algorithm will determine optimal pickup sequence">
                <Info color="action" sx={{ cursor: 'help' }} />
              </Tooltip>
            </Box>

            {pickupMode === 'custom' && (
              <Box sx={{ mt: 2 }}>
                <AddressInput
                  label="Pickup Address"
                  value={pickupAddressData}
                  onChange={setPickupAddressData}
                  onValidationChange={setPickupAddressValid}
                  required
                />
              </Box>
            )}

            <TextField
              select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              fullWidth
              sx={{ mt: 2 }}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateJob}
            disabled={
              !formData.customerName ||
              !deliveryAddressValid ||
              (pickupMode === 'custom' && !pickupAddressValid)
            }
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={reassignDialogOpen} onClose={handleCloseReassignDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Reassign {selectedJobIds.length} Job(s)</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Driver</InputLabel>
            <Select
              value={selectedDriverForReassign}
              onChange={(e) => setSelectedDriverForReassign(e.target.value)}
              label="Select Driver"
            >
              {drivers.filter(d => d.status === 'ACTIVE').map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  {getDriverName(driver.id)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReassignDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmReassign}
            disabled={!selectedDriverForReassign}
          >
            Reassign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
