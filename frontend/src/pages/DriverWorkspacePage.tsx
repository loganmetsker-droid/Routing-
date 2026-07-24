import { ArrowForward, Chat, LocalShipping, Place } from '@mui/icons-material';
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { StatusPill, type StatusPillTone } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import { TopoShellBackground } from '../components/TopoShellBackground';
import LoadingState from '../components/ui/LoadingState';
import { useDriverManifestQuery } from '../services/driverApi';
import { trovanColors } from '../theme/designTokens';

const driverPrimaryButtonSx = {
  minHeight: 56,
  borderRadius: 1.5,
  fontSize: '1rem',
  '& .MuiButton-endIcon svg': {
    fontSize: 26,
  },
} as const;

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
  const routes = manifest?.routes || [];

  if (manifestQuery.isLoading) {
    return <LoadingState label="Loading driver workspace..." minHeight="50vh" />;
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        width: '100%',
        maxWidth: '100vw',
        px: { xs: 1.25, sm: 2 },
        pt: { xs: 'max(14px, env(safe-area-inset-top))', sm: 2 },
        pb: { xs: 'max(14px, env(safe-area-inset-bottom))', sm: 2 },
        bgcolor: trovanColors.black[950],
        background: `linear-gradient(180deg, ${trovanColors.black[950]} 0%, ${trovanColors.black[900]} 100%)`,
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      <TopoShellBackground active tone="black" quiet />
      <Stack
        spacing={1.2}
        sx={{
          maxWidth: 460,
          mx: 'auto',
          position: 'relative',
          zIndex: 1,
          minWidth: 0,
        }}
      >
        <SurfacePanel
          variant="command"
          padding={1.5}
          sx={{
            borderTop: `4px solid ${trovanColors.copper[500]}`,
            bgcolor: 'rgba(31, 26, 23, 0.96)',
          }}
        >
          <Stack spacing={1.2}>
            <Stack direction="row" alignItems="center" spacing={1.1}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 1,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'rgba(185,113,41,0.14)',
                  color: trovanColors.copper[500],
                  flex: '0 0 auto',
                }}
              >
                <LocalShipping />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ color: trovanColors.copper[500] }}>
                  TROVAN DRIVER
                </Typography>
                <Typography variant="h5" component="h1" sx={{ lineHeight: 1.1, overflowWrap: 'anywhere' }}>
                  {manifest
                    ? `${manifest.driver.firstName} ${manifest.driver.lastName}`
                    : 'Driver'}
                </Typography>
              </Box>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {routes.length} assigned {routes.length === 1 ? 'route' : 'routes'}
            </Typography>
          </Stack>
        </SurfacePanel>

        {routes.length === 0 ? (
          <SurfacePanel variant="command" padding={1.6}>
            <Typography variant="h5" component="h2" sx={{ mb: 0.7 }}>
              No assigned routes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your route will appear here when it is assigned.
            </Typography>
          </SurfacePanel>
        ) : (
          <Stack spacing={1.2}>
            {routes.map((route) => {
              const progress = route.progress.totalStops
                ? (route.progress.completedStops / route.progress.totalStops) * 100
                : 0;
              return (
                <SurfacePanel key={route.routeRun.id} variant="command" padding={1.4}>
                  <Stack spacing={1.2}>
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" component="h2" color="text.secondary">
                          Today route
                        </Typography>
                        <Typography variant="h6" component="h3" sx={{ overflowWrap: 'anywhere' }}>
                          {route.nextStop?.presentation?.customerName || 'Next stop pending'}
                        </Typography>
                      </Box>
                      <StatusPill
                        label={route.routeRun.status.replace(/_/g, ' ')}
                        tone={statusColor(route.routeRun.status)}
                      />
                    </Stack>

                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {route.progress.completedStops}/{route.progress.totalStops} stops
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {route.progress.remainingStops} left
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          height: 7,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.12)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: trovanColors.copper[500],
                          },
                        }}
                      />
                    </Box>

                    <Stack spacing={0.75}>
                      <Stack direction="row" spacing={0.8} alignItems="flex-start">
                        <Place fontSize="small" sx={{ mt: 0.15, color: trovanColors.copper[500] }} />
                        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                          {route.nextStop?.presentation?.address || 'Address pending'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        <Chat fontSize="small" sx={{ color: trovanColors.copper[500] }} />
                        <Typography variant="body2" color="text.secondary">
                          {route.messageSummary?.unreadCount || 0} unread messages
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                        {route.vehicle
                          ? `${route.vehicle.make} ${route.vehicle.model} • ${route.vehicle.licensePlate}`
                          : 'Vehicle pending'}
                      </Typography>
                    </Stack>

                    <Button
                      component={RouterLink}
                      to={`/driver/route-runs/${route.routeRun.id}`}
                      variant="contained"
                      endIcon={<ArrowForward />}
                      size="large"
                      fullWidth
                      sx={driverPrimaryButtonSx}
                    >
                      Start stop flow
                    </Button>
                  </Stack>
                </SurfacePanel>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
