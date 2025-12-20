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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Avatar,
} from '@mui/material';
import { Add, Edit, Person } from '@mui/icons-material';
import { useDrivers, useCreateDriver, useUpdateDriver } from '../graphql/hooks';
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

export default function DriversPage() {
  const { data, loading } = useDrivers();
  const [createDriver] = useCreateDriver();
  const [updateDriver] = useUpdateDriver();

  const [openDialog, setOpenDialog] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    licenseNumber: '',
    status: 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleOpenDialog = (driver?: any) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({
        firstName: driver.firstName || '',
        lastName: driver.lastName || '',
        email: driver.email || '',
        phone: driver.phone || '',
        licenseNumber: driver.licenseNumber || '',
        status: driver.status || 'ACTIVE',
      });
    } else {
      setEditingDriver(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        licenseNumber: '',
        status: 'ACTIVE',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingDriver(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingDriver) {
        await updateDriver({
          variables: {
            id: editingDriver.id,
            input: formData,
          },
        });
      } else {
        await createDriver({
          variables: {
            input: formData,
          },
        });
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving driver:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'OFF_DUTY':
        return 'warning';
      case 'INACTIVE':
        return 'error';
      default:
        return 'default';
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
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
          Drivers
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
          }}
        >
          Add Driver
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
                <TableCell sx={{ fontWeight: 600 }}>Driver</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>License Number</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.drivers?.length > 0 ? (
                data.drivers.map((driver: any) => (
                  <motion.tr
                    key={driver.id}
                    variants={item}
                    component={TableRow}
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                          {getInitials(driver.firstName, driver.lastName)}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight={500}>
                            {driver.firstName} {driver.lastName}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{driver.phone || 'N/A'}</TableCell>
                    <TableCell>{driver.email || 'N/A'}</TableCell>
                    <TableCell>{driver.licenseNumber || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={driver.status}
                        color={getStatusColor(driver.status)}
                        size="small"
                        sx={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(driver)}
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
                    </TableCell>
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Box sx={{ py: 4 }}>
                      <Person sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                      <Typography variant="h6" color="textSecondary">
                        No drivers found
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Click "Add Driver" to create your first driver
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
          {editingDriver ? 'Edit Driver' : 'Add New Driver'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="License Number"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Status"
              select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              fullWidth
            >
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="OFF_DUTY">Off Duty</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
            </TextField>
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
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {submitting ? 'Saving...' : editingDriver ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
