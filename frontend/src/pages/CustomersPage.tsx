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
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../services/api';

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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [formData, setFormData] = useState({
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
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await getCustomers();
        if (!mounted) return;
        const safeCustomers = Array.isArray(data) ? data : [];
        setCustomers(safeCustomers);
        setSelectedCustomerId(safeCustomers[0]?.id || '');
      } catch (error) {
        console.error('Failed to load customers', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === selectedCustomerId) || customers[0] || null, [customers, selectedCustomerId]);

  const openCreate = () => {
    setEditingCustomer(null);
    setFormData({
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
    });
    setDialogOpen(true);
  };

  const openEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      businessName: customer.businessName || '',
      defaultAddress: customer.defaultAddress || customer.address || '',
      notes: customer.notes || '',
      serviceTime: '',
      timeWindows: '',
      callAheadRequired: '',
      gateCode: '',
      dockHours: '',
      vehicleRestrictions: '',
      signatureRequired: '',
      weekendRestrictions: '',
      preferredTerritory: '',
      additionalConstraints: customer.exceptions || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
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
        await updateCustomer(editingCustomer.id, payload);
      } else {
        await createCustomer(payload as any);
      }
      setDialogOpen(false);
      const data = await getCustomers();
      const safeCustomers = Array.isArray(data) ? data : [];
      setCustomers(safeCustomers);
      setSelectedCustomerId(safeCustomers[0]?.id || '');
    } catch (error) {
      console.error('Failed to save customer', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedCustomer) return;
    try {
      await deleteCustomer(selectedCustomer.id);
      const data = await getCustomers();
      const safeCustomers = Array.isArray(data) ? data : [];
      setCustomers(safeCustomers);
      setSelectedCustomerId(safeCustomers[0]?.id || '');
    } catch (error) {
      console.error('Failed to delete customer', error);
    }
  };

  if (loading) {
    return <LoadingState label="Loading customers..." minHeight="50vh" />;
  }

  return (
    <Box>
      <PageHeader eyebrow="Resources" title="Customers" subtitle="Contact details, service notes, and operational constraints now have a clear home." actions={<Button variant="contained" onClick={openCreate}>Add Customer</Button>} />

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={4}>
          <SurfacePanel sx={{ p: 0, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h5">Customer List</Typography>
            </Box>
            <List disablePadding>
              {customers.map((customer) => (
                <ListItemButton key={customer.id} selected={customer.id === selectedCustomer?.id} onClick={() => setSelectedCustomerId(customer.id)}>
                  <ListItemText primary={customer.name} secondary={customer.businessName || customer.defaultAddress || customer.address || 'Operational profile pending'} />
                </ListItemButton>
              ))}
            </List>
          </SurfacePanel>
        </Grid>

        <Grid item xs={12} lg={8}>
          <SurfacePanel>
            {selectedCustomer ? (
              <>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h4">{selectedCustomer.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{selectedCustomer.businessName || 'Individual customer'}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
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
                    <Grid item xs={12} md={6}>
                      <SurfacePanel sx={{ bgcolor: 'rgba(255, 248, 242, 1)' }}>
                        <Typography variant="subtitle2" color="text.secondary">Contact details</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>{selectedCustomer.phone || 'Phone not set'}</Typography>
                        <Typography variant="body2">{selectedCustomer.email || 'Email not set'}</Typography>
                      </SurfacePanel>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <SurfacePanel sx={{ bgcolor: 'rgba(243, 236, 228, 0.8)' }}>
                        <Typography variant="subtitle2" color="text.secondary">Address</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>{selectedCustomer.defaultAddress || selectedCustomer.address || 'No address saved'}</Typography>
                      </SurfacePanel>
                    </Grid>
                  </Grid>
                ) : null}

                {detailTab === 1 ? (
                  <SurfacePanel sx={{ bgcolor: 'rgba(255, 248, 242, 1)' }}>
                    <Typography variant="subtitle2" color="text.secondary">Operational constraints</Typography>
                    <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line' }}>{selectedCustomer.exceptions || 'No operational constraints recorded yet.'}</Typography>
                  </SurfacePanel>
                ) : null}

                {detailTab === 2 ? (
                  <SurfacePanel sx={{ bgcolor: 'rgba(243, 236, 228, 0.8)' }}>
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
            <Grid item xs={12} md={6}><TextField label="Name" value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Business name" value={formData.businessName} onChange={(event) => setFormData((current) => ({ ...current, businessName: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Phone" value={formData.phone} onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Email" value={formData.email} onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Address" multiline minRows={3} value={formData.defaultAddress} onChange={(event) => setFormData((current) => ({ ...current, defaultAddress: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Service time" value={formData.serviceTime} onChange={(event) => setFormData((current) => ({ ...current, serviceTime: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Time windows" value={formData.timeWindows} onChange={(event) => setFormData((current) => ({ ...current, timeWindows: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Call ahead required" value={formData.callAheadRequired} onChange={(event) => setFormData((current) => ({ ...current, callAheadRequired: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Gate code" value={formData.gateCode} onChange={(event) => setFormData((current) => ({ ...current, gateCode: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={4}><TextField label="Dock hours" value={formData.dockHours} onChange={(event) => setFormData((current) => ({ ...current, dockHours: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Vehicle restrictions" value={formData.vehicleRestrictions} onChange={(event) => setFormData((current) => ({ ...current, vehicleRestrictions: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Preferred territory" value={formData.preferredTerritory} onChange={(event) => setFormData((current) => ({ ...current, preferredTerritory: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Signature required" value={formData.signatureRequired} onChange={(event) => setFormData((current) => ({ ...current, signatureRequired: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12} md={6}><TextField label="Weekend restrictions" value={formData.weekendRestrictions} onChange={(event) => setFormData((current) => ({ ...current, weekendRestrictions: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Additional operational constraints" multiline minRows={3} value={formData.additionalConstraints} onChange={(event) => setFormData((current) => ({ ...current, additionalConstraints: event.target.value }))} fullWidth /></Grid>
            <Grid item xs={12}><TextField label="Notes" multiline minRows={3} value={formData.notes} onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))} fullWidth /></Grid>
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
