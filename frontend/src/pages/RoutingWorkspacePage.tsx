import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import {
  PlannerRoutePlan,
  PlannerRoutePlanGroup,
  PlannerRoutePlanStop,
  generateDraftRoutePlan,
  getDrivers,
  getJobs,
  getPlanner,
  getVehicles,
  publishRoutePlan,
  reoptimizeRoutePlan,
  updateRoutePlanGroup,
  updateRoutePlanStop,
} from '../services/api';
import type { DispatchJob, DispatchVehicle } from '../types/dispatch';

const objectives = [
  { value: 'distance', label: 'Minimize distance' },
  { value: 'time', label: 'Minimize time' },
  { value: 'balance', label: 'Balance workload' },
  { value: 'sla', label: 'Protect SLAs' },
];

function todayServiceDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function RoutingWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<DispatchJob[]>([]);
  const [vehicles, setVehicles] = useState<DispatchVehicle[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [plan, setPlan] = useState<PlannerRoutePlan | null>(null);
  const [groups, setGroups] = useState<PlannerRoutePlanGroup[]>([]);
  const [stops, setStops] = useState<PlannerRoutePlanStop[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [unassignedJobs, setUnassignedJobs] = useState<DispatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [objective, setObjective] = useState('distance');
  const [serviceDate, setServiceDate] = useState(todayServiceDate());

  const loadWorkspace = async (nextServiceDate = serviceDate) => {
    setLoading(true);
    setError(null);
    try {
      const [jobsData, vehiclesData, driversData, plannerData] = await Promise.all([
        getJobs(),
        getVehicles(),
        getDrivers(),
        getPlanner(nextServiceDate),
      ]);
      const safeJobs = Array.isArray(jobsData) ? (jobsData as DispatchJob[]) : [];
      const safeVehicles = Array.isArray(vehiclesData) ? (vehiclesData as DispatchVehicle[]) : [];
      const safeDrivers = Array.isArray(driversData) ? driversData : [];
      setJobs(safeJobs);
      setVehicles(safeVehicles);
      setDrivers(safeDrivers);
      setPlan(plannerData.plan || null);
      setGroups(plannerData.groups || []);
      setStops(plannerData.stops || []);
      setSelectedGroupId(plannerData.groups?.[0]?.id || null);
      setUnassignedJobs(plannerData.unassignedJobs || []);
      const seededJobs = searchParams.getAll('jobId');
      setSelectedJobIds(seededJobs.length ? seededJobs : safeJobs.filter((job) => !job.assignedRouteId).slice(0, 12).map((job) => job.id));
      setSelectedVehicleIds(safeVehicles.slice(0, 4).map((vehicle) => vehicle.id));
      if (plannerData.plan?.objective) {
        setObjective(plannerData.plan.objective);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load planner workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace(serviceDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [groups, stops, jobs]);

  const selectedGroup = groupedStops.find((group) => group.id === selectedGroupId) || groupedStops[0] || null;

  const refreshPlanView = (payload: any) => {
    setPlan(payload.routePlan || payload.plan || null);
    setGroups(payload.groups || []);
    setStops(payload.stops || []);
    setSelectedGroupId((current) => current && (payload.groups || []).some((group: any) => group.id === current) ? current : payload.groups?.[0]?.id || null);
  };

  const moveStop = async (stopId: string, direction: 'up' | 'down' | 'next-group') => {
    if (!plan?.id || !selectedGroup) return;
    const ordered = selectedGroup.stops;
    const currentIndex = ordered.findIndex((stop) => stop.id === stopId);
    if (currentIndex < 0) return;
    const currentStop = ordered[currentIndex];
    let payload: { targetGroupId?: string; targetSequence?: number; isLocked?: boolean } = {};
    if (direction === 'up' && currentIndex > 0) payload = { targetSequence: currentIndex };
    if (direction === 'down' && currentIndex < ordered.length - 1) payload = { targetSequence: currentIndex + 2 };
    if (direction === 'next-group') {
      const currentGroupIndex = groupedStops.findIndex((group) => group.id === selectedGroup.id);
      const fallbackGroup = groupedStops[(currentGroupIndex + 1) % groupedStops.length];
      if (fallbackGroup && fallbackGroup.id !== selectedGroup.id) {
        payload = { targetGroupId: fallbackGroup.id, targetSequence: 1 };
      }
    }
    if (Object.keys(payload).length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateRoutePlanStop(plan.id, currentStop.id, payload);
      refreshPlanView(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to move route stop.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStopLock = async (stopId: string, isLocked: boolean) => {
    if (!plan?.id) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateRoutePlanStop(plan.id, stopId, { isLocked: !isLocked });
      refreshPlanView(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to update stop lock.');
    } finally {
      setSaving(false);
    }
  };

  const updateAssignments = async (groupId: string, payload: { driverId?: string; vehicleId?: string }) => {
    if (!plan?.id) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateRoutePlanGroup(plan.id, groupId, payload);
      refreshPlanView(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to update route assignment.');
    } finally {
      setSaving(false);
    }
  };

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
      const plannerData = await getPlanner(serviceDate);
      setUnassignedJobs(plannerData.unassignedJobs || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate route draft.');
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
      const plannerData = await getPlanner(serviceDate);
      setUnassignedJobs(plannerData.unassignedJobs || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to reoptimize plan.');
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
      await loadWorkspace(serviceDate);
      navigate('/dispatch');
    } catch (err: any) {
      setError(err?.message || 'Failed to publish route plan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading routing workspace..." minHeight="50vh" />;
  }

  return (
    <Box data-testid="routing-workspace-page">
      <PageHeader
        eyebrow="Operations"
        title="Routing Planner"
        subtitle="Generate deterministic route drafts, assign vehicles, review stop sequences, and publish into live dispatch runs."
        actions={
          <>
            <Chip label={`${selectedJobIds.length} jobs`} color="primary" />
            <Chip label={`${groups.length} draft routes`} variant="outlined" />
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={saving || selectedJobIds.length === 0 || selectedVehicleIds.length === 0}
              data-testid="routing-generate-draft-button"
            >
              Generate Draft
            </Button>
            <Button variant="outlined" onClick={handleReoptimize} disabled={!plan?.id || saving}>
              Reoptimize
            </Button>
            <Button variant="outlined" color="success" onClick={handlePublish} disabled={!plan?.id || saving} data-testid="routing-publish-button">
              Publish
            </Button>
          </>
        }
      />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {plan?.warnings?.length ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {plan.warnings.map((warning) => typeof warning === 'string' ? warning : JSON.stringify(warning)).join(' • ')}
        </Alert>
      ) : null}

      <Grid container spacing={2.5}>
        <Grid item xs={12} xl={3}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h5" sx={{ mb: 1.5 }}>Planner Setup</Typography>
              <Stack spacing={2}>
                <TextField label="Service date" type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField select label="Objective" value={objective} onChange={(event) => setObjective(event.target.value)}>
                  {objectives.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
                </TextField>
                <FormControlLabel control={<Checkbox checked disabled />} label="Deterministic optimizer" />
                <FormControlLabel control={<Checkbox checked disabled />} label="Capacity constraints" />
                <FormControlLabel control={<Checkbox checked disabled />} label="Service times" />
                <FormControlLabel control={<Checkbox checked disabled />} label="Shift awareness" />
              </Stack>
            </SurfacePanel>

            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Unassigned Jobs</Typography>
              <List dense disablePadding>
                {(unassignedJobs.length ? unassignedJobs : jobs).slice(0, 18).map((job, index) => {
                  const selected = selectedJobIds.includes(job.id);
                  return (
                    <ListItem key={job.id} disableGutters data-testid={`routing-job-row-${index}`}>
                      <Checkbox
                        checked={selected}
                        onChange={() => setSelectedJobIds((current) => current.includes(job.id) ? current.filter((id) => id !== job.id) : [...current, job.id])}
                        data-testid={`routing-job-checkbox-${index}`}
                      />
                      <ListItemText primary={job.customerName || 'Job'} secondary={job.deliveryAddress || 'Address pending'} />
                    </ListItem>
                  );
                })}
              </List>
            </SurfacePanel>

            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Vehicles</Typography>
              <List dense disablePadding>
                {vehicles.slice(0, 12).map((vehicle, index) => {
                  const selected = selectedVehicleIds.includes(vehicle.id);
                  return (
                    <ListItem key={vehicle.id} disableGutters data-testid={`routing-vehicle-row-${index}`}>
                      <Checkbox
                        checked={selected}
                        onChange={() => setSelectedVehicleIds((current) => current.includes(vehicle.id) ? current.filter((id) => id !== vehicle.id) : [...current, vehicle.id])}
                        data-testid={`routing-vehicle-checkbox-${index}`}
                      />
                      <ListItemText primary={vehicle.licensePlate || `${vehicle.make || 'Vehicle'} ${vehicle.model || ''}`.trim()} secondary={`${vehicle.status || 'fleet'} • ${vehicle.capacity || 0} kg`} />
                    </ListItem>
                  );
                })}
              </List>
            </SurfacePanel>
          </Stack>
        </Grid>

        <Grid item xs={12} xl={5}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h5" sx={{ mb: 1.5 }}>Draft Routes</Typography>
              <Stack spacing={2}>
                {groupedStops.length === 0 ? (
                  <Typography color="text.secondary">Generate a draft to see route groups and stop sequences.</Typography>
                ) : groupedStops.map((group, index) => (
                  <SurfacePanel
                    key={group.id}
                    sx={{ bgcolor: group.id === selectedGroup?.id ? 'rgba(255,242,226,1)' : 'rgba(255,248,242,1)', cursor: 'pointer' }}
                    onClick={() => setSelectedGroupId(group.id)}
                    data-testid={`routing-draft-route-card-${index}`}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Box>
                        <Typography variant="h6">{group.label}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {group.stops.length} stops • {Number(group.totalDistanceKm || 0).toFixed(1)} km • {group.totalDurationMinutes || 0} min
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        {group.id === selectedGroup?.id ? <Chip label="Selected" color="primary" /> : null}
                        <Chip label={group.vehicleId ? 'Assigned vehicle' : 'Needs vehicle'} color={group.vehicleId ? 'success' : 'default'} />
                      </Stack>
                    </Stack>
                    <List dense disablePadding>
                      {group.stops.map((stop) => (
                        <ListItem key={stop.id} disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                          <ListItemText
                            primary={`${stop.stopSequence}. ${stop.job?.customerName || stop.jobId}`}
                            secondary={`${String(stop.metadata?.stopType || 'STOP')} • ${String(stop.metadata?.address || stop.job?.deliveryAddress || '')}`}
                          />
                          {stop.isLocked ? <Chip size="small" label="Locked" color="warning" /> : null}
                        </ListItem>
                      ))}
                    </List>
                  </SurfacePanel>
                ))}
              </Stack>
            </SurfacePanel>
          </Stack>
        </Grid>

        <Grid item xs={12} xl={4}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h5" sx={{ mb: 1.5 }}>Planner Summary</Typography>
              <Stack spacing={1.5}>
                <Chip label={plan ? `Plan ${plan.status}` : 'No draft yet'} color={plan ? 'success' : 'default'} />
                <Typography variant="body2" color="text.secondary">Service date: {serviceDate}</Typography>
                <Typography variant="body2" color="text.secondary">Objective: {objectives.find((item) => item.value === objective)?.label}</Typography>
                <Typography variant="body2" color="text.secondary">Routes: {groups.length}</Typography>
                <Typography variant="body2" color="text.secondary">Stops: {stops.length}</Typography>
                <Typography variant="body2" color="text.secondary">Unassigned jobs: {unassignedJobs.length}</Typography>
              </Stack>
            </SurfacePanel>

            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Selected Route Detail</Typography>
              {!selectedGroup ? (
                <Typography variant="body2" color="text.secondary">Choose a draft route to edit assignments and stop order.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="text.secondary">{selectedGroup.label}</Typography>
                  <TextField
                    select
                    size="small"
                    label="Vehicle"
                    value={selectedGroup.vehicleId || ''}
                    onChange={(event) => void updateAssignments(selectedGroup.id, { vehicleId: event.target.value || undefined, driverId: selectedGroup.driverId || undefined })}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {vehicles.map((vehicle) => <MenuItem key={vehicle.id} value={vehicle.id}>{vehicle.licensePlate || vehicle.id}</MenuItem>)}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Driver"
                    value={selectedGroup.driverId || ''}
                    onChange={(event) => void updateAssignments(selectedGroup.id, { driverId: event.target.value || undefined, vehicleId: selectedGroup.vehicleId || undefined })}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {drivers.map((driver) => <MenuItem key={driver.id} value={driver.id}>{[driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.id}</MenuItem>)}
                  </TextField>
                  <List dense disablePadding>
                    {selectedGroup.stops.map((stop, index) => (
                      <ListItem key={stop.id} disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider', alignItems: 'flex-start' }}>
                        <ListItemText
                          primary={`${stop.stopSequence}. ${stop.job?.customerName || stop.jobId}`}
                          secondary={`${String(stop.metadata?.stopType || 'STOP')} • ${String(stop.metadata?.address || stop.job?.deliveryAddress || '')}`}
                        />
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" onClick={() => void moveStop(stop.id, 'up')} disabled={index === 0 || saving}>↑</Button>
                          <Button size="small" onClick={() => void moveStop(stop.id, 'down')} disabled={index === selectedGroup.stops.length - 1 || saving}>↓</Button>
                          <Button size="small" onClick={() => void moveStop(stop.id, 'next-group')} disabled={groupedStops.length < 2 || saving}>Move</Button>
                          <Button size="small" color={stop.isLocked ? 'warning' : 'inherit'} onClick={() => void toggleStopLock(stop.id, stop.isLocked)} disabled={saving}>{stop.isLocked ? 'Unlock' : 'Lock'}</Button>
                        </Stack>
                      </ListItem>
                    ))}
                  </List>
                </Stack>
              )}
            </SurfacePanel>

            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Unassigned After Planning</Typography>
              {unassignedJobs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">All selected jobs were placed into draft routes.</Typography>
              ) : (
                <List disablePadding>
                  {unassignedJobs.map((job) => (
                    <ListItem key={job.id} disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                      <ListItemText primary={job.customerName} secondary={job.deliveryAddress || 'Address pending'} />
                    </ListItem>
                  ))}
                </List>
              )}
            </SurfacePanel>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
