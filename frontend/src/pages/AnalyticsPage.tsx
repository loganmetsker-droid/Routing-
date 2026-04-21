import { Grid, Stack, Typography } from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import { KpiTile } from '../components/KpiTile';

export default function AnalyticsPage() {
  return (
    <Stack spacing={2.5}>
      <PageHeader eyebrow="System" title="Analytics" subtitle="A lightweight placeholder for the SaaS analytics surface without changing backend contracts in this pass." />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}><KpiTile label="On-time rate" value="96%" meta="Last 7 days" tone="success" /></Grid>
        <Grid item xs={12} md={4}><KpiTile label="Planner utilization" value="74%" meta="Scenarios published to dispatch" /></Grid>
        <Grid item xs={12} md={4}><KpiTile label="Exception rate" value="3.2%" meta="Needs richer backend instrumentation" tone="warning" /></Grid>
      </Grid>
      <SurfacePanel>
        <Typography variant="h5">Coming next</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This area is ready for route profitability, SLA adherence, driver productivity, and customer service analytics once the reporting layer is finalized.
        </Typography>
      </SurfacePanel>
    </Stack>
  );
}
