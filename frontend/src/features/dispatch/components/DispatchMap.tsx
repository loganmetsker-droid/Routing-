import { Box, Typography } from '@mui/material';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from 'react-leaflet';
import PageSection from '../../../components/ui/PageSection';
import EmptyState from '../../../components/ui/EmptyState';
import type { DispatchRoute } from '../../../types/dispatch';
import { extractRoutePolyline } from '../utils/routeMap';
import 'leaflet/dist/leaflet.css';

type DispatchMapProps = {
  route: DispatchRoute | null;
};

export default function DispatchMap({ route }: DispatchMapProps) {
  const polyline = extractRoutePolyline(route);

  if (!route) {
    return (
      <PageSection title="Map" subtitle="Supporting context for the selected route">
        <EmptyState
          title="No route selected"
          message="Select a route to inspect trusted stop geometry."
        />
      </PageSection>
    );
  }

  if (polyline.length < 2) {
    return (
      <PageSection title="Map" subtitle="Supporting context for the selected route">
        <EmptyState
          title="Route geometry unavailable"
          message="This route has no trustworthy coordinate sequence yet."
        />
      </PageSection>
    );
  }

  return (
    <PageSection title="Map" subtitle="Only real route geometry is rendered">
      <Box sx={{ height: 320, overflow: 'hidden', borderRadius: 2 }}>
        <MapContainer
          center={polyline[0]}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline positions={polyline} pathOptions={{ color: '#0f766e', weight: 5 }} />
          {polyline.map((point, index) => (
            <Marker key={`${route.id}-${index}`} position={point}>
              <Popup>
                <Typography variant="body2">Stop {index + 1}</Typography>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Box>
    </PageSection>
  );
}
