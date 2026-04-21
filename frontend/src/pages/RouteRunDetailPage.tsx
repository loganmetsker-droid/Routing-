import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import {
  addRouteRunStopNote,
  addRouteRunStopProof,
  completeRouteRun,
  failRouteRunStop,
  getRouteRunDetail,
  markRouteRunStopArrived,
  markRouteRunStopServiced,
  rescheduleRouteRunStop,
  RouteRunStopRecord,
  startRouteRun,
} from '../features/dispatch/api/routeRunsApi';

function statusColor(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced', 'resolved'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'error';
  if (['in_progress', 'arrived', 'assigned', 'ready_for_dispatch'].includes(normalized)) return 'info';
  if (['open', 'rescheduled'].includes(normalized)) return 'warning';
  return 'default';
}

export default function RouteRunDetailPage() {
  const { id = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [actionStop, setActionStop] = useState<RouteRunStopRecord | null>(null);
  const [actionType, setActionType] = useState<'note' | 'proof' | 'fail' | 'reschedule' | null>(null);
  const [inputValue, setInputValue] = useState('');

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await getRouteRunDetail(id));
    } catch (err: any) {
      setError(err?.message || 'Failed to load route run detail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [id]);

  const eventsByStop = useMemo(() => {
    const events = detail?.stopEvents || [];
    return events.reduce((acc: Record<string, any[]>, event: any) => {
      acc[event.routeRunStopId] = [...(acc[event.routeRunStopId] || []), event];
      return acc;
    }, {});
  }, [detail]);

  const proofsByStop = useMemo(() => {
    const proofs = detail?.proofArtifacts || [];
    return proofs.reduce((acc: Record<string, any[]>, proof: any) => {
      acc[proof.routeRunStopId] = [...(acc[proof.routeRunStopId] || []), proof];
      return acc;
    }, {});
  }, [detail]);

  const runStopAction = async (stopId: string, action: 'arrived' | 'serviced') => {
    setError(null);
    try {
      if (action === 'arrived') await markRouteRunStopArrived(stopId);
      if (action === 'serviced') await markRouteRunStopServiced(stopId);
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Stop update failed.');
    }
  };

  const submitModalAction = async () => {
    if (!actionStop || !actionType) return;
    setError(null);
    try {
      if (actionType === 'note') await addRouteRunStopNote(actionStop.id, inputValue);
      if (actionType === 'proof') await addRouteRunStopProof(actionStop.id, { type: 'PHOTO', uri: inputValue, metadata: { source: 'dispatcher-ui' } });
      if (actionType === 'fail') await failRouteRunStop(actionStop.id, inputValue);
      if (actionType === 'reschedule') await rescheduleRouteRunStop(actionStop.id, inputValue);
      setActionStop(null);
      setActionType(null);
      setInputValue('');
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Stop action failed.');
    }
  };

  const handleStartRoute = async () => {
    setError(null);
    try {
      await startRouteRun(id);
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Failed to start route run.');
    }
  };

  const handleCompleteRoute = async () => {
    setError(null);
    try {
      await completeRouteRun(id);
      await loadDetail();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete route run.');
    }
  };

  if (loading) {
    return <LoadingState label="Loading route run detail..." minHeight="50vh" />;
  }

  if (!detail?.routeRun) {
    return (
      <Box>
        <Alert severity="error">{error || 'Route run not found.'}</Alert>
      </Box>
    );
  }

  return (
    <Box data-testid="route-run-detail-page">
      <PageHeader
        eyebrow="Dispatch"
        title={`Route Run ${detail.routeRun.id.slice(0, 8)}`}
        subtitle="Execution detail with live stop controls, proofs, notes, and exception context."
        actions={
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/dispatch" variant="outlined">Back to board</Button>
            <Button component={RouterLink} to="/exceptions" variant="outlined">Exceptions</Button>
            <Button variant="outlined" onClick={() => void handleStartRoute()} data-testid="route-run-start-button">Start Route</Button>
            <Button variant="contained" onClick={() => void handleCompleteRoute()} data-testid="route-run-complete-button">Complete Route</Button>
          </Stack>
        }
      />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Grid container spacing={2.5}>
        <Grid item xs={12} xl={4}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Route Summary</Typography>
              <Stack spacing={1}>
                <Chip label={detail.routeRun.status} color={statusColor(detail.routeRun.status)} data-testid="route-run-status-chip" />
                <Typography variant="body2" color="text.secondary">Distance: {Number(detail.routeRun.totalDistanceKm || 0).toFixed(1)} km</Typography>
                <Typography variant="body2" color="text.secondary">Duration: {detail.routeRun.totalDurationMinutes || 0} min</Typography>
                <Typography variant="body2" color="text.secondary">Jobs: {detail.routeRun.jobCount || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Planned start: {detail.routeRun.plannedStart || '—'}</Typography>
                <Typography variant="body2" color="text.secondary">Actual start: {detail.routeRun.actualStart || '—'}</Typography>
                <Typography variant="body2" color="text.secondary">Completed: {detail.routeRun.completedAt || '—'}</Typography>
              </Stack>
            </SurfacePanel>
            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Exceptions</Typography>
              <List disablePadding>
                {(detail.exceptions || []).map((item: any) => (
                  <ListItem key={item.id} disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <ListItemText primary={item.code} secondary={item.message} />
                    <Chip label={item.status} size="small" color={statusColor(item.status)} />
                  </ListItem>
                ))}
                {(detail.exceptions || []).length === 0 ? <Typography variant="body2" color="text.secondary">No exceptions on this route run.</Typography> : null}
              </List>
            </SurfacePanel>
          </Stack>
        </Grid>
        <Grid item xs={12} xl={8}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h5" sx={{ mb: 1.5 }}>Stops</Typography>
              <Stack spacing={2}>
                {(detail.stops || []).map((stop: RouteRunStopRecord, index: number) => (
                  <SurfacePanel key={stop.id} sx={{ bgcolor: 'rgba(255,248,242,1)' }} data-testid={`route-run-stop-card-${index}`}>
                    <Stack spacing={1.25}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="h6">Stop {stop.stopSequence}</Typography>
                          <Typography variant="body2" color="text.secondary">Job {stop.jobId.slice(0, 8)}</Typography>
                        </Box>
                        <Chip label={stop.status} color={statusColor(stop.status)} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Planned: {stop.plannedArrival || '—'} • Arrived: {stop.actualArrival || '—'} • Departed: {stop.actualDeparture || '—'}
                      </Typography>
                      {stop.notes ? <Typography variant="body2">Latest note: {stop.notes}</Typography> : null}
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                        <Button variant="outlined" onClick={() => void runStopAction(stop.id, 'arrived')} data-testid={`route-run-stop-arrived-button-${index}`}>Mark arrived</Button>
                        <Button variant="outlined" color="success" onClick={() => void runStopAction(stop.id, 'serviced')} data-testid={`route-run-stop-serviced-button-${index}`}>Mark serviced</Button>
                        <Button variant="outlined" color="warning" onClick={() => { setActionStop(stop); setActionType('reschedule'); }} data-testid={`route-run-stop-reschedule-button-${index}`}>Reschedule</Button>
                        <Button variant="outlined" color="error" onClick={() => { setActionStop(stop); setActionType('fail'); }} data-testid={`route-run-stop-fail-button-${index}`}>Fail</Button>
                        <Button variant="outlined" onClick={() => { setActionStop(stop); setActionType('note'); }} data-testid={`route-run-stop-note-button-${index}`}>Add note</Button>
                        <Button variant="outlined" onClick={() => { setActionStop(stop); setActionType('proof'); }} data-testid={`route-run-stop-proof-button-${index}`}>Add proof</Button>
                      </Stack>
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Timeline</Typography>
                          <List dense disablePadding data-testid={`route-run-stop-timeline-${index}`}>
                            {(eventsByStop[stop.id] || []).map((event: any) => (
                              <ListItem key={event.id} disableGutters>
                                <ListItemText primary={event.eventType} secondary={JSON.stringify(event.payload || {})} />
                              </ListItem>
                            ))}
                            {(eventsByStop[stop.id] || []).length === 0 ? <Typography variant="body2" color="text.secondary">No timeline events yet.</Typography> : null}
                          </List>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Proofs</Typography>
                          <List dense disablePadding data-testid={`route-run-stop-proofs-${index}`}>
                            {(proofsByStop[stop.id] || []).map((proof: any) => (
                              <ListItem key={proof.id} disableGutters>
                                <ListItemText primary={proof.type} secondary={proof.uri} />
                              </ListItem>
                            ))}
                            {(proofsByStop[stop.id] || []).length === 0 ? <Typography variant="body2" color="text.secondary">No proofs captured yet.</Typography> : null}
                          </List>
                        </Grid>
                      </Grid>
                    </Stack>
                  </SurfacePanel>
                ))}
              </Stack>
            </SurfacePanel>
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={Boolean(actionStop && actionType)} onClose={() => { setActionStop(null); setActionType(null); setInputValue(''); }} fullWidth maxWidth="sm">
        <DialogTitle>{actionType === 'proof' ? 'Add proof URL' : actionType === 'note' ? 'Add stop note' : actionType === 'fail' ? 'Fail stop' : 'Reschedule stop'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label={actionType === 'proof' ? 'Proof URL' : 'Details'}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            multiline
            minRows={3}
            inputProps={{ 'data-testid': 'route-run-action-input' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setActionStop(null); setActionType(null); setInputValue(''); }}>Cancel</Button>
          <Button variant="contained" onClick={() => void submitModalAction()} disabled={!inputValue.trim()} data-testid="route-run-action-save">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
