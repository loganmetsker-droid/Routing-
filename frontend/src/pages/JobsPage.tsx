import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Chip, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tabs, Tab, Tooltip, Autocomplete } from '@mui/material';
import { Add, Info } from '@mui/icons-material';
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
  defaultAddressStructured?: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    zip: string;
  };
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [customerTab, setCustomerTab] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pickupMode, setPickupMode] = useState('last_stop');
  const [recentCustomerNames, setRecentCustomerNames] = useState<string[]>([]);
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

  useEffect(() => {
    loadJobs();
    loadCustomers();

    // Load recent customer names from local storage
    const cached = localStorage.getItem('recentCustomerNames');
    if (cached) {
      setRecentCustomerNames(JSON.parse(cached));
    }

    // Connect SSE for real-time updates
    const eventSource = connectSSE((data) => {
      if (data.type === 'job-created' || data.type === 'job-updated') {
        loadJobs();
      }
    });

    return () => eventSource.close();
  }, []);

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
        deliveryAddress: customer.address || '',
      });

      // Auto-populate delivery address if structured address exists
      if (customer.defaultAddressStructured) {
        setDeliveryAddressData({
          line1: customer.defaultAddressStructured.line1 || '',
          line2: customer.defaultAddressStructured.line2 || null,
          city: customer.defaultAddressStructured.city || '',
          state: customer.defaultAddressStructured.state || '',
          zip: customer.defaultAddressStructured.zip || '',
        });
        setDeliveryAddressValid(true);
      } else {
        // Reset to empty if no structured address
        setDeliveryAddressData({ line1: '', line2: null, city: '', state: '', zip: '' });
        setDeliveryAddressValid(false);
      }
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
      loadJobs();
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  };

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
        <Typography variant="h4">Jobs</Typography>
        <Box>
          <Button variant="outlined" onClick={loadJobs} sx={{ mr: 1 }}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>Create Job</Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {jobs.map((job: any) => (
          <Grid item xs={12} md={6} key={job.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{job.customerName}</Typography>
                <Box sx={{ mt: 1, mb: 2 }}>
                  <Chip label={job.status} color={getStatusColor(job.status) as any} size="small" sx={{ mr: 1 }} />
                  <Chip label={job.priority} color={getPriorityColor(job.priority) as any} size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  <strong>Pickup:</strong> {job.pickupAddress}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Delivery:</strong> {job.deliveryAddress}
                </Typography>
                {job.createdAt && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Created: {new Date(job.createdAt).toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

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
                    renderInput={(params) => (
                      <TextField {...params} label="Select Customer" required />
                    )}
                  />
                  {selectedCustomer && (
                    <AddressInput
                      label="Delivery Address"
                      value={deliveryAddressData}
                      onChange={setDeliveryAddressData}
                      onValidationChange={setDeliveryAddressValid}
                      required
                    />
                  )}
                </>
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
    </Box>
  );
}
