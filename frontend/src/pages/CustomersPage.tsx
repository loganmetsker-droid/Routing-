import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Avatar,
  Chip,
} from '@mui/material';
import { Add, Edit, Delete, Business, Person } from '@mui/icons-material';
import { motion } from 'framer-motion';
import AddressInput from '../components/forms/AddressInput';
import { Address } from '../types/address';
import { formatAddress, parseLegacyAddress } from '../utils/addressValidation';

const API_BASE_URL = (import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '').replace(/\/api$/, '');

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { x: -20, opacity: 0 },
  show: { x: 0, opacity: 1 },
};


export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    businessName: '',
    notes: '',
    exceptions: '',
  });
  const [addressData, setAddressData] = useState<Address>({
    line1: '',
    line2: null,
    city: '',
    state: '',
    zip: '',
  });
  const [addressValid, setAddressValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/customers`);
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleOpenDialog = (customer?: any) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        businessName: customer.businessName || '',
        notes: customer.notes || '',
        exceptions: customer.exceptions || '',
      });
      if (customer.defaultAddressStructured) {
        const structuredAddress = {
          line1: customer.defaultAddressStructured.line1 || '',
          line2: customer.defaultAddressStructured.line2 || null,
          city: customer.defaultAddressStructured.city || '',
          state: customer.defaultAddressStructured.state || '',
          zip: customer.defaultAddressStructured.zip || '',
        };
        setAddressData(structuredAddress);
        setAddressValid(
          !!(
            structuredAddress.line1 &&
            structuredAddress.city &&
            structuredAddress.state &&
            structuredAddress.zip
          ),
        );
      } else {
        // Fallback for older customer records
        const parsed = parseLegacyAddress(customer.defaultAddress || customer.address || '');
        const parsedAddress = {
          line1: parsed.line1 || '',
          line2: parsed.line2 || null,
          city: parsed.city || '',
          state: parsed.state || '',
          zip: parsed.zip || '',
        };
        setAddressData(parsedAddress);
        setAddressValid(
          !!(
            parsedAddress.line1 &&
            parsedAddress.city &&
            parsedAddress.state &&
            parsedAddress.zip
          ),
        );
      }
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        businessName: '',
        notes: '',
        exceptions: '',
      });
      setAddressData({ line1: '', line2: null, city: '', state: '', zip: '' });
      setAddressValid(false);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCustomer(null);
    setAddressValid(false);
  };

  const handleOpenDeleteDialog = (customer: any) => {
    setDeletingCustomer(customer);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setDeletingCustomer(null);
  };

  const handleSubmit = async () => {
    if (!addressValid) {
      return;
    }

    setSubmitting(true);
    try {
      const customerData = {
        ...formData,
        defaultAddress: formatAddress(addressData),
        defaultAddressStructured: addressData,
      };

      if (editingCustomer) {
        await fetch(`${API_BASE_URL}/api/customers/${editingCustomer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerData),
        });
      } else {
        await fetch(`${API_BASE_URL}/api/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerData),
        });
      }
      handleCloseDialog();
      await loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;

    setSubmitting(true);
    try {
      await fetch(`${API_BASE_URL}/api/customers/${deletingCustomer.id}`, {
        method: 'DELETE',
      });
      handleCloseDeleteDialog();
      await loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Customers
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          data-testid="add-customer-button"
          sx={{
            textTransform: 'none',
            borderRadius: 2,
          }}
        >
          Add Customer
        </Button>
      </Box>

      <motion.div variants={container} initial="hidden" animate="show">
        <TableContainer
          component={Paper}
          sx={{
            boxShadow: 2,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Table>
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Business</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Exceptions</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.length > 0 ? (
                customers.map((customer: any) => (
                  <TableRow
                    key={customer.id}
                    component={motion.tr}
                    variants={item}
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }}>
                          {customer.businessName ? (
                            <Business fontSize="small" />
                          ) : (
                            getInitials(customer.name)
                          )}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight={500}>
                            {customer.name}
                          </Typography>
                          {customer.businessName && (
                            <Typography variant="caption" color="text.secondary">
                              {customer.businessName}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {customer.defaultAddress || customer.address || 'No address saved'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {customer.businessName ? (
                        <Typography variant="body2">{customer.businessName}</Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Individual
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.exceptions ? (
                        <Chip
                          label="Has Exceptions"
                          color="warning"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(customer)}
                          sx={{
                            '&:hover': {
                              bgcolor: 'primary.light',
                              color: 'primary.contrastText',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDeleteDialog(customer)}
                          sx={{
                            '&:hover': {
                              bgcolor: 'error.light',
                              color: 'error.contrastText',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Box sx={{ py: 4 }}>
                      <Person sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                      <Typography variant="h6" color="textSecondary">
                        No customers found
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Click "Add Customer" to create your first customer
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>
          {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              placeholder="John Doe"
            />
            <TextField
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
              placeholder="(555) 123-4567"
            />
            <TextField
              label="Email"
              name="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
              placeholder="customer@example.com"
            />
            <AddressInput
              label="Address"
              value={addressData}
              onChange={setAddressData}
              onValidationChange={setAddressValid}
              required
            />
            <TextField
              label="Business Name"
              name="businessName"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              fullWidth
              placeholder="Optional: ABC Company Inc."
            />
            <TextField
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Additional notes about the customer..."
            />
            <TextField
              label="Exceptions"
              name="exceptions"
              value={formData.exceptions}
              onChange={(e) => setFormData({ ...formData, exceptions: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder="Special delivery instructions, access restrictions, etc."
              helperText="Special handling requirements or delivery restrictions"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting || !formData.name || !addressValid}
            data-testid="save-customer-button"
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {submitting ? 'Saving...' : editingCustomer ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>Delete Customer?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingCustomer?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDeleteDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {submitting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
