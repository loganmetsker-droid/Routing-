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
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import MultiRouteMap from '../components/maps/MultiRouteMap';
import { PageHeader } from '../components/PageHeader';
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

  return (
    <Box data-testid="routing-workspace-page">
      <PageHeader
        eyebrow="Planning"
        title="Routing"
        subtitle="Generate suggested lanes, then manually rebalance and reorder stops before publish."
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
      />

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      <SurfacePanel variant="panel" padding={1.5} sx={{ mb: 1.5 }}>
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          justifyContent="space-between"
          alignItems={{ xl: 'center' }}
          spacing={1.25}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              size="small"
              label="Service date"
              type="date"
              value={serviceDate}
              onChange={(event) => setServiceDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 180 }}
            />
            <TextField
              select
              size="small"
              label="Objective"
              value={objective}
              onChange={(event) =>
                setObjective(normalizeOptimizationObjective(event.target.value))
              }
              sx={{ minWidth: 180 }}
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
            >
              <ToggleButton value="suggested">Suggested</ToggleButton>
              <ToggleButton value="manual">Manual</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" spacing={0.75} flexWrap="wrap">
            <StatusPill label={`${selectedJobIds.length} jobs selected`} tone="accent" />
            <StatusPill label={`${groups.length} route lanes`} tone="info" />
            <StatusPill label={`${unassignedJobs.length} unassigned`} tone={unassignedJobs.length ? 'warning' : 'success'} />
          </Stack>
        </Stack>
      </SurfacePanel>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', xl: '320px minmax(0, 1fr) 360px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.5}>
          <SurfacePanel variant="panel" padding={0}>
            <Box sx={{ px: 2, py: 1.4, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6">Unassigned jobs</Typography>
              <Typography variant="body2" color="text.secondary">
                Select demand before generating a draft. Dragging new jobs in is preview-first for now.
              </Typography>
            </Box>
            <List disablePadding sx={{ maxHeight: 360, overflowY: 'auto' }}>
              {(unassignedJobs.length ? unassignedJobs : jobs.filter((job) => !job.assignedRouteId))
                .slice(0, 20)
                .map((job, index) => {
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
                        sx={{ py: 1.1 }}
                      >
                        <Checkbox
                          edge="start"
                          checked={selected}
                          tabIndex={-1}
                          disableRipple
                          data-testid={`routing-job-checkbox-${index}`}
                        />
                        <ListItemText
                          primary={job.customerName || 'Job'}
                          secondary={job.deliveryAddress || 'Address pending'}
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

          <SurfacePanel variant="panel" padding={0}>
            <Box sx={{ px: 2, py: 1.4, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6">Draft routes</Typography>
              <Typography variant="body2" color="text.secondary">
                Review route structure, assignment state, and stop counts before editing.
              </Typography>
            </Box>
            <List disablePadding>
              {groupedStops.length === 0 ? (
                <ListItem sx={{ py: 2.25 }}>
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
                      sx={{ py: 1.15 }}
                    >
                      <ListItemText
                        primary={group.label}
                        secondary={`${group.stops.length} stops • ${Number(group.totalDistanceKm || 0).toFixed(1)} km`}
                        primaryTypographyProps={{ fontWeight: 700 }}
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

          <SurfacePanel variant="subtle">
            <Typography variant="h6" sx={{ mb: 1.1 }}>
              Vehicles in play
            </Typography>
            <Stack spacing={0.8}>
              {vehicles.slice(0, 8).map((vehicle, index) => (
                <Box
                  key={vehicle.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Stack spacing={0.15}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {vehicle.licensePlate || vehicle.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {vehicle.make || 'Vehicle'} {vehicle.model || ''}
                    </Typography>
                  </Stack>
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
                  />
                </Box>
              ))}
            </Stack>
          </SurfacePanel>
        </Stack>

        <Stack spacing={1.5}>
          <SurfacePanel variant="canvas" padding={0} sx={{ overflow: 'hidden' }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ px: 2, py: 1.4, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Box>
                <Typography variant="h6">Route canvas</Typography>
                <Typography variant="body2" color="text.secondary">
                  Suggested and manual planning share one full map workspace.
                </Typography>
              </Box>
              <StatusPill
                label={selectedGroup ? selectedGroup.label : 'No route selected'}
                tone={selectedGroup ? 'accent' : 'default'}
              />
            </Stack>
            <Box sx={{ height: 420 }}>
              {mapRoutes.length ? (
                <MultiRouteMap routes={mapRoutes} height="420px" />
              ) : (
                <Box sx={{ p: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Generate a draft route plan to populate the planner canvas.
                  </Typography>
                </Box>
              )}
            </Box>
          </SurfacePanel>

          <SurfacePanel variant="panel" padding={0}>
            <Box sx={{ px: 2, py: 1.4, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6">Manual route editor</Typography>
              <Typography variant="body2" color="text.secondary">
                Drag future stops between routes or reorder within a lane. Locked stops stay put.
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
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: '1fr',
                      lg: `repeat(${Math.min(groupedStops.length, 3)}, minmax(0, 1fr))`,
                    },
                    p: 1.5,
                  }}
                >
                  {groupedStops.map((group) => (
                    <Droppable droppableId={group.id} key={group.id}>
                      {(provided, snapshot) => (
                        <Box
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          sx={{
                            minHeight: 280,
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: snapshot.isDraggingOver
                              ? alpha('#B97129', 0.38)
                              : 'divider',
                            bgcolor: snapshot.isDraggingOver
                              ? alpha('#B97129', 0.05)
                              : 'background.paper',
                            p: 1.2,
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {group.label}
                              </Typography>
                              <StatusPill
                                label={`${group.stops.length} stops`}
                                tone={toneForRoute(group, group.stops.length)}
                              />
                            </Stack>
                            <Stack spacing={0.85}>
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
                                        px: 1.1,
                                        py: 1,
                                        borderRadius: 1.35,
                                        border: '1px solid',
                                        borderColor: dragSnapshot.isDragging
                                          ? alpha('#B97129', 0.38)
                                          : 'divider',
                                        bgcolor: dragSnapshot.isDragging
                                          ? alpha('#B97129', 0.06)
                                          : trovanSurfaceColor(group.id === selectedGroup?.id),
                                      }}
                                    >
                                      <Stack spacing={0.45}>
                                        <Stack direction="row" justifyContent="space-between" gap={1}>
                                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
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
                                        <Typography variant="caption" color="text.secondary">
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
        </Stack>

        <Stack spacing={1.5}>
          <SurfacePanel variant="panel">
            <Typography variant="h6" sx={{ mb: 1.1 }}>
              Planner summary
            </Typography>
            <Stack spacing={0.9}>
              <StatusPill
                label={plan ? `Plan ${plan.status}` : 'No draft'}
                tone={plan ? 'success' : 'default'}
              />
              <Typography variant="body2" color="text.secondary">
                Service date: {serviceDate}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Objective: {getOptimizationObjectiveLabel(objective)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Routes: {groups.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Stops: {stops.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Preview mode: {isPreview() ? 'Local seeded planner' : 'Live planner data'}
              </Typography>
            </Stack>
          </SurfacePanel>

          <SurfacePanel variant="panel">
            <Typography variant="h6" sx={{ mb: 1.1 }}>
              Selected route detail
            </Typography>
            {!selectedGroup ? (
              <Typography variant="body2" color="text.secondary">
                Select a route lane to manage assignment and stop order.
              </Typography>
            ) : (
              <Stack spacing={1.15}>
                <Typography variant="body2" color="text.secondary">
                  {selectedGroup.label}
                </Typography>
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
                <Stack spacing={0.85}>
                  {selectedGroup.stops.map((stop) => (
                    <Box
                      key={stop.id}
                      sx={{
                        px: 1.15,
                        py: 0.95,
                        borderRadius: 1.35,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {stop.stopSequence}. {stop.job?.customerName || stop.jobId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
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
          </SurfacePanel>

          <SurfacePanel variant="subtle">
            <Typography variant="h6" sx={{ mb: 1.1 }}>
              Draft leftovers
            </Typography>
            {unassignedJobs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                All selected jobs were placed into draft routes.
              </Typography>
            ) : (
              <Stack spacing={0.8}>
                {unassignedJobs.map((job) => (
                  <Box key={job.id} sx={{ py: 0.8, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {job.customerName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {job.deliveryAddress || 'Address pending'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </SurfacePanel>
        </Stack>
      </Box>
    </Box>
  );
}

function trovanSurfaceColor(selected: boolean) {
  return selected ? 'rgba(185, 113, 41, 0.06)' : '#FFFFFF';
}
