import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { DriverRecord, RouteRecord, VehicleRecord } from '../../services/api.types';
import type {
  RouteRunRecord,
  RouteRunStopRecord,
} from '../../features/dispatch/api/routeRunsApi';
import MultiRouteMap, { type MapDisplayMode } from './MultiRouteMap';
import {
  buildMapRoutesFromRouteRuns,
  buildMapRoutesFromRoutes,
} from './opsRouteMapUtils';

type LiveRouteMapPanelProps = {
  routes?: RouteRecord[];
  routeRuns?: RouteRunRecord[];
  routeRunStops?: RouteRunStopRecord[];
  vehicles?: VehicleRecord[];
  drivers?: DriverRecord[];
  height?: number | string;
  showLegend?: boolean;
  selectedRouteId?: string | null;
  displayMode?: MapDisplayMode;
  emptyTitle?: string;
  emptyBody?: string;
};

const hasRenderableGeometry = (route: {
  polyline?: { coordinates?: [number, number][] } | null;
  stops?: Array<{ lat: number; lng: number }>;
}) =>
  Boolean(route.polyline?.coordinates?.length) ||
  Boolean(route.stops?.some((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng)));

export default function LiveRouteMapPanel({
  routes = [],
  routeRuns = [],
  routeRunStops = [],
  vehicles = [],
  drivers = [],
  height = 350,
  showLegend = false,
  selectedRouteId = null,
  displayMode = 'all',
  emptyTitle = 'No route geometry available',
  emptyBody = 'The map is live, but this data set has no geocoded stops or route geometry yet.',
}: LiveRouteMapPanelProps) {
  const mapRoutes = useMemo(() => {
    const runRoutes = routeRuns.length
      ? buildMapRoutesFromRouteRuns(routeRuns, routeRunStops, vehicles, drivers)
      : [];
    const sourceRoutes = runRoutes.some(hasRenderableGeometry)
      ? runRoutes
      : buildMapRoutesFromRoutes(routes, vehicles, drivers);
    return sourceRoutes.filter(hasRenderableGeometry);
  }, [drivers, routeRunStops, routeRuns, routes, vehicles]);

  const mapHeight = typeof height === 'number' ? `${height}px` : height;

  if (!mapRoutes.length) {
    return (
      <Box
        sx={{
          height: mapHeight,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          px: 3,
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.035),
          border: '1px dashed',
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
            {emptyTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {emptyBody}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: mapHeight,
        overflow: 'hidden',
        '& .trovan-map': { height: mapHeight },
        '& .leaflet-container': { background: '#DDE7D6' },
      }}
    >
      <MultiRouteMap
        routes={mapRoutes}
        height={mapHeight}
        showLegend={showLegend}
        selectedRouteId={selectedRouteId}
        displayMode={displayMode}
      />
    </Box>
  );
}
