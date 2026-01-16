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
    <Box sx={{ p: 3 }}>
      {/* Available Drivers */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Person sx={{ fontSize: 22, color: '#2196F3' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#FFFFFF' }}>
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
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: '8px',
                  bgcolor: isAvailable ? 'rgba(46, 204, 113, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid',
                  borderColor: isAvailable ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: isAvailable ? 'rgba(46, 204, 113, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                {isAvailable ? (
                  <CheckCircle sx={{ fontSize: 18, color: '#2ECC71' }} />
                ) : (
                  <Warning sx={{ fontSize: 18, color: '#F1C40F' }} />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px', color: '#FFFFFF', mb: 0.25 }}>
                    {driver.firstName} {driver.lastName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px' }}>
                    {routeCount} route{routeCount !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Chip
                  label={isAvailable ? 'Available' : 'Busy'}
                  size="small"
                  sx={{
                    height: '20px',
                    fontSize: '10px',
                    fontWeight: 600,
                    bgcolor: isAvailable ? '#2ECC71' : '#F1C40F',
                    color: isAvailable ? '#FFFFFF' : '#000000',
                  }}
                />
              </Box>
            );
          })}
          {sortedDrivers.length > 8 && (
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px', textAlign: 'center', mt: 1 }}>
              +{sortedDrivers.length - 8} more
            </Typography>
          )}
          {sortedDrivers.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>
                No drivers available
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Vehicle Status */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <LocalShipping sx={{ fontSize: 22, color: '#2ECC71' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#FFFFFF' }}>
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
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: '8px',
                  bgcolor: isAssigned ? 'rgba(33, 150, 243, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid',
                  borderColor: isAssigned ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: isAssigned ? 'rgba(33, 150, 243, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <LocalShipping sx={{ fontSize: 18, color: isAssigned ? '#2196F3' : 'rgba(255, 255, 255, 0.3)' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px', color: '#FFFFFF', mb: 0.25 }}>
                    {vehicle.make} {vehicle.model}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px' }}>
                    {vehicle.licensePlate || 'No plate'}
                  </Typography>
                </Box>
                <Chip
                  label={displayStatus}
                  size="small"
                  sx={{
                    height: '20px',
                    fontSize: '10px',
                    fontWeight: 600,
                    bgcolor:
                      displayStatus === 'Available'
                        ? '#2ECC71'
                        : displayStatus === 'Assigned'
                        ? '#2196F3'
                        : 'rgba(255, 255, 255, 0.1)',
                    color: displayStatus === 'Available' || displayStatus === 'Assigned' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                  }}
                />
              </Box>
            );
          })}
          {vehicles.length > 8 && (
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px', textAlign: 'center', mt: 1 }}>
              +{vehicles.length - 8} more
            </Typography>
          )}
          {vehicles.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>
                No vehicles available
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
