import { Alert, Button, Chip, Divider, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import PageSection from '../../../components/ui/PageSection';
import EmptyState from '../../../components/ui/EmptyState';
import type { DispatchDriver, DispatchRoute } from '../../../types/dispatch';
import type { DispatchRouteVersion } from '../types/dispatch';
import DriverAssignmentPanel from './DriverAssignmentPanel';

type RouteInspectorDrawerProps = {
  route: DispatchRoute | null;
  versions: DispatchRouteVersion[];
  drivers: DispatchDriver[];
  loadingVersions: boolean;
  mutationError: string | null;
  rerouteHistoryCount: number;
  onAssign: (driverId: string) => Promise<void>;
  onSnapshot: () => Promise<void>;
  onReview: () => Promise<void>;
  onApprove: () => Promise<void>;
  onPublish: () => void;
  onStart: () => Promise<void>;
};

export default function RouteInspectorDrawer({
  route,
  versions,
  drivers,
  loadingVersions,
  mutationError,
  rerouteHistoryCount,
  onAssign,
  onSnapshot,
  onReview,
  onApprove,
  onPublish,
  onStart,
}: RouteInspectorDrawerProps) {
  if (!route) {
    return (
      <PageSection title="Inspector" subtitle="Route details and workflow controls">
        <EmptyState
          title="No route selected"
          message="Pick a route from the board to inspect version history, driver assignment, and launch actions."
        />
      </PageSection>
    );
  }

  const latestVersion = versions[0] ?? null;
  const lastPublishedVersion =
    versions.find((version) => version.status === 'PUBLISHED') ??
    versions.find((version) => Boolean(version.publishedAt)) ??
    null;
  const publishHistory = versions.filter((version) => Boolean(version.publishedAt));
  const canReview = latestVersion?.status === 'DRAFT';
  const canApprove =
    latestVersion?.status === 'DRAFT' || latestVersion?.status === 'REVIEWED';
  const canPublish = latestVersion?.status === 'APPROVED';

  return (
    <Stack spacing={2}>
      <PageSection title="Inspector" subtitle={`Route ${route.id.slice(0, 8)}`}>
        <Stack spacing={1.25}>
          {mutationError ? <Alert severity="error">{mutationError}</Alert> : null}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`Status: ${route.status || 'planned'}`} />
            <Chip label={`Workflow: ${route.workflowStatus || 'planned'}`} />
            <Chip
              label={
                latestVersion
                  ? `Working Version: v${latestVersion.versionNumber} ${latestVersion.status}`
                  : 'Working Version: none'
              }
            />
            <Chip
              label={
                lastPublishedVersion
                  ? `Last Published: v${lastPublishedVersion.versionNumber}`
                  : 'Last Published: none'
              }
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Vehicle {route.vehicleId ? route.vehicleId.slice(0, 8) : 'unassigned'} ·
            {` `}
            {route.jobIds?.length ?? route.optimizedStops?.length ?? 0} stops
          </Typography>
          <DriverAssignmentPanel
            driverId={route.driverId}
            drivers={drivers}
            onAssign={onAssign}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button variant="outlined" size="small" onClick={() => void onSnapshot()}>
              Snapshot
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={!canReview}
              onClick={() => void onReview()}
            >
              Review
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={!canApprove}
              onClick={() => void onApprove()}
            >
              Approve
            </Button>
            <Button
              variant="contained"
              size="small"
              disabled={!canPublish}
              onClick={onPublish}
            >
              Publish
            </Button>
            <Button variant="contained" color="secondary" size="small" onClick={() => void onStart()}>
              Start
            </Button>
          </Stack>
        </Stack>
      </PageSection>

      <PageSection
        title="Version History"
        subtitle="Current working state and full route version timeline"
      >
        {loadingVersions ? (
          <Typography variant="body2" color="text.secondary">
            Loading versions...
          </Typography>
        ) : versions.length === 0 ? (
          <EmptyState
            title="No versions yet"
            message="Create a snapshot to start controlled route lifecycle tracking."
          />
        ) : (
          <List disablePadding>
            {versions.map((version) => (
              <ListItem key={version.id} disableGutters>
                <ListItemText
                  primary={`Version ${version.versionNumber} · ${version.status}`}
                  secondary={[
                    `Created ${new Date(version.createdAt).toLocaleString()}`,
                    version.publishedAt
                      ? `Published ${new Date(version.publishedAt).toLocaleString()}`
                      : null,
                    version.publishedByUserId
                      ? `Publisher ${version.publishedByUserId}`
                      : null,
                  ].filter(Boolean).join(' · ')}
                />
              </ListItem>
            ))}
          </List>
        )}
      </PageSection>

      <PageSection
        title="Publish History"
        subtitle="Published route plans retained for operational auditability"
      >
        {publishHistory.length === 0 ? (
          <EmptyState
            title="No publish history"
            message="Published versions will appear here once a route plan has been promoted."
          />
        ) : (
          <List disablePadding>
            {publishHistory.map((version) => (
              <ListItem key={`published-${version.id}`} disableGutters>
                <ListItemText
                  primary={`Version ${version.versionNumber}`}
                  secondary={[
                    version.status,
                    version.publishedAt
                      ? new Date(version.publishedAt).toLocaleString()
                      : null,
                    version.publishedByUserId || null,
                  ].filter(Boolean).join(' · ')}
                />
              </ListItem>
            ))}
          </List>
        )}
      </PageSection>

      <PageSection title="Audit Signals" subtitle="Current dispatch audit context">
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Reroute requests on this route: {rerouteHistoryCount}
          </Typography>
          {Array.isArray(route.planningWarnings) && route.planningWarnings.length > 0 ? (
            <>
              <Divider />
              {route.planningWarnings.slice(0, 3).map((warning) => (
                <Alert severity="warning" key={warning}>
                  {warning}
                </Alert>
              ))}
            </>
          ) : null}
        </Stack>
      </PageSection>
    </Stack>
  );
}
