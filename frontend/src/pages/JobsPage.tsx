import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Chip, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material';
import { Add } from '@mui/icons-material';
import { getJobs, createJob, connectSSE } from '../services/api';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    pickupAddress: '',
    deliveryAddress: '',
    priority: 'normal',
  });

  const loadJobs = async () => {
    try {
      const data = await getJobs();
      setJobs(data.jobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();

    // Connect SSE for real-time updates
    const eventSource = connectSSE((data) => {
      if (data.type === 'job-created' || data.type === 'job-updated') {
        loadJobs();
      }
    });

    return () => eventSource.close();
  }, []);

  const handleCreateJob = async () => {
    try {
      await createJob(formData);
      setCreateDialogOpen(false);
      setFormData({ customerName: '', pickupAddress: '', deliveryAddress: '', priority: 'normal' });
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
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateDialogOpen(true)}>Create Job</Button>
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

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Job</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Customer Name"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Pickup Address"
              value={formData.pickupAddress}
              onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Delivery Address"
              value={formData.deliveryAddress}
              onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
              fullWidth
              required
            />
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateJob} disabled={!formData.customerName || !formData.pickupAddress || !formData.deliveryAddress}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
