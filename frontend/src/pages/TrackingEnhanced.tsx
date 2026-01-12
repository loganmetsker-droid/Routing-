import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Stack,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonChecked as RadioButtonCheckedIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  FiberManualRecord as FiberManualRecordIcon,
  Phone as PhoneIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { getRoutes, getDrivers, getVehicles, connectSSE } from '../services/api';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Route {
  id?: string;
  vehicleId?: string;
  driverId?: string;
  jobIds?: string[];
  status?: string;
  totalDistance?: number;
  currentLocation?: [number, number];
  completedStops?: number;
  totalStops?: number;
  estimatedTimeRemaining?: number;
  path?: [number, number][];
}

interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
}

interface Vehicle {
  id: string;
  make?: string;
  model?: string;
  licensePlate?: string;
}

interface AlertItem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  routeId: string;
  timestamp: Date;
}

export default function TrackingEnhanced() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Filter active routes
  const activeRoutes = routes.filter(
    (r) => r.status === 'dispatched' || r.status === 'in_progress'
  );

  useEffect(() => {
    loadData();

    // Set up real-time updates every 30 seconds
    const interval = setInterval(() => {
      loadData();
      setLastUpdate(new Date());
    }, 30000);

    // SSE for real-time events
    const eventSource = connectSSE((data) => {
      if (data.type === 'route-updated' || data.type === 'location-updated') {
        loadData();
      }
    });

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  const loadData = async () => {
    try {
      const [routesData, driversData, vehiclesData] = await Promise.all([
        getRoutes(),
        getDrivers(),
        getVehicles(),
      ]);

      setRoutes((routesData.routes || []) as Route[]);
      setDrivers(driversData.drivers || []);
      setVehicles(vehiclesData.vehicles || []);

      // Generate mock alerts for demo
      generateMockAlerts(routesData.routes || []);
    } catch (error) {
      console.error('Failed to load tracking data:', error);
    }
  };

  const generateMockAlerts = (routes: Route[]) => {
    const mockAlerts: AlertItem[] = [];

    routes.forEach((route) => {
      // Simulate delays
      if (route.id && route.status === 'in_progress' && Math.random() > 0.7) {
        mockAlerts.push({
          id: `delay-${route.id}`,
          severity: 'warning',
          title: 'Delay Risk',
          message: `Route ${route.id.slice(0, 8)} is running 15 minutes behind schedule`,
          routeId: route.id,
          timestamp: new Date(),
        });
      }

      // Simulate missed time windows
      if (route.id && route.completedStops && route.totalStops && route.completedStops > route.totalStops / 2 && Math.random() > 0.8) {
        mockAlerts.push({
          id: `timewindow-${route.id}`,
          severity: 'error',
          title: 'Missed Time Window',
          message: `Stop #${route.completedStops} missed delivery window`,
          routeId: route.id,
          timestamp: new Date(),
        });
      }
    });

    setAlerts(mockAlerts);
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find((d) => d.id === driverId);
    return driver ? `${driver.firstName} ${driver.lastName}` : 'Unknown';
  };

  const getVehicleName = (vehicleId?: string) => {
    if (!vehicleId) return 'Unknown';
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    return vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown';
  };

  const getDriverIcon = (status?: string) => {
    const color = status === 'in_progress' ? '#4CAF50' : status === 'delayed' ? '#f44336' : '#FFA726';
    return L.divIcon({
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      className: '',
      iconSize: [24, 24],
    });
  };

  const handleDismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h4">Real-Time Tracking</Typography>
            <Chip
              label="Live"
              color="success"
              size="small"
              icon={
                <FiberManualRecordIcon
                  sx={{
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }}
                />
              }
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Typography>
        </Box>
        <Button variant="outlined" onClick={loadData}>
          Refresh Now
        </Button>
      </Box>

      <Grid container spacing={2}>
        {/* Left: Map View */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ height: 'calc(100vh - 250px)', position: 'relative', overflow: 'hidden' }}>
            <MapContainer
              center={[39.8283, -98.5795]}
              zoom={5}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />

              {/* Driver markers */}
              {activeRoutes.map((route) => {
                const location = route.currentLocation || [39.8283 + Math.random() * 10, -98.5795 + Math.random() * 10];
                return (
                  <Marker
                    key={route.id}
                    position={location as [number, number]}
                    icon={getDriverIcon(route.status)}
                    eventHandlers={{
                      click: () => setSelectedRoute(route),
                    }}
                  >
                    <Popup>
                      <Box>
                        <Typography variant="subtitle2">{getDriverName(route.driverId)}</Typography>
                        <Typography variant="caption">{getVehicleName(route.vehicleId)}</Typography>
                        <Typography variant="caption" display="block">
                          {route.completedStops || 0}/{route.totalStops || 0} stops
                        </Typography>
                      </Box>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Selected route path */}
              {selectedRoute && selectedRoute.path && (
                <Polyline positions={selectedRoute.path} color="blue" weight={4} />
              )}
            </MapContainer>
          </Paper>
        </Grid>

        {/* Right: Details Panel */}
        <Grid item xs={12} md={4}>
          {/* Alerts Section */}
          <Paper sx={{ p: 2, mb: 2, maxHeight: 200, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Alerts ({alerts.length})
            </Typography>
            {alerts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No active alerts
              </Typography>
            ) : (
              <Stack spacing={1}>
                {alerts.map((alert) => (
                  <Alert
                    key={alert.id}
                    severity={alert.severity}
                    onClose={() => handleDismissAlert(alert.id)}
                  >
                    <AlertTitle>{alert.title}</AlertTitle>
                    {alert.message}
                  </Alert>
                ))}
              </Stack>
            )}
          </Paper>

          {/* Route Details */}
          {selectedRoute ? (
            <RouteDetailsPanel
              route={selectedRoute}
              driverName={getDriverName(selectedRoute.driverId)}
              vehicleName={getVehicleName(selectedRoute.vehicleId)}
            />
          ) : (
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Select a driver on the map to view details
              </Typography>

              {/* Active Routes Summary */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Active Routes ({activeRoutes.length})
                </Typography>
                <List dense>
                  {activeRoutes.map((route) => (
                    <ListItem
                      key={route.id}
                      button
                      onClick={() => setSelectedRoute(route)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <ListItemText
                        primary={getDriverName(route.driverId)}
                        secondary={`${getVehicleName(route.vehicleId)} - ${route.completedStops || 0}/${
                          route.totalStops || 0
                        } stops`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

// Route Details Panel Component
function RouteDetailsPanel({
  route,
  driverName,
  vehicleName,
}: {
  route: Route;
  driverName: string;
  vehicleName: string;
}) {
  const progress = route.totalStops
    ? ((route.completedStops || 0) / route.totalStops) * 100
    : 0;

  // Mock stops data
  const mockStops = Array.from({ length: route.totalStops || 5 }, (_, i) => ({
    id: `stop-${i}`,
    customer: `Customer ${i + 1}`,
    address: `${100 + i * 10} Main St`,
    timeWindow: '9:00 AM - 11:00 AM',
    status: i < (route.completedStops || 0) ? 'completed' : i === route.completedStops ? 'current' : 'pending',
    completedAt: i < (route.completedStops || 0) ? '10:30 AM' : undefined,
  }));

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{driverName}</Typography>
        <Chip label={route.status} color="primary" size="small" />
      </Box>

      {/* Progress Bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption">Route Progress</Typography>
          <Typography variant="caption">{progress.toFixed(0)}%</Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} />
        <Typography variant="caption" color="text.secondary">
          {route.completedStops || 0} of {route.totalStops || 0} stops completed
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Vehicle
          </Typography>
          <Typography variant="body2">{vehicleName}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Distance
          </Typography>
          <Typography variant="body2">{route.totalDistance?.toFixed(1) || 0} km</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            ETA
          </Typography>
          <Typography variant="body2">
            {route.estimatedTimeRemaining
              ? `${Math.floor(route.estimatedTimeRemaining / 60)}h ${route.estimatedTimeRemaining % 60}m`
              : 'N/A'}
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Status
          </Typography>
          <Typography variant="body2">On Time</Typography>
        </Grid>
      </Grid>

      {/* Stops List */}
      <Typography variant="subtitle2" gutterBottom>
        Stops
      </Typography>
      <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
        {mockStops.map((stop, idx) => (
          <ListItem
            key={stop.id}
            sx={{
              opacity: stop.status === 'completed' ? 0.6 : 1,
              bgcolor: stop.status === 'current' ? 'action.selected' : 'transparent',
            }}
          >
            <ListItemIcon>
              {stop.status === 'completed' ? (
                <CheckCircleIcon color="success" />
              ) : stop.status === 'current' ? (
                <RadioButtonCheckedIcon color="primary" />
              ) : (
                <RadioButtonUncheckedIcon />
              )}
            </ListItemIcon>
            <ListItemText
              primary={`${idx + 1}. ${stop.customer}`}
              secondary={
                <>
                  {stop.address}
                  {stop.timeWindow && (
                    <Typography variant="caption" display="block">
                      Window: {stop.timeWindow}
                    </Typography>
                  )}
                  {stop.status === 'completed' && stop.completedAt && (
                    <Typography variant="caption" color="success.main">
                      Completed at {stop.completedAt}
                    </Typography>
                  )}
                </>
              }
            />
          </ListItem>
        ))}
      </List>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button variant="outlined" size="small" startIcon={<PhoneIcon />} fullWidth>
          Contact
        </Button>
        <Button variant="outlined" size="small" startIcon={<EditIcon />} fullWidth>
          Modify
        </Button>
      </Box>
    </Paper>
  );
}
