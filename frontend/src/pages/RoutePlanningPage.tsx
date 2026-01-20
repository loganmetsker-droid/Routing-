import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Autocomplete,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Delete,
  Navigation,
  LocalShipping,
  DragIndicator,
  TrendingUp,
  AccessTime,
  Place,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import { motion } from 'framer-motion';
import 'leaflet/dist/leaflet.css';

const API_BASE_URL = import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Route colors for visualization
const ROUTE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7B731', '#5F27CD', '#00D2D3', '#FF9FF3', '#54A0FF',
];

interface Stop {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
}

interface Route {
  id: string;
  vehicleId: string;
  vehicleName: string;
  stops: Stop[];
  color: string;
  totalMiles: number;
  estimatedTime: number;
}

// Placeholder geocoding function
const geocodeAddress = async (): Promise<{ lat: number; lng: number }> => {
  // TODO: Replace with actual geocoding service (Google Maps, Mapbox, etc.)
  // For now, return random coordinates in USA
  const baseLat = 39.8283;
  const baseLng = -98.5795;
  return {
    lat: baseLat + (Math.random() - 0.5) * 20,
    lng: baseLng + (Math.random() - 0.5) * 40,
  };
};

// Placeholder route optimization algorithm
const optimizeRoute = (stops: Stop[]): Stop[] => {
  // TODO: Implement actual route optimization (TSP algorithm, Google OR-Tools, etc.)
  // For now, simple nearest neighbor approach
  if (stops.length <= 1) return stops;

  const optimized: Stop[] = [];
  const remaining = [...stops];

  // Start with first stop
  optimized.push(remaining.shift()!);

  while (remaining.length > 0) {
    const last = optimized[optimized.length - 1];
    let nearestIndex = 0;
    let minDistance = Infinity;

    remaining.forEach((stop, index) => {
      const distance = Math.sqrt(
        Math.pow(stop.lat - last.lat, 2) + Math.pow(stop.lng - last.lng, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });

    optimized.push(remaining.splice(nearestIndex, 1)[0]);
  }

  return optimized.map((stop, index) => ({ ...stop, order: index }));
};

// Calculate route statistics
const calculateRouteStats = (stops: Stop[]) => {
  if (stops.length < 2) {
    return { totalMiles: 0, estimatedTime: 0 };
  }

  let totalMiles = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const lat1 = stops[i].lat;
    const lng1 = stops[i].lng;
    const lat2 = stops[i + 1].lat;
    const lng2 = stops[i + 1].lng;

    // Haversine formula for distance
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalMiles += R * c;
  }

  // Estimate time: 30 mph average + 10 min per stop
  const estimatedTime = (totalMiles / 30) * 60 + (stops.length * 10);

  return {
    totalMiles: Math.round(totalMiles * 10) / 10,
    estimatedTime: Math.round(estimatedTime),
  };
};

export default function RoutingPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<any[]>([]);
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [vehiclesRes, customersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/vehicles`),
          fetch(`${API_BASE_URL}/api/customers`)
        ]);
        const vehiclesData = await vehiclesRes.json();
        const customersData = await customersRes.json();
        setVehicles(vehiclesData);
        setCustomers(customersData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleAddRoute = async () => {
    if (!selectedVehicle || selectedCustomers.length === 0) {
      return;
    }

    // Geocode customer addresses
    const stopsWithCoords = await Promise.all(
      selectedCustomers.map(async (customer, index) => {
        const coords = await geocodeAddress();
        return {
          id: `stop-${Date.now()}-${index}`,
          customerId: customer.id,
          customerName: customer.name,
          address: customer.address,
          lat: coords.lat,
          lng: coords.lng,
          order: index,
        };
      })
    );

    const vehicleName = selectedVehicle.name || `${selectedVehicle.make || ''} ${selectedVehicle.model || ''}`.trim() || 'Unknown Vehicle';

    const newRoute: Route = {
      id: `route-${Date.now()}`,
      vehicleId: selectedVehicle.id,
      vehicleName,
      stops: stopsWithCoords,
      color: ROUTE_COLORS[routes.length % ROUTE_COLORS.length],
      totalMiles: 0,
      estimatedTime: 0,
    };

    const stats = calculateRouteStats(newRoute.stops);
    newRoute.totalMiles = stats.totalMiles;
    newRoute.estimatedTime = stats.estimatedTime;

    try {
      // Create a general route (without jobs) using the new backend endpoint
      const response = await fetch(`${API_BASE_URL}/api/dispatch/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Route for ${vehicleName}`,
          vehicleId: selectedVehicle.id,
          stops: selectedCustomers.map(c => c.address),
          status: 'planned',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create route');
      }

      const data = await response.json();
      console.log('Route created:', data.route);

      setRoutes([...routes, newRoute]);
      setSelectedVehicle(null);
      setSelectedCustomers([]);
    } catch (error) {
      console.error('Failed to generate route:', error);
      alert('Failed to generate route. Please try again.');
    }
  };

  const handleOptimizeRoute = (routeId: string) => {
    setRoutes(routes.map(route => {
      if (route.id === routeId) {
        const optimizedStops = optimizeRoute(route.stops);
        const stats = calculateRouteStats(optimizedStops);
        return {
          ...route,
          stops: optimizedStops,
          totalMiles: stats.totalMiles,
          estimatedTime: stats.estimatedTime,
        };
      }
      return route;
    }));
  };

  const handleDeleteRoute = (routeId: string) => {
    setRoutes(routes.filter(route => route.id !== routeId));
  };

  const handleDeleteStop = (routeId: string, stopId: string) => {
    setRoutes(routes.map(route => {
      if (route.id === routeId) {
        const updatedStops = route.stops
          .filter(stop => stop.id !== stopId)
          .map((stop, index) => ({ ...stop, order: index }));
        const stats = calculateRouteStats(updatedStops);
        return {
          ...route,
          stops: updatedStops,
          totalMiles: stats.totalMiles,
          estimatedTime: stats.estimatedTime,
        };
      }
      return route;
    }));
  };

  const handleDragStart = (stopId: string) => {
    setDraggedStopId(stopId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (routeId: string, targetStopId: string) => {
    if (!draggedStopId) return;

    setRoutes(routes.map(route => {
      if (route.id === routeId) {
        const stops = [...route.stops];
        const draggedIndex = stops.findIndex(s => s.id === draggedStopId);
        const targetIndex = stops.findIndex(s => s.id === targetStopId);

        if (draggedIndex === -1 || targetIndex === -1) return route;

        const [draggedStop] = stops.splice(draggedIndex, 1);
        stops.splice(targetIndex, 0, draggedStop);

        const reorderedStops = stops.map((stop, index) => ({ ...stop, order: index }));
        const stats = calculateRouteStats(reorderedStops);

        return {
          ...route,
          stops: reorderedStops,
          totalMiles: stats.totalMiles,
          estimatedTime: stats.estimatedTime,
        };
      }
      return route;
    }));

    setDraggedStopId(null);
  };

  // Calculate map center and bounds
  const mapCenter: LatLngExpression = routes.length > 0 && routes[0].stops.length > 0
    ? [routes[0].stops[0].lat, routes[0].stops[0].lng]
    : [39.8283, -98.5795]; // Center of USA

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Route Planning
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Route Builder */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Create New Route
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Autocomplete
                value={selectedVehicle}
                onChange={(_, newValue) => setSelectedVehicle(newValue)}
                options={vehicles}
                getOptionLabel={(vehicle) => {
                  const name = vehicle.name || `${vehicle.make || ''} ${vehicle.model || ''}`.trim();
                  return vehicle.licensePlate ? `${name} - ${vehicle.licensePlate}` : name;
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Vehicle"
                    placeholder="Choose a vehicle"
                  />
                )}
              />

              <Autocomplete
                multiple
                value={selectedCustomers}
                onChange={(_, newValue) => setSelectedCustomers(newValue)}
                options={customers}
                getOptionLabel={(customer) => `${customer.name} - ${customer.address}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Stops"
                    placeholder="Add customers"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.name}
                      {...getTagProps({ index })}
                      size="small"
                    />
                  ))
                }
              />

              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddRoute}
                disabled={!selectedVehicle || selectedCustomers.length === 0}
                fullWidth
                sx={{ textTransform: 'none' }}
              >
                Create Route
              </Button>
            </Box>
          </Paper>

          {/* Active Routes */}
          <Paper sx={{ p: 3, maxHeight: '500px', overflow: 'auto' }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Active Routes ({routes.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {routes.length === 0 ? (
              <Alert severity="info">No routes created yet. Create your first route above!</Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {routes.map((route) => (
                  <motion.div
                    key={route.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card variant="outlined" sx={{ borderLeft: `4px solid ${route.color}` }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LocalShipping sx={{ color: route.color }} />
                            <Typography variant="subtitle1" fontWeight={600}>
                              {route.vehicleName}
                            </Typography>
                          </Box>
                          <Box>
                            <IconButton
                              size="small"
                              onClick={() => handleOptimizeRoute(route.id)}
                              title="Optimize Route"
                            >
                              <TrendingUp fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteRoute(route.id)}
                              color="error"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                          <Chip
                            icon={<Place />}
                            label={`${route.stops.length} stops`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            icon={<Navigation />}
                            label={`${route.totalMiles} mi`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            icon={<AccessTime />}
                            label={`${route.estimatedTime} min`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>

                        <List dense>
                          {route.stops.map((stop, index) => (
                            <ListItem
                              key={stop.id}
                              draggable
                              onDragStart={() => handleDragStart(stop.id)}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(route.id, stop.id)}
                              sx={{
                                cursor: 'move',
                                bgcolor: draggedStopId === stop.id ? 'action.hover' : 'transparent',
                                borderRadius: 1,
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                              secondaryAction={
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={() => handleDeleteStop(route.id, stop.id)}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              }
                            >
                              <ListItemIcon>
                                <DragIndicator />
                              </ListItemIcon>
                              <ListItemText
                                primary={`${index + 1}. ${stop.customerName}`}
                                secondary={stop.address}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Map */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '800px' }}>
            <MapContainer
              center={mapCenter}
              zoom={5}
              style={{ height: '100%', width: '100%', borderRadius: '8px' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {routes.map((route) => (
                <Box key={route.id}>
                  {/* Route polyline */}
                  {route.stops.length > 1 && (
                    <Polyline
                      positions={route.stops.map(stop => [stop.lat, stop.lng] as LatLngExpression)}
                      color={route.color}
                      weight={4}
                      opacity={0.7}
                    />
                  )}

                  {/* Stop markers */}
                  {route.stops.map((stop, index) => (
                    <Marker
                      key={stop.id}
                      position={[stop.lat, stop.lng]}
                    >
                      <Popup>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            Stop {index + 1}: {stop.customerName}
                          </Typography>
                          <Typography variant="caption" display="block">
                            {stop.address}
                          </Typography>
                          <Typography variant="caption" display="block" sx={{ color: route.color }}>
                            {route.vehicleName}
                          </Typography>
                        </Box>
                      </Popup>
                    </Marker>
                  ))}
                </Box>
              ))}
            </MapContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
