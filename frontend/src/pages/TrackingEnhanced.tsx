import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, Grid, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import { KpiTile } from '../components/KpiTile';
import LoadingState from '../components/ui/LoadingState';
import {
  getRoutes,
  getDrivers,
  getDispatchOptimizerHealth,
  getTrackingLocations,
  subscribeToTrackingLocations,
  type OptimizerHealth,
  type TrackingLocationsSnapshot,
} from '../services/api';

const STALE_SIGNAL_MS = 15 * 60 * 1000;

export default function TrackingEnhanced() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [optimizerHealth, setOptimizerHealth] = useState<OptimizerHealth | null>(null);
  const [trackingSnapshot, setTrackingSnapshot] = useState<TrackingLocationsSnapshot>({
    vehicles: [],
    timestamp: '',
    count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: () => void = () => {};

    const load = async () => {
      try {
        const [routesData, driversData, healthData, trackingData] = await Promise.all([
          getRoutes(),
          getDrivers(),
          getDispatchOptimizerHealth(),
          getTrackingLocations(),
        ]);
        if (!mounted) return;
        setRoutes(Array.isArray(routesData) ? routesData : []);
        setDrivers(Array.isArray(driversData) ? driversData : []);
        setOptimizerHealth(healthData);
        setTrackingSnapshot(trackingData);
        unsubscribe = subscribeToTrackingLocations((snapshot) => {
          if (mounted) {
            setTrackingSnapshot(snapshot);
          }
        });
      } catch (error) {
        console.error('Failed to load tracking', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const liveRoutes = useMemo(
    () => routes.filter((route) => ['assigned', 'in_progress', 'active', 'live'].includes(String(route.status).toLowerCase())),
    [routes],
  );
  const liveLocations = useMemo(
    () => trackingSnapshot.vehicles.filter((location) => liveRoutes.some((route) => route.vehicleId === location.vehicleId)),
    [liveRoutes, trackingSnapshot.vehicles],
  );
  const staleSignals = useMemo(
    () => liveLocations.filter((location) => Date.now() - new Date(location.timestamp).getTime() > STALE_SIGNAL_MS).length,
    [liveLocations],
  );
  const adherence = liveLocations.length ? Math.max(62, 100 - staleSignals * 12) : 0;
  const mapCenter: [number, number] = liveLocations.length
    ? [liveLocations[0].latitude, liveLocations[0].longitude]
    : [39.1, -94.58];
  const newestTimestamp = liveLocations
    .map((location) => new Date(location.timestamp).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0];
  const lastUpdateLabel = newestTimestamp
    ? new Date(newestTimestamp).toLocaleString()
    : 'No telemetry yet';

  if (loading) {
    return <LoadingState label="Loading tracking..." minHeight="50vh" />;
  }

  const emptyState = liveLocations.length === 0;

  return (
    <Box>
      <PageHeader
        eyebrow="Operations"
        title="Tracking"
        subtitle="Phone or device telemetry only. Live movement is shown from recorded signals, not synthetic map positions."
        actions={<Chip label={optimizerHealth?.status === 'healthy' ? 'System healthy' : 'Needs review'} color={optimizerHealth?.status === 'healthy' ? 'success' : 'warning'} />}
      />

      {emptyState ? (
        <SurfacePanel sx={{ py: 5, px: { xs: 2.5, md: 4 } }}>
          <Stack spacing={2.5} alignItems="flex-start" maxWidth={720}>
            <Chip label="Telemetry offline" color="warning" />
            <Box>
              <Typography variant="h3" sx={{ mb: 1 }}>No live telemetry connected</Typography>
              <Typography variant="body1" color="text.secondary">
                Tracking is now wired to the real telemetry service. Once vehicles start posting location pings, this page will show their latest positions and route context automatically.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.25} flexWrap="wrap">
              <Button component={RouterLink} to="/drivers" variant="contained">Review drivers</Button>
              <Button component={RouterLink} to="/vehicles" variant="outlined">Review vehicles</Button>
              <Button component={RouterLink} to="/settings" variant="outlined">Tracking setup</Button>
              <Button variant="text" onClick={() => setShowHowItWorks((current) => !current)}>View how tracking works</Button>
            </Stack>
            {showHowItWorks ? (
              <SurfacePanel sx={{ bgcolor: 'rgba(255, 248, 242, 1)' }}>
                <Typography variant="subtitle1">Tracking rollout</Typography>
                <Typography variant="body2" color="text.secondary">
                  1. Make sure vehicles and drivers are active. 2. Post GPS pings to `/api/tracking/ingest` from your mobile or device middleware using the assigned vehicle ID. 3. Dispatch published routes. 4. Review stale signals and route adherence here.
                </Typography>
              </SurfacePanel>
            ) : null}
          </Stack>
        </SurfacePanel>
      ) : (
        <>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid item xs={12} md={4}><KpiTile label="Vehicles live now" value={liveLocations.length} meta="Sending active telemetry" tone="success" /></Grid>
            <Grid item xs={12} md={4}><KpiTile label="Last update" value={lastUpdateLabel} meta={String(staleSignals) + ' stale signals need review'} tone={staleSignals ? 'warning' : 'success'} /></Grid>
            <Grid item xs={12} md={4}><KpiTile label="Route adherence" value={String(adherence) + '%'} meta="On-time confidence across live routes" tone={adherence < 80 ? 'warning' : 'success'} /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid item xs={12} lg={8}>
              <SurfacePanel sx={{ p: 0, overflow: 'hidden' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h5">Live Positioning</Typography>
                  <Typography variant="body2" color="text.secondary">Latest persisted vehicle telemetry with route context.</Typography>
                </Box>
                <Box sx={{ height: 500 }}>
                  <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap contributors &copy; CARTO" />
                    {liveLocations.map((location) => {
                      const route = liveRoutes.find((item) => item.vehicleId === location.vehicleId);
                      const driver = drivers.find((item) => item.id === route?.driverId);
                      const isStale = Date.now() - new Date(location.timestamp).getTime() > STALE_SIGNAL_MS;
                      return (
                        <CircleMarker
                          key={location.vehicleId}
                          center={[location.latitude, location.longitude]}
                          radius={9}
                          pathOptions={{
                            color: '#FFFFFF',
                            weight: 2,
                            fillColor: isStale ? '#B8781C' : '#2F7D5B',
                            fillOpacity: 1,
                          }}
                        >
                          <Popup>
                            <strong>{driver ? driver.firstName + ' ' + driver.lastName : 'Driver pending'}</strong>
                            <br />
                            Route {route?.id || 'unassigned'}
                            <br />
                            {location.vehicleInfo?.licensePlate || location.vehicleId}
                            <br />
                            Last ping: {new Date(location.timestamp).toLocaleTimeString()}
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </Box>
              </SurfacePanel>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Stack spacing={2.5}>
                <SurfacePanel>
                  <Typography variant="h5" sx={{ mb: 1 }}>Live Routes</Typography>
                  <List disablePadding>
                    {liveLocations.map((location) => {
                      const route = liveRoutes.find((item) => item.vehicleId === location.vehicleId);
                      const driver = drivers.find((item) => item.id === route?.driverId);
                      return (
                        <ListItem key={location.vehicleId} disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                          <ListItemText
                            primary={driver ? driver.firstName + ' ' + driver.lastName : (location.vehicleInfo?.licensePlate || 'Vehicle pending')}
                            secondary={'Route: ' + (route?.id || 'unassigned') + ' • Last ping: ' + new Date(location.timestamp).toLocaleTimeString()}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </SurfacePanel>
                <SurfacePanel>
                  <Typography variant="h6" sx={{ mb: 1 }}>Signal Quality</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip label={String(staleSignals) + ' stale'} color={staleSignals ? 'warning' : 'success'} variant="outlined" />
                    <Chip label={String(Math.max(liveLocations.length - staleSignals, 0)) + ' healthy'} color="success" variant="outlined" />
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
