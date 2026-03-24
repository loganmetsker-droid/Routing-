import { useState, useEffect } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Checkbox,
  Paper,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  AutoAwesome,
  Refresh,
  PlayArrow,
  ErrorOutline,
  CheckCircle,
  LocalShipping,
  Route as RouteIcon,
  Person,
} from '@mui/icons-material';
import {
  getJobs,
  getRoutes,
  getVehicles,
  getDrivers,
  getDispatchOptimizerHealth,
  getRerouteHistory,
  getDispatchTimeline,
  requestReroute,
  approveReroute,
  rejectReroute,
  applyReroute,
  previewReroute,
  assignDriverToRoute,
  startRoute,
  generateRoute,
  updateRoute,
  reorderRouteStops,
  OptimizerHealth,
  RerouteRequest,
  DispatchTimelineEvent,
  ReroutePreview,
} from '../services/api';
import { connectDispatchRealtime } from '../services/socket';
import VehicleRouteCard from '../components/dispatch/VehicleRouteCard';
import LiveStatusColumn from '../components/dispatch/LiveStatusColumn';
import ModuleHeader from '../components/ui/ModuleHeader';
import DetailTray from '../components/ui/DetailTray';
import MapPanel from '../components/map/MapPanel';
import StatusPill from '../components/ui/StatusPill';
import {
  DISPATCH_PLANNER_SELECTION_KEY,
  DispatchDriver as Driver,
  DispatchJob as Job,
  DispatchPlannerSelection,
  DispatchRoute as Route,
  DispatchVehicle as Vehicle,
} from '../types/dispatch';

const ROUTE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#95E1D3',
  '#F38181', '#7FDBFF', '#B4A7D6', '#FFD93D', '#6BCF7F', '#FF9F1C',
];

interface DriverSuggestion extends Driver {
  available: boolean;
  currentJobCount: number;
  score: number;
  reason: string;
}

type FeedbackSeverity = 'success' | 'info' | 'warning' | 'error';

// ==================== MAIN COMPONENT ====================

export default function DispatchUnifiedV2() {
  const theme = useTheme();
  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [optimizingRouteId, setOptimizingRouteId] = useState<string | null>(null);
  const [dispatchingRouteId, setDispatchingRouteId] = useState<string | null>(null);
  const [selectedRouteDetailId, setSelectedRouteDetailId] = useState<string | null>(null);
  const [plannerSource, setPlannerSource] = useState<'jobs' | 'dispatch' | null>(null);
  const [plannerSelectionRestored, setPlannerSelectionRestored] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    severity: FeedbackSeverity;
  } | null>(null);
  const [optimizerHealth, setOptimizerHealth] = useState<OptimizerHealth | null>(null);
  const [reviewedRouteIds, setReviewedRouteIds] = useState<string[]>([]);
  const [rerouteDialogOpen, setRerouteDialogOpen] = useState(false);
  const [rerouteSubmitting, setRerouteSubmitting] = useState(false);
  const [rerouteHistory, setRerouteHistory] = useState<RerouteRequest[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<DispatchTimelineEvent[]>([]);
  const [rerouteCategory, setRerouteCategory] = useState('traffic_delay');
  const [rerouteAction, setRerouteAction] = useState('reorder_stops');
  const [rerouteReason, setRerouteReason] = useState('');
  const [constraintPackId, setConstraintPackId] = useState<'generic' | 'construction_concrete'>('generic');
  const [overrideRequested, setOverrideRequested] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [reroutePreview, setReroutePreview] = useState<ReroutePreview | null>(null);

  // Dialogs
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [selectedRouteForDriver, setSelectedRouteForDriver] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // ==================== DATA LOADING ====================

  useEffect(() => {
    loadData();
    const eventSource = connectDispatchRealtime((event) => {
      if (event.type === 'job-updated' || event.type === 'route-updated') {
        loadData();
      }
    });
    return () => eventSource?.close();
  }, []);

  const showFeedback = (message: string, severity: FeedbackSeverity = 'info') => {
    setFeedback({ message, severity });
  };

  const loadData = async () => {
    try {
      const [jobsData, routesData, vehiclesData, driversData] = await Promise.all([
        getJobs(),
        getRoutes(),
        getVehicles(),
        getDrivers(),
      ]);
      const healthData = await getDispatchOptimizerHealth();
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setRoutes(Array.isArray(routesData) ? routesData : []);
      setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setOptimizerHealth(healthData);
    } catch (error) {
      console.error('Failed to load data:', error);
      setJobs([]);
      setRoutes([]);
      setVehicles([]);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  };

  // ==================== COMPUTED DATA ====================

  const unassignedJobs = jobs.filter((job) => job.status === 'pending' && !job.assignedRouteId);

  const activeRoutes = routes.filter(
    (route) => route.status !== 'completed' && route.status !== 'cancelled'
  );

  const availableVehicles = vehicles.filter((vehicle) => {
    const assignedRoute = activeRoutes.find((route) => route.vehicleId === vehicle.id);
    const isAvailableStatus =
      vehicle.status === 'available' || vehicle.status === 'AVAILABLE';
    return isAvailableStatus && !assignedRoute;
  });

  const readyToDispatchRoutes = activeRoutes.filter(
    (route) =>
      (route.status === 'planned' || route.status === 'assigned') &&
      route.vehicleId &&
      route.driverId &&
      route.jobIds &&
      route.jobIds.length > 0
  );

  const optimizerHealthColor =
    optimizerHealth?.status === 'healthy'
      ? '#059669'
      : optimizerHealth?.status === 'degraded'
      ? '#d97706'
      : '#dc2626';

  useEffect(() => {
    if (selectedRouteDetailId && activeRoutes.some((route) => route.id === selectedRouteDetailId)) {
      return;
    }
    setSelectedRouteDetailId(activeRoutes[0]?.id || null);
  }, [activeRoutes, selectedRouteDetailId]);

  useEffect(() => {
    if (selectedVehicleId && availableVehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      return;
    }

    setSelectedVehicleId(availableVehicles[0]?.id || '');
  }, [availableVehicles, selectedVehicleId]);

  useEffect(() => {
    if (plannerSelectionRestored || loading) {
      return;
    }

    const rawSelection = sessionStorage.getItem(DISPATCH_PLANNER_SELECTION_KEY);

    if (!rawSelection) {
      setPlannerSelectionRestored(true);
      return;
    }

    try {
      const parsed = JSON.parse(rawSelection) as DispatchPlannerSelection;
      const validJobIds = parsed.selectedJobIds.filter((jobId) =>
        unassignedJobs.some((job) => job.id === jobId),
      );

      if (validJobIds.length > 0) {
        setSelectedJobIds(validJobIds);
        setPlannerSource(parsed.source || 'dispatch');
        showFeedback(
          `Loaded ${validJobIds.length} job${validJobIds.length === 1 ? '' : 's'} from Jobs into the planner.`,
          'success',
        );
      }
    } catch (error) {
      console.error('Failed to restore dispatch planner selection:', error);
    } finally {
      sessionStorage.removeItem(DISPATCH_PLANNER_SELECTION_KEY);
      setPlannerSelectionRestored(true);
    }
  }, [loading, plannerSelectionRestored, unassignedJobs]);

  // ==================== CONFLICT DETECTION ====================

  interface RouteConflict {
    routeId: string;
    type: 'driver' | 'vehicle';
    severity: 'high' | 'medium';
    message: string;
  }

  const detectConflicts = (): RouteConflict[] => {
    const conflicts: RouteConflict[] = [];

    // Check for driver conflicts
    const driverRouteMap = new Map<string, string[]>();
    activeRoutes.forEach((route) => {
      if (route.driverId) {
        if (!driverRouteMap.has(route.driverId)) {
          driverRouteMap.set(route.driverId, []);
        }
        driverRouteMap.get(route.driverId)!.push(route.id);
      }
    });

    driverRouteMap.forEach((routeIds, driverId) => {
      if (routeIds.length > 1) {
        const driver = drivers.find((d) => d.id === driverId);
        conflicts.push({
          routeId: routeIds[0],
          type: 'driver',
          severity: 'high',
          message: `Driver ${driver?.firstName} ${driver?.lastName} assigned to ${routeIds.length} routes`,
        });
      }
    });

    // Check for vehicle conflicts
    const vehicleRouteMap = new Map<string, string[]>();
    activeRoutes.forEach((route) => {
      if (route.vehicleId) {
        if (!vehicleRouteMap.has(route.vehicleId)) {
          vehicleRouteMap.set(route.vehicleId, []);
        }
        vehicleRouteMap.get(route.vehicleId)!.push(route.id);
      }
    });

    vehicleRouteMap.forEach((routeIds, vehicleId) => {
      if (routeIds.length > 1) {
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        conflicts.push({
          routeId: routeIds[0],
          type: 'vehicle',
          severity: 'high',
          message: `Vehicle ${vehicle?.licensePlate} assigned to ${routeIds.length} routes`,
        });
      }
    });

    return conflicts;
  };

  const conflicts = detectConflicts();

  // ==================== AUTO-ASSIGN LOGIC ====================

  const handleCreatePlannedRoute = async () => {
    if (selectedJobIds.length === 0) {
      showFeedback('Select at least one job before creating a route.', 'warning');
      return;
    }

    if (!selectedVehicleId) {
      showFeedback('Choose an available vehicle for this route.', 'warning');
      return;
    }

    setAutoAssigning(true);
    try {
      const response = await generateRoute(selectedVehicleId, selectedJobIds);
      const newRoute = (response as any).route || response;
      const plannedJobIds =
        Array.isArray(newRoute.jobIds) && newRoute.jobIds.length > 0
          ? newRoute.jobIds
          : selectedJobIds;

      await reorderRouteStops(newRoute.id, plannedJobIds);

      setSelectedJobIds([]);
      setPlannerSource('dispatch');
      await loadData();
      setSelectedRouteForDriver(newRoute.id);
      setSelectedDriverId('');
      setAssignDriverDialogOpen(true);
      showFeedback(
        'Route created. Assign a driver to move it into the ready lane.',
        'success',
      );
    } catch (error) {
      console.error('Route creation failed:', error);
      showFeedback('Failed to create the planned route.', 'error');
    } finally {
      setAutoAssigning(false);
    }
  };

  // ==================== OPTIMIZATION LOGIC ====================

  const handleOptimizeRoute = async (routeId: string) => {
    setOptimizingRouteId(routeId);
    try {
      const route = routes.find((r) => r.id === routeId);
      if (!route || !route.vehicleId || !route.jobIds || route.jobIds.length === 0) {
        throw new Error('Invalid route');
      }

      await reorderRouteStops(routeId, route.jobIds);

      await loadData();
    } catch (error) {
      console.error('Optimization failed:', error);
      showFeedback('Failed to optimize route.', 'error');
    } finally {
      setOptimizingRouteId(null);
    }
  };

  // ==================== DRIVER ASSIGNMENT ====================

  const getSuggestedDrivers = (_route: Route): DriverSuggestion[] => {
    const routeDriverAssignments = routes
      .filter((r) => r.status !== 'completed' && r.status !== 'cancelled')
      .reduce((acc, r) => {
        if (r.driverId) acc[r.driverId] = (acc[r.driverId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return drivers
      .filter((d) => d.status === 'active' || d.status === 'available' || d.status === 'ACTIVE')
      .map((d) => {
        const currentJobCount = routeDriverAssignments[d.id] || 0;
        const available = currentJobCount === 0;
        const hoursOk = !d.maxHours || (d.currentHours || 0) < d.maxHours;

        let score = 100;
        let reason = 'Available';

        if (!available) {
          score -= 30;
          reason = `Already assigned (${currentJobCount} routes)`;
        }
        if (!hoursOk) {
          score -= 50;
          reason = 'Near max hours';
        }

        score -= currentJobCount * 10;

        return {
          ...d,
          available,
          currentJobCount,
          score,
          reason,
        };
      })
      .sort((a, b) => b.score - a.score);
  };

  const handleAssignDriverClick = (routeId: string) => {
    setSelectedRouteForDriver(routeId);
    setAssignDriverDialogOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedRouteForDriver || !selectedDriverId) return;

    try {
      await assignDriverToRoute(selectedRouteForDriver, selectedDriverId);
      await updateRoute(selectedRouteForDriver, { status: 'assigned' });
      setAssignDriverDialogOpen(false);
      setSelectedDriverId('');
      setSelectedRouteForDriver(null);
      await loadData();
      showFeedback('Driver assigned. The route is now ready to dispatch.', 'success');
    } catch (error) {
      console.error('Driver assignment failed:', error);
      showFeedback('Failed to assign driver.', 'error');
    }
  };

  const handleRemoveDriver = async (routeId: string) => {
    try {
      await updateRoute(routeId, { driverId: null, status: 'planned' });
      await loadData();
      showFeedback('Driver removed. Route moved back to planned.', 'info');
    } catch (error) {
      console.error('Remove driver failed:', error);
      showFeedback('Failed to remove driver.', 'error');
    }
  };

  // ==================== DISPATCH ====================

  const handleDispatch = async (routeId: string) => {
    if (!reviewedRouteIds.includes(routeId)) {
      showFeedback('Review route warnings/details before dispatching.', 'warning');
      return;
    }
    setDispatchingRouteId(routeId);
    try {
      await startRoute(routeId);
      await loadData();
      showFeedback('Route dispatched successfully.', 'success');
    } catch (error) {
      console.error('Dispatch failed:', error);
      showFeedback('Failed to dispatch route.', 'error');
    } finally {
      setDispatchingRouteId(null);
    }
  };

  // ==================== JOB SELECTION ====================

  const handleJobToggle = (jobId: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleSelectAllJobs = () => {
    if (selectedJobIds.length === unassignedJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(unassignedJobs.map((j) => j.id));
    }
  };

  // ==================== MAP COMPUTATION ====================

  const mapRoutes = activeRoutes.map((route, index) => {
    const assignedVehicle = vehicles.find((v) => v.id === route.vehicleId);
    const routeId = typeof route.id === 'string' ? route.id : String(route.id ?? `route-${index}`);

    // Use stable fallback positions until backend geometry is available.
    const positions = route.optimizedStops && route.optimizedStops.length > 0
      ? route.optimizedStops.map((stop, i) => ({
        lat: 39.0997 + (i * 0.012) + (((index * 7 + i * 3) % 9) - 4) * 0.004,
        lng: -94.5786 + (i * 0.01) + (((index * 5 + i * 2) % 7) - 3) * 0.004,
        address: stop.address
      }))
      : [];

    return {
      id: routeId,
      positions: positions,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
      status: String(route.status || 'planned'),
      vehicle: `${assignedVehicle?.make || ''} ${assignedVehicle?.model || ''}`.trim() || 'Unassigned',
      vehiclePlate: assignedVehicle?.licensePlate || 'N/A',
      totalDistance: Number(route.totalDistance || 0),
      stopCount: positions.length,
      simulatedGeometry: route.dataQuality === 'simulated',
    };
  });

  const usingSimulatedGeometry = mapRoutes.some((route) => route.simulatedGeometry);
  const usingDegradedQuality = activeRoutes.some((route) => route.dataQuality === 'degraded');

  const mapCenter: [number, number] = mapRoutes.length > 0 && mapRoutes[0].positions.length > 0
    ? [mapRoutes[0].positions[0].lat, mapRoutes[0].positions[0].lng]
    : [39.0997, -94.5786];

  const mapZoom = mapRoutes.length > 0 ? 12 : 10;

  // ==================== RENDER ====================

  const selectedRoute = selectedRouteForDriver
    ? routes.find((r) => r.id === selectedRouteForDriver)
    : null;
  const suggestedDrivers = selectedRoute ? getSuggestedDrivers(selectedRoute) : [];
  const selectedRouteDetail = selectedRouteDetailId
    ? activeRoutes.find((route) => route.id === selectedRouteDetailId) || null
    : null;
  const selectedRouteLabel = selectedRouteDetail
    ? String(selectedRouteDetail.id ?? 'unknown').slice(0, 8)
    : '';
  const selectedRouteStatus = String(selectedRouteDetail?.status || 'planned');
  const selectedRouteDistanceKm = Number(selectedRouteDetail?.totalDistance || 0);
  const selectedRouteJobIds = Array.isArray(selectedRouteDetail?.jobIds) ? selectedRouteDetail.jobIds : [];
  const selectedRouteVehicle = selectedRouteDetail
    ? vehicles.find((vehicle) => vehicle.id === selectedRouteDetail.vehicleId) || null
    : null;
  const selectedRouteDriver = selectedRouteDetail
    ? drivers.find((driver) => driver.id === selectedRouteDetail.driverId) || null
    : null;
  const selectedRouteJobs = selectedRouteDetail
    ? jobs.filter((job) => selectedRouteJobIds.includes(job.id))
    : [];
  const routeIsReady = Boolean(
    selectedRouteDetail &&
      (selectedRouteDetail.status === 'planned' || selectedRouteDetail.status === 'assigned') &&
      selectedRouteDetail.vehicleId &&
      selectedRouteDetail.driverId &&
      selectedRouteDetail.jobIds?.length,
  );
  const routeNeedsRerouteResolution = Boolean(
    selectedRouteDetail &&
      (selectedRouteDetail.rerouteState === 'requested' ||
        selectedRouteDetail.rerouteState === 'approved'),
  );
  const routeIsReviewed = Boolean(
    selectedRouteDetail && reviewedRouteIds.includes(selectedRouteDetail.id),
  );
  const panelSx = {
    borderRadius: 4,
    border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.88 : 0.95),
    boxShadow: `0 12px 22px -22px ${alpha(theme.palette.common.black, 0.28)}`,
  };
  const panelBodySx = {
    flex: 1,
    overflow: 'auto',
    pr: 0.5,
    mr: -0.5,
    minHeight: 0,
    '&::-webkit-scrollbar': { width: '8px' },
    '&::-webkit-scrollbar-thumb': {
      bgcolor: alpha(theme.palette.text.primary, 0.14),
      borderRadius: '999px',
    },
  };
  const scrollAreaSx = {
    ...panelBodySx,
  };
  const emptyStateSx = {
    textAlign: 'center',
    py: 6,
    px: 3,
    border: `1.5px dashed ${alpha(theme.palette.text.primary, 0.14)}`,
    borderRadius: '18px',
    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.76 : 0.72),
  };
  const selectedVehicle = availableVehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const latestRerouteRequest = rerouteHistory[0] || null;

  useEffect(() => {
    const loadRerouteHistory = async () => {
      if (!selectedRouteDetailId) {
        setRerouteHistory([]);
        setTimelineEvents([]);
        return;
      }
      const history = await getRerouteHistory(selectedRouteDetailId);
      const events = await getDispatchTimeline({
        routeId: selectedRouteDetailId,
        limit: 20,
        source: 'reroute',
      });
      setRerouteHistory(history);
      setTimelineEvents(events);
    };
    loadRerouteHistory();
  }, [selectedRouteDetailId, routes]);

  const handleRequestReroute = async () => {
    if (!selectedRouteDetail) return;
    if (!rerouteReason.trim()) {
      showFeedback('Provide a reason before requesting reroute.', 'warning');
      return;
    }
    setRerouteSubmitting(true);
    try {
      await requestReroute(selectedRouteDetail.id, {
        exceptionCategory: rerouteCategory,
        action: rerouteAction,
        reason: rerouteReason.trim(),
        requesterId: 'dispatcher-ui',
        requestPayload: buildPreviewPayload(),
      });
      setRerouteDialogOpen(false);
      setRerouteReason('');
      setConstraintPackId('generic');
      setReroutePreview(null);
      await loadData();
      showFeedback('Reroute request submitted for approval.', 'success');
    } catch (error) {
      console.error('Failed to request reroute:', error);
      showFeedback('Failed to request reroute.', 'error');
    } finally {
      setRerouteSubmitting(false);
    }
  };

  const handleApproveReroute = async () => {
    if (!selectedRouteDetail || !latestRerouteRequest) return;
    try {
      await approveReroute(selectedRouteDetail.id, latestRerouteRequest.id, {
        reviewerId: 'dispatcher-ui',
      });
      await loadData();
      showFeedback('Reroute request approved.', 'success');
    } catch (error) {
      console.error('Failed to approve reroute:', error);
      showFeedback('Failed to approve reroute.', 'error');
    }
  };

  const handleRejectReroute = async () => {
    if (!selectedRouteDetail || !latestRerouteRequest) return;
    try {
      await rejectReroute(selectedRouteDetail.id, latestRerouteRequest.id, {
        reviewerId: 'dispatcher-ui',
      });
      await loadData();
      showFeedback('Reroute request rejected.', 'info');
    } catch (error) {
      console.error('Failed to reject reroute:', error);
      showFeedback('Failed to reject reroute.', 'error');
    }
  };

  const handleApplyReroute = async () => {
    if (!selectedRouteDetail || !latestRerouteRequest) return;
    try {
      await applyReroute(selectedRouteDetail.id, latestRerouteRequest.id, {
        appliedBy: 'dispatcher-ui',
        appliedPayload: buildPreviewPayload(),
        overrideRequested,
        overrideReason: overrideRequested ? overrideReason.trim() : undefined,
        overrideActor: overrideRequested ? 'dispatcher-ui' : undefined,
        overrideActorRole: overrideRequested ? 'dispatcher' : undefined,
      });
      setOverrideRequested(false);
      setOverrideReason('');
      await loadData();
      showFeedback(
        overrideRequested ? 'Reroute override applied and audited.' : 'Reroute applied and logged.',
        'success',
      );
    } catch (error) {
      console.error('Failed to apply reroute:', error);
      const message = error instanceof Error ? error.message : 'Failed to apply reroute.';
      if (message.toLowerCase().includes('override denied by policy')) {
        showFeedback(message, 'warning');
      } else {
        showFeedback(message, 'error');
      }
    }
  };

  const buildPreviewPayload = () => {
    if (!selectedRouteDetail) return {};
    const firstJobId = selectedRouteDetail.jobIds?.[0];
    const withPack = (payload: Record<string, any>) =>
      constraintPackId === 'construction_concrete'
        ? { ...payload, constraintPackId: 'construction_concrete' }
        : payload;
    if (rerouteAction === 'reorder_stops') {
      return withPack({ newJobOrder: [...(selectedRouteDetail.jobIds || [])].reverse() });
    }
    if (rerouteAction === 'split_route') {
      return withPack({
        splitAtIndex: Math.max(1, Math.floor((selectedRouteDetail.jobIds?.length || 2) / 2)),
      });
    }
    if (
      (rerouteAction === 'remove_stop' ||
        rerouteAction === 'hold_stop' ||
        rerouteAction === 'reassign_stop_to_route') &&
      firstJobId
    ) {
      if (rerouteAction === 'reassign_stop_to_route') {
        const targetRoute = activeRoutes.find((route) => route.id !== selectedRouteDetail.id);
        return targetRoute
          ? withPack({ jobId: firstJobId, targetRouteId: targetRoute.id })
          : withPack({ jobId: firstJobId });
      }
      return withPack({ jobId: firstJobId });
    }
    if (rerouteAction === 'reassign_driver') {
      const fallbackDriverId = drivers[0]?.id;
      return fallbackDriverId ? withPack({ driverId: fallbackDriverId }) : withPack({});
    }
    return withPack({});
  };

  useEffect(() => {
    const loadPreview = async () => {
      if (!rerouteDialogOpen || !selectedRouteDetail) {
        setReroutePreview(null);
        return;
      }
      const preview = await previewReroute(selectedRouteDetail.id, {
        action: rerouteAction,
        payload: buildPreviewPayload(),
      });
      setReroutePreview(preview);
    };
    loadPreview();
  }, [rerouteDialogOpen, selectedRouteDetail, rerouteAction, drivers, constraintPackId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Grid container spacing={2.25}>
        <Grid item xs={12} lg={8}>
          <ModuleHeader
            title="Dispatch Board"
            subtitle={`Unassigned jobs, route planning, ready lane, and live map in one command-center view. Optimizer: ${optimizerHealth?.status || 'unknown'}.`}
            onRefresh={loadData}
          />
        </Grid>
        <Grid item xs={12} lg={4}>
          <DetailTray
            title="Planner Controls"
            subtitle="Select a vehicle and create a planned route."
            sx={panelSx}
            action={
              <StatusPill
                label={`${readyToDispatchRoutes.length} ready`}
                color={readyToDispatchRoutes.length > 0 ? '#059669' : '#64748b'}
              />
            }
          >
            <Stack spacing={1.25}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Vehicle</InputLabel>
                <Select
                  value={selectedVehicleId}
                  label="Select Vehicle"
                  onChange={(event) => setSelectedVehicleId(event.target.value)}
                >
                  {availableVehicles.map((vehicle) => (
                    <MenuItem key={vehicle.id} value={vehicle.id}>
                      {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'} · {vehicle.licensePlate || 'No plate'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={autoAssigning ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                  onClick={handleCreatePlannedRoute}
                  disabled={selectedJobIds.length === 0 || !selectedVehicleId || autoAssigning}
                >
                  Create Planned Route
                </Button>
                <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={loadData}>
                  Refresh
                </Button>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <StatusPill label={`${selectedJobIds.length} selected`} color="#2563eb" />
                <StatusPill label={`${availableVehicles.length} open`} color="#4f46e5" />
                <StatusPill
                  label={`Optimizer ${optimizerHealth?.status || 'unknown'}`}
                  color={optimizerHealthColor}
                />
                {plannerSource === 'jobs' && selectedJobIds.length > 0 ? (
                  <StatusPill label="Loaded from Jobs" color="#8b5cf6" />
                ) : null}
              </Stack>
            </Stack>
          </DetailTray>
        </Grid>
      </Grid>

      {conflicts.length > 0 && (
        <Paper elevation={0} sx={{ ...panelSx, p: 2, borderColor: alpha(theme.palette.error.main, 0.36) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
              <ErrorOutline sx={{ color: 'error.main', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
              </Typography>
              {conflicts.slice(0, 2).map((conflict, idx) => (
                <StatusPill key={`${conflict.routeId}-${idx}`} label={conflict.message} color="#dc2626" />
              ))}
            </Box>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() =>
                showFeedback(
                  'Resolve duplicate driver or vehicle assignments before dispatching these routes.',
                  'warning',
                )
              }
            >
              Review
            </Button>
          </Box>
        </Paper>
      )}

      <Grid container spacing={2.25} alignItems="stretch">
        <Grid item xs={12} lg={3}>
          <DetailTray
            title="Unassigned Jobs"
            subtitle="Open jobs waiting to be planned"
            sx={{ ...panelSx, display: 'flex', flexDirection: 'column', height: { xs: 'auto', lg: 740 } }}
            action={
              <Checkbox
                size="small"
                checked={selectedJobIds.length === unassignedJobs.length && unassignedJobs.length > 0}
                indeterminate={selectedJobIds.length > 0 && selectedJobIds.length < unassignedJobs.length}
                onChange={handleSelectAllJobs}
              />
            }
          >
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <StatusPill label={`${unassignedJobs.length} open`} color="#2563eb" />
              <StatusPill
                label={selectedVehicle ? `${selectedVehicle.licensePlate || 'Vehicle'} ready` : 'Vehicle needed'}
                color={selectedVehicle ? '#059669' : '#d97706'}
              />
            </Stack>
            <Box sx={scrollAreaSx}>
              {unassignedJobs.length === 0 ? (
                <Box sx={emptyStateSx}>
                  <CheckCircle sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                    Queue is clear
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    All dispatchable jobs are already routed or in progress.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.25}>
                  {unassignedJobs.map((job) => {
                    const selected = selectedJobIds.includes(job.id);
                    const priority = job.priority || 'normal';
                    return (
                      <Card
                        key={job.id}
                        elevation={0}
                        onClick={() => handleJobToggle(job.id)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: alpha(theme.palette.background.paper, 0.85),
                          border: '1px solid',
                          borderColor: selected ? alpha(theme.palette.primary.main, 0.45) : alpha(theme.palette.text.primary, 0.1),
                          borderRadius: 3,
                        }}
                      >
                        <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {job.customerName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {job.deliveryAddress || 'No delivery address'}
                              </Typography>
                            </Box>
                            <StatusPill
                              label={priority}
                              color={priority === 'urgent' ? '#dc2626' : priority === 'high' ? '#d97706' : '#64748b'}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Box>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1}>
              <Button
                fullWidth
                variant="contained"
                startIcon={autoAssigning ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                onClick={handleCreatePlannedRoute}
                disabled={selectedJobIds.length === 0 || !selectedVehicleId || autoAssigning}
              >
                Create Planned Route
              </Button>
              <Button fullWidth variant="text" onClick={() => setSelectedJobIds([])} disabled={selectedJobIds.length === 0}>
                Clear Selection
              </Button>
            </Stack>
          </DetailTray>
        </Grid>

        <Grid item xs={12} lg={4}>
          <DetailTray
            title="Vehicles / Routes"
            subtitle="Optimize routes and assign drivers"
            sx={{ ...panelSx, display: 'flex', flexDirection: 'column', height: { xs: 'auto', lg: 740 } }}
            action={<StatusPill label={`${activeRoutes.length} active`} color="#f97316" />}
          >
            <Box sx={scrollAreaSx}>
              {vehicles.length === 0 ? (
                <Box sx={emptyStateSx}>
                  <LocalShipping sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                    No vehicles available
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add vehicles before building routes.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.25}>
                  {vehicles.map((vehicle) => {
                    const route = routes.find(
                      (r) => r.vehicleId === vehicle.id && r.status !== 'completed' && r.status !== 'cancelled',
                    );
                    const driver = route?.driverId ? drivers.find((d) => d.id === route.driverId) : null;
                    const routeJobs = route?.jobIds ? jobs.filter((j) => route.jobIds?.includes(j.id)) : [];
                    return (
                      <VehicleRouteCard
                        key={vehicle.id}
                        vehicle={vehicle}
                        route={route || null}
                        jobs={routeJobs}
                        driver={driver || null}
                        onOptimize={handleOptimizeRoute}
                        onAssignDriver={handleAssignDriverClick}
                        onRemoveDriver={handleRemoveDriver}
                        optimizing={optimizingRouteId === route?.id}
                        selected={Boolean(route?.id && route.id === selectedRouteDetailId)}
                        onSelect={setSelectedRouteDetailId}
                      />
                    );
                  })}
                </Stack>
              )}
            </Box>
          </DetailTray>
        </Grid>

        <Grid item xs={12} lg={5}>
          <MapPanel
            mapCenter={mapCenter}
            mapZoom={mapZoom}
            mapRoutes={mapRoutes}
            title="Live Map"
            subtitle={
              mapRoutes.length > 0
                ? usingSimulatedGeometry
                  ? 'Tracking active routes (simulated geometry)'
                  : usingDegradedQuality
                  ? 'Tracking active routes (degraded telemetry)'
                  : 'Tracking active routes'
                : 'Awaiting route geometry'
            }
            height={740}
          />
        </Grid>
      </Grid>

      <DetailTray
        title="Ready to Dispatch + Route Detail"
        subtitle="Dispatch-ready routes and actions for the selected route"
        sx={panelSx}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} lg={4}>
            <Box sx={{ maxHeight: 300, overflow: 'auto', pr: 0.5 }}>
              {readyToDispatchRoutes.length === 0 ? (
                <Box sx={emptyStateSx}>
                  <PlayArrow sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No routes staged for dispatch.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.2}>
                  {readyToDispatchRoutes.map((route) => (
                    <Card
                      key={route.id}
                      elevation={0}
                      onClick={() => setSelectedRouteDetailId(route.id)}
                      sx={{
                        border: '1px solid',
                        borderColor: route.id === selectedRouteDetailId ? alpha(theme.palette.success.main, 0.45) : alpha(theme.palette.text.primary, 0.1),
                        borderRadius: 3,
                        cursor: 'pointer',
                        bgcolor: alpha(theme.palette.success.main, 0.06),
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Route {String(route.id ?? 'unknown').slice(0, 8)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {route.jobIds?.length || 0} stops
                        </Typography>
                        <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
                          <StatusPill
                            label={route.optimizationStatus || 'optimized'}
                            color={route.optimizationStatus === 'optimized' ? '#059669' : '#d97706'}
                          />
                          <StatusPill
                            label={route.dataQuality || 'live'}
                            color={route.dataQuality === 'live' ? '#0ea5e9' : route.dataQuality === 'degraded' ? '#d97706' : '#64748b'}
                          />
                          {route.rerouteState ? (
                            <StatusPill
                              label={`reroute ${route.rerouteState}`}
                              color={route.rerouteState === 'applied' ? '#059669' : '#d97706'}
                            />
                          ) : null}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Box>
          </Grid>

          <Grid item xs={12} lg={5}>
            {selectedRouteDetail ? (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Route {selectedRouteLabel}
                  </Typography>
                  <StatusPill label={selectedRouteStatus} color={routeIsReady ? '#059669' : '#64748b'} />
                </Stack>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    Vehicle: {[selectedRouteVehicle?.make, selectedRouteVehicle?.model].filter(Boolean).join(' ') || 'Unassigned'} {selectedRouteVehicle?.licensePlate ? `· ${selectedRouteVehicle.licensePlate}` : ''}
                  </Typography>
                  <Typography variant="body2">
                    Driver: {[selectedRouteDriver?.firstName, selectedRouteDriver?.lastName].filter(Boolean).join(' ') || 'Not assigned'}
                  </Typography>
                  <Typography variant="body2">
                    Stops: {selectedRouteJobIds.length} • Distance: {selectedRouteDistanceKm.toFixed(1)} km
                  </Typography>
                  <Typography variant="body2">
                    Duration: {selectedRouteDetail.totalDuration ? `${Math.floor(selectedRouteDetail.totalDuration / 60)}h ${Math.round(selectedRouteDetail.totalDuration % 60)}m` : '0m'}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <StatusPill
                      label={selectedRouteDetail.optimizationStatus || 'optimized'}
                      color={selectedRouteDetail.optimizationStatus === 'optimized' ? '#059669' : '#d97706'}
                    />
                    <StatusPill
                      label={selectedRouteDetail.dataQuality || 'live'}
                      color={selectedRouteDetail.dataQuality === 'live' ? '#0ea5e9' : selectedRouteDetail.dataQuality === 'degraded' ? '#d97706' : '#64748b'}
                    />
                    <StatusPill
                      label={routeIsReviewed ? 'Reviewed' : 'Needs Review'}
                      color={routeIsReviewed ? '#059669' : '#b45309'}
                    />
                    {selectedRouteDetail.rerouteState ? (
                      <StatusPill
                        label={`Reroute ${selectedRouteDetail.rerouteState}`}
                        color={selectedRouteDetail.rerouteState === 'applied' ? '#059669' : '#d97706'}
                      />
                    ) : null}
                    {selectedRouteDetail.exceptionCategory ? (
                      <StatusPill label={selectedRouteDetail.exceptionCategory} color="#7c3aed" />
                    ) : null}
                  </Stack>
                  {selectedRouteDetail.planningWarnings && selectedRouteDetail.planningWarnings.length > 0 ? (
                    <Alert severity="warning" sx={{ mt: 0.5 }}>
                      {selectedRouteDetail.planningWarnings[0]}
                    </Alert>
                  ) : null}
                  {selectedRouteDetail.droppedJobIds && selectedRouteDetail.droppedJobIds.length > 0 ? (
                    <Alert severity="error" sx={{ mt: 0.5 }}>
                      {selectedRouteDetail.droppedJobIds.length} dropped/infeasible job(s): {selectedRouteDetail.droppedJobIds.slice(0, 2).join(', ')}
                    </Alert>
                  ) : null}
                  {routeNeedsRerouteResolution ? (
                    <Alert severity="warning" sx={{ mt: 0.5 }}>
                      Dispatch is blocked while reroute is {selectedRouteDetail.rerouteState}.
                    </Alert>
                  ) : null}
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={() => handleOptimizeRoute(selectedRouteDetail.id)}
                    disabled={optimizingRouteId === selectedRouteDetail.id}
                  >
                    Optimize
                  </Button>
                  {!selectedRouteDetail.driverId ? (
                    <Button variant="outlined" startIcon={<Person />} onClick={() => handleAssignDriverClick(selectedRouteDetail.id)}>
                      Assign Driver
                    </Button>
                  ) : (
                    <Button variant="outlined" color="error" onClick={() => handleRemoveDriver(selectedRouteDetail.id)}>
                      Remove Driver
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    onClick={() =>
                      setReviewedRouteIds((prev) =>
                        prev.includes(selectedRouteDetail.id)
                          ? prev.filter((id) => id !== selectedRouteDetail.id)
                          : [...prev, selectedRouteDetail.id],
                      )
                    }
                  >
                    {routeIsReviewed ? 'Unmark Review' : 'Mark Reviewed'}
                  </Button>
                  <Button variant="outlined" onClick={() => setRerouteDialogOpen(true)}>
                    Request Reroute
                  </Button>
                  {latestRerouteRequest?.status === 'requested' ? (
                    <Button variant="outlined" color="warning" onClick={handleApproveReroute}>
                      Approve Reroute
                    </Button>
                  ) : null}
                  {latestRerouteRequest?.status === 'requested' ? (
                    <Button variant="outlined" color="error" onClick={handleRejectReroute}>
                      Reject Reroute
                    </Button>
                  ) : null}
                  {latestRerouteRequest?.status === 'approved' ? (
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={handleApplyReroute}
                      disabled={overrideRequested && !overrideReason.trim()}
                    >
                      Apply Reroute
                    </Button>
                  ) : null}
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={dispatchingRouteId === selectedRouteDetail.id ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
                    onClick={() => handleDispatch(selectedRouteDetail.id)}
                    disabled={
                      !routeIsReady ||
                      !routeIsReviewed ||
                      routeNeedsRerouteResolution ||
                      dispatchingRouteId === selectedRouteDetail.id
                    }
                  >
                    Dispatch
                  </Button>
                </Stack>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {selectedRouteJobs.length} linked job{selectedRouteJobs.length !== 1 ? 's' : ''}
                </Typography>
                {latestRerouteRequest ? (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Latest reroute: {latestRerouteRequest.status} • {latestRerouteRequest.action} • {latestRerouteRequest.exceptionCategory}
                  </Typography>
                ) : null}
                {latestRerouteRequest?.status === 'approved' ? (
                  <Box sx={{ mt: 1, p: 1.25, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Checkbox
                        size="small"
                        checked={overrideRequested}
                        onChange={(event) => setOverrideRequested(event.target.checked)}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Operator override (for infeasible apply)
                      </Typography>
                    </Stack>
                    {overrideRequested ? (
                      <Box
                        component="textarea"
                        value={overrideReason}
                        onChange={(event: any) => setOverrideReason(event.target.value)}
                        style={{
                          marginTop: 8,
                          width: '100%',
                          minHeight: 64,
                          resize: 'vertical',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          padding: 8,
                          fontFamily: 'inherit',
                          fontSize: 12,
                        }}
                      />
                    ) : null}
                  </Box>
                ) : null}
                {rerouteHistory.length > 0 ? (
                  <Box sx={{ mt: 1.25 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                      Reroute audit trail
                    </Typography>
                    {rerouteHistory.slice(0, 3).map((entry) => (
                      <Typography key={entry.id} variant="caption" color="text.secondary" display="block">
                        {entry.status} • {entry.action} • {entry.exceptionCategory}
                        {entry.plannerDiagnostics?.override?.applied ? ' • override applied' : ''}
                      </Typography>
                    ))}
                  </Box>
                ) : null}
                {timelineEvents.length > 0 ? (
                  <Box sx={{ mt: 1.25 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                      Timeline events
                    </Typography>
                    {timelineEvents.slice(0, 3).map((event) => (
                      <Typography key={event.id} variant="caption" color="text.secondary" display="block">
                        {event.source}:{event.code} • {event.message}
                      </Typography>
                    ))}
                  </Box>
                ) : null}
              </Box>
            ) : (
              <Box sx={emptyStateSx}>
                <RouteIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Select a route to inspect details and run actions.
                </Typography>
              </Box>
            )}
          </Grid>

          <Grid item xs={12} lg={3}>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2, maxHeight: 300, overflow: 'auto' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
                Ops Pulse
              </Typography>
              <LiveStatusColumn drivers={drivers} vehicles={vehicles} routes={activeRoutes} />
            </Box>
          </Grid>
        </Grid>
      </DetailTray>

      {/* Assign Driver Dialog */}
      <Dialog open={assignDriverDialogOpen} onClose={() => setAssignDriverDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Driver to Route</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Driver</InputLabel>
            <Select
              value={selectedDriverId}
              label="Select Driver"
              onChange={(e) => setSelectedDriverId(e.target.value)}
            >
              {suggestedDrivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>
                      {driver.firstName} {driver.lastName}
                    </span>
                    <Chip
                      label={driver.reason}
                      size="small"
                      color={driver.available ? 'success' : 'warning'}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDriverDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignDriver} disabled={!selectedDriverId}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rerouteDialogOpen} onClose={() => setRerouteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Reroute</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Exception Category</InputLabel>
              <Select
                value={rerouteCategory}
                label="Exception Category"
                onChange={(event) => setRerouteCategory(event.target.value)}
              >
                <MenuItem value="urgent_insert">urgent_insert</MenuItem>
                <MenuItem value="vehicle_unavailable">vehicle_unavailable</MenuItem>
                <MenuItem value="driver_unavailable">driver_unavailable</MenuItem>
                <MenuItem value="missed_time_window">missed_time_window</MenuItem>
                <MenuItem value="traffic_delay">traffic_delay</MenuItem>
                <MenuItem value="customer_not_ready">customer_not_ready</MenuItem>
                <MenuItem value="no_show">no_show</MenuItem>
                <MenuItem value="capacity_issue">capacity_issue</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Constraint Pack</InputLabel>
              <Select
                value={constraintPackId}
                label="Constraint Pack"
                onChange={(event) =>
                  setConstraintPackId(event.target.value as 'generic' | 'construction_concrete')
                }
              >
                <MenuItem value="generic">generic</MenuItem>
                <MenuItem value="construction_concrete">construction_concrete</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Reroute Action</InputLabel>
              <Select
                value={rerouteAction}
                label="Reroute Action"
                onChange={(event) => setRerouteAction(event.target.value)}
              >
                <MenuItem value="reorder_stops">reorder_stops</MenuItem>
                <MenuItem value="reassign_stop_to_route">reassign_stop_to_route</MenuItem>
                <MenuItem value="split_route">split_route</MenuItem>
                <MenuItem value="hold_stop">hold_stop</MenuItem>
                <MenuItem value="remove_stop">remove_stop</MenuItem>
                <MenuItem value="reassign_driver">reassign_driver</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel shrink>Reason</InputLabel>
              <Box
                component="textarea"
                value={rerouteReason}
                onChange={(event: any) => setRerouteReason(event.target.value)}
                style={{
                  marginTop: 20,
                  minHeight: 90,
                  resize: 'vertical',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  padding: 10,
                  fontFamily: 'inherit',
                  fontSize: 14,
                }}
              />
            </FormControl>
            {reroutePreview ? (
              <Stack spacing={1.2}>
                <Alert severity={reroutePreview?.constraintDiagnostics?.feasible ? 'info' : 'warning'}>
                  What-if: distance Δ {reroutePreview?.impactSummary?.distanceDeltaKm ?? 0} km, duration Δ {reroutePreview?.impactSummary?.durationDeltaMinutes ?? 0} min, dropped {reroutePreview?.impactSummary?.droppedJobs?.length || 0}, data quality {reroutePreview?.impliedDataQuality || 'degraded'}, workflow {reroutePreview?.impliedWorkflowStatus || 'rerouting'}, dispatch blocked {reroutePreview?.dispatchBlocked ? 'yes' : 'no'}.
                {typeof reroutePreview?.constraintDiagnostics?.feasibilityScore === 'number' ? (
                  <>
                    {' '}Feasibility score: {reroutePreview.constraintDiagnostics.feasibilityScore}/100.
                  </>
                ) : null}
                {reroutePreview?.constraintDiagnostics?.conflictSummary?.total ? (
                  <>
                    {' '}Conflicts: critical {reroutePreview.constraintDiagnostics.conflictSummary.critical}, major {reroutePreview.constraintDiagnostics.conflictSummary.major}, minor {reroutePreview.constraintDiagnostics.conflictSummary.minor}.
                  </>
                ) : null}
                {reroutePreview?.constraintDiagnostics?.reasonCodes?.length ? (
                  <>
                    {' '}Constraint reason codes: {reroutePreview.constraintDiagnostics.reasonCodes.join(', ')}.
                  </>
                ) : null}
                {reroutePreview?.constraintDiagnostics?.selectedPackId ? (
                  <>
                    {' '}Pack: {reroutePreview.constraintDiagnostics.selectedPackId}.
                  </>
                ) : null}
                {reroutePreview?.constraintDiagnostics?.timeWindowViolations?.length ? (
                  <>
                    {' '}Time-window violations: {reroutePreview.constraintDiagnostics.timeWindowViolations.length}.
                  </>
                ) : null}
                {reroutePreview?.constraintDiagnostics?.capacityConflicts?.length ? (
                  <>
                    {' '}Capacity conflicts: {reroutePreview.constraintDiagnostics.capacityConflicts.length}.
                  </>
                ) : null}
                {reroutePreview?.constraintDiagnostics?.skillMismatches?.length ? (
                  <>
                    {' '}Skill mismatches: {reroutePreview.constraintDiagnostics.skillMismatches.length}.
                  </>
                ) : null}
                {reroutePreview?.alternatives?.length ? (
                  <>
                    {' '}Alternatives: {reroutePreview.alternatives
                      .slice(0, 3)
                      .map((alt) => `#${alt.rank} ${alt.label} score ${alt.score}${alt.feasible ? '' : ' (blocked)'}`)
                      .join(', ')}.
                  </>
                ) : null}
                </Alert>
                {reroutePreview?.constraintDiagnostics?.reasonCodes?.length ? (
                  <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
                    <Typography variant="caption" color="text.secondary">
                      Reason Codes
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                      {reroutePreview.constraintDiagnostics.reasonCodes.slice(0, 8).map((code) => (
                        <StatusPill key={code} label={code} color={code.startsWith('CONCRETE_') ? '#9a3412' : '#475569'} />
                      ))}
                    </Stack>
                  </Box>
                ) : null}
                {reroutePreview?.alternatives?.length ? (
                  <Stack spacing={0.9}>
                    {reroutePreview.alternatives.slice(0, 3).map((alt) => (
                      <Box
                        key={alt.label}
                        sx={{
                          p: 1.1,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          bgcolor: alt.rank === 1 ? 'action.hover' : 'background.paper',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            #{alt.rank} {alt.label}
                          </Typography>
                          <StatusPill label={`score ${alt.score}`} color={alt.feasible ? '#059669' : '#d97706'} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.35 }}>
                          {alt.rationale}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            ) : (
              <Alert severity="warning">
                Preview unavailable for current action/payload. Configure required payload when applying.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRerouteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRequestReroute} disabled={rerouteSubmitting}>
            {rerouteSubmitting ? 'Submitting...' : 'Submit Reroute Request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={4200}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {feedback ? (
          <Alert onClose={() => setFeedback(null)} severity={feedback.severity} variant="filled">
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
