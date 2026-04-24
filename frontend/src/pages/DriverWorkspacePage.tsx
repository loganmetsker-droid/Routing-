import { ArrowForward, Navigation, Route, Schedule } from '@mui/icons-material';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { StatusPill, type StatusPillTone } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import { useDriverManifestQuery } from '../services/driverApi';
import { trovanColors } from '../theme/designTokens';

function statusColor(status: string): StatusPillTone {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'danger';
  if (['in_progress', 'assigned', 'arrived'].includes(normalized)) return 'info';
  if (['planned', 'pending'].includes(normalized)) return 'warning';
  return 'default';
}

export default function DriverWorkspacePage() {
  const manifestQuery = useDriverManifestQuery();
  const manifest = manifestQuery.data ?? null;

  if (manifestQuery.isLoading) {
    return <LoadingState label="Loading driver workspace..." minHeight="50vh" />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1.5, md: 2.5 },
        py: { xs: 2, md: 3 },
        bgcolor: '#EEF2F6',
        background: 'linear-gradient(180deg, #F4F6F8 0%, #EEF2F6 100%)',
      }}
    >
      <Box sx={{ maxWidth: 1380, mx: 'auto' }}>
        <Stack spacing={2.5}>
          <SurfacePanel
            variant="command"
            sx={{
              borderTop: `4px solid ${trovanColors.copper[500]}`,
              backgroundImage:
                'radial-gradient(circle at top left, rgba(185,113,41,0.08), transparent 24%)',
            }}
          >
            <Stack spacing={2.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" component="div" sx={{ color: trovanColors.copper[600], mb: 0.8 }}>
                    DRIVER WORKSPACE
                  </Typography>
                  <Typography variant="h2" component="h1" sx={{ mb: 0.8 }}>
                    {manifest
                      ? `${manifest.driver.firstName} ${manifest.driver.lastName}`
                      : 'Driver Workspace'}
                  </Typography>
                  <Typography variant="body1" component="p" color="text.secondary" sx={{ maxWidth: 640 }}>
                    Route execution built for motion: today’s manifest, stop actions, telemetry, and no dispatcher clutter.
                  </Typography>
                </Box>
                <Button component={RouterLink} to="/" variant="outlined">
                  Dispatcher console
                </Button>
              </Stack>

              <Grid container spacing={1.5}>
                {[
                  { label: 'Assigned route runs', value: manifest?.routes.length || 0 },
                  { label: 'Driver email', value: manifest?.driver.email || 'Unavailable' },
                  { label: 'Driver phone', value: manifest?.driver.phone || 'Unavailable' },
                ].map((item) => (
                  <Grid item xs={12} md={4} key={item.label}>
                    <SurfacePanel variant="subtle" padding={1.6} sx={{ height: '100%' }}>
                      <Typography variant="subtitle2" component="div" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="h5" component="div" sx={{ overflowWrap: 'anywhere' }}>
                        {item.value}
                      </Typography>
                    </SurfacePanel>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </SurfacePanel>

          {(manifest?.routes || []).length === 0 ? (
            <SurfacePanel variant="command">
              <Typography variant="h3" sx={{ mb: 1 }}>
                No assigned route runs
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Once dispatch publishes work to this driver, the route manifest appears here with stop execution actions.
              </Typography>
            </SurfacePanel>
          ) : (
            <Stack spacing={2}>
              {(manifest?.routes || []).map((route) => (
                <SurfacePanel key={route.routeRun.id} variant="command" sx={{ overflow: 'hidden' }}>
                  <Stack spacing={2.25}>
                    <Stack
                      direction={{ xs: 'column', lg: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', lg: 'center' }}
                      spacing={1.5}
                    >
                      <Box>
                        <Typography variant="subtitle2" component="div" sx={{ mb: 0.75 }}>
                          ACTIVE MANIFEST
                        </Typography>
                        <Typography variant="h3" component="div" sx={{ mb: 0.5 }}>
                          Route {route.routeRun.id.slice(0, 8)}
                        </Typography>
                        <Typography variant="body2" component="div" color="text.secondary">
                          {route.vehicle
                            ? `${route.vehicle.make} ${route.vehicle.model} • ${route.vehicle.licensePlate}`
                            : 'Vehicle pending'}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <StatusPill
                          label={route.routeRun.status.replace(/_/g, ' ')}
                          tone={statusColor(route.routeRun.status)}
                        />
                        <StatusPill
                          label={`${route.progress.remainingStops} stops remaining`}
                          tone={route.progress.remainingStops ? 'warning' : 'success'}
                        />
                      </Stack>
                    </Stack>

                    <Grid container spacing={2}>
                      <Grid item xs={12} xl={8}>
                        <Grid container spacing={1.5}>
                          {[
                            {
                              icon: <Route fontSize="small" />,
                              label: 'Distance',
                              value: `${Number(route.routeRun.totalDistanceKm || 0).toFixed(1)} km`,
                            },
                            {
                              icon: <Schedule fontSize="small" />,
                              label: 'Duration',
                              value: `${route.routeRun.totalDurationMinutes || 0} min`,
                            },
                            {
                              icon: <Navigation fontSize="small" />,
                              label: 'Telemetry',
                              value: route.latestTelemetry
                                ? `${route.latestTelemetry.latitude.toFixed(3)}, ${route.latestTelemetry.longitude.toFixed(3)}`
                                : 'Pending',
                            },
                          ].map((item) => (
                            <Grid item xs={12} md={4} key={item.label}>
                              <SurfacePanel variant="subtle" padding={1.6} sx={{ height: '100%' }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.7 }}>
                                  <Box sx={{ color: trovanColors.copper[500], display: 'grid', placeItems: 'center' }}>
                                    {item.icon}
                                  </Box>
                                  <Typography variant="subtitle2" component="div">
                                    {item.label}
                                  </Typography>
                                </Stack>
                                <Typography variant="h5" component="div" sx={{ overflowWrap: 'anywhere' }}>
                                  {item.value}
                                </Typography>
                              </SurfacePanel>
                            </Grid>
                          ))}
                        </Grid>
                      </Grid>

                      <Grid item xs={12} xl={4}>
                        <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                          <Typography variant="subtitle2" component="div" sx={{ mb: 0.8 }}>
                            NEXT ACTION
                          </Typography>
                          <Typography variant="h5" component="div" sx={{ mb: 1 }}>
                            Open the route run
                          </Typography>
                          <Typography variant="body2" component="div" color="text.secondary" sx={{ mb: 2 }}>
                            Enter the stop flow, capture proof, and update service status without dispatcher clutter.
                          </Typography>
                          <Button
                            component={RouterLink}
                            to={`/driver/route-runs/${route.routeRun.id}`}
                            variant="contained"
                            endIcon={<ArrowForward />}
                            fullWidth
                          >
                            Open route run
                          </Button>
                        </SurfacePanel>
                      </Grid>
                    </Grid>
                  </Stack>
                </SurfacePanel>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
