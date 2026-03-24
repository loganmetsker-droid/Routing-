import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonChecked as RadioButtonCheckedIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Phone as PhoneIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Archive as ArchiveIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import {
  getRoutes,
  getDrivers,
  getVehicles,
  getJobs,
  updateJobStatus,
  assignDriverToRoute,
  getDispatchOptimizerHealth,
  OptimizerHealth,
} from '../services/api';
import { connectDispatchRealtime } from '../services/socket';
import ModuleHeader from '../components/ui/ModuleHeader';
import DetailTray from '../components/ui/DetailTray';
import StatusPill from '../components/ui/StatusPill';
import InfoCard from '../components/ui/InfoCard';
import {
  DispatchDriver as Driver,
  DispatchRoute as Route,
  DispatchVehicle as Vehicle,
} from '../types/dispatch';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface AlertItem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  routeId: string;
  timestamp: Date;
}

interface Job {
  id: string;
  customerName: string;
  deliveryAddress?: string;
  status: string;
  completedAt?: string;
  priority?: string;
}

const buildTrackingAlerts = (routes: Route[]): AlertItem[] => {
  const now = Date.now();
  const items: AlertItem[] = [];

  routes.forEach((route) => {
    if (!route?.id) return;

    if (route.dataQuality === 'degraded' || route.dataQuality === 'simulated') {
      items.push({
        id: `degraded-${route.id}`,
        severity: 'info',
        title: 'Degraded Telemetry',
        message: `Route ${route.id.slice(0, 8)} is marked ${route.dataQuality}.`,
        routeId: route.id,
        timestamp: new Date(),
      });
    }

    if (route.rerouteState === 'requested' || route.rerouteState === 'approved') {
      items.push({
        id: `reroute-${route.id}`,
        severity: 'warning',
        title: 'Reroute Pending',
        message: `Route ${route.id.slice(0, 8)} has reroute state '${route.rerouteState}'.`,
        routeId: route.id,
        timestamp: new Date(),
      });
    }

    if (route.exceptionCategory) {
      items.push({
        id: `exception-${route.id}`,
        severity: 'info',
        title: 'Exception Category',
        message: `Route ${route.id.slice(0, 8)} exception: ${route.exceptionCategory}.`,
        routeId: route.id,
        timestamp: new Date(),
      });
    }

    const advancedReasonCodes = route?.plannerDiagnostics?.advancedConstraints?.reasonCodes;
    if (Array.isArray(advancedReasonCodes) && advancedReasonCodes.length > 0) {
      items.push({
        id: `diagnostics-${route.id}`,
        severity: 'warning',
        title: 'Constraint Diagnostics',
        message: `Route ${route.id.slice(0, 8)} reason codes: ${advancedReasonCodes.slice(0, 2).join(', ')}`,
        routeId: route.id,
        timestamp: new Date(),
      });
    }

    if ((route.status === 'assigned' || route.status === 'in_progress') && !route.driverId) {
      items.push({
        id: `driver-missing-${route.id}`,
        severity: 'warning',
        title: 'Driver Missing',
        message: `Route ${route.id.slice(0, 8)} has no assigned driver.`,
        routeId: route.id,
        timestamp: new Date(),
      });
    }

    if (route.eta) {
      const etaTs = new Date(route.eta).getTime();
      if (!Number.isNaN(etaTs) && etaTs < now && route.status !== 'completed') {
        items.push({
          id: `late-${route.id}`,
          severity: 'warning',
          title: 'ETA Breached',
          message: `Route ${route.id.slice(0, 8)} is running past its ETA.`,
          routeId: route.id,
          timestamp: new Date(),
        });
      }
    }
  });

  return items;
};

export default function TrackingEnhanced() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [archiving, setArchiving] = useState<string | null>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedRouteForReassign, setSelectedRouteForReassign] = useState<Route | null>(null);
  const [newDriverId, setNewDriverId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [optimizerHealth, setOptimizerHealth] = useState<OptimizerHealth | null>(null);

  // Filter active routes
  const activeRoutes = routes.filter(
    (r) => r.status === 'assigned' || r.status === 'in_progress'
  );
  const reroutePendingCount = activeRoutes.filter(
    (r) => r.rerouteState === 'requested' || r.rerouteState === 'approved',
  ).length;

  // Filter completed jobs for today
  const completedJobsToday = jobs.filter((job) => {
    if (job.status !== 'completed') return false;
    if (!job.completedAt) return false;
    const completedDate = new Date(job.completedAt);
    const today = new Date();
    return (
      completedDate.getDate() === today.getDate() &&
      completedDate.getMonth() === today.getMonth() &&
      completedDate.getFullYear() === today.getFullYear()
    );
  });

  useEffect(() => {
    loadData();

    // Set up real-time updates every 30 seconds
    const interval = setInterval(() => {
      loadData();
      setLastUpdate(new Date());
    }, 30000);

    // SSE for real-time events
    const eventSource = connectDispatchRealtime((data) => {
      if (data.type === 'route-updated' || data.type === 'location-updated') {
        loadData();
      }
    });

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  const loadData = async () => {
    try {
      const [routesData, driversData, vehiclesData, jobsData] = await Promise.all([
        getRoutes(),
        getDrivers(),
        getVehicles(),
        getJobs(),
      ]);
      const healthData = await getDispatchOptimizerHealth();

      setRoutes(routesData);
      setDrivers(driversData);
      setVehicles(vehiclesData);
      setJobs(jobsData as any);
      setOptimizerHealth(healthData);

      setAlerts(buildTrackingAlerts(routesData));
    } catch (error) {
      console.error('Failed to load tracking data:', error);
    }
  };

  const getDriverName = (driverId?: string | null) => {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find((d) => d.id === driverId);
    return driver ? `${driver.firstName} ${driver.lastName}` : 'Unknown';
  };

  const getVehicleName = (vehicleId?: string | null) => {
    if (!vehicleId) return 'Unknown';
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    return vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown';
  };

  const getDriverIcon = (status?: string) => {
    const color = status === 'in_progress' ? '#4CAF50' : status === 'delayed' ? '#f44336' : '#FFA726';
    return L.divIcon({
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      className: '',
      iconSize: [24, 24],
    });
  };

  const handleDismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleArchiveJob = async (jobId: string) => {
    setArchiving(jobId);
    try {
      await updateJobStatus(jobId, 'archived');
      await loadData();
    } catch (error) {
      console.error('Failed to archive job:', error);
      alert('Failed to archive job');
    } finally {
      setArchiving(null);
    }
  };

  const handleArchiveAll = async () => {
    if (!confirm(`Archive all ${completedJobsToday.length} completed jobs?`)) return;

    try {
      await Promise.all(completedJobsToday.map((job) => updateJobStatus(job.id, 'archived')));
      await loadData();
    } catch (error) {
      console.error('Failed to archive jobs:', error);
      alert('Failed to archive some jobs');
    }
  };

  const handleReassignClick = (route: Route) => {
    setSelectedRouteForReassign(route);
    setNewDriverId('');
    setReassignDialogOpen(true);
  };

  const handleReassignDriver = async () => {
    if (!selectedRouteForReassign || !newDriverId) return;

    // Check for conflicts
    const targetDriver = drivers.find((d) => d.id === newDriverId);
    const driverCurrentRoute = routes.find((r) =>
      r.driverId === newDriverId &&
      (r.status === 'assigned' || r.status === 'in_progress')
    );

    if (driverCurrentRoute) {
      const confirm = window.confirm(
        `Driver ${targetDriver?.firstName} ${targetDriver?.lastName} is already assigned to Route ${driverCurrentRoute.id?.slice(0, 8)}. Reassign anyway?`
      );
      if (!confirm) return;
    }

    setReassigning(true);
    try {
      await assignDriverToRoute(selectedRouteForReassign.id!, newDriverId);
      setSnackbarMessage(`Route reassigned to ${targetDriver?.firstName} ${targetDriver?.lastName}`);
      setReassignDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Failed to reassign driver:', error);
      alert('Failed to reassign driver');
    } finally {
      setReassigning(false);
    }
  };

  const getAvailableDrivers = () => {
    const busyDriverIds = new Set(
      routes
        .filter((r) => r.status === 'assigned' || r.status === 'in_progress')
        .map((r) => r.driverId)
        .filter(Boolean)
    );

    return drivers.map((driver) => ({
      ...driver,
      isBusy: busyDriverIds.has(driver.id),
    }));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Grid container spacing={2.25}>
        <Grid item xs={12} lg={8}>
          <ModuleHeader
            title="Real-Time Tracking"
            subtitle={`Live route movement and exceptions. Last updated: ${lastUpdate.toLocaleTimeString()}${activeRoutes.some((route) => route.dataQuality && route.dataQuality !== 'live') ? ' • Degraded telemetry in active routes' : ''} • Optimizer: ${optimizerHealth?.status || 'unknown'}`}
            onRefresh={loadData}
          />
        </Grid>
        <Grid item xs={12} lg={4}>
          <DetailTray
            title="Live Status"
            subtitle="Monitoring stream"
            action={<StatusPill label="LIVE" color="#059669" />}
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <StatusPill label={`${alerts.length} alerts`} color={alerts.length > 0 ? '#d97706' : '#64748b'} />
              <StatusPill label={`${activeRoutes.length} active routes`} color="#84cc16" />
              <StatusPill
                label={`${reroutePendingCount} reroute pending`}
                color={reroutePendingCount > 0 ? '#d97706' : '#64748b'}
              />
              <StatusPill
                label={`Optimizer ${optimizerHealth?.status || 'unknown'}`}
                color={optimizerHealth?.status === 'healthy' ? '#059669' : optimizerHealth?.status === 'degraded' ? '#d97706' : '#dc2626'}
              />
            </Stack>
          </DetailTray>
        </Grid>
      </Grid>

      <Grid container spacing={2.25}>
        <Grid item xs={12} sm={4}>
          <InfoCard title="Active Routes" value={activeRoutes.length} subtitle="Assigned + in progress" statusLabel="Live" statusColor="#84cc16" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <InfoCard title="Active Alerts" value={alerts.length} subtitle="Exceptions and risks" statusLabel={alerts.length > 0 ? 'Attention' : 'Clear'} statusColor={alerts.length > 0 ? '#d97706' : '#64748b'} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <InfoCard title="Completed Today" value={completedJobsToday.length} subtitle="Jobs finished today" statusLabel="Archive Ready" statusColor="#2563eb" />
        </Grid>
      </Grid>

      <Grid container spacing={2.25}>
        <Grid item xs={12} lg={8}>
          <DetailTray
            title="Live Map"
            subtitle="Select a vehicle marker to inspect route details"
            height={680}
          >
            <Box sx={{ height: 560, borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <MapContainer center={[39.8283, -98.5795]} zoom={5} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                {activeRoutes.map((route, index) => {
                  const fallbackLocation: [number, number] = [
                    39.8283 + (((index * 7) % 9) - 4) * 1.15,
                    -98.5795 + (((index * 5) % 11) - 5) * 1.45,
                  ];
                  const location = route.currentLocation || fallbackLocation;
                  return (
                    <Marker
                      key={route.id}
                      position={location as [number, number]}
                      icon={getDriverIcon(route.status)}
                      eventHandlers={{ click: () => setSelectedRoute(route) }}
                    >
                      <Popup>
                        <Box>
                          <Typography variant="subtitle2">{getDriverName(route.driverId)}</Typography>
                          <Typography variant="caption">{getVehicleName(route.vehicleId)}</Typography>
                          <Typography variant="caption" display="block">
                            {route.completedStops || 0}/{route.totalStops || 0} stops
                          </Typography>
                        </Box>
                      </Popup>
                    </Marker>
                  );
                })}
                {selectedRoute && selectedRoute.path && (
                  <Polyline positions={selectedRoute.path} color="blue" weight={4} />
                )}
              </MapContainer>
            </Box>
          </DetailTray>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={2.25}>
            <DetailTray title="Alerts / Exceptions" subtitle={`${alerts.length} active`}>
              {alerts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No active alerts
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {alerts.map((alert) => (
                    <Alert key={alert.id} severity={alert.severity} onClose={() => handleDismissAlert(alert.id)}>
                      <AlertTitle>{alert.title}</AlertTitle>
                      {alert.message}
                    </Alert>
                  ))}
                </Stack>
              )}
            </DetailTray>

            <DetailTray title="Active Routes" subtitle="Click to focus on map and details">
              {activeRoutes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No active routes right now.
                </Typography>
              ) : (
                <List dense>
                  {activeRoutes.map((route) => (
                    <ListItem
                      key={route.id}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReassignClick(route);
                          }}
                          title="Reassign driver"
                        >
                          <SwapHorizIcon fontSize="small" />
                        </IconButton>
                      }
                      onClick={() => setSelectedRoute(route)}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: selectedRoute?.id === route.id ? 'primary.main' : 'divider',
                        mb: 1,
                      }}
                    >
                      <ListItemText
                        primary={getDriverName(route.driverId)}
                        secondary={`${getVehicleName(route.vehicleId)} • ${route.completedStops || 0}/${route.totalStops || 0} stops${
                          Array.isArray(route?.plannerDiagnostics?.advancedConstraints?.reasonCodes) &&
                          route.plannerDiagnostics.advancedConstraints.reasonCodes.length > 0
                            ? ` • ${route.plannerDiagnostics.advancedConstraints.reasonCodes[0]}`
                            : ''
                        }`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </DetailTray>
          </Stack>
        </Grid>
      </Grid>

      <DetailTray
        title="Selected Route Detail"
        subtitle={selectedRoute ? `Route ${selectedRoute.id?.slice(0, 8)}` : 'Pick an active route to inspect'}
      >
        {selectedRoute ? (
          <RouteDetailsPanel
            route={selectedRoute}
            driverName={getDriverName(selectedRoute.driverId)}
            vehicleName={getVehicleName(selectedRoute.vehicleId)}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select a driver marker on the map or an item from Active Routes.
          </Typography>
        )}
      </DetailTray>

      {completedJobsToday.length > 0 && (
        <DetailTray title="Completed Jobs" subtitle={`Today: ${completedJobsToday.length}`}>
          <Accordion elevation={0} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                <Typography variant="subtitle1">Completed Today ({completedJobsToday.length})</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ArchiveIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchiveAll();
                  }}
                >
                  Archive All
                </Button>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>Completed At</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {completedJobsToday.map((job) => (
                    <TableRow key={job.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>{job.customerName}</TableCell>
                      <TableCell>{job.deliveryAddress || 'N/A'}</TableCell>
                      <TableCell>
                        {job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.priority || 'normal'}
                          size="small"
                          color={job.priority === 'high' || job.priority === 'urgent' ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleArchiveJob(job.id)}
                          disabled={archiving === job.id}
                        >
                          <ArchiveIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        </DetailTray>
      )}

      {/* Reassign Driver Dialog */}
      <Dialog open={reassignDialogOpen} onClose={() => setReassignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SwapHorizIcon />
            <span>Reassign Driver</span>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedRouteForReassign && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Reassigning Route {selectedRouteForReassign.id?.slice(0, 8)} from{' '}
                <strong>{getDriverName(selectedRouteForReassign.driverId)}</strong>
              </Alert>
            </Box>
          )}

          <FormControl fullWidth>
            <InputLabel>New Driver</InputLabel>
            <Select
              value={newDriverId}
              label="New Driver"
              onChange={(e) => setNewDriverId(e.target.value)}
            >
              {getAvailableDrivers().map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <span>
                      {driver.firstName} {driver.lastName}
                    </span>
                    {driver.isBusy && (
                      <Chip label="Busy" size="small" color="warning" sx={{ ml: 'auto' }} />
                    )}
                    {!driver.isBusy && (
                      <Chip label="Available" size="small" color="success" sx={{ ml: 'auto' }} />
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {newDriverId && getAvailableDrivers().find((d) => d.id === newDriverId)?.isBusy && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This driver is already assigned to another active route. Reassigning may cause conflicts.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleReassignDriver}
            variant="contained"
            disabled={!newDriverId || reassigning}
            startIcon={reassigning && <CircularProgress size={16} />}
          >
            {reassigning ? 'Reassigning...' : 'Reassign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Box>
  );
}

// Route Details Panel Component
function RouteDetailsPanel({
  route,
  driverName,
  vehicleName,
}: {
  route: Route;
  driverName: string;
  vehicleName: string;
}) {
  const progress = route.totalStops
    ? ((route.completedStops || 0) / route.totalStops) * 100
    : 0;

  const totalStops = route.totalStops || route.jobIds?.length || 0;
  const completedStops = route.completedStops || 0;
  const hasDetailedStopTelemetry = false;
  const advancedConstraints = route?.plannerDiagnostics?.advancedConstraints || null;
  const feasibilityScore =
    typeof advancedConstraints?.feasibilityScore === 'number'
      ? advancedConstraints.feasibilityScore
      : null;
  const fallbackStops = Array.from({ length: totalStops }, (_, i) => ({
    id: route.jobIds?.[i] || `stop-${i}`,
    status:
      i < completedStops ? 'completed' : i === completedStops ? 'current' : 'pending',
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{driverName}</Typography>
        <StatusPill label={route.status} color="#2563eb" />
      </Box>

      {/* Progress Bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption">Route Progress</Typography>
          <Typography variant="caption">{progress.toFixed(0)}%</Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} />
        <Typography variant="caption" color="text.secondary">
          {route.completedStops || 0} of {route.totalStops || 0} stops completed
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Vehicle
          </Typography>
          <Typography variant="body2">{vehicleName}</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Distance
          </Typography>
          <Typography variant="body2">{route.totalDistance?.toFixed(1) || 0} km</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            ETA
          </Typography>
          <Typography variant="body2">
            {route.estimatedTimeRemaining
              ? `${Math.floor(route.estimatedTimeRemaining / 60)}h ${route.estimatedTimeRemaining % 60}m`
              : 'N/A'}
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Status
          </Typography>
          <Typography variant="body2">On Time</Typography>
        </Grid>
      </Grid>

      {advancedConstraints ? (
        <Alert severity={advancedConstraints.feasible ? 'info' : 'warning'} sx={{ mb: 2 }}>
          {feasibilityScore !== null ? `Feasibility score ${feasibilityScore}/100.` : 'Diagnostics available.'}
          {Array.isArray(advancedConstraints.reasonCodes) && advancedConstraints.reasonCodes.length > 0
            ? ` Reason codes: ${advancedConstraints.reasonCodes.slice(0, 3).join(', ')}.`
            : ''}
        </Alert>
      ) : null}

      {/* Stops List */}
      <Typography variant="subtitle2" gutterBottom>
        Stops
      </Typography>
      {!hasDetailedStopTelemetry && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Stop-level telemetry unavailable. Showing sequence placeholders.
        </Typography>
      )}
      <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
        {fallbackStops.map((stop, idx) => (
          <ListItem
            key={stop.id}
            sx={{
              opacity: stop.status === 'completed' ? 0.6 : 1,
              bgcolor: stop.status === 'current' ? 'action.selected' : 'transparent',
            }}
          >
            <ListItemIcon>
              {stop.status === 'completed' ? (
                <CheckCircleIcon color="success" />
              ) : stop.status === 'current' ? (
                <RadioButtonCheckedIcon color="primary" />
              ) : (
                <RadioButtonUncheckedIcon />
              )}
            </ListItemIcon>
            <ListItemText
              primary={`${idx + 1}. Stop ${idx + 1}`}
              secondary={
                <>
                  <Typography variant="caption" display="block">
                    Job ID: {stop.id}
                  </Typography>
                  {stop.status === 'completed' && (
                    <Typography variant="caption" color="success.main">
                      Completed
                    </Typography>
                  )}
                </>
              }
            />
          </ListItem>
        ))}
      </List>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button variant="outlined" size="small" startIcon={<PhoneIcon />} fullWidth>
          Contact
        </Button>
        <Button variant="outlined" size="small" startIcon={<EditIcon />} fullWidth>
          Modify
        </Button>
      </Box>
    </Box>
  );
}
