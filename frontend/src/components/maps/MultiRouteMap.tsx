import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Chip, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { trovanColors } from '../../theme/designTokens';
import {
  MapStyleToggle,
  MapFilmOverlay,
  mapFloatingPanelSx,
  trovanMapLayers,
  usePersistedTrovanMapStyle,
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

type MapRenderLevel = 'overview' | 'context' | 'detail';
type StopImportance = 'normal' | 'late-risk' | 'exception' | 'blocking';

const DENSE_ROUTE_DAY_STOP_THRESHOLD = 60;
const VERY_DENSE_ROUTE_DAY_STOP_THRESHOLD = 100;
const LOW_ZOOM_MARKER_BUDGET = 40;

const escapeHtml = (value: string | number) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createVehicleIcon = (color: string, muted = false, selected = false) =>
  L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        background: linear-gradient(180deg, ${color}, ${color});
        width: ${selected ? 40 : 34}px;
        height: ${selected ? 40 : 34}px;
        border-radius: 50%;
        border: ${selected ? 3 : 2}px solid #FFF8F1;
        box-shadow: ${selected ? `0 0 0 5px ${color}40, 0 16px 32px rgba(65, 42, 24, 0.26)` : '0 8px 14px rgba(65, 42, 24, 0.14)'};
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: ${muted ? 0.38 : 1};
      ">
        <svg xmlns="http://www.w3.org/2000/svg" fill="#FFF8F1" viewBox="0 0 24 24" width="20" height="20">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
    `,
    iconSize: selected ? [40, 40] : [34, 34],
    iconAnchor: selected ? [20, 20] : [17, 17],
  });

const createClusterIcon = ({
  color,
  count,
  label,
  muted = false,
}: {
  color: string;
  count: number;
  label: string;
  muted?: boolean;
}) =>
  L.divIcon({
    className: 'custom-route-cluster-marker',
    html: `
      <span
        aria-hidden="true"
        data-testid="routing-route-cluster-marker"
        data-route-label="${escapeHtml(label)}"
        style="
          min-width: 52px;
          height: 34px;
          border-radius: 10px;
          border: 2px solid ${color};
          background: #fff8f1;
          color: #241712;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          font-family: inherit;
          font-weight: 800;
          line-height: 1;
          cursor: pointer;
          opacity: ${muted ? 0.76 : 1};
          box-shadow: 0 2px 5px rgba(36, 23, 18, 0.16);
        "
      >
        <span style="font-size: 12px; letter-spacing: 0;">${escapeHtml(label)}</span>
        <span style="font-size: 11px; letter-spacing: 0;">${count} stops</span>
      </span>
    `,
    iconSize: [58, 36],
    iconAnchor: [29, 18],
  });

const createStopIcon = ({
  index,
  color,
  compact = false,
  muted = false,
  selected = false,
  routeFocus,
  importance,
  role,
}: {
  index: number;
  color: string;
  compact?: boolean;
  muted?: boolean;
  selected?: boolean;
  routeFocus: 'selected' | 'muted' | 'default';
  importance: StopImportance;
  role: 'start' | 'end' | 'stop';
}) => {
  const isImportant = importance !== 'normal';
  const baseSize = selected ? (compact ? 23 : 31) : compact ? 17 : 26;
  const size = isImportant ? Math.max(baseSize, selected ? 33 : 29) : baseSize;
  const issueColor =
    importance === 'blocking' || importance === 'exception'
      ? '#b42318'
      : importance === 'late-risk'
        ? '#9a6700'
        : color;
  const markerColor = isImportant ? issueColor : color;
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div
        data-testid="routing-stop-marker"
        data-route-focus="${routeFocus}"
        data-stop-importance="${importance}"
        data-stop-role="${role}"
        style="
        background: ${markerColor};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${isImportant ? 3 : selected ? 3 : compact ? 1.5 : 2}px solid #FFF8F1;
        box-shadow: ${selected ? `0 0 0 3px ${color}38, 0 7px 14px rgba(65, 42, 24, 0.18)` : isImportant ? '0 0 0 3px rgba(180, 35, 24, 0.18)' : '0 4px 9px rgba(65, 42, 24, 0.12)'};
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFF8F1;
        font-weight: 700;
        font-size: ${compact ? 8 : 12}px;
        line-height: 1;
        opacity: ${muted ? 0.3 : 1};
      ">
        ${index + 1}
        ${
          isImportant
            ? `<span data-testid="routing-exception-marker" aria-hidden="true" style="position:absolute; transform:translate(11px,-11px); width:13px; height:13px; border-radius:50%; background:#fff8f1; color:${issueColor}; border:1px solid ${issueColor}; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:900;">!</span>`
            : ''
        }
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

interface RouteData {
  id: string;
  color: string;
  polyline?: { coordinates?: [number, number][] } | null;
  hasException?: boolean;
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
    status?: string;
    priority?: string;
    isLocked?: boolean;
    hasException?: boolean;
    isLateRisk?: boolean;
    isBlocking?: boolean;
  }>;
}

export type MapDisplayMode = 'selected' | 'all' | 'density' | 'exceptions';

interface MultiRouteMapProps {
  routes: RouteData[];
  height?: string;
  showLegend?: boolean;
  selectedRouteId?: string | null;
  onRouteSelect?: (routeId: string | null) => void;
  displayMode?: MapDisplayMode;
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
      map.fitBounds(L.latLngBounds(allPoints), { padding: [38, 38], maxZoom: 14 });
    }
  }, [routes, map]);

  return null;
}

function MapZoomObserver({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

export default function MultiRouteMap({
  routes,
  height = '600px',
  showLegend = true,
  selectedRouteId,
  onRouteSelect,
  displayMode = 'all',
}: MultiRouteMapProps) {
  const [internalSelectedRoute, setInternalSelectedRoute] = useState<string | null>(null);
  const [zoom, setZoom] = useState(12);
  const [mapStyle, setMapStyle] = usePersistedTrovanMapStyle();
  const activeMapLayer = trovanMapLayers[mapStyle];
  const selectedRoute = selectedRouteId ?? internalSelectedRoute;
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const totalStops = useMemo(
    () => routes.reduce((count, route) => count + (route.stops?.length || route.jobCount || 0), 0),
    [routes],
  );
  const isDenseRouteDay = totalStops >= DENSE_ROUTE_DAY_STOP_THRESHOLD;
  const isVeryDenseRouteDay = totalStops >= VERY_DENSE_ROUTE_DAY_STOP_THRESHOLD;

  const renderLevel: MapRenderLevel = useMemo(() => {
    if (displayMode === 'density' || displayMode === 'exceptions') return 'overview';
    if (zoom >= 13) return 'detail';
    if (zoom <= 10) return 'overview';
    if (isVeryDenseRouteDay && (displayMode === 'selected' || displayMode === 'all')) {
      return 'overview';
    }
    if (zoom >= 11 && zoom <= 12) return 'context';
    return isDenseRouteDay ? 'context' : 'detail';
  }, [displayMode, isDenseRouteDay, isVeryDenseRouteDay, zoom]);

  const selectRoute = (routeId: string) => {
    const nextRouteId = selectedRoute === routeId ? null : routeId;
    setInternalSelectedRoute(nextRouteId);
    onRouteSelect?.(nextRouteId);
  };

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
  const formatDistance = (distanceKm?: number) => {
    if (!Number.isFinite(distanceKm)) return 'N/A';
    const safeDistance = Number(distanceKm);
    return `${(safeDistance * 0.621371).toFixed(1)} mi`;
  };
  const routeLabel = (route: RouteData) =>
    route.vehicle?.licensePlate ||
    (route.driver ? `${route.driver.firstName} ${route.driver.lastName}` : `Route ${route.id.slice(-4)}`);
  const routeCentroid = (route: RouteData): [number, number] => {
    const points = route.stops?.length
      ? route.stops.map((stop) => [stop.lat, stop.lng] as [number, number])
      : route.vehicle?.currentLocation
        ? [[route.vehicle.currentLocation.lat, route.vehicle.currentLocation.lng] as [number, number]]
        : [defaultCenter];
    const lat = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const lng = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    return [lat, lng];
  };
  const stopImportance = (stop: NonNullable<RouteData['stops']>[number]): StopImportance => {
    const status = String(stop.status || '').toLowerCase();
    if (stop.isBlocking || stop.hasException || /exception|failed|blocked|unresolved/.test(status)) return 'exception';
    if (stop.isLateRisk || /late|risk/.test(status)) return 'late-risk';
    return 'normal';
  };

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        '& .leaflet-tile-pane': {
          filter: activeMapLayer.tileFilter,
        },
        '& .leaflet-overlay-pane': {
          filter: 'saturate(1.08) contrast(1.05)',
        },
        '& .leaflet-tile': {
          imageRendering: 'auto',
        },
        '& .leaflet-control-zoom': {
          border: '1px solid rgba(60,64,67,0.18)',
          boxShadow: '0 1px 4px rgba(60,64,67,0.24)',
        },
        '& .leaflet-control-zoom a': {
          color: '#3C4043',
          backgroundColor: '#FFFFFF',
          borderBottomColor: 'rgba(60,64,67,0.14)',
          fontWeight: 700,
        },
        '& .leaflet-control-zoom a:hover': {
          backgroundColor: '#F8F9FA',
        },
      }}
      className="trovan-map"
    >
      <Box
        data-testid="routing-map-render-level"
        data-render-level={renderLevel}
        data-total-stops={totalStops}
        data-marker-budget={LOW_ZOOM_MARKER_BUDGET}
        sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
      />
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
          <Typography variant="h6" component="p" gutterBottom>
            Active Routes ({routes.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9 }}>
            {routes.map((route) => (
              <Box
                key={route.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedRoute === route.id}
                aria-label={`Select route ${route.id}`}
                sx={{
                  p: 1.2,
                  borderRadius: 1.25,
                  border: '1px solid',
                  borderColor:
                    selectedRoute === route.id
                      ? alpha(route.color, 0.4)
                      : trovanColors.utility.border,
                  bgcolor:
                    selectedRoute === route.id
                      ? alpha(route.color, 0.14)
                      : alpha(trovanColors.black[950], 0.26),
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: alpha(route.color, 0.06),
                  },
                }}
                onClick={() => selectRoute(route.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectRoute(route.id);
                  }
                }}
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
                  Stops: {route.jobCount} | Distance: {formatDistance(route.totalDistanceKm)}
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

      <MapStyleToggle value={mapStyle} onChange={setMapStyle} />

      <MapContainer
        attributionControl={false}
        center={getMapCenter()}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          key={`${mapStyle}-base`}
          attribution={activeMapLayer.attribution}
          url={activeMapLayer.url}
        />
        {activeMapLayer.labelUrl ? (
          <TileLayer
            key={`${mapStyle}-labels`}
            url={activeMapLayer.labelUrl}
            opacity={activeMapLayer.labelOpacity ?? 0.82}
            zIndex={280}
          />
        ) : null}
        <MapZoomObserver onZoomChange={setZoom} />

        {routes.map((route) => {
          const hasSelectedRoute = Boolean(selectedRoute);
          const isRouteSelected = selectedRoute === route.id;
          const isExceptionOnlyHidden = displayMode === 'exceptions' && !route.hasException && !isRouteSelected;
          const isSelectedModeMuted = displayMode === 'selected' && hasSelectedRoute && !isRouteSelected;
          const isDensityMode = displayMode === 'density';
          const isOverview = renderLevel === 'overview';
          const isContext = renderLevel === 'context';
          const isDetail = renderLevel === 'detail';
          const stops = route.stops || [];
          const importantStops = stops.filter((stop) => stopImportance(stop) !== 'normal');
          const isRouteMuted = isExceptionOnlyHidden || isSelectedModeMuted || (hasSelectedRoute && !isRouteSelected && displayMode !== 'all');
          const simplifyUnrelated =
            (displayMode === 'selected' && hasSelectedRoute && !isRouteSelected) ||
            isExceptionOnlyHidden ||
            (displayMode === 'all' && isOverview) ||
            isDensityMode;
          const shouldClusterRoute =
            stops.length > 0 &&
            (
              (displayMode === 'selected' && hasSelectedRoute && !isRouteSelected && !isDetail) ||
              (displayMode === 'all' && !isDetail && totalStops > LOW_ZOOM_MARKER_BUDGET) ||
              isDensityMode
            );
          const routeLineWeight = isRouteSelected
            ? 5.4
            : simplifyUnrelated
              ? isDensityMode ? 1.3 : 0.9
              : isDensityMode
                ? 1.7
                : isRouteMuted
                  ? 2
                  : 3;
          const routeLineOpacity = isRouteSelected
            ? 1
            : isExceptionOnlyHidden
              ? 0.05
              : simplifyUnrelated
                ? isDensityMode ? 0.26 : 0.1
                : isDensityMode
                  ? 0.42
                  : isRouteMuted
                    ? 0.22
                    : 0.82;
          const visibleStops = (() => {
            if (displayMode === 'exceptions') return importantStops;
            if (isDensityMode) return importantStops;
            if (displayMode === 'selected' && hasSelectedRoute) {
              if (isRouteSelected) return stops;
              return isDetail ? importantStops : importantStops;
            }
            if (displayMode === 'all' && !isDetail && totalStops > LOW_ZOOM_MARKER_BUDGET) {
              return importantStops;
            }
            if (isContext && totalStops > LOW_ZOOM_MARKER_BUDGET) {
              return stops.filter((stop, index) => stopImportance(stop) !== 'normal' || index === 0 || index === stops.length - 1);
            }
            return stops;
          })();
          const routeFocus = isRouteSelected ? 'selected' : isRouteMuted || shouldClusterRoute ? 'muted' : 'default';
          const routeIsHiddenForExceptions = displayMode === 'exceptions' && !route.hasException && !isRouteSelected;

          return (
          <div
            key={route.id}
            data-route-id={route.id}
            data-route-focus={routeFocus}
            data-route-simplified={simplifyUnrelated ? 'true' : 'false'}
            data-map-display-mode={displayMode}
            data-map-render-level={renderLevel}
          >
            {route.polyline?.coordinates && !routeIsHiddenForExceptions ? (
              <Polyline
                positions={route.polyline.coordinates.map((coord: [number, number]) => [
                  coord[1],
                  coord[0],
                ])}
                color={route.color}
                weight={routeLineWeight}
                opacity={routeLineOpacity}
                dashArray="6 1"
                lineCap="butt"
                lineJoin="round"
                className={
                  isRouteSelected
                    ? `trovan-route-line route-line-${route.id} is-selected`
                    : simplifyUnrelated
                      ? `trovan-route-line route-line-${route.id} is-simplified`
                      : isRouteMuted
                        ? `trovan-route-line route-line-${route.id} is-muted`
                        : `trovan-route-line route-line-${route.id}`
                }
                eventHandlers={{
                  click: () => selectRoute(route.id),
                }}
              />
            ) : null}

            {route.vehicle && !(shouldClusterRoute && !isRouteSelected) && !routeIsHiddenForExceptions && displayMode !== 'density' ? (
              <Marker
                title={`${route.vehicle.make} ${route.vehicle.model} on ${routeLabel(route)}`}
                position={
                  route.vehicle.currentLocation
                    ? [route.vehicle.currentLocation.lat, route.vehicle.currentLocation.lng]
                    : route.stops?.length
                      ? [route.stops[0].lat, route.stops[0].lng]
                      : defaultCenter
                }
                icon={createVehicleIcon(route.color, isRouteMuted, isRouteSelected)}
                opacity={simplifyUnrelated ? 0.16 : isRouteMuted ? 0.46 : 1}
                eventHandlers={{
                  click: () => selectRoute(route.id),
                }}
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

            {shouldClusterRoute && !routeIsHiddenForExceptions ? (
              <Marker
                title={`${routeLabel(route)} • ${stops.length} stops`}
                position={routeCentroid(route)}
                icon={createClusterIcon({
                  color: route.color,
                  count: stops.length,
                  label: routeLabel(route),
                  muted: !isRouteSelected,
                })}
                eventHandlers={{
                  click: () => selectRoute(route.id),
                }}
              >
                <Popup>
                  <Box sx={{ p: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {routeLabel(route)}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {stops.length} stops summarized
                    </Typography>
                  </Box>
                </Popup>
              </Marker>
            ) : null}

            {visibleStops.map((stop) => {
              const originalIndex = Math.max(0, stops.indexOf(stop));
              const importance = stopImportance(stop);
              const stopRole =
                originalIndex === 0
                  ? 'start'
                  : originalIndex === stops.length - 1
                    ? 'end'
                    : 'stop';
              return (
              <Marker
                key={`${route.id}-stop-${originalIndex}`}
                title={`${routeLabel(route)} stop ${originalIndex + 1}`}
                position={[stop.lat, stop.lng]}
                icon={createStopIcon({
                  index: originalIndex,
                  color: route.color,
                  compact: stops.length >= 8 && !isDetail,
                  muted: isRouteMuted && importance === 'normal',
                  selected: isRouteSelected,
                  routeFocus,
                  importance,
                  role: stopRole,
                })}
                opacity={isRouteMuted ? 0.4 : 1}
                eventHandlers={{
                  click: () => selectRoute(route.id),
                }}
              >
                <Popup>
                  <Box sx={{ p: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Stop #{originalIndex + 1}
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
              );
            })}
          </div>
          );
        })}

        <FitBounds routes={routes} />
      </MapContainer>

      <MapFilmOverlay variant={mapStyle} />

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
            bgcolor: alpha(trovanColors.utility.panel, 0.86),
            border: `1px solid ${trovanColors.utility.borderStrong}`,
            backdropFilter: 'blur(18px)',
          }}
        >
          <Typography variant="h6" component="p" color="text.secondary">
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
