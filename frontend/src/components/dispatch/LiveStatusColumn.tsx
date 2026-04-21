import { alpha, useTheme } from '@mui/material/styles';
import { Box, Typography, Stack, Divider } from '@mui/material';
import { Person, LocalShipping, CheckCircle, Warning } from '@mui/icons-material';
import {
  DispatchDriver as Driver,
  DispatchRoute as Route,
  DispatchVehicle as Vehicle,
} from '../../types/dispatch';
import StatusPill from '../ui/StatusPill';

interface LiveStatusColumnProps {
  drivers: Driver[];
  vehicles: Vehicle[];
  routes: Route[];
}

export default function LiveStatusColumn({
  drivers,
  vehicles,
  routes,
}: LiveStatusColumnProps) {
  const theme = useTheme();
  const mutedText = alpha(theme.palette.text.primary, 0.6);

  const driverAssignments = routes.reduce((acc, route) => {
    if (route.driverId) {
      acc[route.driverId] = (acc[route.driverId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const vehicleAssignments = routes.reduce((acc, route) => {
    if (route.vehicleId) {
      acc[route.vehicleId] = true;
    }
    return acc;
  }, {} as Record<string, boolean>);

  const sortedDrivers = [...drivers].sort((a, b) => {
    const aCount = driverAssignments[a.id] || 0;
    const bCount = driverAssignments[b.id] || 0;
    return aCount - bCount;
  });
  const degradedRoutes = routes.filter((route) => route.dataQuality && route.dataQuality !== 'live').length;
  const reroutePending = routes.filter(
    (route) => route.rerouteState === 'requested' || route.rerouteState === 'approved',
  ).length;

  return (
    <Box sx={{ p: 0 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <StatusPill compact label={`${routes.length} active`} color="#2563eb" />
        <StatusPill
          compact
          label={`${degradedRoutes} degraded`}
          color={degradedRoutes > 0 ? '#d97706' : '#64748b'}
        />
        <StatusPill
          compact
          label={`${reroutePending} reroute`}
          color={reroutePending > 0 ? '#f97316' : '#64748b'}
        />
      </Stack>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Person sx={{ fontSize: 22, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px' }}>
            Drivers
          </Typography>
        </Box>
        <Stack spacing={1.5}>
          {sortedDrivers.slice(0, 8).map((driver) => {
            const routeCount = driverAssignments[driver.id] || 0;
            const isAvailable = routeCount === 0;
            return (
              <Box
                key={driver.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: '8px',
                  bgcolor: isAvailable
                    ? alpha(theme.palette.success.main, 0.08)
                    : alpha(theme.palette.warning.main, 0.08),
                  border: '1px solid',
                  borderColor: isAvailable
                    ? alpha(theme.palette.success.main, 0.24)
                    : alpha(theme.palette.warning.main, 0.24),
                  transition: 'all 0.2s ease',
                }}
              >
                {isAvailable ? (
                  <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
                ) : (
                  <Warning sx={{ fontSize: 18, color: 'warning.dark' }} />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px', mb: 0.25 }}>
                    {driver.firstName} {driver.lastName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: mutedText, fontSize: '11px' }}>
                    {routeCount} route{routeCount !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Box sx={{ alignSelf: 'center' }}>
                  <StatusPill compact label={isAvailable ? 'Available' : 'Busy'} color={isAvailable ? '#059669' : '#d97706'} />
                </Box>
              </Box>
            );
          })}
          {sortedDrivers.length > 8 && (
            <Typography
              variant="caption"
              sx={{ color: mutedText, fontSize: '11px', textAlign: 'center', mt: 1 }}
            >
              +{sortedDrivers.length - 8} more
            </Typography>
          )}
          {sortedDrivers.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" sx={{ color: mutedText, fontSize: '13px' }}>
                No drivers available
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Divider sx={{ my: 3, borderColor: alpha(theme.palette.text.primary, 0.08) }} />

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <LocalShipping sx={{ fontSize: 22, color: 'secondary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px' }}>
            Vehicles
          </Typography>
        </Box>
        <Stack spacing={1.5}>
          {vehicles.slice(0, 8).map((vehicle) => {
            const isAssigned = vehicleAssignments[vehicle.id];
            const displayStatus =
              vehicle.status === 'available' && !isAssigned
                ? 'Available'
                : isAssigned
                ? 'Assigned'
                : vehicle.status;

            return (
              <Box
                key={vehicle.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: '8px',
                  bgcolor: isAssigned
                    ? alpha(theme.palette.info.main, 0.08)
                    : alpha(theme.palette.background.paper, 0.72),
                  border: '1px solid',
                  borderColor: isAssigned
                    ? alpha(theme.palette.info.main, 0.24)
                    : alpha(theme.palette.text.primary, 0.08),
                  transition: 'all 0.2s ease',
                }}
              >
                <LocalShipping
                  sx={{
                    fontSize: 18,
                    color: isAssigned ? 'info.main' : mutedText,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px', mb: 0.25 }}>
                    {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: mutedText, fontSize: '11px' }}>
                    {vehicle.licensePlate || 'No plate'}
                  </Typography>
                </Box>
                <Box sx={{ alignSelf: 'center' }}>
                  <StatusPill
                    compact
                    label={displayStatus}
                    color={
                      displayStatus === 'Available'
                        ? '#059669'
                        : displayStatus === 'Assigned'
                          ? '#0284c7'
                          : '#64748b'
                    }
                  />
                </Box>
              </Box>
            );
          })}
          {vehicles.length > 8 && (
            <Typography
              variant="caption"
              sx={{ color: mutedText, fontSize: '11px', textAlign: 'center', mt: 1 }}
            >
              +{vehicles.length - 8} more
            </Typography>
          )}
          {vehicles.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" sx={{ color: mutedText, fontSize: '13px' }}>
                No vehicles available
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
