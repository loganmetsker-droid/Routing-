import { Box, Typography, Paper, Chip, Stack, Divider } from '@mui/material';
import { Person, LocalShipping, CheckCircle, Warning } from '@mui/icons-material';

interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
  status: string;
}

interface Vehicle {
  id: string;
  make?: string;
  model?: string;
  licensePlate?: string;
  status: string;
}

interface Route {
  id: string;
  driverId?: string;
  vehicleId?: string;
}

interface LiveStatusColumnProps {
  drivers: Driver[];
  vehicles: Vehicle[];
  routes: Route[];
}

export default function LiveStatusColumn({ drivers, vehicles, routes }: LiveStatusColumnProps) {
  // Calculate driver assignments
  const driverAssignments = routes.reduce((acc, route) => {
    if (route.driverId) {
      acc[route.driverId] = (acc[route.driverId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Calculate vehicle assignments
  const vehicleAssignments = routes.reduce((acc, route) => {
    if (route.vehicleId) {
      acc[route.vehicleId] = true;
    }
    return acc;
  }, {} as Record<string, boolean>);

  // Sort drivers by availability
  const sortedDrivers = [...drivers].sort((a, b) => {
    const aCount = driverAssignments[a.id] || 0;
    const bCount = driverAssignments[b.id] || 0;
    return aCount - bCount;
  });

  const getDriverStatusColor = (driver: Driver) => {
    const routeCount = driverAssignments[driver.id] || 0;
    if (routeCount === 0) return 'success';
    if (routeCount === 1) return 'warning';
    return 'error';
  };

  const getVehicleStatusColor = (vehicle: Vehicle) => {
    if (vehicle.status === 'available' && !vehicleAssignments[vehicle.id]) return 'success';
    if (vehicle.status === 'in_transit') return 'info';
    if (vehicleAssignments[vehicle.id]) return 'warning';
    return 'default';
  };

  return (
    <Box>
      {/* Available Drivers */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Person />
          <Typography variant="h6">Drivers</Typography>
        </Box>
        <Stack spacing={1}>
          {sortedDrivers.slice(0, 8).map((driver) => {
            const routeCount = driverAssignments[driver.id] || 0;
            const isAvailable = routeCount === 0;
            return (
              <Box
                key={driver.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: isAvailable ? 'success.50' : 'action.hover',
                  border: '1px solid',
                  borderColor: isAvailable ? 'success.main' : 'divider',
                }}
              >
                {isAvailable ? (
                  <CheckCircle fontSize="small" color="success" />
                ) : (
                  <Warning fontSize="small" color="warning" />
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight="bold">
                    {driver.firstName} {driver.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {routeCount} route{routeCount !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Chip
                  label={isAvailable ? 'Available' : 'Busy'}
                  size="small"
                  color={getDriverStatusColor(driver)}
                />
              </Box>
            );
          })}
          {sortedDrivers.length > 8 && (
            <Typography variant="caption" color="text.secondary" textAlign="center">
              +{sortedDrivers.length - 8} more
            </Typography>
          )}
          {sortedDrivers.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No drivers
            </Typography>
          )}
        </Stack>
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Vehicle Status */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LocalShipping />
          <Typography variant="h6">Vehicles</Typography>
        </Box>
        <Stack spacing={1}>
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
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <LocalShipping fontSize="small" color={isAssigned ? 'primary' : 'disabled'} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight="bold">
                    {vehicle.make} {vehicle.model}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {vehicle.licensePlate || 'No plate'}
                  </Typography>
                </Box>
                <Chip label={displayStatus} size="small" color={getVehicleStatusColor(vehicle)} />
              </Box>
            );
          })}
          {vehicles.length > 8 && (
            <Typography variant="caption" color="text.secondary" textAlign="center">
              +{vehicles.length - 8} more
            </Typography>
          )}
          {vehicles.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No vehicles
            </Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
