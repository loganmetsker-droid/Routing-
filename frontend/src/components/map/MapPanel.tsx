import { Box, Divider, Typography } from '@mui/material';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import StatusPill from '../ui/StatusPill';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type MapPanelProps = {
  mapCenter: [number, number];
  mapZoom: number;
  mapRoutes: any[];
  title?: string;
  subtitle?: string;
  height?: number;
};

export default function MapPanel({
  mapCenter,
  mapZoom,
  mapRoutes,
  title = 'Active Routes Map',
  subtitle,
  height = 620,
}: MapPanelProps) {
  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        height,
      }}
    >
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle || `${mapRoutes.length} route${mapRoutes.length !== 1 ? 's' : ''} active`}
        </Typography>
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      <Box sx={{ mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {mapRoutes.slice(0, 6).map((route: any) => (
          <StatusPill key={route.id} label={`${route.vehicle} · ${route.vehiclePlate}`} color={route.color} />
        ))}
        {mapRoutes.length > 6 ? <StatusPill label={`+${mapRoutes.length - 6} more`} color="#64748b" /> : null}
      </Box>

      <Box
        sx={{
          height: height - 120,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapRoutes.map((route: any) => {
            if (!route.positions || route.positions.length === 0) return null;
            const positions = route.positions.map((pos: any) => [pos.lat, pos.lng]);
            return (
              <div key={route.id}>
                <Polyline positions={positions} pathOptions={{ color: route.color, weight: 5, opacity: 0.82 }}>
                  <LeafletTooltip sticky>
                    <div style={{ textAlign: 'center' }}>
                      <strong>{route.vehicle}</strong>
                      <br />
                      {route.stopCount} stops • {route.totalDistance}km
                    </div>
                  </LeafletTooltip>
                </Polyline>
                {positions.map((pos: any, idx: number) => (
                  <Marker key={`${route.id}-${idx}`} position={pos}>
                    <Popup>
                      <strong>{route.vehicle}</strong>
                      <br />
                      Stop {idx + 1} of {route.stopCount}
                      <br />
                      {route.vehiclePlate}
                    </Popup>
                  </Marker>
                ))}
              </div>
            );
          })}
        </MapContainer>
      </Box>
    </Box>
  );
}
