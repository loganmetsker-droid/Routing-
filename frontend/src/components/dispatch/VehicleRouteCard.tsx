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
  const hasOptimizationData =
    Boolean(route?.optimizedStops && route.optimizedStops.length > 0) ||
    Boolean(route?.totalDistance);
  const hasDriver = !!driver;

  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: hasRoute ? 'rgba(33, 150, 243, 0.08)' : 'rgba(255, 255, 255, 0.05)',
        border: '2px solid',
        borderColor: hasRoute ? '#2196F3' : 'rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          borderColor: hasRoute ? '#2196F3' : 'rgba(255, 255, 255, 0.15)',
          transform: 'translateY(-2px)',
          boxShadow: hasRoute ? '0 4px 12px rgba(33, 150, 243, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Vehicle Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <LocalShipping sx={{ color: hasRoute ? '#2196F3' : 'rgba(255, 255, 255, 0.3)', fontSize: 24 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '15px', color: '#FFFFFF' }}>
              {vehicle.make} {vehicle.model}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
              {vehicle.licensePlate || 'No plate'}
            </Typography>
          </Box>
          <Chip
            label={vehicle.status}
            size="small"
            sx={{
              height: '22px',
              fontSize: '11px',
              fontWeight: 600,
              bgcolor: vehicle.status === 'available' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(241, 196, 15, 0.15)',
              color: vehicle.status === 'available' ? '#2ECC71' : '#F1C40F',
              border: 'none',
            }}
          />
        </Box>

        {/* Capacity Bar */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', fontWeight: 500 }}>
              Capacity
            </Typography>
            <Typography variant="caption" sx={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 700 }}>
              {capacityPercent.toFixed(0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={capacityPercent}
            sx={{
              height: 10,
              borderRadius: '6px',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                borderRadius: '6px',
                bgcolor: capacityPercent > 90 ? '#E74C3C' : capacityPercent > 70 ? '#F1C40F' : '#2ECC71',
                transition: 'all 0.3s ease',
              },
            }}
          />
        </Box>

        {hasRoute ? (
          <>
            {/* Route Info */}
            <Box
              sx={{
                mb: 2.5,
                p: 2,
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
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
                <Typography variant="body2" sx={{ color: '#FFFFFF', fontSize: '13px' }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>{routeJobs.length}</Box> jobs
                </Typography>
                <Typography variant="body2" sx={{ color: '#FFFFFF', fontSize: '13px' }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>{formatDistance(route.totalDistance)}</Box>
                </Typography>
                <Typography variant="body2" sx={{ color: '#FFFFFF', fontSize: '13px' }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>{formatDuration(route.totalDuration)}</Box>
                </Typography>
              </Box>
            </Box>

            {/* Driver Assignment */}
            <Box
              sx={{
                mb: 2.5,
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                bgcolor: hasDriver ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: hasDriver ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)',
              }}
            >
              <Person sx={{ fontSize: 20, color: hasDriver ? '#2ECC71' : '#E74C3C' }} />
              <Typography variant="body2" sx={{ flex: 1, color: '#FFFFFF', fontSize: '13px', fontWeight: 500 }}>
                {hasDriver ? `${driver.firstName} ${driver.lastName}` : 'No driver assigned'}
              </Typography>
              {hasDriver && (
                <Chip
                  label="Assigned"
                  size="small"
                  sx={{
                    height: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    bgcolor: '#2ECC71',
                    color: '#FFFFFF',
                  }}
                />
              )}
            </Box>

            {/* Warning if not optimized */}
            {!hasOptimizationData && (
              <Alert
                severity="warning"
                icon={false}
                sx={{
                  mb: 2.5,
                  py: 1,
                  px: 1.5,
                  bgcolor: 'rgba(241, 196, 15, 0.1)',
                  border: '1px solid rgba(241, 196, 15, 0.3)',
                  color: '#F1C40F',
                  fontSize: '12px',
                  fontWeight: 600,
                  '& .MuiAlert-message': {
                    p: 0,
                  },
                }}
              >
                ⚠️ Route needs optimization pass
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
            <Stack spacing={1.5}>
              <Button
                size="small"
                variant="outlined"
                startIcon={optimizing ? <Autorenew className="rotating" /> : <Autorenew />}
                onClick={() => onOptimize(route.id)}
                disabled={optimizing}
                fullWidth
                sx={{
                  borderColor: 'rgba(33, 150, 243, 0.5)',
                  color: '#2196F3',
                  borderRadius: '8px',
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: '#2196F3',
                    bgcolor: 'rgba(33, 150, 243, 0.1)',
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
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
                  sx={{
                    bgcolor: '#2ECC71',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: '#27AE60',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(46, 204, 113, 0.3)',
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
                    borderColor: 'rgba(231, 76, 60, 0.5)',
                    color: '#E74C3C',
                    borderRadius: '8px',
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#E74C3C',
                      bgcolor: 'rgba(231, 76, 60, 0.1)',
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
          <>
            {/* No Route Assigned */}
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                border: '2px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                bgcolor: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px', fontWeight: 500, mb: 1 }}>
                No jobs assigned
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '12px' }}>
                Select jobs and use Auto-Assign
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
