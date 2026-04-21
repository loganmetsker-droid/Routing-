import { useState } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  LinearProgress,
  Stack,
  Collapse,
  IconButton,
  Alert,
} from '@mui/material';
import {
  LocalShipping,
  Person,
  ExpandMore,
  ExpandLess,
  Autorenew,
  PersonAdd,
  PersonRemove,
} from '@mui/icons-material';
import {
  DispatchDriver as Driver,
  DispatchJob as Job,
  DispatchRoute as Route,
  DispatchVehicle as Vehicle,
} from '../../types/dispatch';
import StatusPill from '../ui/StatusPill';

interface VehicleRouteCardProps {
  vehicle: Vehicle;
  route: Route | null;
  jobs: Job[];
  driver: Driver | null;
  onOptimize: (routeId: string) => void;
  onAssignDriver: (routeId: string) => void;
  onRemoveDriver: (routeId: string) => void;
  optimizing: boolean;
  selected?: boolean;
  onSelect?: (routeId: string | null) => void;
}

export default function VehicleRouteCard({
  vehicle,
  route,
  jobs,
  driver,
  onOptimize,
  onAssignDriver,
  onRemoveDriver,
  optimizing,
  selected = false,
  onSelect,
}: VehicleRouteCardProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const capacityPercent = route?.estimatedCapacity
    ? Math.min((route.estimatedCapacity / (vehicle.capacity || 1000)) * 100, 100)
    : 0;

  const routeJobs = route?.jobIds
    ? jobs
        .filter((job) => route.jobIds?.includes(job.id))
        .sort((a, b) => (a.stopSequence || 0) - (b.stopSequence || 0))
    : [];

  const formatDistance = (distanceKm?: number) => {
    if (!distanceKm) return '0 km';
    return `${distanceKm.toFixed(1)} km`;
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const hasRoute = !!route;
  const hasOptimizationData =
    Boolean(route?.optimizedStops && route.optimizedStops.length > 0) ||
    Boolean(route?.totalDistance);
  const hasDriver = !!driver;
  const brandText = theme.palette.text.primary;
  const mutedText = alpha(theme.palette.text.primary, 0.68);
  const tertiaryText = alpha(theme.palette.text.primary, 0.5);

  return (
    <Card
      elevation={0}
      onClick={() => onSelect?.(route?.id || null)}
      sx={{
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.84 : 0.9),
        border: '1.5px solid',
        borderColor: hasRoute
          ? selected
            ? alpha(theme.palette.primary.main, 0.45)
            : alpha(theme.palette.primary.main, 0.18)
          : selected
            ? alpha(theme.palette.primary.main, 0.32)
            : alpha(theme.palette.text.primary, 0.08),
        borderRadius: '10px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        '&:hover': {
          borderColor: hasRoute
            ? alpha(theme.palette.primary.main, 0.5)
            : alpha(theme.palette.text.primary, 0.16),
          transform: 'translateY(-1px)',
          boxShadow: hasRoute
            ? `0 14px 24px -20px ${alpha(theme.palette.primary.main, 0.35)}`
            : `0 16px 28px -22px ${alpha(theme.palette.common.black, 0.22)}`,
        },
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
          <LocalShipping
            sx={{
              color: hasRoute ? 'primary.main' : tertiaryText,
              fontSize: 24,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, fontSize: '15px', color: brandText }}
            >
              {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Unassigned vehicle'}
            </Typography>
            <Typography variant="caption" sx={{ color: tertiaryText, fontSize: '12px' }}>
              {vehicle.licensePlate || 'No plate'}
            </Typography>
          </Box>
          <StatusPill
            compact
            label={vehicle.status || 'unknown'}
            color={vehicle.status === 'available' ? theme.palette.success.main : theme.palette.warning.main}
          />
        </Box>

        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: mutedText, fontSize: '12px', fontWeight: 500 }}
            >
              Capacity
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: brandText, fontSize: '12px', fontWeight: 700 }}
            >
              {capacityPercent.toFixed(0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={capacityPercent}
            sx={{
              height: 10,
              borderRadius: '6px',
              bgcolor: alpha(theme.palette.text.primary, 0.08),
              '& .MuiLinearProgress-bar': {
                borderRadius: '6px',
                bgcolor:
                  capacityPercent > 90
                    ? theme.palette.error.main
                    : capacityPercent > 70
                    ? theme.palette.warning.main
                    : theme.palette.success.main,
                transition: 'all 0.3s ease',
              },
            }}
          />
        </Box>

        {hasRoute ? (
          <>
            <Box
              sx={{
                mb: 2.5,
                p: 2,
                bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.9 : 0.84),
                borderRadius: '8px',
                border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: tertiaryText,
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'block',
                  mb: 1,
                }}
              >
                Route ID: {route.id.slice(0, 8)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: brandText, fontSize: '13px' }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {routeJobs.length}
                  </Box>{' '}
                  jobs
                </Typography>
                <Typography variant="body2" sx={{ color: brandText, fontSize: '13px' }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {formatDistance(route.totalDistance)}
                  </Box>
                </Typography>
                <Typography variant="body2" sx={{ color: brandText, fontSize: '13px' }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {formatDuration(route.totalDuration)}
                  </Box>
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
                <StatusPill
                  compact
                  label={route.optimizationStatus || 'optimized'}
                  color={route.optimizationStatus === 'optimized' ? '#059669' : '#d97706'}
                />
                <StatusPill
                  compact
                  label={route.dataQuality || 'live'}
                  color={route.dataQuality === 'live' ? '#0ea5e9' : route.dataQuality === 'degraded' ? '#d97706' : '#64748b'}
                />
                {route.rerouteState ? (
                  <StatusPill
                    compact
                    label={`reroute ${route.rerouteState}`}
                    color={route.rerouteState === 'applied' ? '#059669' : '#d97706'}
                  />
                ) : null}
              </Stack>
            </Box>

            <Box
              sx={{
                mb: 2.5,
                p: 1.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                bgcolor: hasDriver
                  ? alpha(theme.palette.success.main, 0.1)
                  : alpha(theme.palette.warning.main, 0.12),
                borderRadius: '8px',
                border: '1px solid',
                borderColor: hasDriver
                  ? alpha(theme.palette.success.main, 0.24)
                  : alpha(theme.palette.warning.main, 0.3),
              }}
            >
              <Person sx={{ fontSize: 20, color: hasDriver ? 'success.main' : 'warning.dark' }} />
              <Typography
                variant="body2"
                sx={{ flex: 1, minWidth: 0, color: brandText, fontSize: '13px', fontWeight: 500 }}
              >
                {hasDriver ? `${driver.firstName} ${driver.lastName}` : 'No driver assigned'}
              </Typography>
              {hasDriver && <StatusPill compact label="Assigned" color={theme.palette.success.main} />}
            </Box>

            {!hasOptimizationData && (
              <Alert
                severity="warning"
                icon={false}
                sx={{
                  mb: 2.5,
                  py: 1,
                  px: 1.5,
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.28)}`,
                  color: theme.palette.warning.dark,
                  fontSize: '12px',
                  fontWeight: 600,
                  '& .MuiAlert-message': {
                    p: 0,
                  },
                }}
              >
                Route needs an optimization pass before it is ready to dispatch.
              </Alert>
            )}
            {route.droppedJobIds && route.droppedJobIds.length > 0 ? (
              <Alert
                severity="error"
                icon={false}
                sx={{
                  mb: 2.5,
                  py: 1,
                  px: 1.5,
                  bgcolor: alpha(theme.palette.error.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.22)}`,
                  '& .MuiAlert-message': { p: 0 },
                }}
              >
                {route.droppedJobIds.length} dropped/infeasible job(s) flagged by planner.
              </Alert>
            ) : null}
            {route.exceptionCategory ? (
              <Alert
                severity="info"
                icon={false}
                sx={{
                  mb: 2.5,
                  py: 1,
                  px: 1.5,
                  bgcolor: alpha(theme.palette.info.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  '& .MuiAlert-message': { p: 0 },
                }}
              >
                Exception: {route.exceptionCategory}
              </Alert>
            ) : null}

            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => setExpanded((value) => !value)}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  Jobs ({routeJobs.length})
                </Typography>
                <IconButton size="small">
                  {expanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
              <Collapse in={expanded}>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {routeJobs.map((job, index) => (
                    <Box
                      key={job.id}
                      sx={{
                        p: 1,
                        bgcolor: alpha(theme.palette.background.default, 0.9),
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" display="block" fontWeight="bold">
                        {index + 1}. {job.customerName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {job.deliveryAddress || 'No address'}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </Box>

            <Stack spacing={1.5}>
              <Button
                size="small"
                variant="outlined"
                startIcon={optimizing ? <Autorenew className="rotating" /> : <Autorenew />}
                onClick={() => onOptimize(route.id)}
                disabled={optimizing}
                fullWidth
                sx={{
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                  color: 'primary.main',
                  borderRadius: '8px',
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': {
                    borderColor: alpha(theme.palette.text.primary, 0.1),
                    color: alpha(theme.palette.text.primary, 0.3),
                  },
                }}
              >
                {optimizing ? 'Optimizing...' : 'Optimize Route'}
              </Button>
              {!hasDriver && hasOptimizationData && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PersonAdd />}
                  onClick={() => onAssignDriver(route.id)}
                  fullWidth
                  sx={{
                    bgcolor: 'success.main',
                    color: 'common.white',
                    borderRadius: '8px',
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'success.dark',
                      transform: 'translateY(-1px)',
                      boxShadow: `0 8px 18px -12px ${alpha(theme.palette.success.main, 0.55)}`,
                    },
                  }}
                >
                  Assign Driver
                </Button>
              )}
              {hasDriver && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PersonRemove />}
                  onClick={() => onRemoveDriver(route.id)}
                  fullWidth
                  sx={{
                    borderColor: alpha(theme.palette.error.main, 0.5),
                    color: 'error.main',
                    borderRadius: '8px',
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'error.main',
                      bgcolor: alpha(theme.palette.error.main, 0.08),
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  Remove Driver
                </Button>
              )}
            </Stack>
          </>
        ) : (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              border: `2px dashed ${alpha(theme.palette.text.primary, 0.1)}`,
              borderRadius: '8px',
              bgcolor: alpha(theme.palette.background.paper, 0.65),
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: mutedText, fontSize: '14px', fontWeight: 500, mb: 1 }}
            >
              No route assigned
            </Typography>
            <Typography variant="caption" sx={{ color: tertiaryText, fontSize: '12px' }}>
              Select jobs from the planning queue and create a planned route.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
