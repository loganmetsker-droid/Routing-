import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
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

interface Job {
  id: string;
  customerName: string;
  deliveryAddress?: string;
  stopSequence?: number;
}

interface Route {
  id: string;
  vehicleId?: string;
  driverId?: string;
  jobIds?: string[];
  status: string;
  totalDistance?: number;
  totalDuration?: number;
  estimatedCapacity?: number;
  optimizedStops?: Array<{
    jobId: string;
    sequence: number;
    address: string;
  }>;
}

interface Vehicle {
  id: string;
  make?: string;
  model?: string;
  licensePlate?: string;
  status: string;
  capacity?: number;
}

interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
}

interface VehicleRouteCardProps {
  vehicle: Vehicle;
  route: Route | null;
  jobs: Job[];
  driver: Driver | null;
  onOptimize: (routeId: string) => void;
  onAssignDriver: (routeId: string) => void;
  onRemoveDriver: (routeId: string) => void;
  optimizing: boolean;
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
}: VehicleRouteCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate capacity percentage
  const capacityPercent = route?.estimatedCapacity
    ? Math.min((route.estimatedCapacity / (vehicle.capacity || 1000)) * 100, 100)
    : 0;

  // Filter jobs for this route
  const routeJobs = route?.jobIds
    ? jobs.filter((j) => route.jobIds?.includes(j.id)).sort((a, b) => (a.stopSequence || 0) - (b.stopSequence || 0))
    : [];

  // Format distance
  const formatDistance = (miles?: number) => {
    if (!miles) return '0 mi';
    return `${miles.toFixed(1)} mi`;
  };

  // Format duration
  const formatDuration = (minutes?: number) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const hasRoute = !!route;
  const isOptimized = route?.status === 'optimized' || route?.status === 'ready';
  const hasDriver = !!driver;

  return (
    <Card
      variant="outlined"
      sx={{
        borderWidth: 2,
        borderColor: hasRoute ? 'primary.main' : 'divider',
        bgcolor: hasRoute ? 'action.hover' : 'background.paper',
      }}
    >
      <CardContent>
        {/* Vehicle Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <LocalShipping color={hasRoute ? 'primary' : 'disabled'} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              {vehicle.make} {vehicle.model}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {vehicle.licensePlate || 'No plate'}
            </Typography>
          </Box>
          <Chip
            label={vehicle.status}
            size="small"
            color={vehicle.status === 'available' ? 'success' : 'warning'}
          />
        </Box>

        {/* Capacity Bar */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption">Capacity</Typography>
            <Typography variant="caption" fontWeight="bold">
              {capacityPercent.toFixed(0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={capacityPercent}
            color={capacityPercent > 90 ? 'error' : capacityPercent > 70 ? 'warning' : 'primary'}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {hasRoute ? (
          <>
            {/* Route Info */}
            <Box sx={{ mb: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Route ID: {route.id.slice(0, 8)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                <Typography variant="body2">
                  <strong>{routeJobs.length}</strong> jobs
                </Typography>
                <Typography variant="body2">
                  <strong>{formatDistance(route.totalDistance)}</strong>
                </Typography>
                <Typography variant="body2">
                  <strong>{formatDuration(route.totalDuration)}</strong>
                </Typography>
              </Box>
            </Box>

            {/* Driver Assignment */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person fontSize="small" color={hasDriver ? 'primary' : 'disabled'} />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {hasDriver ? `${driver.firstName} ${driver.lastName}` : '⚠️ No driver assigned'}
              </Typography>
              {hasDriver && (
                <Chip label="Assigned" size="small" color="success" />
              )}
            </Box>

            {/* Warning if not optimized */}
            {!isOptimized && (
              <Alert severity="warning" sx={{ mb: 2, py: 0 }}>
                Route needs optimization
              </Alert>
            )}

            {/* Jobs List (Expandable) */}
            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => setExpanded(!expanded)}
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
                  {routeJobs.map((job, idx) => (
                    <Box
                      key={job.id}
                      sx={{
                        p: 1,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" display="block" fontWeight="bold">
                        {idx + 1}. {job.customerName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        📍 {job.deliveryAddress || 'No address'}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </Box>

            {/* Actions */}
            <Stack spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={optimizing ? <Autorenew /> : <Autorenew />}
                onClick={() => onOptimize(route.id)}
                disabled={optimizing}
                fullWidth
              >
                {optimizing ? 'Optimizing...' : 'Optimize Route'}
              </Button>
              {!hasDriver && isOptimized && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PersonAdd />}
                  onClick={() => onAssignDriver(route.id)}
                  fullWidth
                >
                  Assign Driver
                </Button>
              )}
              {hasDriver && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<PersonRemove />}
                  onClick={() => onRemoveDriver(route.id)}
                  fullWidth
                >
                  Remove Driver
                </Button>
              )}
            </Stack>
          </>
        ) : (
          <>
            {/* No Route Assigned */}
            <Box
              sx={{
                p: 3,
                textAlign: 'center',
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No jobs assigned
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Drag jobs here or use Auto-Assign
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
