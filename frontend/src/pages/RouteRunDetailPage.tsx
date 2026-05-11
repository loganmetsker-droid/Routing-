import { useMemo, useState } from 'react';
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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import {
  useCreateExceptionMutation,
  NotificationDeliveryRecord,
  RouteRunStopRecord,
  type RouteRunMessageRecord,
  type ProofArtifactRecord,
  type StopEventRecord,
  useCreateRouteRunMessageMutation,
  useRouteRunShareLinkMutation,
  useRouteRunMessagesQuery,
  getRouteRunsErrorMessage,
  fetchProofArtifactBlob,
  useCompleteRouteRunMutation,
  useRouteRunDetailQuery,
  useRouteRunStopMutation,
  useStartRouteRunMutation,
} from '../features/dispatch/api/routeRunsApi';

function statusColor(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced', 'resolved'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'error';
  if (['in_progress', 'arrived', 'assigned', 'ready_for_dispatch'].includes(normalized)) return 'info';
  if (['open', 'rescheduled'].includes(normalized)) return 'warning';
  return 'default';
}

function deliverySummary(delivery: NotificationDeliveryRecord) {
  const parts = [
    delivery.channel,
    delivery.recipient,
    delivery.provider,
    delivery.sentAt || delivery.createdAt || 'Pending timestamp',
  ];
  return parts.filter(Boolean).join(' • ');
}

function formatWhen(value?: string | null) {
  if (!value) return 'Pending timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function signatureSummary(proof: ProofArtifactRecord) {
  const metadata = proof.metadata || {};
  const signerName = typeof metadata.signerName === 'string' ? metadata.signerName : 'Signer pending';
  const capturedAt = typeof metadata.capturedAt === 'string' ? metadata.capturedAt : proof.createdAt;
  return `${signerName} • ${formatWhen(capturedAt)}`;
}

function SignatureProofPreview({ proof }: { proof: ProofArtifactRecord }) {
  const strokes = Array.isArray(proof.metadata?.strokes)
    ? (proof.metadata?.strokes as Array<Array<{ x?: number; y?: number }>>)
    : [];

  if (!strokes.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        Signature strokes unavailable.
      </Typography>
    );
  }

  return (
    <Box
      component="svg"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      sx={{
        width: '100%',
        height: 96,
        mt: 0.75,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.04)',
      }}
    >
      {strokes.map((stroke, index) => {
        const points = stroke
          .map((point) => `${Number(point.x || 0)},${Number(point.y || 0)}`)
          .join(' ');
        return (
          <polyline
            key={`${proof.id}-${index}`}
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.012"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </Box>
  );
}

export default function RouteRunDetailPage() {
  const { id = '' } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [actionStop, setActionStop] = useState<RouteRunStopRecord | null>(null);
  const [actionType, setActionType] = useState<'note' | 'proof' | 'fail' | 'reschedule' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionCode, setExceptionCode] = useState('');
  const [exceptionMessage, setExceptionMessage] = useState('');
  const [exceptionStopId, setExceptionStopId] = useState('');
  const [routeMessageDraft, setRouteMessageDraft] = useState('');
  const routeRunDetailQuery = useRouteRunDetailQuery(id);
  const routeMessagesQuery = useRouteRunMessagesQuery(id);
  const startRouteMutation = useStartRouteRunMutation();
  const completeRouteMutation = useCompleteRouteRunMutation();
  const stopMutation = useRouteRunStopMutation();
  const shareLinkMutation = useRouteRunShareLinkMutation();
  const createExceptionMutation = useCreateExceptionMutation();
  const createMessageMutation = useCreateRouteRunMessageMutation();
  const detail = routeRunDetailQuery.data ?? null;
  const loading = routeRunDetailQuery.isLoading;
  const routeMessages: RouteRunMessageRecord[] =
    routeMessagesQuery.data?.messages || detail?.messages || [];

  const eventsByStop = useMemo(() => {
    const events = detail?.stopEvents || [];
    return events.reduce<Record<string, StopEventRecord[]>>((acc, event) => {
      acc[event.routeRunStopId] = [...(acc[event.routeRunStopId] || []), event];
      return acc;
    }, {});
  }, [detail]);

  const proofsByStop = useMemo(() => {
    const proofs = detail?.proofArtifacts || [];
    return proofs.reduce<Record<string, ProofArtifactRecord[]>>((acc, proof) => {
      acc[proof.routeRunStopId] = [...(acc[proof.routeRunStopId] || []), proof];
      return acc;
    }, {});
  }, [detail]);

  const runStopAction = async (stopId: string, action: 'arrived' | 'serviced') => {
    setError(null);
    try {
      await stopMutation.mutateAsync({
        routeRunId: id,
        stopId,
        kind: action,
      });
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const submitModalAction = async () => {
    if (!actionStop || !actionType) return;
    setError(null);
    try {
      await stopMutation.mutateAsync({
        routeRunId: id,
        stopId: actionStop.id,
        kind: actionType,
        value: inputValue,
      });
      setActionStop(null);
      setActionType(null);
      setInputValue('');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const handleStartRoute = async () => {
    setError(null);
    try {
      await startRouteMutation.mutateAsync(id);
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const handleCompleteRoute = async () => {
    setError(null);
    try {
      await completeRouteMutation.mutateAsync(id);
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const handleCopyTrackingLink = async () => {
    setError(null);
    try {
      const link = await shareLinkMutation.mutateAsync(id);
      await navigator.clipboard.writeText(link.url);
      setError(`Tracking link copied: ${link.url}`);
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const handleCreateException = async () => {
    setError(null);
    try {
      await createExceptionMutation.mutateAsync({
        routeId: id,
        routeRunStopId: exceptionStopId || undefined,
        code: exceptionCode.trim().toUpperCase(),
        message: exceptionMessage.trim(),
        details: { source: 'route-run-detail' },
      });
      setExceptionDialogOpen(false);
      setExceptionCode('');
      setExceptionMessage('');
      setExceptionStopId('');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const handleSendRouteMessage = async () => {
    if (!routeMessageDraft.trim()) return;
    setError(null);
    try {
      await createMessageMutation.mutateAsync({
        routeRunId: id,
        payload: {
          body: routeMessageDraft.trim(),
          routeRunStopId: null,
        },
      });
      setRouteMessageDraft('');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const openProofFile = async (proof: ProofArtifactRecord) => {
    setError(null);
    try {
      const { blob, filename } = await fetchProofArtifactBlob(proof.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.download = filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
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
            <Button variant="outlined" onClick={() => setExceptionDialogOpen(true)}>New exception</Button>
            <Button variant="outlined" onClick={() => void handleCopyTrackingLink()}>Copy tracking link</Button>
            <Button variant="outlined" onClick={() => void handleStartRoute()} data-testid="route-run-start-button">Start Route</Button>
            <Button variant="contained" onClick={() => void handleCompleteRoute()} data-testid="route-run-complete-button">Complete Route</Button>
          </Stack>
        }
      />
      {error ? <Alert severity={error.startsWith('Tracking link copied:') ? 'success' : 'error'} sx={{ mb: 2 }}>{error}</Alert> : null}
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
                {(detail.exceptions || []).map((item) => (
                  <ListItem key={item.id} disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <ListItemText primary={item.code} secondary={item.message} />
                    <StatusPill label={item.status} tone={statusColor(item.status) === 'error' ? 'danger' : statusColor(item.status) === 'warning' ? 'warning' : statusColor(item.status) === 'success' ? 'success' : statusColor(item.status) === 'info' ? 'info' : 'default'} />
                  </ListItem>
                ))}
                {(detail.exceptions || []).length === 0 ? <Typography variant="body2" color="text.secondary">No exceptions on this route run.</Typography> : null}
              </List>
            </SurfacePanel>
            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Customer Communications
              </Typography>
              <List disablePadding>
                {(detail.notificationDeliveries || []).map((delivery) => (
                  <ListItem
                    key={delivery.id}
                    disableGutters
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      alignItems: 'flex-start',
                    }}
                  >
                    <ListItemText
                      primary={delivery.eventType.replace(/_/g, ' ')}
                      secondary={`${deliverySummary(delivery)}\n${delivery.message}`}
                      secondaryTypographyProps={{ sx: { whiteSpace: 'pre-line' } }}
                    />
                    <Chip
                      label={delivery.status}
                      size="small"
                      color={statusColor(delivery.status)}
                    />
                  </ListItem>
                ))}
                {(detail.notificationDeliveries || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No customer notifications have been logged for this route run yet.
                  </Typography>
                ) : null}
              </List>
            </SurfacePanel>
            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Driver Messages
              </Typography>
              <List disablePadding>
                {routeMessages.map((message) => (
                  <ListItem
                    key={message.id}
                    disableGutters
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      alignItems: 'flex-start',
                    }}
                  >
                    <ListItemText
                      primary={
                        String(message.senderRole).toUpperCase() === 'DRIVER'
                          ? 'Driver'
                          : 'Dispatch'
                      }
                      secondary={`${formatWhen(message.createdAt)}\n${message.body}`}
                      secondaryTypographyProps={{ sx: { whiteSpace: 'pre-line' } }}
                    />
                    <Chip
                      label={
                        String(message.senderRole).toUpperCase() === 'DRIVER'
                          ? message.readByDispatchAt
                            ? 'read'
                            : 'new'
                          : message.readByDriverAt
                            ? 'read'
                            : 'sent'
                      }
                      size="small"
                      color={
                        String(message.senderRole).toUpperCase() === 'DRIVER' &&
                        !message.readByDispatchAt
                          ? 'warning'
                          : 'default'
                      }
                    />
                  </ListItem>
                ))}
                {routeMessages.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No driver-dispatch messages have been sent for this route yet.
                  </Typography>
                ) : null}
              </List>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                <TextField
                  label="Message driver"
                  value={routeMessageDraft}
                  onChange={(event) => setRouteMessageDraft(event.target.value)}
                  fullWidth
                  multiline
                  maxRows={3}
                />
                <Button
                  variant="contained"
                  onClick={() => void handleSendRouteMessage()}
                  disabled={!routeMessageDraft.trim() || createMessageMutation.isPending}
                >
                  Send
                </Button>
              </Stack>
            </SurfacePanel>
          </Stack>
        </Grid>
        <Grid item xs={12} xl={8}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h5" sx={{ mb: 1.5 }}>Stops</Typography>
              <Stack spacing={2}>
                {(detail.stops || []).map((stop: RouteRunStopRecord, index: number) => (
                  <SurfacePanel key={stop.id} sx={{ bgcolor: 'rgba(30,26,23,1)' }} data-testid={`route-run-stop-card-${index}`}>
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
                          <List dense disablePadding>
                            {(eventsByStop[stop.id] || []).map((event) => (
                              <ListItem key={event.id} disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                                <ListItemText primary={event.eventType} secondary={event.happenedAt || 'Timestamp pending'} />
                              </ListItem>
                            ))}
                            {(eventsByStop[stop.id] || []).length === 0 ? <Typography variant="body2" color="text.secondary">No stop events recorded yet.</Typography> : null}
                          </List>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Proofs</Typography>
                          <List dense disablePadding>
                            {(proofsByStop[stop.id] || []).map((proof) => (
                              <ListItem
                                key={proof.id}
                                disableGutters
                                sx={{
                                  borderBottom: '1px solid',
                                  borderColor: 'divider',
                                  alignItems: 'stretch',
                                  flexDirection: 'column',
                                }}
                              >
                                <ListItemText
                                  primary={proof.type}
                                  secondary={
                                    String(proof.type).toUpperCase() === 'SIGNATURE'
                                      ? signatureSummary(proof)
                                      : typeof proof.metadata?.originalName === 'string'
                                        ? `${proof.metadata.originalName} • ${formatWhen(
                                            typeof proof.metadata.capturedAt === 'string'
                                              ? proof.metadata.capturedAt
                                              : proof.createdAt,
                                          )}`
                                        : proof.uri
                                  }
                                />
                                {String(proof.type).toUpperCase() === 'SIGNATURE' ? (
                                  <SignatureProofPreview proof={proof} />
                                ) : proof.uri !== 'proof-decision' ? (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => void openProofFile(proof)}
                                    sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                                  >
                                    Download proof
                                  </Button>
                                ) : null}
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

      <Dialog open={Boolean(actionStop && actionType)} onClose={() => { setActionStop(null); setActionType(null); }} fullWidth maxWidth="sm">
        <DialogTitle>
          {actionType === 'note' ? 'Add Stop Note' : null}
          {actionType === 'proof' ? 'Attach Proof' : null}
          {actionType === 'fail' ? 'Fail Stop' : null}
          {actionType === 'reschedule' ? 'Reschedule Stop' : null}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={actionType === 'proof' ? 2 : 4}
            label={actionType === 'proof' ? 'Proof URI' : 'Details'}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setActionStop(null); setActionType(null); setInputValue(''); }}>Cancel</Button>
          <Button variant="contained" onClick={() => void submitModalAction()} disabled={!inputValue.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={exceptionDialogOpen} onClose={() => setExceptionDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Exception</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField
            select
            label="Related stop"
            value={exceptionStopId}
            onChange={(event) => setExceptionStopId(event.target.value)}
            fullWidth
          >
            <MenuItem value="">Route-level issue</MenuItem>
            {(detail.stops || []).map((stop) => (
              <MenuItem key={stop.id} value={stop.id}>
                Stop {stop.stopSequence} • {stop.jobId.slice(0, 8)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Code"
            value={exceptionCode}
            onChange={(event) => setExceptionCode(event.target.value)}
            placeholder="DELAY"
            fullWidth
          />
          <TextField
            label="Message"
            value={exceptionMessage}
            onChange={(event) => setExceptionMessage(event.target.value)}
            multiline
            minRows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExceptionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleCreateException()}
            disabled={!exceptionCode.trim() || !exceptionMessage.trim()}
          >
            Create exception
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
