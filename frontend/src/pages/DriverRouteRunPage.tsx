import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from 'react';
import {
  Chat,
  CheckCircle,
  Close,
  Description,
  Draw,
  FactCheck,
  ListAlt,
  MyLocation,
  Navigation,
  Place,
  Send,
  UploadFile,
} from '@mui/icons-material';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useParams } from 'react-router-dom';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import { TopoShellBackground } from '../components/TopoShellBackground';
import LoadingState from '../components/ui/LoadingState';
import {
  getRouteRunsErrorMessage,
  type ProofArtifactRecord,
  type RouteRunMessageRecord,
  type RouteRunStopRecord,
  useCreateRouteRunMessageMutation,
  useMarkRouteRunMessagesReadMutation,
  useRouteRunDetailQuery,
  useRouteRunMessagesQuery,
  useRouteRunStopMutation,
} from '../features/dispatch/api/routeRunsApi';
import { sendDriverTelemetry } from '../services/trackingApi';
import { trovanColors } from '../theme/designTokens';

type SignaturePoint = { x: number; y: number };
type SignatureStroke = SignaturePoint[];
type ProofRequirement = 'required' | 'optional' | 'not_required';

function statusTone(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'danger';
  if (['in_progress', 'assigned', 'arrived', 'dispatched'].includes(normalized)) return 'info';
  if (['planned', 'pending', 'ready_for_dispatch', 'rescheduled'].includes(normalized)) return 'warning';
  return 'default';
}

function statusChipColor(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const tone = statusTone(status);
  return tone === 'danger' ? 'error' : tone;
}

function isStopClosed(status: string) {
  return ['SERVICED', 'FAILED', 'SKIPPED'].includes(String(status || '').toUpperCase());
}

function hasStopArrived(stop?: RouteRunStopRecord | null) {
  if (!stop) return false;
  return Boolean(stop.actualArrival) || String(stop.status).toUpperCase() === 'ARRIVED';
}

function formatWhen(value?: string | null) {
  if (!value) return 'Pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildMapUrl(stop?: RouteRunStopRecord | null) {
  const location = stop?.presentation?.location;
  if (location) {
    return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
  }
  const address = stop?.presentation?.address;
  return address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null;
}

function getRequirementLabel(requirement: ProofRequirement) {
  if (requirement === 'required') return 'Required';
  if (requirement === 'optional') return 'Ask driver';
  return 'Not needed';
}

function getSignaturePreview(proof: ProofArtifactRecord) {
  const metadata = proof.metadata || {};
  const signerName = typeof metadata.signerName === 'string' ? metadata.signerName : 'Signature';
  const capturedAt = typeof metadata.capturedAt === 'string' ? metadata.capturedAt : proof.createdAt;
  return `${signerName}${capturedAt ? ` • ${formatWhen(capturedAt)}` : ''}`;
}

const driverPrimaryButtonSx = {
  minHeight: 56,
  borderRadius: 1.5,
  fontSize: '1rem',
  '& .MuiButton-startIcon svg, & .MuiButton-endIcon svg': {
    fontSize: 26,
  },
} as const;

const driverSecondaryButtonSx = {
  minHeight: 48,
  borderRadius: 1.5,
  fontSize: '0.95rem',
  '& .MuiButton-startIcon svg': {
    fontSize: 22,
  },
} as const;

const driverIconButtonSx = {
  width: 44,
  height: 44,
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.12)',
  bgcolor: 'rgba(255,255,255,0.035)',
  '&:hover': {
    bgcolor: 'rgba(255,255,255,0.08)',
  },
} as const;

function SignatureCapture({
  onAccept,
}: {
  onAccept: (payload: {
    signerName: string;
    strokes: Array<Array<{ x: number; y: number }>>;
  }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [signerName, setSignerName] = useState('');

  const getPoint = (event: PointerEvent<HTMLCanvasElement>): SignaturePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const drawLine = (from: SignaturePoint, to: SignaturePoint) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.strokeStyle = '#F7EFE4';
    context.lineWidth = 3.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setStrokes([]);
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = getPoint(event);
    setStrokes((current) => [...current, [point]]);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = getPoint(event);
    setStrokes((current) => {
      const next = current.slice();
      const active = next[next.length - 1] || [];
      const previous = active[active.length - 1];
      if (previous) drawLine(previous, point);
      next[next.length - 1] = [...active, point];
      return next;
    });
  };

  const stop = () => {
    drawingRef.current = false;
  };

  const accept = () => {
    onAccept({
      signerName: signerName.trim(),
      strokes: strokes.map((stroke) =>
        stroke.map((point) => ({
          x: Number((point.x / 600).toFixed(4)),
          y: Number((point.y / 220).toFixed(4)),
        })),
      ),
    });
  };

  return (
    <Stack spacing={2}>
      <TextField
        label="Signer name"
        value={signerName}
        onChange={(event) => setSignerName(event.target.value)}
        fullWidth
        autoFocus
      />
      <Box
        component="canvas"
        aria-label="Signature canvas"
        ref={canvasRef}
        width={600}
        height={220}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        sx={{
          width: '100%',
          height: { xs: 176, sm: 220 },
          borderRadius: 1,
          border: '1px solid rgba(255,255,255,0.22)',
          bgcolor: '#17120F',
          touchAction: 'none',
        }}
      />
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={clear} fullWidth sx={driverSecondaryButtonSx}>
          Clear
        </Button>
        <Button
          variant="contained"
          onClick={accept}
          fullWidth
          disabled={!signerName.trim() || strokes.length === 0}
          sx={driverSecondaryButtonSx}
        >
          Accept signature
        </Button>
      </Stack>
    </Stack>
  );
}

export default function DriverRouteRunPage() {
  const { id = '' } = useParams();
  const routeRunQuery = useRouteRunDetailQuery(id);
  const messagesQuery = useRouteRunMessagesQuery(id);
  const stopMutation = useRouteRunStopMutation();
  const createMessageMutation = useCreateRouteRunMessageMutation();
  const markMessagesReadMutation = useMarkRouteRunMessagesReadMutation();
  const bolInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [signatureStop, setSignatureStop] = useState<RouteRunStopRecord | null>(null);
  const [messageDrawerOpen, setMessageDrawerOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detail = routeRunQuery.data ?? null;
  const routeRun = detail?.routeRun ?? null;
  const orderedStops = useMemo(
    () =>
      (detail?.stops || [])
        .slice()
        .sort((left, right) => left.stopSequence - right.stopSequence),
    [detail?.stops],
  );
  const completedStops = orderedStops.filter((stop) => isStopClosed(stop.status)).length;
  const nextStop = orderedStops.find((stop) => !isStopClosed(stop.status)) || null;
  const progress = orderedStops.length ? Math.round((completedStops / orderedStops.length) * 100) : 0;
  const mapUrl = buildMapUrl(nextStop);

  const proofsByStop = useMemo(() => {
    const proofs = detail?.proofArtifacts || [];
    return proofs.reduce<Record<string, ProofArtifactRecord[]>>((acc, proof) => {
      acc[proof.routeRunStopId] = [...(acc[proof.routeRunStopId] || []), proof];
      return acc;
    }, {});
  }, [detail?.proofArtifacts]);

  const messages: RouteRunMessageRecord[] =
    messagesQuery.data?.messages || detail?.messages || [];
  const unreadCount = messagesQuery.data?.unreadCount || 0;
  const nextStopProofs = nextStop ? proofsByStop[nextStop.id] || [] : [];
  const proofRequirements = nextStop?.proofRequirements || {
    signature: nextStop?.proofRequired ? 'required' : 'not_required',
    bol: 'optional',
    documents: 'optional',
  };
  const signatureCaptured =
    Boolean(nextStop?.proofStatus?.signatureCaptured) ||
    nextStopProofs.some((proof) => String(proof.type).toUpperCase() === 'SIGNATURE');
  const bolCaptured =
    Boolean(nextStop?.proofStatus?.bolCaptured) ||
    nextStopProofs.some((proof) => String(proof.type).toUpperCase() === 'BOL');
  const documentsCaptured =
    Boolean(nextStop?.proofStatus?.documentsCaptured) ||
    nextStopProofs.some((proof) => String(proof.type).toUpperCase() === 'DOCUMENT');
  const bolSkipped =
    Boolean(nextStop?.proofStatus?.bolSkipped) ||
    nextStopProofs.some((proof) => String(proof.type).toUpperCase() === 'BOL_DECISION');
  const documentsSkipped =
    Boolean(nextStop?.proofStatus?.documentsSkipped) ||
    nextStopProofs.some((proof) => String(proof.type).toUpperCase() === 'DOCUMENTS_DECISION');
  const arrived = hasStopArrived(nextStop);
  const signatureComplete =
    proofRequirements.signature !== 'required' || signatureCaptured;
  const bolComplete =
    proofRequirements.bol === 'not_required' || bolCaptured || bolSkipped;
  const documentsComplete =
    proofRequirements.documents === 'not_required' ||
    documentsCaptured ||
    documentsSkipped;
  const proofPromptsComplete = signatureComplete && bolComplete && documentsComplete;
  const canDepart = Boolean(nextStop && arrived && proofPromptsComplete);

  const currentStage = !nextStop
    ? 'complete'
    : !arrived
      ? 'arrive'
      : proofRequirements.signature === 'required' && !signatureCaptured
        ? 'signature'
        : !bolComplete
          ? 'bol'
          : !documentsComplete
            ? 'documents'
            : 'depart';

  useEffect(() => {
    if (id && unreadCount > 0) {
      markMessagesReadMutation.mutate(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, unreadCount]);

  useEffect(() => {
    setNoteDraft('');
  }, [nextStop?.id]);

  const runStopAction = async (stopId: string, action: 'arrived' | 'serviced') => {
    if (action === 'serviced' && !canDepart) {
      setError('Finish the required stop steps before departing.');
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await stopMutation.mutateAsync({
        routeRunId: id,
        stopId,
        kind: action,
      });
      setNotice(action === 'arrived' ? 'Arrival recorded.' : 'Departed. Next stop loaded.');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const saveNote = async () => {
    if (!nextStop || !noteDraft.trim()) return;
    setError(null);
    try {
      await stopMutation.mutateAsync({
        routeRunId: id,
        stopId: nextStop.id,
        kind: 'note',
        value: noteDraft.trim(),
      });
      setNoteDraft('');
      setNotice('Note saved.');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const saveSignature = async (payload: {
    signerName: string;
    strokes: Array<Array<{ x: number; y: number }>>;
  }) => {
    if (!signatureStop) return;
    setError(null);
    try {
      await stopMutation.mutateAsync({
        routeRunId: id,
        stopId: signatureStop.id,
        kind: 'proof',
        proof: {
          type: 'SIGNATURE',
          uri: 'inline-signature',
          metadata: {
            source: 'driver-pwa',
            signerName: payload.signerName,
            capturedAt: new Date().toISOString(),
            strokes: payload.strokes,
          },
        },
      });
      setSignatureStop(null);
      setNotice('Signature captured.');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const uploadProofFile = async (type: 'BOL' | 'DOCUMENT', file?: File | null) => {
    if (!nextStop || !file) return;
    setError(null);
    setNotice(null);
    try {
      await stopMutation.mutateAsync({
        routeRunId: id,
        stopId: nextStop.id,
        kind: 'proofFile',
        proofFile: {
          type,
          file,
          metadata: {
            source: 'driver-pwa',
            capturedAt: new Date().toISOString(),
          },
        },
      });
      setNotice(type === 'BOL' ? 'BOL uploaded.' : 'Document uploaded.');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const recordProofDecision = async (type: 'BOL' | 'DOCUMENTS') => {
    if (!nextStop) return;
    setError(null);
    setNotice(null);
    try {
      await stopMutation.mutateAsync({
        routeRunId: id,
        stopId: nextStop.id,
        kind: 'proofDecision',
        proofDecision: {
          type,
          required: false,
          reason: type === 'BOL' ? 'No BOL needed' : 'No extra documents needed',
        },
      });
      setNotice(type === 'BOL' ? 'BOL marked not needed.' : 'Documents marked not needed.');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const sendMessage = async () => {
    if (!messageDraft.trim()) return;
    setError(null);
    try {
      await createMessageMutation.mutateAsync({
        routeRunId: id,
        payload: {
          body: messageDraft.trim(),
          routeRunStopId: nextStop?.id || null,
        },
      });
      setMessageDraft('');
    } catch (err: unknown) {
      setError(getRouteRunsErrorMessage(err));
    }
  };

  const shareLocation = async () => {
    if (!routeRun?.vehicleId) {
      setError('Vehicle is not assigned yet, so location cannot be shared.');
      return;
    }
    if (!navigator.geolocation) {
      setError('Location sharing is not available in this browser.');
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }),
      );
      await sendDriverTelemetry({
        vehicleId: routeRun.vehicleId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
        metadata: { source: 'driver-pwa', routeRunId: id },
      });
      setNotice('Location shared with dispatch.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to share location.');
    }
  };

  const onProofFileChange =
    (type: 'BOL' | 'DOCUMENT') => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      void uploadProofFile(type, file);
    };

  const renderStep = () => {
    if (!nextStop) {
      return (
        <Stack spacing={1.2} alignItems="stretch">
          <CheckCircle color="success" sx={{ fontSize: 42 }} />
          <Typography variant="h5" component="h3">Route complete</Typography>
          <Typography variant="body2" color="text.secondary">
            All stops are closed for this route run.
          </Typography>
        </Stack>
      );
    }

    if (currentStage === 'arrive') {
      return (
        <Stack spacing={1.2}>
          <Typography variant="overline" color="text.secondary">
            Step 1
          </Typography>
          <Typography variant="h5" component="h3">Arrive</Typography>
          <Typography variant="body2" color="text.secondary">
            Tap once parked at the customer stop.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => void runStopAction(nextStop.id, 'arrived')}
            disabled={stopMutation.isPending}
            fullWidth
            sx={driverPrimaryButtonSx}
          >
            Arrive
          </Button>
        </Stack>
      );
    }

    if (currentStage === 'signature') {
      return (
        <Stack spacing={1.2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Draw sx={{ color: trovanColors.copper[500] }} />
            <Typography variant="h5" component="h3">Capture signature</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            This customer requires a signature before departure.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Draw />}
            onClick={() => setSignatureStop(nextStop)}
            fullWidth
            sx={driverPrimaryButtonSx}
          >
            Capture signature
          </Button>
        </Stack>
      );
    }

    if (currentStage === 'bol') {
      return (
        <Stack spacing={1.2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Description sx={{ color: trovanColors.copper[500] }} />
            <Typography variant="h5" component="h3">BOL</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Upload the BOL or mark that one is not needed for this stop.
          </Typography>
          <input
            ref={bolInputRef}
            aria-label="BOL file"
            hidden
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.heic,image/*,application/pdf"
            onChange={onProofFileChange('BOL')}
          />
          <Button
            variant="contained"
            size="large"
            startIcon={<UploadFile />}
            onClick={() => bolInputRef.current?.click()}
            disabled={stopMutation.isPending}
            fullWidth
            sx={driverPrimaryButtonSx}
          >
            Upload BOL
          </Button>
          {proofRequirements.bol !== 'required' ? (
            <Button
              variant="outlined"
              size="large"
              onClick={() => void recordProofDecision('BOL')}
              disabled={stopMutation.isPending}
              fullWidth
              sx={driverSecondaryButtonSx}
            >
              No BOL needed
            </Button>
          ) : null}
        </Stack>
      );
    }

    if (currentStage === 'documents') {
      return (
        <Stack spacing={1.2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <FactCheck sx={{ color: trovanColors.copper[500] }} />
            <Typography variant="h5" component="h3">Extra documents</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Upload any extra documents or mark that none are needed.
          </Typography>
          <input
            ref={documentInputRef}
            aria-label="Document file"
            hidden
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.heic,image/*,application/pdf"
            onChange={onProofFileChange('DOCUMENT')}
          />
          <Button
            variant="contained"
            size="large"
            startIcon={<UploadFile />}
            onClick={() => documentInputRef.current?.click()}
            disabled={stopMutation.isPending}
            fullWidth
            sx={driverPrimaryButtonSx}
          >
            Upload document
          </Button>
          {proofRequirements.documents !== 'required' ? (
            <Button
              variant="outlined"
              size="large"
              onClick={() => void recordProofDecision('DOCUMENTS')}
              disabled={stopMutation.isPending}
              fullWidth
              sx={driverSecondaryButtonSx}
            >
              No documents needed
            </Button>
          ) : null}
        </Stack>
      );
    }

    return (
      <Stack spacing={1.2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CheckCircle color="success" />
          <Typography variant="h5" component="h3">Ready to depart</Typography>
        </Stack>
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
          <Chip size="small" color={signatureCaptured ? 'success' : 'default'} label="Signature" />
          <Chip size="small" color={bolCaptured || bolSkipped ? 'success' : 'default'} label="BOL" />
          <Chip size="small" color={documentsCaptured || documentsSkipped ? 'success' : 'default'} label="Documents" />
        </Stack>
        <Button
          variant="contained"
          color="success"
          size="large"
          onClick={() => void runStopAction(nextStop.id, 'serviced')}
          disabled={stopMutation.isPending || !canDepart}
          fullWidth
          sx={driverPrimaryButtonSx}
        >
          Depart
        </Button>
      </Stack>
    );
  };

  if (routeRunQuery.isLoading) {
    return <LoadingState label="Loading route run..." minHeight="50vh" />;
  }

  if (!routeRun) {
    return (
      <SurfacePanel>
        <Typography variant="h5" component="h1">Route run unavailable</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          The requested route run could not be loaded for this driver.
        </Typography>
      </SurfacePanel>
    );
  }

  return (
    <Box
      data-testid="driver-route-run-page"
      sx={{
        minHeight: '100dvh',
        width: '100%',
        maxWidth: '100vw',
        px: { xs: 1.1, sm: 2 },
        pt: { xs: 'max(10px, env(safe-area-inset-top))', sm: 2 },
        pb: { xs: 'max(10px, env(safe-area-inset-bottom))', sm: 2 },
        bgcolor: '#050403',
        background: 'linear-gradient(180deg, #050403 0%, #0B0908 100%)',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      <TopoShellBackground active tone="black" quiet />
      <Stack spacing={1.05} sx={{ position: 'relative', zIndex: 1, maxWidth: 460, mx: 'auto', minWidth: 0 }}>
        <SurfacePanel
          variant="command"
          padding={1.15}
          sx={{
            bgcolor: 'rgba(31, 26, 23, 0.96)',
            color: '#fff',
            borderTop: `4px solid ${trovanColors.copper[500]}`,
          }}
        >
          <Stack spacing={0.95}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  Today route
                </Typography>
                <Typography variant="subtitle1" component="h1" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                  {nextStop
                    ? `Stop ${nextStop.stopSequence} of ${orderedStops.length}`
                    : 'Route complete'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} sx={{ flex: '0 0 auto' }}>
                <IconButton
                  aria-label="Open stop details"
                  onClick={() => setDetailsDrawerOpen(true)}
                  sx={driverIconButtonSx}
                >
                  <ListAlt />
                </IconButton>
                <IconButton
                  aria-label="Open dispatch messages"
                  onClick={() => setMessageDrawerOpen(true)}
                  sx={driverIconButtonSx}
                >
                  <Badge badgeContent={unreadCount} color="warning">
                    <Chat />
                  </Badge>
                </IconButton>
              </Stack>
            </Stack>
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.45 }}>
                <Typography variant="caption" color="text.secondary">
                  {completedStops}/{orderedStops.length} complete
                </Typography>
                <StatusPill label={routeRun.status.replace(/_/g, ' ')} tone={statusTone(routeRun.status)} />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progress}
                aria-label="Route completion"
                sx={{
                  height: 7,
                  borderRadius: 999,
                  bgcolor: 'rgba(255,255,255,0.12)',
                  '& .MuiLinearProgress-bar': { bgcolor: trovanColors.copper[500] },
                }}
              />
            </Box>

            {nextStop ? (
              <Stack spacing={0.75}>
                <Typography variant="h5" component="h2" sx={{ lineHeight: 1.1, overflowWrap: 'anywhere' }}>
                  {nextStop.presentation?.customerName || 'Customer pending'}
                </Typography>
                <Stack direction="row" spacing={0.75} alignItems="flex-start">
                  <Place fontSize="small" sx={{ mt: 0.1, color: trovanColors.copper[500] }} />
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {nextStop.presentation?.address || 'Address pending'}
                  </Typography>
                </Stack>
                {nextStop.presentation?.instructions ? (
                  <Typography
                    variant="caption"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      color: 'text.secondary',
                    }}
                  >
                    {nextStop.presentation.instructions}
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={0.75}>
                  <Button
                    component="a"
                    variant="outlined"
                    size="small"
                    startIcon={<Navigation />}
                    href={mapUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    disabled={!mapUrl}
                    fullWidth
                    sx={driverSecondaryButtonSx}
                  >
                    Open map
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<MyLocation />}
                    onClick={() => void shareLocation()}
                    fullWidth
                    sx={driverSecondaryButtonSx}
                  >
                    Location
                  </Button>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </SurfacePanel>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {notice && !detailsDrawerOpen && !messageDrawerOpen ? (
          <Alert severity="success">{notice}</Alert>
        ) : null}

        <SurfacePanel variant="command" padding={1.35}>
          {renderStep()}
        </SurfacePanel>

        {nextStop && currentStage !== 'arrive' ? (
          <Stack direction="row" spacing={0.75}>
            <Button
              variant="outlined"
              onClick={() => setDetailsDrawerOpen(true)}
              fullWidth
              sx={driverSecondaryButtonSx}
            >
              Stop details
            </Button>
            <Button
              variant="outlined"
              onClick={() => setMessageDrawerOpen(true)}
              fullWidth
              sx={driverSecondaryButtonSx}
            >
              Message dispatch
            </Button>
          </Stack>
        ) : null}
      </Stack>

      <Drawer
        anchor="bottom"
        open={messageDrawerOpen}
        onClose={() => setMessageDrawerOpen(false)}
        PaperProps={{
          sx: {
            maxHeight: '82dvh',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            bgcolor: 'background.default',
          },
        }}
      >
        <Stack spacing={1.2} sx={{ p: 1.5, pb: 'max(14px, env(safe-area-inset-bottom))' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" component="h2">Dispatch messages</Typography>
            <IconButton aria-label="Close messages" onClick={() => setMessageDrawerOpen(false)}>
              <Close />
            </IconButton>
          </Stack>
          <Stack spacing={1} sx={{ overflowY: 'auto', maxHeight: '52dvh', pr: 0.3 }}>
            {messages.map((message) => {
              const fromDriver = String(message.senderRole).toUpperCase() === 'DRIVER';
              return (
                <Box
                  key={message.id}
                  sx={{
                    alignSelf: fromDriver ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    p: 1,
                    borderRadius: 1,
                    bgcolor: fromDriver ? alpha(trovanColors.copper[500], 0.22) : 'background.paper',
                    border: '1px solid',
                    borderColor: fromDriver ? alpha(trovanColors.copper[500], 0.3) : 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {fromDriver ? 'You' : 'Dispatch'} • {formatWhen(message.createdAt)}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {message.body}
                  </Typography>
                </Box>
              );
            })}
            {messages.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No route messages yet.
              </Typography>
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Message dispatch"
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              fullWidth
              multiline
              maxRows={3}
            />
            <Button
              aria-label="Send message"
              variant="contained"
              onClick={() => void sendMessage()}
              disabled={!messageDraft.trim() || createMessageMutation.isPending}
              sx={{ minWidth: 48 }}
            >
              <Send />
            </Button>
          </Stack>
        </Stack>
      </Drawer>

      <Drawer
        anchor="bottom"
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        PaperProps={{
          sx: {
            maxHeight: '86dvh',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            bgcolor: 'background.default',
          },
        }}
      >
        <Stack spacing={1.4} sx={{ p: 1.5, pb: 'max(14px, env(safe-area-inset-bottom))', overflowY: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" component="h2">Stop details</Typography>
            <IconButton aria-label="Close stop details" onClick={() => setDetailsDrawerOpen(false)}>
              <Close />
            </IconButton>
          </Stack>

          {notice ? <Alert severity="success">{notice}</Alert> : null}

          {nextStop ? (
            <SurfacePanel variant="subtle" padding={1.2}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Driver note</Typography>
                <TextField
                  label="Driver note"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
                <Button
                  variant="outlined"
                  onClick={() => void saveNote()}
                  disabled={!noteDraft.trim() || stopMutation.isPending}
                >
                  Save note
                </Button>
              </Stack>
            </SurfacePanel>
          ) : null}

          <SurfacePanel variant="subtle" padding={1.2}>
            <Stack spacing={0.8}>
              <Typography variant="subtitle2">Proof status</Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color={signatureCaptured ? 'success' : 'default'}
                  label={`Signature ${getRequirementLabel(proofRequirements.signature)}`}
                />
                <Chip
                  size="small"
                  color={bolCaptured || bolSkipped ? 'success' : 'default'}
                  label={`BOL ${getRequirementLabel(proofRequirements.bol)}`}
                />
                <Chip
                  size="small"
                  color={documentsCaptured || documentsSkipped ? 'success' : 'default'}
                  label={`Documents ${getRequirementLabel(proofRequirements.documents)}`}
                />
              </Stack>
              {nextStopProofs.map((proof) => (
                <Typography key={proof.id} variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                  {String(proof.type).toUpperCase() === 'SIGNATURE'
                    ? getSignaturePreview(proof)
                    : `${proof.type} • ${
                        typeof proof.metadata?.originalName === 'string'
                          ? proof.metadata.originalName
                          : proof.uri
                      }`}
                </Typography>
              ))}
            </Stack>
          </SurfacePanel>

          <SurfacePanel variant="subtle" padding={1.2}>
            <Stack spacing={0.8}>
              <Typography variant="subtitle2">Route stops</Typography>
              {orderedStops.map((stop) => (
                <Stack
                  key={stop.id}
                  direction="row"
                  spacing={1}
                  justifyContent="space-between"
                  sx={{
                    p: 0.8,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor:
                      stop.id === nextStop?.id
                        ? alpha(trovanColors.copper[500], 0.4)
                        : 'divider',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {stop.stopSequence}. {stop.presentation?.customerName || stop.jobId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ overflowWrap: 'anywhere' }}>
                      {stop.presentation?.address || 'Address pending'}
                    </Typography>
                  </Box>
                  <Chip label={stop.status} size="small" color={statusChipColor(stop.status)} />
                </Stack>
              ))}
            </Stack>
          </SurfacePanel>
        </Stack>
      </Drawer>

      <Dialog
        open={Boolean(signatureStop)}
        onClose={() => setSignatureStop(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            m: { xs: 1.15, sm: 4 },
            width: { xs: 'calc(100% - 18px)', sm: '100%' },
            maxHeight: { xs: 'calc(100dvh - 22px)', sm: 'calc(100% - 64px)' },
            borderRadius: 2,
            bgcolor: 'background.default',
          },
        }}
      >
        <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 }, pb: 1 }}>
          Capture signature
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 1 }}>
          <SignatureCapture onAccept={(payload) => void saveSignature(payload)} />
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.4 } }}>
          <Button onClick={() => setSignatureStop(null)} sx={{ minHeight: 44 }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
