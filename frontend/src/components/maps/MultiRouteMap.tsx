import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Paper, Typography, Chip } from '@mui/material';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom vehicle icon with dynamic color
const createVehicleIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" width="22" height="22">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

// Stop marker icon
const createStopIcon = (index: number, color: string) => {
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

interface RouteData {
  id: string;
  color: string;
  polyline?: any;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    licensePlate: string;
    currentLocation?: { lat: number; lng: number };
  };
  driver?: {
    firstName: string;
    lastName: string;
  };
  status: string;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  eta?: string;
  jobCount: number;
  stops?: Array<{
    lat: number;
    lng: number;
    address: string;
    type: 'pickup' | 'delivery';
  }>;
}

interface MultiRouteMapProps {
  routes: RouteData[];
  height?: string;
  showLegend?: boolean;
}

// Component to auto-fit bounds when routes update
function FitBounds({ routes }: { routes: RouteData[] }) {
  const map = useMap();

  useEffect(() => {
    const allPoints: [number, number][] = [];

    routes.forEach((route) => {
      // Add vehicle location if available
      if (route.vehicle?.currentLocation) {
        allPoints.push([
          route.vehicle.currentLocation.lat,
          route.vehicle.currentLocation.lng,
        ]);
      }

      // Add stops
      if (route.stops) {
        route.stops.forEach((stop) => {
          allPoints.push([stop.lat, stop.lng]);
        });
      }

      // Add polyline coordinates if available
      if (route.polyline?.coordinates) {
        route.polyline.coordinates.forEach((coord: [number, number]) => {
          allPoints.push([coord[1], coord[0]]); // GeoJSON is [lng, lat]
        });
      }
    });

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [routes, map]);

  return null;
}

export default function MultiRouteMap({
  routes,
  height = '600px',
  showLegend = true,
}: MultiRouteMapProps) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  // Default center (San Francisco)
  const defaultCenter: [number, number] = [37.7749, -122.4194];

  // Get center from first route's first stop or vehicle location
  const getMapCenter = (): [number, number] => {
    if (routes.length === 0) return defaultCenter;

    const firstRoute = routes[0];
    if (firstRoute.vehicle?.currentLocation) {
      return [
        firstRoute.vehicle.currentLocation.lat,
        firstRoute.vehicle.currentLocation.lng,
      ];
    }
    if (firstRoute.stops && firstRoute.stops.length > 0) {
      return [firstRoute.stops[0].lat, firstRoute.stops[0].lng];
    }
    return defaultCenter;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'success';
      case 'assigned':
      case 'in_progress':
        return 'primary';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ position: 'relative', height }}>
      {/* Legend */}
      {showLegend && routes.length > 0 && (
        <Paper
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1000,
            p: 2,
            maxHeight: '400px',
            overflowY: 'auto',
            minWidth: '280px',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Active Routes ({routes.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {routes.map((route) => (
              <Box
                key={route.id}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: '2px solid',
                  borderColor:
                    selectedRoute === route.id ? route.color : 'transparent',
                  bgcolor:
                    selectedRoute === route.id ? `${route.color}15` : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: `${route.color}10`,
                  },
                }}
                onClick={() =>
                  setSelectedRoute(selectedRoute === route.id ? null : route.id)
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: route.color,
                      border: '2px solid white',
                      boxShadow: 1,
                    }}
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {route.vehicle
                      ? `${route.vehicle.make} ${route.vehicle.model}`
                      : `Route #${route.id.slice(0, 8)}`}
                  </Typography>
                  <Chip
                    label={route.status}
                    size="small"
                    color={getStatusColor(route.status) as any}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  {route.driver
                    ? `Driver: ${route.driver.firstName} ${route.driver.lastName}`
                    : 'No driver assigned'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Stops: {route.jobCount} | Distance:{' '}
                  {route.totalDistanceKm?.toFixed(1) || 'N/A'} km
                </Typography>
                {route.eta && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    ETA: {new Date(route.eta).toLocaleTimeString()}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Map */}
      <MapContainer
        center={getMapCenter()}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render each route */}
        {routes.map((route) => (
          <div key={route.id}>
            {/* Route polyline */}
            {route.polyline?.coordinates && (
              <Polyline
                positions={route.polyline.coordinates.map((coord: [number, number]) => [
                  coord[1],
                  coord[0],
                ])} // Convert [lng, lat] to [lat, lng]
                color={route.color}
                weight={selectedRoute === route.id ? 6 : 4}
                opacity={selectedRoute === route.id ? 0.9 : 0.6}
                dashArray={route.status === 'planned' ? '10, 10' : undefined}
              />
            )}

            {/* Vehicle marker at current location or first stop */}
            {route.vehicle && (
              <Marker
                position={
                  route.vehicle.currentLocation
                    ? [
                        route.vehicle.currentLocation.lat,
                        route.vehicle.currentLocation.lng,
                      ]
                    : route.stops && route.stops.length > 0
                    ? [route.stops[0].lat, route.stops[0].lng]
                    : defaultCenter
                }
                icon={createVehicleIcon(route.color)}
              >
                <Popup>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {route.vehicle.make} {route.vehicle.model}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      License: {route.vehicle.licensePlate}
                    </Typography>
                    {route.driver && (
                      <Typography variant="body2" color="text.secondary">
                        Driver: {route.driver.firstName} {route.driver.lastName}
                      </Typography>
                    )}
                    <Chip
                      label={route.status}
                      size="small"
                      color={getStatusColor(route.status) as any}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Popup>
              </Marker>
            )}

            {/* Stop markers */}
            {route.stops?.map((stop, index) => (
              <Marker
                key={`${route.id}-stop-${index}`}
                position={[stop.lat, stop.lng]}
                icon={createStopIcon(index, route.color)}
              >
                <Popup>
                  <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Stop #{index + 1}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      Type: {stop.type}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {stop.address}
                    </Typography>
                  </Box>
                </Popup>
              </Marker>
            ))}
          </div>
        ))}

        {/* Auto-fit bounds */}
        <FitBounds routes={routes} />
      </MapContainer>

      {/* Empty state */}
      {routes.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 1000,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No routes to display
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create routes to see them on the map
          </Typography>
        </Box>
      )}
    </Box>
  );
}
