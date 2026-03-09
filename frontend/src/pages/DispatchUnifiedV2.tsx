import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Checkbox,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  AutoAwesome,
  Refresh,
  PlayArrow,
  ErrorOutline,
  CheckCircle,
  LocalShipping,
  Route as RouteIcon,
  Speed,
  Schedule,
} from '@mui/icons-material';
import {
  getJobs,
  getRoutes,
  getVehicles,
  getDrivers,
  assignDriverToRoute,
  startRoute,
  generateRoute,
  updateRoute,
  reorderRouteStops,
  connectSSE,
} from '../services/api';
import VehicleRouteCard from '../components/dispatch/VehicleRouteCard';
import LiveStatusColumn from '../components/dispatch/LiveStatusColumn';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ROUTE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#95E1D3',
  '#F38181', '#7FDBFF', '#B4A7D6', '#FFD93D', '#6BCF7F', '#FF9F1C',
];

// ==================== INTERFACES ====================

interface Job {
  id: string;
  customerName: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  status: string;
  priority?: string;
  assignedRouteId?: string;
  assignedVehicleId?: string;
  stopSequence?: number;
}

interface Route {
  id: string;
  vehicleId: string;
  driverId?: string | null;
  jobIds: string[];
  status: string;
  totalDistance?: number;
  totalDuration?: number;
  estimatedCapacity?: number;
  optimizedStops?: OptimizedStop[];
  optimizedAt?: string;
}

interface OptimizedStop {
  jobId: string;
  sequence: number;
  address: string;
  estimatedArrival?: string;
  distanceFromPrevious?: number;
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
  status: string;
  currentHours?: number;
  maxHours?: number;
}

interface DriverSuggestion extends Driver {
  available: boolean;
  currentJobCount: number;
  score: number;
  reason: string;
}

// ==================== MAIN COMPONENT ====================

export default function DispatchUnifiedV2() {
  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [optimizingRouteId, setOptimizingRouteId] = useState<string | null>(null);
  const [dispatchingRouteId, setDispatchingRouteId] = useState<string | null>(null);

  // Dialogs
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [selectedRouteForDriver, setSelectedRouteForDriver] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // ==================== DATA LOADING ====================

  useEffect(() => {
    loadData();
    const eventSource = connectSSE((event) => {
      if (event.type === 'job-updated' || event.type === 'route-updated') {
        loadData();
      }
    });
    return () => eventSource?.close();
  }, []);

  const loadData = async () => {
    try {
      const [jobsData, routesData, vehiclesData, driversData] = await Promise.all([
        getJobs(),
        getRoutes(),
        getVehicles(),
        getDrivers(),
      ]);
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setRoutes(Array.isArray(routesData) ? routesData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setJobs([]);
      setRoutes([]);
      setVehicles([]);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  };

  // ==================== COMPUTED DATA ====================

  const unassignedJobs = jobs.filter((job) => job.status === 'pending' && !job.assignedRouteId);

  const activeRoutes = routes.filter(
    (route) => route.status !== 'completed' && route.status !== 'cancelled'
  );

  const readyToDispatchRoutes = activeRoutes.filter(
    (route) =>
      (route.status === 'planned' || route.status === 'assigned') &&
      route.vehicleId &&
      route.driverId &&
      route.jobIds &&
      route.jobIds.length > 0
  );

  // ==================== CONFLICT DETECTION ====================

  interface RouteConflict {
    routeId: string;
    type: 'driver' | 'vehicle';
    severity: 'high' | 'medium';
    message: string;
  }

  const detectConflicts = (): RouteConflict[] => {
    const conflicts: RouteConflict[] = [];

    // Check for driver conflicts
    const driverRouteMap = new Map<string, string[]>();
    activeRoutes.forEach((route) => {
      if (route.driverId) {
        if (!driverRouteMap.has(route.driverId)) {
          driverRouteMap.set(route.driverId, []);
        }
        driverRouteMap.get(route.driverId)!.push(route.id);
      }
    });

    driverRouteMap.forEach((routeIds, driverId) => {
      if (routeIds.length > 1) {
        const driver = drivers.find((d) => d.id === driverId);
        conflicts.push({
          routeId: routeIds[0],
          type: 'driver',
          severity: 'high',
          message: `Driver ${driver?.firstName} ${driver?.lastName} assigned to ${routeIds.length} routes`,
        });
      }
    });

    // Check for vehicle conflicts
    const vehicleRouteMap = new Map<string, string[]>();
    activeRoutes.forEach((route) => {
      if (route.vehicleId) {
        if (!vehicleRouteMap.has(route.vehicleId)) {
          vehicleRouteMap.set(route.vehicleId, []);
        }
        vehicleRouteMap.get(route.vehicleId)!.push(route.id);
      }
    });

    vehicleRouteMap.forEach((routeIds, vehicleId) => {
      if (routeIds.length > 1) {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        conflicts.push({
          routeId: routeIds[0],
          type: 'vehicle',
          severity: 'high',
          message: `Vehicle ${vehicle?.licensePlate} assigned to ${routeIds.length} routes`,
        });
      }
    });

    return conflicts;
  };

  const conflicts = detectConflicts();

  // ==================== AUTO-ASSIGN LOGIC ====================

  const handleAutoAssign = async () => {
    if (selectedJobIds.length === 0) return;

    setAutoAssigning(true);
    try {
      // Find available vehicle
      const availableVehicle = vehicles.find((v) => {
        const assignedRoute = routes.find(
          (r) => r.vehicleId === v.id && r.status !== 'completed' && r.status !== 'cancelled',
        );
        return !assignedRoute;
      });

      if (!availableVehicle) {
        alert('No available vehicles');
        return;
      }

      // Create route
      const response = await generateRoute(availableVehicle.id, selectedJobIds);
      const newRoute = (response as any).route || response;

      // Immediately run optimization/reordering on the newly created route.
      await reorderRouteStops(
        newRoute.id,
        Array.isArray(newRoute.jobIds) && newRoute.jobIds.length > 0
          ? newRoute.jobIds
          : selectedJobIds,
      );

      setSelectedJobIds([]);
      await loadData();
    } catch (error) {
      console.error('Auto-assign failed:', error);
      alert('Failed to auto-assign jobs');
    } finally {
      setAutoAssigning(false);
    }
  };

  // ==================== OPTIMIZATION LOGIC ====================

  const handleOptimizeRoute = async (routeId: string) => {
    setOptimizingRouteId(routeId);
    try {
      const route = routes.find((r) => r.id === routeId);
      if (!route || !route.vehicleId || !route.jobIds || route.jobIds.length === 0) {
        throw new Error('Invalid route');
      }

      await reorderRouteStops(routeId, route.jobIds);

      await loadData();
    } catch (error) {
      console.error('Optimization failed:', error);
      alert('Failed to optimize route');
    } finally {
      setOptimizingRouteId(null);
    }
  };

  // ==================== DRIVER ASSIGNMENT ====================

  const getSuggestedDrivers = (_route: Route): DriverSuggestion[] => {
    const routeDriverAssignments = routes
      .filter((r) => r.status !== 'completed' && r.status !== 'cancelled')
      .reduce((acc, r) => {
        if (r.driverId) acc[r.driverId] = (acc[r.driverId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return drivers
      .filter((d) => d.status === 'active' || d.status === 'available' || d.status === 'ACTIVE')
      .map((d) => {
        const currentJobCount = routeDriverAssignments[d.id] || 0;
        const available = currentJobCount === 0;
        const hoursOk = !d.maxHours || (d.currentHours || 0) < d.maxHours;

        let score = 100;
        let reason = 'Available';

        if (!available) {
          score -= 30;
          reason = `Already assigned (${currentJobCount} routes)`;
        }
        if (!hoursOk) {
          score -= 50;
          reason = 'Near max hours';
        }

        score -= currentJobCount * 10;

        return {
          ...d,
          available,
          currentJobCount,
          score,
          reason,
        };
      })
      .sort((a, b) => b.score - a.score);
  };

  const handleAssignDriverClick = (routeId: string) => {
    setSelectedRouteForDriver(routeId);
    setAssignDriverDialogOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedRouteForDriver || !selectedDriverId) return;

    try {
      await assignDriverToRoute(selectedRouteForDriver, selectedDriverId);
      await updateRoute(selectedRouteForDriver, { status: 'assigned' });
      setAssignDriverDialogOpen(false);
      setSelectedDriverId('');
      setSelectedRouteForDriver(null);
      await loadData();
    } catch (error) {
      console.error('Driver assignment failed:', error);
      alert('Failed to assign driver');
    }
  };

  const handleRemoveDriver = async (routeId: string) => {
    try {
      await updateRoute(routeId, { driverId: null, status: 'planned' });
      await loadData();
    } catch (error) {
      console.error('Remove driver failed:', error);
    }
  };

  // ==================== DISPATCH ====================

  const handleDispatch = async (routeId: string) => {
    setDispatchingRouteId(routeId);
    try {
      await startRoute(routeId);
      await loadData();
    } catch (error) {
      console.error('Dispatch failed:', error);
      alert('Failed to dispatch route');
    } finally {
      setDispatchingRouteId(null);
    }
  };

  // ==================== JOB SELECTION ====================

  const handleJobToggle = (jobId: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleSelectAllJobs = () => {
    if (selectedJobIds.length === unassignedJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(unassignedJobs.map((j) => j.id));
    }
  };

  // ==================== MAP COMPUTATION ====================

  const mapRoutes = activeRoutes.map((route, index) => {
    const assignedVehicle = vehicles.find((v) => v.id === route.vehicleId);

    // Convert stop addresses to positions (mocking coordinates for demo)
    const positions = route.optimizedStops && route.optimizedStops.length > 0
      ? route.optimizedStops.map((stop, i) => ({
        lat: 39.0997 + (i * 0.01) + (Math.random() - 0.5) * 0.05,
        lng: -94.5786 + (i * 0.01) + (Math.random() - 0.5) * 0.05,
        address: stop.address
      }))
      : [];

    return {
      id: route.id,
      positions: positions,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
      status: route.status,
      vehicle: `${assignedVehicle?.make || ''} ${assignedVehicle?.model || ''}`.trim() || 'Unassigned',
      vehiclePlate: assignedVehicle?.licensePlate || 'N/A',
      totalDistance: route.totalDistance || 0,
      stopCount: positions.length,
    };
  });

  const mapCenter: [number, number] = mapRoutes.length > 0 && mapRoutes[0].positions.length > 0
    ? [mapRoutes[0].positions[0].lat, mapRoutes[0].positions[0].lng]
    : [39.0997, -94.5786];

  const mapZoom = mapRoutes.length > 0 ? 12 : 10;

  // ==================== RENDER ====================

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedRoute = selectedRouteForDriver
    ? routes.find((r) => r.id === selectedRouteForDriver)
    : null;
  const suggestedDrivers = selectedRoute ? getSuggestedDrivers(selectedRoute) : [];

  return (
    <Box sx={{ bgcolor: '#0D1117', minHeight: '100vh', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '24px', color: '#FFFFFF' }}>
          Dispatch Control Center
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadData}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'rgba(33, 150, 243, 0.08)',
              }
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Conflicts Alert Banner - Improved */}
      {conflicts.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            mb: 4,
            p: 3,
            bgcolor: '#2C1810',
            border: '2px solid #E74C3C',
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              bgcolor: '#E74C3C',
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <ErrorOutline sx={{ fontSize: 28, color: '#E74C3C' }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#E74C3C', fontSize: '18px' }}>
                  {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected
                </Typography>
              </Box>
              <Box
                sx={{
                  borderTop: '1px solid rgba(231, 76, 60, 0.2)',
                  pt: 2,
                  mb: 2,
                }}
              >
                <Stack spacing={1}>
                  {conflicts.map((conflict, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#E74C3C' }} />
                      <Typography variant="body2" sx={{ color: '#FFFFFF', fontSize: '14px' }}>
                        {conflict.message}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
            <Button
              variant="contained"
              size="small"
              sx={{
                bgcolor: '#E74C3C',
                color: '#FFFFFF',
                textTransform: 'none',
                borderRadius: '6px',
                px: 3,
                '&:hover': {
                  bgcolor: '#C0392B',
                },
              }}
            >
              Resolve Conflicts
            </Button>
          </Box>
        </Paper>
      )}

      {/* Map Section */}
      <Paper sx={{ p: 3, mb: 4, height: 400, borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={600} color="#FFFFFF">
            Live Dispatch Map
          </Typography>
          <Chip icon={<CheckCircle />} label="Live" color="success" size="small" />
        </Box>
        <Box sx={{ height: 320, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapRoutes.map((route) => {
              if (!route.positions || route.positions.length === 0) return null;
              const positions = route.positions.map((pos) => [pos.lat, pos.lng] as [number, number]);
              return (
                <div key={route.id}>
                  <Polyline positions={positions} pathOptions={{ color: route.color, weight: 5, opacity: 0.8 }}>
                    <LeafletTooltip sticky>
                      <div style={{ textAlign: 'center' }}>
                        <strong>{route.vehicle}</strong><br />
                        {route.vehiclePlate}<br />
                        {route.stopCount} stops • {route.totalDistance.toFixed(1)}km
                      </div>
                    </LeafletTooltip>
                  </Polyline>
                  {route.positions.map((pos, idx) => (
                    <Marker key={`${route.id}-${idx}`} position={[pos.lat, pos.lng]}>
                      <Popup>
                        <Box sx={{ minWidth: 200 }}>
                          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                            Stop {idx + 1} of {route.stopCount}
                          </Typography>
                          <Typography variant="body2">{pos.address}</Typography>
                          <Typography variant="body2" mt={1}>
                            <strong>Vehicle:</strong> {route.vehicle} ({route.vehiclePlate})
                          </Typography>
                          <Typography variant="body2">
                            <strong>Status:</strong> {route.status}
                          </Typography>
                        </Box>
                      </Popup>
                    </Marker>
                  ))}
                </div>
              );
            })}
          </MapContainer>
        </Box>
      </Paper>

      {/* 3-Column Responsive Layout */}
      <Grid container spacing={3}>
        {/* Column 1: Unassigned Jobs */}
        <Grid item xs={12} lg={3} md={12}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              height: '75vh',
              overflow: 'auto',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                },
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px', color: '#FFFFFF' }}>
                Unassigned Jobs
                <Chip
                  label={unassignedJobs.length}
                  size="small"
                  sx={{
                    ml: 1.5,
                    bgcolor: 'rgba(33, 150, 243, 0.15)',
                    color: '#2196F3',
                    fontWeight: 700,
                    height: '24px',
                  }}
                />
              </Typography>
              <Checkbox
                checked={selectedJobIds.length === unassignedJobs.length && unassignedJobs.length > 0}
                indeterminate={
                  selectedJobIds.length > 0 && selectedJobIds.length < unassignedJobs.length
                }
                onChange={handleSelectAllJobs}
                sx={{
                  color: 'rgba(255, 255, 255, 0.3)',
                  '&.Mui-checked': {
                    color: '#2196F3',
                  },
                }}
              />
            </Box>

            {unassignedJobs.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 8,
                  px: 3,
                  border: '2px dashed rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <CheckCircle sx={{ fontSize: 48, color: '#2ECC71', mb: 2, opacity: 0.8 }} />
                <Typography variant="h6" sx={{ color: '#FFFFFF', mb: 1, fontSize: '16px', fontWeight: 600 }}>
                  No unassigned jobs
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }}>
                  All jobs have been assigned to routes
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {unassignedJobs.map((job) => (
                  <Card
                    key={job.id}
                    elevation={0}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: selectedJobIds.includes(job.id)
                        ? 'rgba(33, 150, 243, 0.15)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: '2px solid',
                      borderColor: selectedJobIds.includes(job.id) ? '#2196F3' : 'transparent',
                      borderRadius: '8px',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        borderColor: selectedJobIds.includes(job.id) ? '#2196F3' : 'rgba(33, 150, 243, 0.5)',
                        bgcolor: selectedJobIds.includes(job.id)
                          ? 'rgba(33, 150, 243, 0.2)'
                          : 'rgba(255, 255, 255, 0.08)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      },
                    }}
                    onClick={() => handleJobToggle(job.id)}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              fontSize: '14px',
                              color: '#FFFFFF',
                              mb: 0.5,
                            }}
                          >
                            {job.customerName}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255, 255, 255, 0.6)',
                              fontSize: '12px',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📍 {job.deliveryAddress || 'No address'}
                          </Typography>
                        </Box>
                        <Chip
                          label={job.priority || 'normal'}
                          size="small"
                          sx={{
                            height: '22px',
                            fontSize: '11px',
                            fontWeight: 600,
                            bgcolor:
                              job.priority === 'urgent'
                                ? '#E74C3C'
                                : job.priority === 'high'
                                  ? '#F1C40F'
                                  : 'rgba(255, 255, 255, 0.1)',
                            color:
                              job.priority === 'urgent'
                                ? '#FFFFFF'
                                : job.priority === 'high'
                                  ? '#000000'
                                  : '#FFFFFF',
                            border: 'none',
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}

            <Box sx={{ mt: 3 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={autoAssigning ? <CircularProgress size={20} /> : <AutoAwesome />}
                onClick={handleAutoAssign}
                disabled={selectedJobIds.length === 0 || autoAssigning}
                sx={{
                  bgcolor: '#2196F3',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  py: 1.5,
                  px: 3,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '15px',
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    bgcolor: '#1976D2',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(33, 150, 243, 0.4)',
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                Auto-Assign Selected
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Column 2: Vehicles & Routes */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              height: '75vh',
              overflow: 'auto',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                },
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px', color: '#FFFFFF' }}>
                Vehicles & Routes
                <Chip
                  label={vehicles.length}
                  size="small"
                  sx={{
                    ml: 1.5,
                    bgcolor: 'rgba(46, 204, 113, 0.15)',
                    color: '#2ECC71',
                    fontWeight: 700,
                    height: '24px',
                  }}
                />
              </Typography>
            </Box>

            <Stack spacing={2}>
              {vehicles.map((vehicle) => {
                const route = routes.find(
                  (r) => r.vehicleId === vehicle.id && r.status !== 'completed' && r.status !== 'cancelled',
                );
                const driver = route?.driverId ? drivers.find((d) => d.id === route.driverId) : null;
                const routeJobs = route?.jobIds
                  ? jobs.filter((j) => route.jobIds?.includes(j.id))
                  : [];

                return (
                  <VehicleRouteCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    route={route || null}
                    jobs={routeJobs}
                    driver={driver || null}
                    onOptimize={handleOptimizeRoute}
                    onAssignDriver={handleAssignDriverClick}
                    onRemoveDriver={handleRemoveDriver}
                    optimizing={optimizingRouteId === route?.id}
                  />
                );
              })}
            </Stack>
          </Paper>
        </Grid>

        {/* Column 3: Ready to Dispatch */}
        <Grid item xs={12} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              height: '75vh',
              overflow: 'auto',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                },
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px', color: '#FFFFFF' }}>
                Ready to Dispatch
                <Chip
                  label={readyToDispatchRoutes.length}
                  size="small"
                  sx={{
                    ml: 1.5,
                    bgcolor: 'rgba(46, 204, 113, 0.15)',
                    color: '#2ECC71',
                    fontWeight: 700,
                    height: '24px',
                  }}
                />
              </Typography>
            </Box>

            {readyToDispatchRoutes.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 8,
                  px: 3,
                  border: '2px dashed rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <PlayArrow sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.3)', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#FFFFFF', mb: 1, fontSize: '16px', fontWeight: 600 }}>
                  No routes ready
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }}>
                  Assign drivers to planned routes to dispatch them
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {readyToDispatchRoutes.map((route) => {
                  const vehicle = vehicles.find((v) => v.id === route.vehicleId);
                  const driver = drivers.find((d) => d.id === route.driverId);

                  return (
                    <Card
                      key={route.id}
                      elevation={0}
                      sx={{
                        bgcolor: 'rgba(46, 204, 113, 0.08)',
                        border: '2px solid #2ECC71',
                        borderRadius: '10px',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          bgcolor: 'rgba(46, 204, 113, 0.12)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(46, 204, 113, 0.2)',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <CheckCircle sx={{ color: '#2ECC71', fontSize: 24 }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '15px', color: '#FFFFFF' }}>
                            Route {route.id.slice(0, 8)}
                          </Typography>
                        </Box>

                        <Stack spacing={1} sx={{ mb: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LocalShipping sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)' }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '13px' }}>
                              {vehicle?.make} {vehicle?.model}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              component="span"
                              sx={{
                                width: 16,
                                height: 16,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'rgba(255, 255, 255, 0.5)',
                              }}
                            >
                              👤
                            </Box>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '13px' }}>
                              {driver?.firstName} {driver?.lastName}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <RouteIcon sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)' }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '13px' }}>
                              {route.jobIds?.length || 0} stops
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Speed sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)' }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '13px' }}>
                              {route.totalDistance?.toFixed(1) || 0} km
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Schedule sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.5)' }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '13px' }}>
                              {route.totalDuration ? `${Math.floor(route.totalDuration / 60)}h ${Math.round(route.totalDuration % 60)}m` : '0m'}
                            </Typography>
                          </Box>
                        </Stack>

                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={
                            dispatchingRouteId === route.id ? (
                              <CircularProgress size={20} sx={{ color: '#FFFFFF' }} />
                            ) : (
                              <PlayArrow />
                            )
                          }
                          onClick={() => handleDispatch(route.id)}
                          disabled={dispatchingRouteId === route.id}
                          sx={{
                            bgcolor: '#2ECC71',
                            color: '#FFFFFF',
                            borderRadius: '8px',
                            py: 1.25,
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '14px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                              bgcolor: '#27AE60',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(46, 204, 113, 0.3)',
                            },
                            '&:disabled': {
                              bgcolor: 'rgba(255, 255, 255, 0.1)',
                              color: 'rgba(255, 255, 255, 0.3)',
                            },
                          }}
                        >
                          DISPATCH
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Column 4: Live Status */}
        <Grid item xs={12} md={2}>
          <Paper
            elevation={0}
            sx={{
              height: '75vh',
              overflow: 'auto',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                },
              },
            }}
          >
            <LiveStatusColumn drivers={drivers} vehicles={vehicles} routes={activeRoutes} />
          </Paper>
        </Grid>
      </Grid>

      {/* Assign Driver Dialog */}
      <Dialog open={assignDriverDialogOpen} onClose={() => setAssignDriverDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Driver to Route</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Driver</InputLabel>
            <Select
              value={selectedDriverId}
              label="Select Driver"
              onChange={(e) => setSelectedDriverId(e.target.value)}
            >
              {suggestedDrivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>
                      {driver.firstName} {driver.lastName}
                    </span>
                    <Chip
                      label={driver.reason}
                      size="small"
                      color={driver.available ? 'success' : 'warning'}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDriverDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignDriver} disabled={!selectedDriverId}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
