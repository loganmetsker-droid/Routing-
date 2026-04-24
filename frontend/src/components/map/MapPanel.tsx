import { Box, Divider, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import StatusPill from '../ui/StatusPill';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { shellTokens } from '../../theme/tokens';

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
  height?: number | string;
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
        p: 2,
        borderRadius: `${shellTokens.radius.md}px`,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.98),
        boxShadow: shellTokens.shadow.soft,
        height,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Box sx={{ mb: 1.5, minWidth: 0 }}>
        <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.25 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle || `${mapRoutes.length} route${mapRoutes.length !== 1 ? 's' : ''} active`}
        </Typography>
      </Box>

      <Divider sx={{ mb: 1.5, opacity: 0.7 }} />

      <Box sx={{ mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {mapRoutes.slice(0, 6).map((route: any) => (
          <StatusPill key={route.id} compact label={`${route.vehicle} · ${route.vehiclePlate}`} color={route.color} />
        ))}
        {mapRoutes.length > 6 ? <StatusPill compact label={`+${mapRoutes.length - 6} more`} color="#64748b" /> : null}
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 320,
          borderRadius: `${shellTokens.radius.sm}px`,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.08)',
        }}
      >
        <MapContainer attributionControl={false} center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
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
