import { Box, Typography, Grid, Card, CardContent, Chip, Button, CircularProgress } from '@mui/material';
import { useJobs } from '../graphql/hooks';

export default function JobsPage() {
  const { data, loading, refetch } = useJobs();
  const jobs = data?.jobs || [];

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
        <Button variant="contained" onClick={() => refetch()}>Refresh</Button>
      </Box>

      <Grid container spacing={3}>
        {jobs.map((job: any) => (
          <Grid item xs={12} md={6} key={job.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{job.jobType}</Typography>
                <Chip label={job.status} size="small" sx={{ mt: 1 }} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Pickup: {new Date(job.scheduledPickupTime).toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  Delivery: {new Date(job.scheduledDeliveryTime).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
