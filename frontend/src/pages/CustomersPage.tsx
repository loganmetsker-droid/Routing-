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
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../graphql/hooks';
import { motion } from 'framer-motion';
import { useState } from 'react';

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

// Placeholder address validation function
const validateAddress = async (address: string): Promise<boolean> => {
  // TODO: Implement actual address validation
  // For now, just check if address is not empty
  return address.trim().length > 0;
};

export default function CustomersPage() {
  const { data, loading } = useCustomers();
  const [createCustomer] = useCreateCustomer();
  const [updateCustomer] = useUpdateCustomer();
  const [deleteCustomer] = useDeleteCustomer();

  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    businessName: '',
    notes: '',
    exceptions: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [addressError, setAddressError] = useState('');

  const handleOpenDialog = (customer?: any) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name || '',
        address: customer.address || '',
        businessName: customer.businessName || '',
        notes: customer.notes || '',
        exceptions: customer.exceptions || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        address: '',
        businessName: '',
        notes: '',
        exceptions: '',
      });
    }
    setAddressError('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCustomer(null);
    setAddressError('');
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
    // Validate address
    const isValidAddress = await validateAddress(formData.address);
    if (!isValidAddress) {
      setAddressError('Please enter a valid address');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCustomer) {
        await updateCustomer({
          variables: {
            id: editingCustomer.id,
            input: formData,
          },
        });
      } else {
        await createCustomer({
          variables: {
            input: formData,
          },
        });
      }
      handleCloseDialog();
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
      await deleteCustomer({
        variables: {
          id: deletingCustomer.id,
        },
      });
      handleCloseDeleteDialog();
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
              {data?.customers?.length > 0 ? (
                data.customers.map((customer: any) => (
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
                      <Typography variant="body2">{customer.address}</Typography>
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
              label="Address"
              name="address"
              value={formData.address}
              onChange={(e) => {
                setFormData({ ...formData, address: e.target.value });
                setAddressError('');
              }}
              fullWidth
              required
              error={!!addressError}
              helperText={addressError || 'Full delivery address'}
              placeholder="123 Main St, City, State, ZIP"
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
            disabled={submitting}
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
