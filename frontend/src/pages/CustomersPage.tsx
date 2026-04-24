import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import {
  getCustomerErrorMessage,
  type CustomerFormInput,
  type CustomerRecord,
  useCreateCustomerMutation,
  useCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from '../services/customersApi';

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

export default function CustomersPage() {
  const customersQuery = useCustomersQuery();
  const createCustomerMutation = useCreateCustomerMutation();
  const updateCustomerMutation = useUpdateCustomerMutation();
  const deleteCustomerMutation = useDeleteCustomerMutation();
  const customers = customersQuery.data ?? [];
  const loading = customersQuery.isLoading;
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (!customers.length) {
      setSelectedCustomerId('');
      return;
    }
    if (!selectedCustomerId || !customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || customers[0] || null,
    [customers, selectedCustomerId],
  );
  const visibleCustomers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter((customer) =>
      [
        customer.name,
        customer.businessName,
        customer.defaultAddress,
        customer.address,
        customer.email,
        customer.phone,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [customers, search]);

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
        await updateCustomerMutation.mutateAsync({
          id: editingCustomer.id,
          updates: payload,
        });
      } else {
        await createCustomerMutation.mutateAsync(payload);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save customer', getCustomerErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!selectedCustomer) return;
    try {
      await deleteCustomerMutation.mutateAsync(selectedCustomer.id);
    } catch (error) {
      console.error('Failed to delete customer', getCustomerErrorMessage(error));
    }
  };

  if (loading) {
    return <LoadingState label="Loading customers..." minHeight="50vh" />;
  }

  return (
    <Box>
      <PageHeader eyebrow="Resources" title="Customers" subtitle="A full-width customer directory with operational detail, contact context, and dispatch constraints in one workspace." actions={<Button variant="contained" onClick={openCreate}>Add Customer</Button>} />

      <SurfacePanel variant="command" sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xl: 'center' }}>
          <TextField
            size="small"
            label="Search customers"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, business, contact, or address"
            sx={{ minWidth: { xs: '100%', xl: 360 } }}
            fullWidth
          />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <SurfacePanel variant="muted" padding={1.25} sx={{ minWidth: 160 }}>
              <Typography variant="subtitle2">Accounts</Typography>
              <Typography variant="h5">{customers.length}</Typography>
            </SurfacePanel>
            <SurfacePanel variant="muted" padding={1.25} sx={{ minWidth: 160 }}>
              <Typography variant="subtitle2">Visible</Typography>
              <Typography variant="h5">{visibleCustomers.length}</Typography>
            </SurfacePanel>
            <SurfacePanel variant="muted" padding={1.25} sx={{ minWidth: 180 }}>
              <Typography variant="subtitle2">Selected</Typography>
              <Typography variant="h5">{selectedCustomer?.name || 'None'}</Typography>
            </SurfacePanel>
          </Stack>
        </Stack>
      </SurfacePanel>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={5} xl={4}>
          <SurfacePanel variant="command" sx={{ p: 0, overflow: 'hidden', minHeight: 'calc(100vh - 280px)' }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h5">Customer directory</Typography>
              <Typography variant="body2" color="text.secondary">
                Select an account to inspect service constraints and delivery context.
              </Typography>
            </Box>
            <List disablePadding>
              {visibleCustomers.map((customer) => (
                <ListItemButton key={customer.id} selected={customer.id === selectedCustomer?.id} onClick={() => setSelectedCustomerId(customer.id)} sx={{ py: 1.4, px: 2.25, alignItems: 'flex-start' }}>
                  <ListItemText
                    primary={customer.name}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                          {customer.businessName || 'Direct account'}
                        </Typography>
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                          {customer.defaultAddress || customer.address || 'Operational profile pending'}
                        </Typography>
                      </>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </SurfacePanel>
        </Grid>

        <Grid item xs={12} lg={7} xl={8}>
          <SurfacePanel variant="command" sx={{ minHeight: 'calc(100vh - 280px)' }}>
            {selectedCustomer ? (
              <>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h4">{selectedCustomer.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{selectedCustomer.businessName || 'Individual customer'}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button variant="outlined" onClick={() => openEdit(selectedCustomer)}>Edit</Button>
                    <Button variant="outlined" color="error" onClick={() => void handleDelete()}>Delete</Button>
                  </Stack>
                </Stack>

                <Tabs value={detailTab} onChange={(_, value) => setDetailTab(value)} sx={{ mb: 2 }}>
                  <Tab label="Overview" />
                  <Tab label="Operational Constraints" />
                  <Tab label="Notes" />
                </Tabs>

                {detailTab === 0 ? (
                  <Grid container spacing={2}>
                    <Grid item xs={12} xl={4}>
                      <SurfacePanel variant="muted">
                        <Typography variant="subtitle2" color="text.secondary">Contact details</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>{selectedCustomer.phone || 'Phone not set'}</Typography>
                        <Typography variant="body2">{selectedCustomer.email || 'Email not set'}</Typography>
                      </SurfacePanel>
                    </Grid>
                    <Grid item xs={12} xl={4}>
                      <SurfacePanel variant="muted">
                        <Typography variant="subtitle2" color="text.secondary">Address</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>{selectedCustomer.defaultAddress || selectedCustomer.address || 'No address saved'}</Typography>
                      </SurfacePanel>
                    </Grid>
                    <Grid item xs={12} xl={4}>
                      <SurfacePanel variant="subtle">
                        <Typography variant="subtitle2" color="text.secondary">Account status</Typography>
                        <Box sx={{ mt: 1.1, mb: 1.1 }}>
                          <StatusPill label="Active" tone="success" />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Customer profile is ready for routing, dispatch, and public tracking communication.
                        </Typography>
                      </SurfacePanel>
                    </Grid>
                  </Grid>
                ) : null}

                {detailTab === 1 ? (
                  <SurfacePanel variant="muted">
                    <Typography variant="subtitle2" color="text.secondary">Operational constraints</Typography>
                    <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line' }}>{selectedCustomer.exceptions || 'No operational constraints recorded yet.'}</Typography>
                  </SurfacePanel>
                ) : null}

                {detailTab === 2 ? (
                  <SurfacePanel variant="muted">
                    <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                    <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line' }}>{selectedCustomer.notes || 'No notes recorded yet.'}</Typography>
                  </SurfacePanel>
                ) : null}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">No customer selected.</Typography>
            )}
          </SurfacePanel>
        </Grid>
      </Grid>

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
            <Grid item xs={12} md={6}><TextField label="Call ahead required" value={formData.callAheadRequired} onChange={(event) => setFormData((current) => ({ ...current, callAheadRequired: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Gate code" value={formData.gateCode} onChange={(event) => setFormData((current) => ({ ...current, gateCode: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Dock hours" value={formData.dockHours} onChange={(event) => setFormData((current) => ({ ...current, dockHours: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Vehicle restrictions" value={formData.vehicleRestrictions} onChange={(event) => setFormData((current) => ({ ...current, vehicleRestrictions: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Signature required" value={formData.signatureRequired} onChange={(event) => setFormData((current) => ({ ...current, signatureRequired: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Weekend restrictions" value={formData.weekendRestrictions} onChange={(event) => setFormData((current) => ({ ...current, weekendRestrictions: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Preferred territory" value={formData.preferredTerritory} onChange={(event) => setFormData((current) => ({ ...current, preferredTerritory: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Additional constraints" multiline minRows={3} value={formData.additionalConstraints} onChange={(event) => setFormData((current) => ({ ...current, additionalConstraints: event.target.value }))} fullWidth /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSubmit()}>Save Customer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
