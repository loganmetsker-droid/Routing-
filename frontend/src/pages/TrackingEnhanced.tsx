import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from '../router';
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { StatusPill, type StatusPillTone } from '../components/StatusPill';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import { KpiTile } from '../components/KpiTile';
import LoadingState from '../components/ui/LoadingState';
import {
  useDispatchOptimizerHealthQuery,
  useRoutesQuery,
} from '../services/dispatchApi';
import { useDriversQuery } from '../services/fleetApi';
import { queryKeys } from '../services/queryKeys';
import {
  subscribeToTrackingLocations,
  useTrackingLocationsQuery,
  useVehicleTrackingHistoryQuery,
} from '../services/trackingApi';
import { trovanColors } from '../theme/designTokens';
import {
  MapFilmOverlay,
  MapStyleToggle,
  trovanMapLayers,
  usePersistedTrovanMapStyle,
} from '../components/maps/mapPresentation';
import {
  calculateTelemetryDistanceKm,
  formatTelemetryAge,
  getPlannedRoutePositions,
  getTelemetryFreshness,
  prepareTelemetryHistory,
  type TelemetryFreshness,
} from '../features/tracking/telemetryHistory';

type TraceMode = 'planned' | 'actual' | 'both';
type HistoryHours = 1 | 6 | 24;

const freshnessPresentation: Record<
  TelemetryFreshness,
  { label: string; tone: StatusPillTone; color: string; rank: number }
> = {
  stale: {
    label: 'Stale',
    tone: 'danger',
    color: trovanColors.semantic.danger,
    rank: 0,
  },
  delayed: {
    label: 'Delayed',
    tone: 'warning',
    color: trovanColors.semantic.warning,
    rank: 1,
  },
  live: {
    label: 'Live',
    tone: 'success',
    color: trovanColors.semantic.success,
    rank: 2,
  },
  unavailable: {
    label: 'Unavailable',
    tone: 'default',
    color: trovanColors.stone[500],
    rank: 3,
  },
};

function TrackingMapViewport({
  positions,
  focusKey,
}: {
  positions: Array<[number, number]>;
  focusKey: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], Math.max(map.getZoom(), 12), { animate: false });
    } else if (positions.length > 1) {
      map.fitBounds(positions, {
        animate: false,
        maxZoom: 14,
        padding: [44, 44],
      });
    }

  }, [focusKey, map, positions]);

  return null;
}

const fullDriverName = (driver?: { firstName?: string; lastName?: string }) =>
  driver
    ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Driver pending'
    : 'Driver pending';

export default function TrackingEnhanced() {
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [selectedVehicleChoice, setSelectedVehicleChoice] = useState('');
  const [historyHours, setHistoryHours] = useState<HistoryHours>(6);
  const [traceMode, setTraceMode] = useState<TraceMode>('both');
  const [lastManualRefreshAt, setLastManualRefreshAt] = useState<Date | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const routesQuery = useRoutesQuery();
  const driversQuery = useDriversQuery();
  const optimizerHealthQuery = useDispatchOptimizerHealthQuery();
  const trackingQuery = useTrackingLocationsQuery();
  const [mapStyle, setMapStyle] = usePersistedTrovanMapStyle();
  const activeMapLayer = trovanMapLayers[mapStyle];

  useEffect(() => {
    const unsubscribe = subscribeToTrackingLocations((snapshot) => {
      queryClient.setQueryData(queryKeys.trackingOverview, snapshot);
    });
    return () => unsubscribe();
  }, [queryClient]);

  useEffect(() => {
    const interval = window.setInterval(() => setClockMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const routes = routesQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const optimizerHealth = optimizerHealthQuery.data ?? null;
  const trackingSnapshot = trackingQuery.data ?? {
    vehicles: [],
    timestamp: '',
    count: 0,
  };
  const liveLocations = trackingSnapshot.vehicles;
  const selectedVehicleId = liveLocations.some(
    (location) => location.vehicleId === selectedVehicleChoice,
  )
    ? selectedVehicleChoice
    : liveLocations[0]?.vehicleId || '';
  const historyQuery = useVehicleTrackingHistoryQuery(
    selectedVehicleId,
    historyHours,
  );
  const historyPoints = useMemo(
    () =>
      prepareTelemetryHistory(
        historyQuery.data?.history ?? [],
        selectedVehicleId,
      ),
    [historyQuery.data?.history, selectedVehicleId],
  );
  const historyResetKey = `${selectedVehicleId}:${historyHours}:${historyPoints.length}:${historyPoints.at(-1)?.timestamp || ''}`;

  useEffect(() => {
    setReplayIndex(Math.max(historyPoints.length - 1, 0));
    setIsPlaying(false);
  }, [historyPoints.length, historyResetKey]);

  useEffect(() => {
    if (!isPlaying || historyPoints.length < 2) return undefined;
    const interval = window.setInterval(() => {
      setReplayIndex((current) => {
        if (current >= historyPoints.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 850);
    return () => window.clearInterval(interval);
  }, [historyPoints.length, isPlaying]);

  const loading =
    routesQuery.isLoading ||
    driversQuery.isLoading ||
    optimizerHealthQuery.isLoading ||
    trackingQuery.isLoading;
  const routeByVehicle = useMemo(
    () =>
      new Map(
        routes
          .filter((route) => Boolean(route.vehicleId))
          .map((route) => [route.vehicleId, route] as const),
      ),
    [routes],
  );
  const driverById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers],
  );
  const freshnessCounts = useMemo(() => {
    const counts: Record<TelemetryFreshness, number> = {
      live: 0,
      delayed: 0,
      stale: 0,
      unavailable: 0,
    };
    liveLocations.forEach((location) => {
      counts[getTelemetryFreshness(location.timestamp, clockMs)] += 1;
    });
    return counts;
  }, [clockMs, liveLocations]);
  const orderedLocations = useMemo(
    () =>
      [...liveLocations].sort((left, right) => {
        const leftFreshness = getTelemetryFreshness(left.timestamp, clockMs);
        const rightFreshness = getTelemetryFreshness(right.timestamp, clockMs);
        return (
          freshnessPresentation[leftFreshness].rank -
            freshnessPresentation[rightFreshness].rank ||
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
        );
      }),
    [clockMs, liveLocations],
  );
  const selectedLocation = liveLocations.find(
    (location) => location.vehicleId === selectedVehicleId,
  );
  const selectedRoute = routeByVehicle.get(selectedVehicleId);
  const selectedDriver = selectedRoute?.driverId
    ? driverById.get(selectedRoute.driverId)
    : undefined;
  const selectedFreshness = getTelemetryFreshness(
    selectedLocation?.timestamp,
    clockMs,
  );
  const selectedReplayPoint =
    historyPoints[Math.min(replayIndex, Math.max(historyPoints.length - 1, 0))] ||
    selectedLocation;
  const actualPositions = useMemo(
    () =>
      historyPoints.map(
        (point) => [point.latitude, point.longitude] as [number, number],
      ),
    [historyPoints],
  );
  const plannedPositions = useMemo(
    () => getPlannedRoutePositions(selectedRoute),
    [selectedRoute],
  );
  const visibleTracePositions = useMemo(() => {
    if (traceMode === 'planned') return plannedPositions;
    if (traceMode === 'actual') return actualPositions;
    return [...plannedPositions, ...actualPositions];
  }, [actualPositions, plannedPositions, traceMode]);
  const fallbackPositions = useMemo(
    () =>
      liveLocations.map(
        (location) =>
          [location.latitude, location.longitude] as [number, number],
      ),
    [liveLocations],
  );
  const viewportPositions = visibleTracePositions.length
    ? visibleTracePositions
    : fallbackPositions;
  const mapCenter: [number, number] = selectedLocation
    ? [selectedLocation.latitude, selectedLocation.longitude]
    : [39.1, -94.58];
  const newestTimestamp = liveLocations.reduce((newest, location) => {
    const timestamp = new Date(location.timestamp).getTime();
    return Number.isFinite(timestamp) ? Math.max(newest, timestamp) : newest;
  }, 0);
  const lastUpdateLabel = newestTimestamp
    ? formatTelemetryAge(new Date(newestTimestamp).toISOString(), clockMs)
    : 'No telemetry yet';
  const totalVehicles =
    trackingSnapshot.summary?.totalVehiclesInOrganization ?? liveLocations.length;
  const activeVehicles =
    trackingSnapshot.summary?.activeVehicles ?? liveLocations.length;
  const missingVehicles = Math.max(totalVehicles - activeVehicles, 0);
  const historyDistanceKm = useMemo(
    () => calculateTelemetryDistanceKm(historyPoints),
    [historyPoints],
  );

  if (loading) {
    return <LoadingState label="Loading tracking..." minHeight="50vh" />;
  }

  const emptyState = liveLocations.length === 0;

  const refreshTracking = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.trackingOverview }),
      selectedVehicleId
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.trackingHistory(selectedVehicleId, historyHours),
          })
        : Promise.resolve(),
    ]);
    setLastManualRefreshAt(new Date());
  };

  const togglePlayback = () => {
    if (historyPoints.length < 2) return;
    if (!isPlaying && replayIndex >= historyPoints.length - 1) {
      setReplayIndex(0);
    }
    setIsPlaying((current) => !current);
  };

  return (
    <Box>
      <PageHeader
        eyebrow="Live Dispatch"
        title="Telemetry monitoring"
        subtitle="Compare planned routes with recorded movement, inspect signal freshness, and replay a vehicle's reported positions."
        actions={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<Box component="span" aria-hidden sx={{ fontSize: 17 }}>↻</Box>}
              onClick={() => void refreshTracking()}
              disabled={trackingQuery.isFetching || historyQuery.isFetching}
            >
              {trackingQuery.isFetching || historyQuery.isFetching
                ? 'Refreshing…'
                : 'Refresh signals'}
            </Button>
            {lastManualRefreshAt ? (
              <Typography variant="caption" color="text.secondary" role="status" aria-live="polite">
                Signals checked at {lastManualRefreshAt.toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </Typography>
            ) : null}
            <StatusPill
              label={
                optimizerHealth?.status === 'healthy'
                  ? 'System healthy'
                  : 'Needs review'
              }
              tone={
                optimizerHealth?.status === 'healthy' ? 'success' : 'warning'
              }
            />
          </Stack>
        }
      />

      {emptyState ? (
        <SurfacePanel variant="command" sx={{ py: 5, px: { xs: 2.5, md: 4 } }}>
          <Stack spacing={2.5} alignItems="flex-start" maxWidth={720}>
            <StatusPill label="Telemetry offline" tone="warning" />
            <Box
              aria-label="Tracking map style"
              sx={{ position: 'relative', width: 220, height: 58 }}
            >
              <MapStyleToggle value={mapStyle} onChange={setMapStyle} />
            </Box>
            <Box>
              <Typography variant="h3" sx={{ mb: 1 }}>
                No live telemetry connected
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Once a vehicle reports a persisted GPS ping, Trovan will show its
                latest position here. Historical traces remain empty until real
                telemetry exists.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.25} flexWrap="wrap">
              <Button component={RouterLink} to="/drivers" variant="contained">
                Review drivers
              </Button>
              <Button component={RouterLink} to="/vehicles" variant="outlined">
                Review vehicles
              </Button>
              <Button component={RouterLink} to="/settings" variant="outlined">
                Tracking setup
              </Button>
              <Button
                variant="text"
                onClick={() => setShowHowItWorks((current) => !current)}
              >
                View how tracking works
              </Button>
            </Stack>
            {showHowItWorks ? (
              <SurfacePanel variant="muted">
                <Typography variant="subtitle1">Tracking rollout</Typography>
                <Typography variant="body2" color="text.secondary">
                  1. Activate vehicles and drivers. 2. Post GPS pings to
                  `/api/tracking/ingest` with the assigned vehicle ID. 3. Dispatch
                  a route. 4. Compare planned and actual traces here; missing or
                  stale signals remain visibly labeled.
                </Typography>
              </SurfacePanel>
            ) : null}
          </Stack>
        </SurfacePanel>
      ) : (
        <>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid item xs={12} md={4}>
              <KpiTile
                label="Vehicles reporting"
                value={liveLocations.length}
                meta={`${freshnessCounts.live} live • ${freshnessCounts.delayed} delayed • ${freshnessCounts.stale} stale`}
                tone={freshnessCounts.stale ? 'warning' : 'success'}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <KpiTile
                label="Newest recorded ping"
                value={lastUpdateLabel}
                meta={
                  newestTimestamp
                    ? new Date(newestTimestamp).toLocaleString()
                    : 'No telemetry timestamp available'
                }
                tone={freshnessCounts.live ? 'success' : 'warning'}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <KpiTile
                label="Fleet signal coverage"
                value={`${activeVehicles}/${totalVehicles}`}
                meta={
                  missingVehicles
                    ? `${missingVehicles} vehicle${missingVehicles === 1 ? '' : 's'} without a ping in the latest 60-minute window`
                    : 'Every configured vehicle has recent telemetry'
                }
                tone={missingVehicles ? 'warning' : 'success'}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid item xs={12} lg={8}>
              <SurfacePanel variant="command" sx={{ p: 0, overflow: 'hidden' }}>
                <Box
                  sx={{
                    p: 2.25,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    background:
                      'linear-gradient(180deg, rgba(21,18,16,0.96), rgba(30,26,23,0.92))',
                    '& .MuiTypography-root': { color: '#FFF8ED' },
                    '& .MuiTypography-body2': {
                      color: alpha('#FFF8ED', 0.72),
                    },
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    gap={1.5}
                  >
                    <Box>
                      <Typography variant="h4" sx={{ color: '#FFF8ED' }}>
                        Route trace
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: alpha('#FFF8ED', 0.72) }}
                      >
                        Solid is planned. Dotted is recorded telemetry.
                      </Typography>
                    </Box>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={traceMode}
                      onChange={(_, value: TraceMode | null) =>
                        value && setTraceMode(value)
                      }
                      aria-label="Route trace display"
                      sx={{
                        bgcolor: alpha('#000', 0.18),
                        '& .MuiToggleButton-root': {
                          color: alpha('#FFF8ED', 0.76),
                          borderColor: alpha('#FFF8ED', 0.28),
                          '&:hover': {
                            bgcolor: alpha('#FFF8ED', 0.08),
                          },
                          '&.Mui-selected': {
                            color: '#FFF8ED',
                            bgcolor: alpha(trovanColors.copper[500], 0.28),
                          },
                          '&.Mui-selected:hover': {
                            bgcolor: alpha(trovanColors.copper[500], 0.36),
                          },
                        },
                      }}
                    >
                      <ToggleButton value="planned">Planned</ToggleButton>
                      <ToggleButton value="actual">Actual</ToggleButton>
                      <ToggleButton value="both">Both</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                </Box>
                <Box
                  sx={{
                    height: { xs: 430, md: 560 },
                    minHeight: 420,
                    bgcolor: trovanColors.utility.mapCanvas,
                    position: 'relative',
                    '& .leaflet-tile-pane': { filter: activeMapLayer.tileFilter },
                  }}
                  className="trovan-map"
                >
                  <MapStyleToggle value={mapStyle} onChange={setMapStyle} />
                  <Box
                    sx={{
                      position: 'absolute',
                      zIndex: 520,
                      left: 12,
                      bottom: 12,
                      display: 'flex',
                      gap: 0.75,
                      p: 0.75,
                      borderRadius: 1,
                      bgcolor: alpha(trovanColors.black[950], 0.82),
                      pointerEvents: 'none',
                    }}
                  >
                    <StatusPill label="Planned" tone="info" />
                    <StatusPill label="Actual" tone="accent" />
                  </Box>
                  <MapContainer
                    attributionControl={false}
                    center={mapCenter}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      key={`${mapStyle}-base`}
                      url={activeMapLayer.url}
                      attribution={activeMapLayer.attribution}
                    />
                    {activeMapLayer.labelUrl ? (
                      <TileLayer
                        key={`${mapStyle}-labels`}
                        url={activeMapLayer.labelUrl}
                        opacity={activeMapLayer.labelOpacity ?? 0.82}
                        zIndex={280}
                      />
                    ) : null}
                    <TrackingMapViewport
                      positions={viewportPositions}
                      focusKey={`${selectedVehicleId}:${historyHours}:${traceMode}:${viewportPositions.length}`}
                    />
                    {(traceMode === 'planned' || traceMode === 'both') &&
                    plannedPositions.length > 1 ? (
                      <Polyline
                        positions={plannedPositions}
                        pathOptions={{
                          color: trovanColors.semantic.info,
                          opacity: 0.82,
                          weight: 5,
                        }}
                      />
                    ) : null}
                    {(traceMode === 'actual' || traceMode === 'both') &&
                    actualPositions.length > 1 ? (
                      <Polyline
                        className="tracking-actual-trace"
                        positions={actualPositions}
                        pathOptions={{
                          color: trovanColors.copper[500],
                          dashArray: '3 8',
                          lineCap: 'round',
                          opacity: 0.95,
                          weight: 5,
                        }}
                      />
                    ) : null}
                    {liveLocations.map((location) => {
                      const route = routeByVehicle.get(location.vehicleId);
                      const driver = route?.driverId
                        ? driverById.get(route.driverId)
                        : undefined;
                      const freshness = getTelemetryFreshness(
                        location.timestamp,
                        clockMs,
                      );
                      const isSelected = location.vehicleId === selectedVehicleId;
                      return (
                        <CircleMarker
                          key={location.vehicleId}
                          center={[location.latitude, location.longitude]}
                          radius={isSelected ? 10 : 7}
                          eventHandlers={{
                            click: () =>
                              setSelectedVehicleChoice(location.vehicleId),
                          }}
                          pathOptions={{
                            color: isSelected ? trovanColors.copper[200] : '#FFFFFF',
                            weight: isSelected ? 4 : 2,
                            fillColor: freshnessPresentation[freshness].color,
                            fillOpacity: 1,
                          }}
                        >
                          <Popup>
                            <strong>{fullDriverName(driver)}</strong>
                            <br />
                            Route {route?.id || 'unassigned'}
                            <br />
                            {location.vehicleInfo?.licensePlate ||
                              location.vehicleId}
                            <br />
                            {freshnessPresentation[freshness].label} ·{' '}
                            {formatTelemetryAge(location.timestamp, clockMs)}
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                    {selectedReplayPoint && historyPoints.length ? (
                      <CircleMarker
                        center={[
                          selectedReplayPoint.latitude,
                          selectedReplayPoint.longitude,
                        ]}
                        radius={6}
                        pathOptions={{
                          color: trovanColors.black[950],
                          weight: 2,
                          fillColor: trovanColors.copper[300],
                          fillOpacity: 1,
                        }}
                      >
                        <Popup>
                          Replay position
                          <br />
                          {new Date(
                            selectedReplayPoint.timestamp,
                          ).toLocaleString()}
                        </Popup>
                      </CircleMarker>
                    ) : null}
                  </MapContainer>
                  <MapFilmOverlay variant={mapStyle} />
                  {historyQuery.isFetching ? (
                    <LinearProgress
                      aria-label="Loading vehicle history"
                      sx={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: 600 }}
                    />
                  ) : null}
                </Box>
              </SurfacePanel>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Stack spacing={2.5}>
                <SurfacePanel>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1 }}
                  >
                    <Box>
                      <Typography variant="h4">Vehicles</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Attention-first by signal freshness
                      </Typography>
                    </Box>
                    <StatusPill
                      label={`${liveLocations.length} reporting`}
                      tone="info"
                    />
                  </Stack>
                  <List disablePadding>
                    {orderedLocations.map((location) => {
                      const route = routeByVehicle.get(location.vehicleId);
                      const driver = route?.driverId
                        ? driverById.get(route.driverId)
                        : undefined;
                      const freshness = getTelemetryFreshness(
                        location.timestamp,
                        clockMs,
                      );
                      return (
                        <ListItemButton
                          key={location.vehicleId}
                          selected={location.vehicleId === selectedVehicleId}
                          onClick={() =>
                            setSelectedVehicleChoice(location.vehicleId)
                          }
                          data-testid={`tracking-vehicle-${location.vehicleId}`}
                          sx={{
                            px: 1,
                            py: 1.1,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            alignItems: 'flex-start',
                          }}
                        >
                          <ListItemText
                            primary={
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                gap={1}
                              >
                                <Typography variant="subtitle2" noWrap>
                                  {fullDriverName(driver) === 'Driver pending'
                                    ? location.vehicleInfo?.licensePlate ||
                                      location.vehicleId
                                    : fullDriverName(driver)}
                                </Typography>
                                <StatusPill
                                  label={freshnessPresentation[freshness].label}
                                  tone={freshnessPresentation[freshness].tone}
                                />
                              </Stack>
                            }
                            secondary={`Route ${route?.id || 'unassigned'} • ${formatTelemetryAge(location.timestamp, clockMs)}`}
                            secondaryTypographyProps={{
                              sx: { mt: 0.45, fontSize: '0.76rem' },
                            }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </SurfacePanel>

                <SurfacePanel data-testid="tracking-history-controls">
                  <Stack spacing={1.7}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h4" noWrap>
                          {fullDriverName(selectedDriver) === 'Driver pending'
                            ? selectedLocation?.vehicleInfo?.licensePlate ||
                              selectedVehicleId
                            : fullDriverName(selectedDriver)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {selectedLocation?.vehicleInfo?.licensePlate ||
                            selectedVehicleId}{' '}
                          · Route {selectedRoute?.id || 'unassigned'}
                        </Typography>
                      </Box>
                      <StatusPill
                        label={freshnessPresentation[selectedFreshness].label}
                        tone={freshnessPresentation[selectedFreshness].tone}
                      />
                    </Stack>

                    <Stack
                      direction={{ xs: 'column', sm: 'row', lg: 'column', xl: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center', lg: 'flex-start', xl: 'center' }}
                      gap={1}
                    >
                      <Box>
                        <Typography variant="subtitle2">Recorded history</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {historyQuery.data?.source === 'preview'
                            ? 'Preview telemetry · synthetic demo only'
                            : 'Persisted vehicle telemetry'}
                        </Typography>
                      </Box>
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={historyHours}
                        onChange={(_, value: HistoryHours | null) =>
                          value && setHistoryHours(value)
                        }
                        aria-label="Telemetry history range"
                      >
                        <ToggleButton value={1}>1h</ToggleButton>
                        <ToggleButton value={6}>6h</ToggleButton>
                        <ToggleButton value={24}>24h</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>

                    {historyQuery.isError ? (
                      <Alert severity="error">
                        Trovan could not load this vehicle&apos;s telemetry history.
                        The latest recorded position remains visible.
                      </Alert>
                    ) : null}

                    {!historyQuery.isFetching && historyPoints.length === 0 ? (
                      <Alert severity="info">
                        No recorded telemetry for this vehicle in the last{' '}
                        {historyHours} hour{historyHours === 1 ? '' : 's'}. Trovan
                        will not infer a route trace from planned stops.
                      </Alert>
                    ) : null}

                    {historyPoints.length ? (
                      <>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap">
                          <StatusPill
                            label={`${historyPoints.length} pings`}
                            tone="info"
                          />
                          <StatusPill
                            label={`${historyDistanceKm.toFixed(1)} km recorded`}
                            tone="accent"
                          />
                          {historyQuery.data?.pointLimitReached ? (
                            <StatusPill
                              label={`${historyQuery.data.pointLimit}-point limit`}
                              tone="warning"
                            />
                          ) : null}
                        </Stack>

                        <Box>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Tooltip title={isPlaying ? 'Pause replay' : 'Play replay'}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={togglePlayback}
                                  disabled={historyPoints.length < 2}
                                  aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
                                >
                                  <Box
                                    component="span"
                                    aria-hidden
                                    sx={{ fontSize: isPlaying ? 15 : 17, lineHeight: 1 }}
                                  >
                                    {isPlaying ? 'Ⅱ' : '▶'}
                                  </Box>
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Slider
                              min={0}
                              max={Math.max(historyPoints.length - 1, 0)}
                              step={1}
                              value={Math.min(
                                replayIndex,
                                Math.max(historyPoints.length - 1, 0),
                              )}
                              onChange={(_, value) => {
                                setIsPlaying(false);
                                setReplayIndex(
                                  Array.isArray(value) ? value[0] : value,
                                );
                              }}
                              aria-label="Replay position"
                              data-testid="tracking-replay-slider"
                            />
                          </Stack>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            gap={1}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {new Date(
                                historyPoints[0].timestamp,
                              ).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ textAlign: 'right' }}
                            >
                              {selectedReplayPoint
                                ? `${new Date(selectedReplayPoint.timestamp).toLocaleString()}${
                                    typeof selectedReplayPoint.speed === 'number'
                                      ? ` · ${Math.round(selectedReplayPoint.speed)} km/h`
                                      : ''
                                  }`
                                : 'Position unavailable'}
                            </Typography>
                          </Stack>
                        </Box>
                      </>
                    ) : null}
                  </Stack>
                </SurfacePanel>

                <SurfacePanel variant="subtle">
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    Signal freshness
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <StatusPill
                      label={`${freshnessCounts.live} live ≤2m`}
                      tone="success"
                    />
                    <StatusPill
                      label={`${freshnessCounts.delayed} delayed ≤10m`}
                      tone="warning"
                    />
                    <StatusPill
                      label={`${freshnessCounts.stale} stale >10m`}
                      tone={freshnessCounts.stale ? 'danger' : 'default'}
                    />
                  </Stack>
                </SurfacePanel>
              </Stack>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
