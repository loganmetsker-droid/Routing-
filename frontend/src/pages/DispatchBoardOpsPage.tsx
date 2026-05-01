import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import {
  type CreateExceptionPayload,
  getRouteRunsErrorMessage,
  useCreateExceptionMutation,
  useDispatchBoardQuery,
  useDispatchRouteRunMutation,
  useMoveDispatchStopMutation,
  useReassignRouteRunMutation,
  useReorderDispatchStopsMutation,
  useStartRouteRunMutation,
} from '../features/dispatch/api/routeRunsApi';
import { buildDispatchMapRoutes } from '../features/dispatch/utils/opsMapData';
import { useRoutesQuery } from '../services/dispatchApi';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import { useJobsQuery } from '../services/jobsApi';

function statusTone(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced', 'resolved'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'danger';
  if (['assigned', 'ready_for_dispatch', 'in_progress', 'arrived'].includes(normalized)) return 'info';
  if (['open', 'rescheduled'].includes(normalized)) return 'warning';
  return 'default';
}

function isEditableRoute(status: string) {
  return ['planned', 'assigned', 'ready_for_dispatch'].includes(
    String(status || '').toLowerCase(),
  );
}

type ExceptionFormState = {
  code: string;
  message: string;
};

const emptyExceptionForm: ExceptionFormState = {
  code: '',
  message: '',
};

export default function DispatchBoardOpsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [savingRouteId, setSavingRouteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDriverByRoute, setSelectedDriverByRoute] = useState<Record<string, string>>({});
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionForm, setExceptionForm] = useState<ExceptionFormState>(emptyExceptionForm);
  const [mobilePanel, setMobilePanel] = useState<'map' | 'routes' | 'inspector'>('map');
  const isDesktopWorkspace = useMediaQuery('(min-width:1200px)');

  const boardQuery = useDispatchBoardQuery();
  const routesQuery = useRoutesQuery();
  const jobsQuery = useJobsQuery();
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const dispatchMutation = useDispatchRouteRunMutation();
  const startMutation = useStartRouteRunMutation();
  const reassignMutation = useReassignRouteRunMutation();
  const reorderMutation = useReorderDispatchStopsMutation();
  const moveMutation = useMoveDispatchStopMutation();
  const createExceptionMutation = useCreateExceptionMutation();

  const routeRuns = boardQuery.data?.routeRuns ?? [];
  const routeRunStops = boardQuery.data?.routeRunStops ?? [];
  const exceptions = boardQuery.data?.exceptions ?? [];
  const routes = routesQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const loading =
    boardQuery.isLoading ||
    routesQuery.isLoading ||
    jobsQuery.isLoading ||
    driversQuery.isLoading ||
    vehiclesQuery.isLoading;

  useEffect(() => {
    if (!selectedRouteId && routeRuns.length) {
      setSelectedRouteId(routeRuns[0].id);
    }
    if (
      selectedRouteId &&
      routeRuns.length &&
      !routeRuns.some((route) => route.id === selectedRouteId)
    ) {
      setSelectedRouteId(routeRuns[0]?.id || null);
    }
  }, [routeRuns, selectedRouteId]);

  const fullRouteById = useMemo(
    () => new Map(routes.map((route) => [route.id, route])),
    [routes],
  );
  const jobById = useMemo(
    () => new Map(jobs.map((job) => [job.id, job])),
    [jobs],
  );
  const driverNameById = useMemo(
    () =>
      Object.fromEntries(
        drivers.map((driver) => [
          driver.id,
          [driver.firstName, driver.lastName].filter(Boolean).join(' ') ||
            driver.id,
        ]),
      ),
    [drivers],
  );
  const vehicleNameById = useMemo(
    () =>
      Object.fromEntries(
        vehicles.map((vehicle) => [
          vehicle.id,
          vehicle.licensePlate ||
            `${vehicle.make || 'Vehicle'} ${vehicle.model || ''}`.trim() ||
            vehicle.id,
        ]),
      ),
    [vehicles],
  );

  const stopsByRoute = useMemo(() => {
    return routeRunStops.reduce<Record<string, typeof routeRunStops>>((acc, stop) => {
      acc[stop.routeId] = [...(acc[stop.routeId] || []), stop];
      return acc;
    }, {});
  }, [routeRunStops]);

  const orderedRouteLanes = useMemo(() => {
    return routeRuns
      .map((route) => {
        const liveRoute = fullRouteById.get(route.id);
        const laneStops = (stopsByRoute[route.id] || [])
          .slice()
          .sort((left, right) => left.stopSequence - right.stopSequence)
          .map((stop) => ({
            ...stop,
            job: jobById.get(stop.jobId),
          }));
        const routeExceptions = exceptions.filter((item) => item.routeId === route.id);
        return {
          route,
          liveRoute,
          stops: laneStops,
          exceptions: routeExceptions,
        };
      })
      .sort((left, right) => left.route.id.localeCompare(right.route.id));
  }, [exceptions, fullRouteById, jobById, routeRuns, stopsByRoute]);

  const selectedLane =
    orderedRouteLanes.find((item) => item.route.id === selectedRouteId) ||
    orderedRouteLanes[0] ||
    null;

  const mapRoutes = useMemo(
    () =>
      buildDispatchMapRoutes({
        routes,
        jobs,
        drivers,
        vehicles,
      }),
    [drivers, jobs, routes, vehicles],
  );

  const boardSummary = useMemo(
    () => ({
      ready: routeRuns.filter((route) =>
        ['assigned', 'planned', 'ready_for_dispatch'].includes(
          String(route.workflowStatus || route.status || '').toLowerCase(),
        ),
      ).length,
      inProgress: routeRuns.filter((route) =>
        ['in_progress'].includes(String(route.status || '').toLowerCase()),
      ).length,
      completed: routeRuns.filter((route) =>
        ['completed'].includes(String(route.status || '').toLowerCase()),
      ).length,
      exceptions: exceptions.filter((item) => item.status === 'OPEN').length,
    }),
    [exceptions, routeRuns],
  );

  const handleRouteAction = async (
    routeId: string,
    action: 'dispatch' | 'start' | 'assign',
  ) => {
    setSavingRouteId(routeId);
    setError(null);
    try {
      if (action === 'dispatch') {
        await dispatchMutation.mutateAsync(routeId);
      } else if (action === 'start') {
        await startMutation.mutateAsync(routeId);
      } else {
        await reassignMutation.mutateAsync({
          routeRunId: routeId,
          payload: {
            driverId: selectedDriverByRoute[routeId] || undefined,
            reason: 'dispatch board assignment',
          },
        });
      }
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    } finally {
      setSavingRouteId(null);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const sourceRouteId = result.source.droppableId;
    const targetRouteId = result.destination.droppableId;
    const sourceLane = orderedRouteLanes.find((item) => item.route.id === sourceRouteId);
    const targetLane = orderedRouteLanes.find((item) => item.route.id === targetRouteId);
    if (!sourceLane || !targetLane) return;
    if (!isEditableRoute(String(sourceLane.route.status)) || !isEditableRoute(String(targetLane.route.status))) {
      setError('Only planned and ready routes can be manually edited from dispatch.');
      return;
    }

    setError(null);
    try {
      if (sourceRouteId === targetRouteId) {
        const liveRoute = fullRouteById.get(sourceRouteId);
        if (!liveRoute?.jobIds) return;
        const newJobOrder = liveRoute.jobIds.slice();
        const [movedJobId] = newJobOrder.splice(result.source.index, 1);
        newJobOrder.splice(result.destination.index, 0, movedJobId);
        await reorderMutation.mutateAsync({ routeId: sourceRouteId, newJobOrder });
      } else {
        await moveMutation.mutateAsync({
          routeId: sourceRouteId,
          payload: {
            jobId: result.draggableId,
            targetRouteId,
            targetSequence: result.destination.index + 1,
          },
        });
        setSelectedRouteId(targetRouteId);
      }
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const submitException = async () => {
    if (!selectedLane) return;
    const payload: CreateExceptionPayload = {
      routeId: selectedLane.route.id,
      code: exceptionForm.code.trim().toUpperCase(),
      message: exceptionForm.message.trim(),
      details: { source: 'dispatch-board' },
    };
    setError(null);
    try {
      await createExceptionMutation.mutateAsync(payload);
      setExceptionDialogOpen(false);
      setExceptionForm(emptyExceptionForm);
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  if (loading) {
    return <LoadingState label="Loading dispatch board..." minHeight="50vh" />;
  }

  const summaryMetrics = [
    { label: 'Ready', value: boardSummary.ready, tone: 'accent' as const },
    { label: 'In progress', value: boardSummary.inProgress, tone: 'info' as const },
    { label: 'Completed', value: boardSummary.completed, tone: 'success' as const },
    { label: 'Open exceptions', value: boardSummary.exceptions, tone: boardSummary.exceptions ? 'warning' as const : 'default' as const },
  ];

  const commandBar = (
    <OpsCommandBar
      eyebrow="Live Dispatch"
      title="Dispatch"
      subtitle="Move from route lanes to live map context without burying the execution surface."
      actions={
        <>
          <Button variant="outlined" component={RouterLink} to="/exceptions">
            Open queue
          </Button>
          <Button variant="contained" onClick={() => setExceptionDialogOpen(true)}>
            New exception
          </Button>
        </>
      }
      meta={
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {summaryMetrics.map((item) => (
            <StatusPill
              key={item.label}
              label={`${item.label}: ${item.value}`}
              tone={item.tone}
            />
          ))}
        </Stack>
      }
    />
  );

  const lanesPanel = (
    <SurfacePanel
      variant="panel"
      padding={0}
      sx={{ overflow: 'hidden', height: { xl: '100%' }, display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{ px: 1.5, py: 1.15, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Route lanes</Typography>
        <Typography variant="body2" color="text.secondary">
          Drag future work inside eligible lanes or move it to another planned route.
        </Typography>
      </Box>
      {orderedRouteLanes.length === 0 ? (
        <Box sx={{ p: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            No published routes are available for dispatch.
          </Typography>
        </Box>
      ) : (
        <DragDropContext onDragEnd={(result) => void handleDragEnd(result)}>
          <Stack spacing={1} sx={{ p: 1.2, overflowY: 'auto', minHeight: 0 }}>
            {orderedRouteLanes.map((lane) => {
              const routeStatus = String(lane.route.workflowStatus || lane.route.status);
              const editable = isEditableRoute(routeStatus);
              const selected = lane.route.id === selectedLane?.route.id;
              return (
                <Box
                  key={lane.route.id}
                  sx={{
                    border: '1px solid',
                    borderColor: selected ? alpha('#B97129', 0.38) : 'divider',
                    borderRadius: 1.2,
                    overflow: 'hidden',
                    bgcolor: selected ? alpha('#B97129', 0.04) : 'background.paper',
                  }}
                >
                  <ListItemButton
                    onClick={() => setSelectedRouteId(lane.route.id)}
                    sx={{
                      py: 0.95,
                      px: 1.15,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      borderLeft: selected ? '3px solid #B97129' : '3px solid transparent',
                    }}
                  >
                    <ListItemText
                      primary={`Route ${lane.route.id.slice(0, 8)}`}
                      secondary={`${lane.stops.length} stops • ${
                        vehicleNameById[lane.route.vehicleId || ''] || 'Vehicle pending'
                      } • ${driverNameById[lane.route.driverId || ''] || 'Driver pending'}`}
                      primaryTypographyProps={{ fontWeight: 800, noWrap: true }}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                    <Stack spacing={0.45} alignItems="flex-end">
                      <StatusPill
                        label={routeStatus.replace(/_/g, ' ')}
                        tone={statusTone(routeStatus)}
                      />
                      <StatusPill
                        label={editable ? 'Editable' : 'Read only'}
                        tone={editable ? 'accent' : 'default'}
                      />
                    </Stack>
                  </ListItemButton>
                  <Droppable droppableId={lane.route.id} isDropDisabled={!editable}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          p: 1,
                          minHeight: 76,
                          bgcolor: snapshot.isDraggingOver
                            ? alpha('#B97129', 0.07)
                            : 'transparent',
                        }}
                      >
                        <Stack spacing={0.65}>
                          {lane.stops.map((stop, index) => (
                            <Draggable
                              key={stop.jobId}
                              draggableId={stop.jobId}
                              index={index}
                              isDragDisabled={!editable}
                            >
                              {(dragProvided, dragSnapshot) => (
                                <Box
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  sx={{
                                    px: 0.95,
                                    py: 0.7,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: dragSnapshot.isDragging
                                      ? alpha('#B97129', 0.42)
                                      : 'divider',
                                    bgcolor: dragSnapshot.isDragging
                                      ? alpha('#B97129', 0.07)
                                      : trovanRowColor(editable, isDark),
                                    cursor: editable ? 'grab' : 'not-allowed',
                                  }}
                                >
                                  <Stack spacing={0.25}>
                                    <Stack direction="row" justifyContent="space-between" gap={1}>
                                      <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                                        {stop.job?.customerName || stop.jobId}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {stop.stopSequence}
                                      </Typography>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                      {stop.job?.deliveryAddress || 'Address pending'}
                                    </Typography>
                                  </Stack>
                                </Box>
                              )}
                            </Draggable>
                          ))}
                          {lane.stops.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ px: 0.4, py: 1 }}>
                              No future stops in this lane.
                            </Typography>
                          ) : null}
                        </Stack>
                        {provided.placeholder}
                      </Box>
                    )}
                  </Droppable>
                </Box>
              );
            })}
          </Stack>
        </DragDropContext>
      )}
    </SurfacePanel>
  );

  const mapPanel = (
    <SurfacePanel
      variant="canvas"
      padding={0}
      sx={{
        overflow: 'hidden',
        minHeight: isDesktopWorkspace ? 0 : { xs: 430, md: 540 },
        height: isDesktopWorkspace ? '100%' : { xs: 430, md: 540 },
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
          <Typography variant="h6">Live dispatch map</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            Execution map stays in the first viewport while lanes update.
          </Typography>
        </Box>
        <StatusPill
          label={selectedLane ? `Route ${selectedLane.route.id.slice(0, 8)}` : `${mapRoutes.length} routes`}
          tone={selectedLane ? 'accent' : 'default'}
        />
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {mapRoutes.length ? (
          <MultiRouteMap
            routes={mapRoutes}
            height="100%"
            selectedRouteId={selectedRouteId}
            onRouteSelect={(routeId) => {
              if (routeId) setSelectedRouteId(routeId);
            }}
          />
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Publish a route plan to populate the live dispatch map.
            </Typography>
          </Box>
        )}
      </Box>
    </SurfacePanel>
  );

  const inspectorPanel = (
    <RouteInspectorPanel
      title={selectedLane ? `Route ${selectedLane.route.id.slice(0, 8)}` : 'Route inspector'}
      subtitle={
        selectedLane
          ? `${vehicleNameById[selectedLane.route.vehicleId || ''] || 'Vehicle pending'} • ${
              driverNameById[selectedLane.route.driverId || ''] || 'Driver pending'
            }`
          : 'Select a route lane or map route to inspect execution state.'
      }
      status={
        selectedLane ? (
          <StatusPill
            label={String(selectedLane.route.workflowStatus || selectedLane.route.status).replace(/_/g, ' ')}
            tone={statusTone(String(selectedLane.route.workflowStatus || selectedLane.route.status))}
          />
        ) : null
      }
      actions={
        selectedLane ? (
          <>
            <Button
              variant="outlined"
              size="small"
              disabled={savingRouteId === selectedLane.route.id}
              onClick={() => void handleRouteAction(selectedLane.route.id, 'assign')}
            >
              Save driver
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={savingRouteId === selectedLane.route.id}
              onClick={() => void handleRouteAction(selectedLane.route.id, 'dispatch')}
            >
              Dispatch
            </Button>
            <Button
              variant="contained"
              size="small"
              disabled={savingRouteId === selectedLane.route.id}
              onClick={() => void handleRouteAction(selectedLane.route.id, 'start')}
            >
              Start
            </Button>
          </>
        ) : null
      }
      summary={
        selectedLane ? (
          <Stack spacing={0.75}>
            <Typography variant="body2" color="text.secondary">
              {selectedLane.stops.length} stops • {selectedLane.exceptions.length} exceptions
            </Typography>
            <TextField
              select
              size="small"
              label="Assign driver"
              value={
                selectedDriverByRoute[selectedLane.route.id] ??
                selectedLane.route.driverId ??
                ''
              }
              onChange={(event) =>
                setSelectedDriverByRoute((current) => ({
                  ...current,
                  [selectedLane.route.id]: event.target.value,
                }))
              }
            >
              <MenuItem value="">Unassigned</MenuItem>
              {drivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  {driverNameById[driver.id]}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1}>
              <Button
                component={RouterLink}
                to={`/route-runs/${selectedLane.route.id}`}
                variant="text"
                size="small"
              >
                Open detail
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => setExceptionDialogOpen(true)}
              >
                Create route exception
              </Button>
            </Stack>
          </Stack>
        ) : null
      }
    >
      {!selectedLane ? (
        <Typography variant="body2" color="text.secondary">
          Select a route to inspect driver assignment, future stops, and pressure.
        </Typography>
      ) : (
        <Stack spacing={1.15}>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.75 }}>
              Future stops
            </Typography>
            <Stack spacing={0.65}>
              {selectedLane.stops.map((stop) => (
                <Box
                  key={stop.id}
                  sx={{
                    px: 1,
                    py: 0.75,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                    {stop.stopSequence}. {stop.job?.customerName || stop.jobId}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {stop.job?.deliveryAddress || 'Address pending'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 0.75 }}>
              Route pressure
            </Typography>
            {selectedLane.exceptions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No active exceptions on the selected route.
              </Typography>
            ) : (
              <List disablePadding>
                {selectedLane.exceptions.map((item) => (
                  <ListItem
                    key={item.id}
                    disableGutters
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <ListItemText primary={item.code} secondary={item.message} />
                    <StatusPill label={item.status} tone={statusTone(item.status)} />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Stack>
      )}
    </RouteInspectorPanel>
  );

  return (
    <Box data-testid="dispatch-board-page" sx={{ display: 'grid', gap: 1.5 }}>
      {commandBar}

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      {isDesktopWorkspace ? (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: '315px minmax(640px, 1fr) 320px',
            alignItems: 'stretch',
            height: 'calc(100vh - 176px)',
            minHeight: 640,
          }}
        >
          {lanesPanel}
          {mapPanel}
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
            <ToggleButton value="inspector">Inspector</ToggleButton>
          </ToggleButtonGroup>
          {mobilePanel === 'map' ? mapPanel : null}
          {mobilePanel === 'routes' ? lanesPanel : null}
          {mobilePanel === 'inspector' ? inspectorPanel : null}
        </Box>
      )}

      <Dialog
        open={exceptionDialogOpen}
        onClose={() => setExceptionDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create Exception</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            label="Code"
            value={exceptionForm.code}
            onChange={(event) =>
              setExceptionForm((current) => ({ ...current, code: event.target.value }))
            }
            placeholder="DELAY"
            fullWidth
          />
          <TextField
            label="Message"
            value={exceptionForm.message}
            onChange={(event) =>
              setExceptionForm((current) => ({
                ...current,
                message: event.target.value,
              }))
            }
            multiline
            minRows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExceptionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void submitException()}
            disabled={!selectedLane || !exceptionForm.code.trim() || !exceptionForm.message.trim()}
          >
            Create exception
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function trovanRowColor(editable: boolean, isDark: boolean) {
  if (isDark) return editable ? 'rgba(21, 18, 16, 0.94)' : 'rgba(11, 9, 8, 0.68)';
  return editable ? 'rgba(255, 253, 249, 0.78)' : 'rgba(239, 231, 220, 0.66)';
}
