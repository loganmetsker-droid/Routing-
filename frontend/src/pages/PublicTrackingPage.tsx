import { AccessTime, LocalShipping, SupportAgent } from '@mui/icons-material';
import { Box, Divider, Grid, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useParams } from 'react-router-dom';
import { StatusPill, type StatusPillTone } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import { usePublicTrackingQuery } from '../services/publicTrackingApi';

function statusColor(status: string): StatusPillTone {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'danger';
  if (['in_progress', 'assigned', 'arrived'].includes(normalized)) return 'info';
  if (['planned', 'pending', 'ready_for_dispatch'].includes(normalized)) return 'warning';
  return 'default';
}

export default function PublicTrackingPage() {
  const { token = '' } = useParams();
  const trackingQuery = usePublicTrackingQuery(token);
  const tracking = trackingQuery.data ?? null;

  if (trackingQuery.isLoading) {
    return <LoadingState label="Loading tracking link..." minHeight="100vh" />;
  }

  if (!tracking) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: '#EEF2F6' }}>
        <SurfacePanel variant="command" sx={{ maxWidth: 720, width: '100%' }}>
          <Typography variant="h2">Tracking link unavailable</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            This tracking link could not be loaded. It may have expired or the route run is no longer available.
          </Typography>
        </SurfacePanel>
      </Box>
    );
  }

  const accent = tracking.organization.branding.accentColor || '#B97129';
  const brandName = tracking.organization.branding.brandName || tracking.organization.name;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#E9EEF3',
        backgroundImage: `radial-gradient(circle at top right, ${alpha(accent, 0.12)}, transparent 24%), linear-gradient(180deg, #F4F6F8 0%, #E9EEF3 100%)`,
        px: { xs: 1.5, md: 3 },
        py: { xs: 2, md: 4 },
      }}
    >
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        <Stack spacing={2.5}>
          <SurfacePanel
            variant="command"
            sx={{
              borderTop: `4px solid ${accent}`,
              background:
                `radial-gradient(circle at top left, ${alpha(accent, 0.12)}, transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.96))`,
            }}
          >
            <Stack spacing={2}>
              <Typography variant="subtitle2" component="div" sx={{ color: accent }}>
                {brandName}
              </Typography>
              <Typography variant="h2" component="h1" sx={{ maxWidth: '14ch' }}>
                {tracking.organization.branding.trackingHeadline || 'Your delivery is on the way'}
              </Typography>
              <Typography variant="body1" component="p" color="text.secondary" sx={{ maxWidth: 720 }}>
                {tracking.organization.branding.trackingSubtitle ||
                  'Live route visibility, current delivery status, and proof-ready completion details.'}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <StatusPill
                  label={tracking.routeRun.status.replace(/_/g, ' ')}
                  tone={statusColor(tracking.routeRun.status)}
                />
                <StatusPill label={`Route ${tracking.routeRun.id.slice(0, 8)}`} tone="accent" />
                <StatusPill label={`${tracking.stops.length} stops`} tone="default" />
              </Stack>
            </Stack>
          </SurfacePanel>

          <Grid container spacing={2.5}>
            <Grid item xs={12} lg={4}>
              <Stack spacing={2.5}>
                <SurfacePanel variant="subtle">
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccessTime fontSize="small" />
                      <Typography variant="h4">Delivery status</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Planned start: {tracking.routeRun.plannedStart || 'Pending'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Started: {tracking.routeRun.actualStart || 'Not yet'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed: {tracking.routeRun.completedAt || 'In progress'}
                    </Typography>
                    <Divider />
                    <Typography variant="body2" color="text.secondary">
                      Link expires: {new Date(tracking.expiresAt).toLocaleString()}
                    </Typography>
                  </Stack>
                </SurfacePanel>

                <SurfacePanel variant="subtle">
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <LocalShipping fontSize="small" />
                      <Typography variant="h4">Vehicle</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {tracking.vehicle
                        ? `${tracking.vehicle.make} ${tracking.vehicle.model}`
                        : 'Vehicle details pending'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tracking.vehicle?.licensePlate || 'License plate pending'}
                    </Typography>
                    <Divider />
                    <Typography variant="subtitle2">Latest telemetry</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tracking.latestTelemetry
                        ? `${tracking.latestTelemetry.latitude.toFixed(3)}, ${tracking.latestTelemetry.longitude.toFixed(3)} at ${new Date(tracking.latestTelemetry.timestamp).toLocaleTimeString()}`
                        : 'Live vehicle telemetry is not available yet.'}
                    </Typography>
                  </Stack>
                </SurfacePanel>

                <SurfacePanel variant="subtle">
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <SupportAgent fontSize="small" />
                      <Typography variant="h4">Support</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {tracking.organization.branding.supportEmail || 'dispatch@trovan.app'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tracking.organization.branding.supportPhone || '(555) 010-0000'}
                    </Typography>
                  </Stack>
                </SurfacePanel>
              </Stack>
            </Grid>

            <Grid item xs={12} lg={8}>
              <SurfacePanel variant="command">
                <Stack spacing={1.5}>
                  <Typography variant="h3">Stop progress</Typography>
                  <Typography variant="body2" color="text.secondary">
                    A clear delivery timeline built for trust and readability, not marketing gradients.
                  </Typography>
                  <Stack spacing={1.25}>
                    {tracking.stops.map((stop) => (
                      <SurfacePanel
                        key={stop.id}
                        variant="muted"
                        sx={{
                          borderColor: alpha(accent, 0.16),
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Box>
                            <Typography variant="subtitle1" sx={{ mb: 0.35 }}>
                              Stop {stop.stopSequence}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Planned arrival: {stop.plannedArrival || 'Pending'}
                            </Typography>
                            {stop.actualArrival ? (
                              <Typography variant="body2" color="text.secondary">
                                Arrived: {stop.actualArrival}
                              </Typography>
                            ) : null}
                          </Box>
                          <StatusPill label={stop.status.replace(/_/g, ' ')} tone={statusColor(stop.status)} />
                        </Stack>
                      </SurfacePanel>
                    ))}
                  </Stack>
                </Stack>
              </SurfacePanel>
            </Grid>
          </Grid>
        </Stack>
      </Box>
    </Box>
  );
}
