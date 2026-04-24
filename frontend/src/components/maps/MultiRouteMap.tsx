import { useEffect, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Chip, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { trovanColors } from '../../theme/designTokens';
import {
  MapFilmOverlay,
  mapFloatingPanelSx,
  trovanMapLayer,
} from './mapPresentation';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const createVehicleIcon = (color: string) =>
  L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        background: linear-gradient(180deg, ${color}, ${color});
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 2px solid #FFF8F1;
        box-shadow: 0 10px 24px rgba(65, 42, 24, 0.18);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" fill="#FFF8F1" viewBox="0 0 24 24" width="20" height="20">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const createStopIcon = (index: number, color: string) =>
  L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="
        background: ${color};
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2px solid #FFF8F1;
        box-shadow: 0 8px 20px rgba(65, 42, 24, 0.16);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFF8F1;
        font-weight: 700;
        font-size: 12px;
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

interface RouteData {
  id: string;
  color: string;
  polyline?: { coordinates?: [number, number][] } | null;
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

function FitBounds({ routes }: { routes: RouteData[] }) {
  const map = useMap();

  useEffect(() => {
    const allPoints: [number, number][] = [];

    routes.forEach((route) => {
      if (route.vehicle?.currentLocation) {
        allPoints.push([route.vehicle.currentLocation.lat, route.vehicle.currentLocation.lng]);
      }

      route.stops?.forEach((stop) => {
        allPoints.push([stop.lat, stop.lng]);
      });

      route.polyline?.coordinates?.forEach((coord: [number, number]) => {
        allPoints.push([coord[1], coord[0]]);
      });
    });

    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [54, 54], maxZoom: 14 });
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
  const defaultCenter: [number, number] = [37.7749, -122.4194];

  const getMapCenter = (): [number, number] => {
    if (routes.length === 0) return defaultCenter;
    const firstRoute = routes[0];
    if (firstRoute.vehicle?.currentLocation) {
      return [firstRoute.vehicle.currentLocation.lat, firstRoute.vehicle.currentLocation.lng];
    }
    if (firstRoute.stops?.length) {
      return [firstRoute.stops[0].lat, firstRoute.stops[0].lng];
    }
    return defaultCenter;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
      case 'draft':
        return 'success';
      case 'assigned':
      case 'ready_for_dispatch':
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
    <Box sx={{ position: 'relative', height }} className="trovan-map">
      {showLegend && routes.length > 0 ? (
        <Paper
          sx={{
            ...mapFloatingPanelSx,
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1000,
            p: 1.65,
            maxHeight: '420px',
            overflowY: 'auto',
            minWidth: '280px',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Active Routes ({routes.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9 }}>
            {routes.map((route) => (
              <Box
                key={route.id}
                sx={{
                  p: 1.2,
                  borderRadius: 1.25,
                  border: '1px solid',
                  borderColor:
                    selectedRoute === route.id
                      ? alpha(route.color, 0.4)
                      : alpha(trovanColors.stone[700], 0.08),
                  bgcolor:
                    selectedRoute === route.id
                      ? alpha(route.color, 0.08)
                      : alpha('#FFFDFC', 0.6),
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: alpha(route.color, 0.06),
                  },
                }}
                onClick={() => setSelectedRoute(selectedRoute === route.id ? null : route.id)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.45 }}>
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: route.color,
                      border: '2px solid #FFF8F1',
                      boxShadow: `0 4px 14px ${alpha(route.color, 0.24)}`,
                    }}
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {route.vehicle
                      ? `${route.vehicle.make} ${route.vehicle.model}`
                      : `Route #${route.id.slice(0, 8)}`}
                  </Typography>
                  <Chip label={route.status.replace(/_/g, ' ')} size="small" color={getStatusColor(route.status) as never} />
                </Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  {route.driver
                    ? `Driver: ${route.driver.firstName} ${route.driver.lastName}`
                    : 'No driver assigned'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Stops: {route.jobCount} | Distance: {route.totalDistanceKm?.toFixed(1) || 'N/A'} km
                </Typography>
                {route.eta ? (
                  <Typography variant="caption" color="text.secondary" display="block">
                    ETA: {new Date(route.eta).toLocaleTimeString()}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Box>
        </Paper>
      ) : null}

      <MapContainer
        attributionControl={false}
        center={getMapCenter()}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer attribution={trovanMapLayer.attribution} url={trovanMapLayer.url} />

        {routes.map((route) => (
          <div key={route.id}>
            {route.polyline?.coordinates ? (
              <Polyline
                positions={route.polyline.coordinates.map((coord: [number, number]) => [
                  coord[1],
                  coord[0],
                ])}
                color={route.color}
                weight={selectedRoute === route.id ? 5.5 : 4.5}
                opacity={selectedRoute === route.id ? 0.94 : 0.82}
                dashArray={route.status === 'planned' || route.status === 'draft' ? '9, 9' : undefined}
              />
            ) : null}

            {route.vehicle ? (
              <Marker
                position={
                  route.vehicle.currentLocation
                    ? [route.vehicle.currentLocation.lat, route.vehicle.currentLocation.lng]
                    : route.stops?.length
                      ? [route.stops[0].lat, route.stops[0].lng]
                      : defaultCenter
                }
                icon={createVehicleIcon(route.color)}
              >
                <Popup>
                  <Box sx={{ p: 0.5 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {route.vehicle.make} {route.vehicle.model}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      License: {route.vehicle.licensePlate}
                    </Typography>
                    {route.driver ? (
                      <Typography variant="body2" color="text.secondary">
                        Driver: {route.driver.firstName} {route.driver.lastName}
                      </Typography>
                    ) : null}
                    <Chip
                      label={route.status.replace(/_/g, ' ')}
                      size="small"
                      color={getStatusColor(route.status) as never}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Popup>
              </Marker>
            ) : null}

            {route.stops?.map((stop, index) => (
              <Marker
                key={`${route.id}-stop-${index}`}
                position={[stop.lat, stop.lng]}
                icon={createStopIcon(index, route.color)}
              >
                <Popup>
                  <Box sx={{ p: 0.5 }}>
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

        <FitBounds routes={routes} />
      </MapContainer>

      <MapFilmOverlay />

      {routes.length === 0 ? (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 1000,
            px: 2.5,
            py: 1.8,
            borderRadius: 1.5,
            bgcolor: alpha('#FFFDFC', 0.82),
            border: `1px solid ${alpha(trovanColors.stone[700], 0.1)}`,
            backdropFilter: 'blur(18px)',
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No routes to display
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create routes to see them on the map
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
