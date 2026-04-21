import { useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import LoadingState from '../../../components/ui/LoadingState';
import ErrorState from '../../../components/ui/ErrorState';
import { PageHeader } from '../../../components/PageHeader';
import { SurfacePanel } from '../../../components/SurfacePanel';
import { useDispatchBoard } from '../hooks/useDispatchBoard';
import DispatchMap from './DispatchMap';
import ExceptionsPanel from './ExceptionsPanel';
import PublishRoutesDialog from './PublishRoutesDialog';
import RouteInspectorDrawer from './RouteInspectorDrawer';
import RoutesBoard from './RoutesBoard';
import UnassignedJobsPanel from './UnassignedJobsPanel';

export default function DispatchBoardPage() {
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const {
    loading,
    refreshing,
    error,
    routes,
    drivers,
    timeline,
    optimizerHealth,
    selectedRoute,
    selectedRouteId,
    selectedVersions,
    loadingVersions,
    mutationError,
    rerouteHistory,
    unassignedJobs,
    exceptions,
    refresh,
    selectRoute,
    snapshotRoute,
    reviewLatestDraft,
    approveLatestVersion,
    publishLatestVersion,
    assignDriver,
    startRoute,
    latestVersion,
  } = useDispatchBoard() as any;

  const routeStatusSummary = useMemo(() => {
    const statuses = ['draft', 'review', 'ready', 'live'];
    return statuses.map((status) => ({
      status,
      count: (routes || []).filter((route: any) => {
        const routeStatus = String(route.status || '').toLowerCase();
        return routeStatus.includes(status) || (status === 'live' && ['assigned', 'in_progress', 'active'].includes(routeStatus));
      }).length,
    }));
  }, [routes]);

  if (loading) {
    return <LoadingState label="Loading dispatch board..." />;
  }

  if (error) {
    return <ErrorState title="Dispatch board unavailable" message={error} onRetry={() => void refresh()} />;
  }

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow="Operations"
        title="Dispatch"
        subtitle="Board-first execution workspace for review, publish, assignment, and live route inspection."
        actions={
          <>
            <Chip label={refreshing ? 'Refreshing' : 'Board live'} color="success" />
            <Chip label={optimizerHealth?.status === 'healthy' ? 'System healthy' : 'Needs review'} color={optimizerHealth?.status === 'healthy' ? 'success' : 'warning'} variant="outlined" />
          </>
        }
      />

      {mutationError ? <Alert severity="error">{mutationError}</Alert> : null}

      <Grid container spacing={2.5}>
        <Grid item xs={12} xl={3}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h5" sx={{ mb: 1 }}>Exceptions</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Late risk, failed stops, and routes that need an operator decision.
              </Typography>
              <ExceptionsPanel routes={exceptions} onSelectRoute={selectRoute} />
            </SurfacePanel>
            <SurfacePanel>
              <Typography variant="h5" sx={{ mb: 1 }}>Unassigned Work</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Work not yet published or missing a usable route package.
              </Typography>
              <UnassignedJobsPanel jobs={unassignedJobs} />
            </SurfacePanel>
            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Status board</Typography>
              <Stack spacing={1}>
                {routeStatusSummary.map((item) => (
                  <Stack key={item.status} direction="row" justifyContent="space-between">
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{item.status}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.count}</Typography>
                  </Stack>
                ))}
              </Stack>
            </SurfacePanel>
          </Stack>
        </Grid>

        <Grid item xs={12} xl={5}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h5" sx={{ mb: 1 }}>Routes Board</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Active, draft, review, ready, and live route groups stay in the center of the workflow.
              </Typography>
              <RoutesBoard routes={routes} selectedRouteId={selectedRouteId} onSelectRoute={selectRoute} />
            </SurfacePanel>
            <SurfacePanel sx={{ p: 0, overflow: 'hidden' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h5">Live Map</Typography>
                <Typography variant="body2" color="text.secondary">Current route focus and board context.</Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <DispatchMap route={selectedRoute} />
              </Box>
            </SurfacePanel>
          </Stack>
        </Grid>

        <Grid item xs={12} xl={4}>
          <Stack spacing={2.5}>
            <SurfacePanel>
              <Typography variant="h5" sx={{ mb: 1 }}>Route Inspector</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Working version, publish state, assignment, and last operator actions.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                <Button variant="outlined" onClick={reviewLatestDraft}>Review</Button>
                <Button variant="contained" onClick={() => setPublishDialogOpen(true)}>Publish</Button>
                <Button variant="outlined" onClick={startRoute}>Start Route</Button>
                <Button variant="outlined" onClick={() => selectedRoute && selectRoute(selectedRoute.id)}>Assign Driver</Button>
              </Stack>
              <RouteInspectorDrawer
                route={selectedRoute}
                versions={selectedVersions}
                drivers={drivers}
                loadingVersions={loadingVersions}
                mutationError={mutationError}
                rerouteHistoryCount={(rerouteHistory || []).length}
                onAssign={assignDriver}
                onSnapshot={snapshotRoute}
                onReview={reviewLatestDraft}
                onApprove={approveLatestVersion}
                onPublish={() => setPublishDialogOpen(true)}
                onStart={startRoute}
              />
            </SurfacePanel>

            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Publish History</Typography>
              <Stack spacing={1.25}>
                {(selectedVersions || []).slice(0, 4).map((version: any, index: number) => (
                  <Box key={version.id || index} sx={{ pl: 2, borderLeft: '2px solid', borderColor: index === 0 ? 'primary.main' : 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{version.label || version.version || 'Version ' + String(index + 1)}</Typography>
                    <Typography variant="caption" color="text.secondary">{version.status || 'Recorded'}</Typography>
                  </Box>
                ))}
                {(selectedVersions || []).length === 0 ? <Typography variant="body2" color="text.secondary">No version history loaded for the current route.</Typography> : null}
              </Stack>
            </SurfacePanel>

            <SurfacePanel>
              <Typography variant="h6" sx={{ mb: 1 }}>Recent Events</Typography>
              <Stack spacing={1.25}>
                {(timeline || []).slice(0, 6).map((event: any) => (
                  <Box key={event.id} sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{event.message}</Typography>
                    <Typography variant="caption" color="text.secondary">{event.level || 'info'}</Typography>
                  </Box>
                ))}
              </Stack>
            </SurfacePanel>
          </Stack>
        </Grid>
      </Grid>

      <PublishRoutesDialog open={publishDialogOpen} version={latestVersion} onClose={() => setPublishDialogOpen(false)} onPublish={publishLatestVersion} />
    </Stack>
  );
}
