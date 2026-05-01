import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import {
  getOptimizationObjectiveLabel,
  normalizeOptimizationObjective,
  type OptimizationObjective,
} from '@shared/contracts';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MultiRouteMap from '../components/maps/MultiRouteMap';
import { OpsCommandBar, RouteInspectorPanel } from '../components/ops';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import { buildPlannerMapRoutes } from '../features/dispatch/utils/opsMapData';
import { isPreview } from '../services/api.preview';
import {
  getErrorMessage,
  type DriverRecord,
  type VehicleRecord,
} from '../services/api.types';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import { useJobsQuery } from '../services/jobsApi';
import {
  generateDraftRoutePlan,
  publishRoutePlan,
  reoptimizeRoutePlan,
  type PlannerRoutePlan,
  type PlannerRoutePlanGroup,
  type PlannerRoutePlanStop,
  updateRoutePlanGroup,
  updateRoutePlanStop,
  usePlannerQuery,
} from '../services/plannerApi';
const objectives: Array<{ value: OptimizationObjective; label: string }> = [
  { value: 'speed', label: 'Speed' },
  { value: 'distance', label: 'Distance' },
  { value: 'balanced', label: 'Balanced' },
];

function todayServiceDate() {
  return new Date().toISOString().slice(0, 10);
}

type PlannerWorkspacePayload = {
  routePlan?: PlannerRoutePlan | null;
  plan?: PlannerRoutePlan | null;
  groups?: PlannerRoutePlanGroup[];
  stops?: PlannerRoutePlanStop[];
  unassignedJobs?: PlannerJobRecord[];
};

type PlannerJobRecord = {
  id: string;
  customerName: string;
  deliveryAddress?: string;
  pickupAddress?: string;
  assignedRouteId?: string | null;
  priority?: string;
  status?: string;
  deliveryLocation?: { lat?: number; lng?: number } | null;
  pickupLocation?: { lat?: number; lng?: number } | null;
};

function toneForRoute(group: PlannerRoutePlanGroup, stopCount: number) {
  if (!group.vehicleId) return 'warning';
  if (stopCount >= 4) return 'accent';
  return 'info';
}

function stopLabel(stop: PlannerRoutePlanStop) {
  return String(stop.metadata?.address || '').trim();
}

export default function RoutingWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [jobs, setJobs] = useState<PlannerJobRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [plan, setPlan] = useState<PlannerRoutePlan | null>(null);
  const [groups, setGroups] = useState<PlannerRoutePlanGroup[]>([]);
  const [stops, setStops] = useState<PlannerRoutePlanStop[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [unassignedJobs, setUnassignedJobs] = useState<PlannerJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [objective, setObjective] = useState<OptimizationObjective>('balanced');
  const [serviceDate, setServiceDate] = useState(todayServiceDate());
  const [mode, setMode] = useState<'suggested' | 'manual'>('suggested');
  const [mobilePanel, setMobilePanel] = useState<'map' | 'routes' | 'jobs'>('map');
  const isDesktopWorkspace = useMediaQuery('(min-width:1200px)');

  const jobsQuery = useJobsQuery();
  const vehiclesQuery = useVehiclesQuery();
  const driversQuery = useDriversQuery();
  const plannerQuery = usePlannerQuery(serviceDate);

  useEffect(() => {
    const safeJobs = (jobsQuery.data ?? []) as PlannerJobRecord[];
    const safeVehicles = (vehiclesQuery.data ?? []) as VehicleRecord[];
    const safeDrivers = driversQuery.data ?? [];
    const plannerData = plannerQuery.data;
    if (!plannerData) return;

    setJobs(safeJobs);
    setVehicles(safeVehicles);
    setDrivers(safeDrivers);
    setPlan(plannerData.plan || null);
    setGroups(plannerData.groups || []);
    setStops(plannerData.stops || []);
    setSelectedGroupId((current) =>
      current && (plannerData.groups || []).some((group) => group.id === current)
        ? current
        : plannerData.groups?.[0]?.id || null,
    );
    setUnassignedJobs(plannerData.unassignedJobs || []);

    const seededJobs = searchParams.getAll('jobId');
    setSelectedJobIds((current) =>
      current.length
        ? current
        : seededJobs.length
          ? seededJobs
          : safeJobs
              .filter((job) => !job.assignedRouteId)
              .slice(0, 12)
              .map((job) => job.id),
    );
    setSelectedVehicleIds((current) =>
      current.length ? current : safeVehicles.slice(0, 4).map((vehicle) => vehicle.id),
    );
    if (plannerData.plan?.objective) {
      setObjective(normalizeOptimizationObjective(plannerData.plan.objective));
    }
    setLoading(false);
  }, [driversQuery.data, jobsQuery.data, plannerQuery.data, searchParams, vehiclesQuery.data]);

  useEffect(() => {
    if (
      jobsQuery.isLoading ||
      vehiclesQuery.isLoading ||
      driversQuery.isLoading ||
      plannerQuery.isLoading
    ) {
      setLoading(true);
    }
  }, [
    driversQuery.isLoading,
    jobsQuery.isLoading,
    plannerQuery.isLoading,
    vehiclesQuery.isLoading,
  ]);

  const groupedStops = useMemo(() => {
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    return groups.map((group) => ({
      ...group,
      stops: stops
        .filter((stop) => stop.routePlanGroupId === group.id)
        .sort((left, right) => left.stopSequence - right.stopSequence)
        .map((stop) => ({
          ...stop,
          job: jobsById.get(stop.jobId),
        })),
    }));
  }, [groups, jobs, stops]);

  const selectedGroup =
    groupedStops.find((group) => group.id === selectedGroupId) ||
    groupedStops[0] ||
    null;

  const refreshPlanView = (payload: PlannerWorkspacePayload) => {
    setPlan(payload.routePlan || payload.plan || null);
    setGroups(payload.groups || []);
    setStops(payload.stops || []);
    setUnassignedJobs(payload.unassignedJobs || []);
    setSelectedGroupId((current) =>
      current && (payload.groups || []).some((group) => group.id === current)
        ? current
        : payload.groups?.[0]?.id || null,
    );
  };

  const mapRoutes = useMemo(
    () =>
      buildPlannerMapRoutes({
        groups,
        stops,
        jobs,
        drivers,
        vehicles,
      }),
    [drivers, groups, jobs, stops, vehicles],
  );

  const handleGenerate = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = await generateDraftRoutePlan({
        serviceDate,
        objective,
        jobIds: selectedJobIds,
        vehicleIds: selectedVehicleIds,
      });
      refreshPlanView(payload);
      setMode('manual');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to generate route draft.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReoptimize = async () => {
    if (!plan?.id) return;
    setSaving(true);
    setError(null);
    try {
      const payload = await reoptimizeRoutePlan(plan.id);
      refreshPlanView(payload);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reoptimize plan.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!plan?.id) return;
    setSaving(true);
    setError(null);
    try {
      await publishRoutePlan(plan.id);
      await Promise.all([plannerQuery.refetch(), jobsQuery.refetch()]);
      navigate('/dispatch');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to publish route plan.'));
    } finally {
      setSaving(false);
    }
  };

  const updateAssignments = async (
    groupId: string,
    payload: { driverId?: string; vehicleId?: string },
  ) => {
    if (!plan?.id) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateRoutePlanGroup(plan.id, groupId, payload);
      refreshPlanView(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update route assignment.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStopLock = async (stopId: string, isLocked: boolean) => {
    if (!plan?.id) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateRoutePlanStop(plan.id, stopId, {
        isLocked: !isLocked,
      });
      refreshPlanView(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update stop lock.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !plan?.id) return;
    if (result.destination.droppableId === result.source.droppableId && result.destination.index === result.source.index) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await updateRoutePlanStop(plan.id, result.draggableId, {
        targetGroupId: result.destination.droppableId,
        targetSequence: result.destination.index + 1,
      });
      refreshPlanView(response);
      setMode('manual');
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          'Failed to move this stop. Regenerate or publish the draft if the planner is out of sync.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || plannerQuery.isLoading) {
    return <LoadingState label="Loading routing workspace..." minHeight="50vh" />;
  }

  const demandJobs = (unassignedJobs.length
    ? unassignedJobs
    : jobs.filter((job) => !job.assignedRouteId)
  ).slice(0, 20);

  const commandBar = (
    <OpsCommandBar
      eyebrow="Planning"
      title="Routing"
      subtitle="Build a suggested plan, then manually rebalance lanes without losing sight of the map."
      actions={
        <>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={saving || selectedJobIds.length === 0 || selectedVehicleIds.length === 0}
            data-testid="routing-generate-draft-button"
          >
            Generate draft
          </Button>
          <Button variant="outlined" onClick={handleReoptimize} disabled={!plan?.id || saving}>
            Reoptimize
          </Button>
          <Button
            variant="outlined"
            onClick={handlePublish}
            disabled={!plan?.id || saving}
            data-testid="routing-publish-button"
          >
            Publish
          </Button>
        </>
      }
      filters={
        <>
          <TextField
            size="small"
            label="Service date"
            type="date"
            value={serviceDate}
            onChange={(event) => setServiceDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 168 }}
          />
          <TextField
            select
            size="small"
            label="Objective"
            value={objective}
            onChange={(event) => setObjective(normalizeOptimizationObjective(event.target.value))}
            sx={{ minWidth: 158 }}
          >
            {objectives.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, value) => value && setMode(value)}
            sx={{
              '& .MuiToggleButton-root': {
                px: 1.15,
                py: 0.65,
                textTransform: 'none',
              },
            }}
          >
            <ToggleButton value="suggested">Suggested</ToggleButton>
            <ToggleButton value="manual">Manual</ToggleButton>
          </ToggleButtonGroup>
        </>
      }
      meta={
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <StatusPill label={`${selectedJobIds.length} jobs`} tone="accent" />
          <StatusPill label={`${groups.length} lanes`} tone="info" />
          <StatusPill
            label={`${unassignedJobs.length} unassigned`}
            tone={unassignedJobs.length ? 'warning' : 'success'}
          />
          <StatusPill
            label={isPreview() ? 'Preview planner' : 'Live planner'}
            tone="default"
          />
        </Stack>
      }
    />
  );

  const jobsPanel = (
    <SurfacePanel variant="panel" padding={0} sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 1.15, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Unassigned jobs</Typography>
        <Typography variant="body2" color="text.secondary">
          Select work for the next draft. Manual moves stay visually tied to route lanes.
        </Typography>
      </Box>
      <List disablePadding sx={{ maxHeight: { xs: 420, xl: '32vh' }, overflowY: 'auto' }}>
        {demandJobs.map((job, index) => {
          const selected = selectedJobIds.includes(job.id);
          return (
            <ListItem key={job.id} disablePadding>
              <ListItemButton
                onClick={() =>
                  setSelectedJobIds((current) =>
                    current.includes(job.id)
                      ? current.filter((id) => id !== job.id)
                      : [...current, job.id],
                  )
                }
                data-testid={`routing-job-row-${index}`}
                sx={{ gap: 1, py: 0.85, px: 1.1 }}
              >
                <Checkbox
                  edge="start"
                  checked={selected}
                  tabIndex={-1}
                  disableRipple
                  data-testid={`routing-job-checkbox-${index}`}
                  sx={{ p: 0.45 }}
                />
                <ListItemText
                  primary={job.customerName || 'Job'}
                  secondary={job.deliveryAddress || job.pickupAddress || 'Address pending'}
                  primaryTypographyProps={{ fontWeight: 750, noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
                <StatusPill
                  label={String(job.priority || 'normal')}
                  tone={String(job.priority || '').toLowerCase() === 'urgent' ? 'warning' : 'default'}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </SurfacePanel>
  );

  const draftRoutesPanel = (
    <SurfacePanel variant="panel" padding={0} sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 1.15, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Draft lanes</Typography>
        <Typography variant="body2" color="text.secondary">
          Click a lane to focus the inspector and map.
        </Typography>
      </Box>
      <List disablePadding sx={{ maxHeight: { xs: 420, xl: '26vh' }, overflowY: 'auto' }}>
        {groupedStops.length === 0 ? (
          <ListItem sx={{ py: 2 }}>
            <ListItemText
              primary="No draft routes yet"
              secondary="Generate a suggested plan to begin manual edits."
            />
          </ListItem>
        ) : (
          groupedStops.map((group) => (
            <ListItem key={group.id} disablePadding>
              <ListItemButton
                selected={group.id === selectedGroup?.id}
                onClick={() => setSelectedGroupId(group.id)}
                sx={{
                  py: 0.95,
                  px: 1.2,
                  borderLeft: group.id === selectedGroup?.id ? '3px solid #B97129' : '3px solid transparent',
                }}
              >
                <ListItemText
                  primary={group.label}
                  secondary={`${group.stops.length} stops • ${Number(group.totalDistanceKm || 0).toFixed(1)} km`}
                  primaryTypographyProps={{ fontWeight: 800, noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
                <StatusPill
                  label={group.vehicleId ? 'Assigned' : 'Needs vehicle'}
                  tone={group.vehicleId ? 'success' : 'warning'}
                />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>
    </SurfacePanel>
  );

  const vehiclesPanel = (
    <SurfacePanel variant="subtle" padding={1.4}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Vehicles in play
      </Typography>
      <Stack spacing={0.55} sx={{ maxHeight: { xl: '19vh' }, overflowY: 'auto' }}>
        {vehicles.slice(0, 8).map((vehicle, index) => (
          <Box
            key={vehicle.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              py: 0.25,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                {vehicle.licensePlate || vehicle.id}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {vehicle.make || 'Vehicle'} {vehicle.model || ''}
              </Typography>
            </Box>
            <Checkbox
              checked={selectedVehicleIds.includes(vehicle.id)}
              onChange={() =>
                setSelectedVehicleIds((current) =>
                  current.includes(vehicle.id)
                    ? current.filter((id) => id !== vehicle.id)
                    : [...current, vehicle.id],
                )
              }
              data-testid={`routing-vehicle-checkbox-${index}`}
              sx={{ p: 0.45 }}
            />
          </Box>
        ))}
      </Stack>
    </SurfacePanel>
  );

  const mapPanel = (
    <SurfacePanel
      variant="canvas"
      padding={0}
      sx={{
        overflow: 'hidden',
        minHeight: { xs: 430, md: 540, xl: 0 },
        height: { xs: 430, md: 540, xl: '100%' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 1.6, py: 1.15, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">Route map</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            Map-first planning canvas with selected-lane focus.
          </Typography>
        </Box>
        <StatusPill
          label={selectedGroup ? selectedGroup.label : 'No lane selected'}
          tone={selectedGroup ? 'accent' : 'default'}
        />
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {mapRoutes.length ? (
          <MultiRouteMap
            routes={mapRoutes}
            height="100%"
            selectedRouteId={selectedGroupId}
            onRouteSelect={(routeId) => {
              if (routeId) setSelectedGroupId(routeId);
            }}
          />
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Generate a draft route plan to populate the planner canvas.
            </Typography>
          </Box>
        )}
      </Box>
    </SurfacePanel>
  );

  const routeEditorPanel = (
    <SurfacePanel variant="panel" padding={0} sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 1.15, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Manual lane editor</Typography>
        <Typography variant="body2" color="text.secondary">
          Drag stops between lanes, reorder within a lane, or lock critical stops.
        </Typography>
      </Box>
      {groupedStops.length === 0 ? (
        <Box sx={{ p: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            The editor opens once a draft route plan exists.
          </Typography>
        </Box>
      ) : (
        <DragDropContext onDragEnd={(result) => void handleDragEnd(result)}>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: {
                xs: '1fr',
                lg: `repeat(${Math.min(groupedStops.length, 3)}, minmax(0, 1fr))`,
              },
              p: 1.2,
            }}
          >
            {groupedStops.map((group) => (
              <Droppable droppableId={group.id} key={group.id}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    onClick={() => setSelectedGroupId(group.id)}
                    sx={{
                      minHeight: { xs: 210, xl: 240 },
                      borderRadius: 1.2,
                      border: '1px dashed',
                      borderColor: snapshot.isDraggingOver
                        ? alpha('#B97129', 0.48)
                        : group.id === selectedGroup?.id
                          ? alpha('#B97129', 0.32)
                          : 'divider',
                      bgcolor: snapshot.isDraggingOver
                        ? alpha('#B97129', 0.07)
                        : group.id === selectedGroup?.id
                          ? alpha('#B97129', 0.035)
                          : 'background.paper',
                      p: 1,
                    }}
                  >
                    <Stack spacing={0.85}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          {group.label}
                        </Typography>
                        <StatusPill
                          label={`${group.stops.length} stops`}
                          tone={toneForRoute(group, group.stops.length)}
                        />
                      </Stack>
                      <Stack spacing={0.7}>
                        {group.stops.map((stop, index) => (
                          <Draggable
                            key={stop.id}
                            draggableId={stop.id}
                            index={index}
                            isDragDisabled={saving || stop.isLocked}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <Box
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                sx={{
                                  px: 1,
                                  py: 0.75,
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: dragSnapshot.isDragging
                                    ? alpha('#B97129', 0.42)
                                    : 'divider',
                                    bgcolor: dragSnapshot.isDragging
                                      ? alpha('#B97129', 0.07)
                                      : trovanSurfaceColor(group.id === selectedGroup?.id, isDark),
                                  cursor: stop.isLocked ? 'not-allowed' : 'grab',
                                }}
                              >
                                <Stack spacing={0.3}>
                                  <Stack direction="row" justifyContent="space-between" gap={1}>
                                    <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                                      {stop.job?.customerName || stop.jobId}
                                    </Typography>
                                    {stop.isLocked ? (
                                      <StatusPill label="Locked" tone="warning" />
                                    ) : (
                                      <Typography variant="caption" color="text.secondary">
                                        {index + 1}
                                      </Typography>
                                    )}
                                  </Stack>
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {stopLabel(stop)}
                                  </Typography>
                                </Stack>
                              </Box>
                            )}
                          </Draggable>
                        ))}
                      </Stack>
                      {provided.placeholder}
                    </Stack>
                  </Box>
                )}
              </Droppable>
            ))}
          </Box>
        </DragDropContext>
      )}
    </SurfacePanel>
  );

  const inspectorPanel = (
    <RouteInspectorPanel
      title={selectedGroup ? selectedGroup.label : 'Planner summary'}
      subtitle={
        selectedGroup
          ? `${selectedGroup.stops.length} stops • ${Number(selectedGroup.totalDistanceKm || 0).toFixed(1)} km`
          : 'Select a lane to manage assignments and locked stops.'
      }
      status={
        <StatusPill
          label={plan ? String(plan.status) : 'No draft'}
          tone={plan ? 'success' : 'default'}
        />
      }
      summary={
        <Stack spacing={0.75}>
          <Typography variant="body2" color="text.secondary">
            Service date: {serviceDate}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Objective: {getOptimizationObjectiveLabel(objective)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Routes: {groups.length} • Stops: {stops.length}
          </Typography>
        </Stack>
      }
      footer={
        <Stack direction="row" spacing={1}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handlePublish}
            disabled={!plan?.id || saving}
          >
            Publish
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleGenerate}
            disabled={saving || selectedJobIds.length === 0 || selectedVehicleIds.length === 0}
          >
            Draft
          </Button>
        </Stack>
      }
    >
      {!selectedGroup ? (
        <Typography variant="body2" color="text.secondary">
          Generate a draft, then select a lane on the left or directly from the map.
        </Typography>
      ) : (
        <Stack spacing={1.1}>
          <TextField
            select
            size="small"
            label="Vehicle"
            value={selectedGroup.vehicleId || ''}
            onChange={(event) =>
              void updateAssignments(selectedGroup.id, {
                vehicleId: event.target.value || undefined,
                driverId: selectedGroup.driverId || undefined,
              })
            }
          >
            <MenuItem value="">Unassigned</MenuItem>
            {vehicles.map((vehicle) => (
              <MenuItem key={vehicle.id} value={vehicle.id}>
                {vehicle.licensePlate || vehicle.id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Driver"
            value={selectedGroup.driverId || ''}
            onChange={(event) =>
              void updateAssignments(selectedGroup.id, {
                driverId: event.target.value || undefined,
                vehicleId: selectedGroup.vehicleId || undefined,
              })
            }
          >
            <MenuItem value="">Unassigned</MenuItem>
            {drivers.map((driver) => (
              <MenuItem key={driver.id} value={driver.id}>
                {[driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.id}
              </MenuItem>
            ))}
          </TextField>
          <Stack spacing={0.75}>
            {selectedGroup.stops.map((stop) => (
              <Box
                key={stop.id}
                sx={{
                  px: 1,
                  py: 0.8,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                      {stop.stopSequence}. {stop.job?.customerName || stop.jobId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {stopLabel(stop)}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    color={stop.isLocked ? 'warning' : 'inherit'}
                    onClick={() => void toggleStopLock(stop.id, stop.isLocked)}
                    disabled={saving}
                  >
                    {stop.isLocked ? 'Unlock' : 'Lock'}
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Stack>
      )}
    </RouteInspectorPanel>
  );

  return (
    <Box data-testid="routing-workspace-page" sx={{ display: 'grid', gap: 1.5 }}>
      {commandBar}

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      {isDesktopWorkspace ? (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: '300px minmax(620px, 1fr) 330px',
            alignItems: 'stretch',
            height: 'calc(100vh - 176px)',
            minHeight: 640,
          }}
        >
          <Stack spacing={1.2} sx={{ minHeight: 0, overflow: 'hidden' }}>
            {jobsPanel}
            {draftRoutesPanel}
            {vehiclesPanel}
          </Stack>

          <Stack spacing={1.2} sx={{ minHeight: 0, overflow: 'hidden' }}>
            {mapPanel}
            <Box sx={{ maxHeight: '34vh', overflow: 'auto' }}>{routeEditorPanel}</Box>
          </Stack>

          {inspectorPanel}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.2 }}>
          <ToggleButtonGroup
            fullWidth
            size="small"
            exclusive
            value={mobilePanel}
            onChange={(_, value) => value && setMobilePanel(value)}
          >
            <ToggleButton value="map">Map</ToggleButton>
            <ToggleButton value="routes">Routes</ToggleButton>
            <ToggleButton value="jobs">Jobs</ToggleButton>
          </ToggleButtonGroup>
          {mobilePanel === 'map' ? mapPanel : null}
          {mobilePanel === 'routes' ? (
            <Stack spacing={1.2}>
              {draftRoutesPanel}
              {routeEditorPanel}
              {inspectorPanel}
            </Stack>
          ) : null}
          {mobilePanel === 'jobs' ? (
            <Stack spacing={1.2}>
              {jobsPanel}
              {vehiclesPanel}
            </Stack>
          ) : null}
        </Box>
      )}
    </Box>
  );
}

function trovanSurfaceColor(selected: boolean, isDark: boolean) {
  if (selected) return 'rgba(169, 99, 33, 0.18)';
  return isDark ? 'rgba(21, 18, 16, 0.94)' : 'rgba(255, 253, 249, 0.78)';
}
