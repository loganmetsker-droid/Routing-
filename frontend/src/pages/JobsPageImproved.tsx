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
  Tooltip,
  Autocomplete,
  Snackbar,
  Alert,
  Badge,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Add,
  Info,
  Archive,
  Unarchive,
  CheckCircle,
} from '@mui/icons-material';
import { getJobs, createJob, connectSSE } from '../services/api';
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

interface Job {
  id: string;
  customerName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  status: string;
  priority?: string;
  createdAt?: string;
  archived?: boolean;
  archivedAt?: string;
}

export default function JobsPageImproved() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [customerTab, setCustomerTab] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pickupMode, setPickupMode] = useState('last_stop');
  const [recentCustomerNames, setRecentCustomerNames] = useState<string[]>([]);

  // Tab state: 0=Active Jobs, 1=Completed, 2=Archived
  const [mainTab, setMainTab] = useState(0);

  // Snackbar for user feedback
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

  // Load jobs from backend
  const loadJobs = async () => {
    try {
      const data = await getJobs();
      setJobs(data.jobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      showSnackbar('Failed to load jobs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load customers
  const loadCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers`);
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  useEffect(() => {
    loadJobs();
    loadCustomers();

    // Load recent customer names from local storage
    const cached = localStorage.getItem('recentCustomerNames');
    if (cached) {
      setRecentCustomerNames(JSON.parse(cached));
    }

    // Connect SSE for real-time updates - automatically archive completed jobs
    const eventSource = connectSSE((data) => {
      if (data.type === 'job-created' || data.type === 'job-updated') {
        loadJobs();

        // Auto-archive completed jobs after 5 seconds
        if (data.job?.status === 'completed' && !data.job?.archived) {
          setTimeout(() => {
            handleAutoArchiveCompleted();
          }, 5000);
        }
      }
    });

    return () => eventSource.close();
  }, []);

  // Show snackbar notification
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Dialog handlers
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

    // Update recent names cache
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

  // Archive a single job
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

  // Unarchive a job
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

  // Auto-archive all completed jobs
  const handleAutoArchiveCompleted = async () => {
    const completedJobs = jobs.filter(j => j.status === 'completed' && !j.archived);

    if (completedJobs.length === 0) {
      showSnackbar('No completed jobs to archive', 'info');
      return;
    }

    try {
      for (const job of completedJobs) {
        await fetch(`${API_BASE_URL}/api/jobs/${job.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: true, archivedAt: new Date().toISOString() }),
        });
      }

      await loadJobs();
      showSnackbar(`${completedJobs.length} job(s) archived`, 'success');
    } catch (error) {
      console.error('Failed to auto-archive jobs:', error);
      showSnackbar('Failed to archive completed jobs', 'error');
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'assigned': return 'info';
      case 'in_progress': return 'primary';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'normal': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  // Filter jobs by status and archive state
  const activeJobs = jobs.filter(j => !j.archived && j.status !== 'completed');
  const completedJobs = jobs.filter(j => !j.archived && j.status === 'completed');
  const archivedJobs = jobs.filter(j => j.archived);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with action buttons */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Jobs Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Create jobs, track status, and manage completed work
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={loadJobs} sx={{ textTransform: 'none' }}>
            Refresh
          </Button>
          {completedJobs.length > 0 && (
            <Tooltip title={`Archive ${completedJobs.length} completed job(s)`}>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<Archive />}
                onClick={handleAutoArchiveCompleted}
                sx={{ textTransform: 'none' }}
              >
                Archive Completed ({completedJobs.length})
              </Button>
            </Tooltip>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenDialog}
            sx={{ textTransform: 'none' }}
          >
            Create Job
          </Button>
        </Box>
      </Box>

      {/* Tabs for Active/Completed/Archived */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)}>
          <Tab
            label={
              <Badge badgeContent={activeJobs.length} color="primary">
                <span style={{ marginRight: 16 }}>Active Jobs</span>
              </Badge>
            }
            sx={{ textTransform: 'none' }}
          />
          <Tab
            label={
              <Badge badgeContent={completedJobs.length} color="success">
                <span style={{ marginRight: 16 }}>Completed Jobs</span>
              </Badge>
            }
            sx={{ textTransform: 'none' }}
          />
          <Tab
            label={
              <Badge badgeContent={archivedJobs.length} color="default">
                <span style={{ marginRight: 16 }}>Archived</span>
              </Badge>
            }
            sx={{ textTransform: 'none' }}
          />
        </Tabs>
      </Box>

      {/* Active Jobs Tab */}
      {mainTab === 0 && (
        <Grid container spacing={3}>
          {activeJobs.length === 0 ? (
            <Grid item xs={12}>
              <Card sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" color="text.secondary">
                  No active jobs
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Click "Create Job" to add a new job
                </Typography>
              </Card>
            </Grid>
          ) : (
            activeJobs.map((job: Job) => (
              <Grid item xs={12} md={6} lg={4} key={job.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" noWrap>{job.customerName}</Typography>
                      <Box>
                        <Chip
                          label={job.status}
                          color={getStatusColor(job.status) as any}
                          size="small"
                          sx={{ mr: 0.5 }}
                        />
                        <Chip
                          label={job.priority}
                          color={getPriorityColor(job.priority) as any}
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Pickup:</strong> {job.pickupAddress || 'From last stop'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Delivery:</strong> {job.deliveryAddress}
                    </Typography>
                    {job.createdAt && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                        Created: {new Date(job.createdAt).toLocaleString()}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Completed Jobs Tab */}
      {mainTab === 1 && (
        <Grid container spacing={3}>
          {completedJobs.length === 0 ? (
            <Grid item xs={12}>
              <Card sx={{ textAlign: 'center', py: 6 }}>
                <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No completed jobs
                </Typography>
              </Card>
            </Grid>
          ) : (
            completedJobs.map((job: Job) => (
              <Grid item xs={12} md={6} lg={4} key={job.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" noWrap>{job.customerName}</Typography>
                      <Chip label="Completed" color="success" size="small" />
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Pickup:</strong> {job.pickupAddress}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Delivery:</strong> {job.deliveryAddress}
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                      <Tooltip title="Archive this job">
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => handleArchiveJob(job.id)}
                        >
                          <Archive />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Archived Jobs Tab */}
      {mainTab === 2 && (
        <Grid container spacing={3}>
          {archivedJobs.length === 0 ? (
            <Grid item xs={12}>
              <Card sx={{ textAlign: 'center', py: 6 }}>
                <Archive sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No archived jobs
                </Typography>
              </Card>
            </Grid>
          ) : (
            archivedJobs.map((job: Job) => (
              <Grid item xs={12} md={6} lg={4} key={job.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', opacity: 0.8 }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" noWrap>{job.customerName}</Typography>
                      <Chip label="Archived" size="small" />
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Pickup:</strong> {job.pickupAddress}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Delivery:</strong> {job.deliveryAddress}
                    </Typography>
                    {job.archivedAt && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                        Archived: {new Date(job.archivedAt).toLocaleString()}
                      </Typography>
                    )}
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                      <Tooltip title="Restore this job">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleUnarchiveJob(job.id)}
                        >
                          <Unarchive />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Create Job Dialog */}
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
                  <AddressInput
                    label="Delivery Address"
                    value={deliveryAddressData}
                    onChange={setDeliveryAddressData}
                    onValidationChange={setDeliveryAddressValid}
                    required
                  />
                </>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                <Tooltip title="Routing algorithm will determine optimal pickup sequence. 'Last Stop' uses the previous job's delivery location.">
                  <Info color="action" sx={{ cursor: 'help' }} />
                </Tooltip>
              </Box>

              {pickupMode === 'custom' && (
                <AddressInput
                  label="Pickup Address"
                  value={pickupAddressData}
                  onChange={setPickupAddressData}
                  onValidationChange={setPickupAddressValid}
                  required
                />
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

      {/* Snackbar for notifications */}
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
