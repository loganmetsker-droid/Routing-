import { useState, type ReactNode } from 'react';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import { KpiTile } from '../components/KpiTile';
import LoadingState from '../components/ui/LoadingState';
import { useAnalyticsOverviewQuery } from '../services/analyticsApi';
import { trovanColors } from '../theme/designTokens';

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function BarRow({
  label,
  value,
  max,
  tone = trovanColors.copper[500],
  meta,
}: {
  label: string;
  value: number;
  max: number;
  tone?: string;
  meta?: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const ratio = max > 0 ? Math.max(8, Math.round((value / max) * 100)) : 0;

  return (
    <Stack spacing={0.45}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {meta ?? value}
        </Typography>
      </Stack>
      <Box
        sx={{
          height: 8,
          borderRadius: 999,
          bgcolor: isDark ? trovanColors.utility.panelMuted : alpha(trovanColors.black[900], 0.08),
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${ratio}%`,
            height: '100%',
            borderRadius: 999,
            bgcolor: tone,
          }}
        />
      </Box>
    </Stack>
  );
}

function ModuleHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
      <Box>
        <Typography variant="h6" component="h3">{title}</Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {badge}
    </Stack>
  );
}

export default function AnalyticsPage() {
  const analyticsQuery = useAnalyticsOverviewQuery();
  const analytics = analyticsQuery.data ?? null;
  const [viewMode, setViewMode] = useState<'overview' | 'details'>('overview');

  if (analyticsQuery.isLoading) {
    return <LoadingState label="Loading analytics overview..." minHeight="50vh" />;
  }

  const routeBreakdown = analytics?.routeStatusBreakdown ?? [];
  const exceptionBreakdown = analytics?.exceptionStatusBreakdown ?? [];
  const maxRouteCount = Math.max(...routeBreakdown.map((item) => item.count), 1);
  const maxExceptionCount = Math.max(...exceptionBreakdown.map((item) => item.count), 1);
  const hasServicedStops = (analytics?.workload.servicedStops ?? 0) > 0;
  const hasProofSignal = (analytics?.serviceLevel.proofCaptureRate ?? 0) > 0;
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(analytics ?? {}, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trovan-analytics-overview.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={1.75}>
      <PageHeader
        eyebrow="Intelligence"
        title="Analytics"
        subtitle="Service-level, fleet readiness, and route pressure arranged as an operator intelligence workspace."
        actions={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <StatusPill label={`${viewMode === 'overview' ? 'Overview' : 'Detailed'} view`} tone="accent" />
            <Button
              variant="outlined"
              onClick={() => setViewMode((current) => (current === 'overview' ? 'details' : 'overview'))}
            >
              View
            </Button>
            <Button variant="contained" onClick={handleExport}>
              Export
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiTile
            label="On-time rate"
            value={`${analytics?.serviceLevel.onTimeRate ?? 0}%`}
            meta={hasServicedStops ? 'Arrival performance' : 'No completed timing data'}
            tone="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiTile
            label="Proof capture"
            value={`${analytics?.serviceLevel.proofCaptureRate ?? 0}%`}
            meta={hasProofSignal ? 'Stops with proof' : 'No proof captured yet'}
            tone="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiTile
            label="Active routes"
            value={analytics?.operations.activeRouteRuns ?? 0}
            meta={`${analytics?.operations.plannedRouteRuns ?? 0} still planned`}
          />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiTile
            label="Open exceptions"
            value={analytics?.workload.openExceptions ?? 0}
            meta={`${analytics?.serviceLevel.exceptionRate ?? 0}% route exception rate`}
            tone={(analytics?.workload.openExceptions ?? 0) > 0 ? 'warning' : 'default'}
          />
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid item xs={12} lg={7}>
          <SurfacePanel variant="panel" padding={1.65}>
            <Stack spacing={1.5}>
              <ModuleHeader
                title="Performance snapshot"
                subtitle="Read service delivery quality and route throughput without leaving the dispatcher workspace."
                badge={<StatusPill label="Live" tone="accent" />}
              />
              <Grid container spacing={1.2}>
                <Grid item xs={12} md={6}>
                  <SurfacePanel variant="muted" padding={1.35}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Route throughput</Typography>
                      <BarRow
                        label="Completed last 7d"
                        value={analytics?.serviceLevel.completedRouteRunsLast7Days ?? 0}
                        max={Math.max(
                          analytics?.operations.totalRouteRuns ?? 0,
                          analytics?.serviceLevel.completedRouteRunsLast7Days ?? 0,
                          1,
                        )}
                        meta={`${analytics?.serviceLevel.completedRouteRunsLast7Days ?? 0} route runs`}
                      />
                      <BarRow
                        label="Serviced stops"
                        value={analytics?.workload.servicedStops ?? 0}
                        max={Math.max(analytics?.workload.totalStops ?? 0, 1)}
                        meta={`${percent(
                          analytics?.workload.servicedStops ?? 0,
                          analytics?.workload.totalStops ?? 0,
                        )}% of total`}
                        tone={trovanColors.semantic.info}
                      />
                    </Stack>
                  </SurfacePanel>
                </Grid>
                <Grid item xs={12} md={6}>
                  <SurfacePanel variant="muted" padding={1.35}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Route efficiency</Typography>
                      <BarRow
                        label="Average distance"
                        value={analytics?.operations.averageRouteDistanceKm ?? 0}
                        max={Math.max((analytics?.operations.averageRouteDistanceKm ?? 0) * 1.3, 1)}
                        meta={`${((analytics?.operations.averageRouteDistanceKm ?? 0) * 0.621371).toFixed(1)} mi`}
                      />
                      <BarRow
                        label="Average duration"
                        value={analytics?.operations.averageRouteDurationMinutes ?? 0}
                        max={Math.max(
                          (analytics?.operations.averageRouteDurationMinutes ?? 0) * 1.25,
                          1,
                        )}
                        meta={`${analytics?.operations.averageRouteDurationMinutes ?? 0} min`}
                        tone={trovanColors.semantic.warning}
                      />
                    </Stack>
                  </SurfacePanel>
                </Grid>
              </Grid>
              <Grid container spacing={1.2}>
                <Grid item xs={12} md={4}>
                  <SurfacePanel variant="subtle" padding={1.35}>
                    <Typography variant="subtitle2">On-time signal</Typography>
                    <Typography variant="h4" component="p" sx={{ mt: 0.55 }}>
                      {analytics?.serviceLevel.onTimeRate ?? 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {hasServicedStops
                        ? 'Routes are landing close to planned service windows.'
                        : 'No completed stop timing has been captured for this workspace yet.'}
                    </Typography>
                  </SurfacePanel>
                </Grid>
                <Grid item xs={12} md={4}>
                  <SurfacePanel variant="subtle" padding={1.35}>
                    <Typography variant="subtitle2">Proof discipline</Typography>
                    <Typography variant="h4" component="p" sx={{ mt: 0.55 }}>
                      {analytics?.serviceLevel.proofCaptureRate ?? 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {hasProofSignal
                        ? 'Proof collection stays strong when drivers remain in guided flows.'
                        : 'Proof metrics will populate from completed driver stop records.'}
                    </Typography>
                  </SurfacePanel>
                </Grid>
                <Grid item xs={12} md={4}>
                  <SurfacePanel variant="subtle" padding={1.35}>
                    <Typography variant="subtitle2">Exception pressure</Typography>
                    <Typography variant="h4" component="p" sx={{ mt: 0.55 }}>
                      {analytics?.serviceLevel.exceptionRate ?? 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      Lower route disruption keeps the board cleaner for dispatchers.
                    </Typography>
                  </SurfacePanel>
                </Grid>
              </Grid>
            </Stack>
          </SurfacePanel>
        </Grid>

        <Grid item xs={12} lg={5}>
          <SurfacePanel variant="panel" padding={1.65}>
            <Stack spacing={1.45}>
              <ModuleHeader
                title="Fleet readiness"
                subtitle="Vehicle, driver, and telemetry posture for the current operating window."
                badge={
                  <StatusPill
                    label={`${percent(
                      analytics?.fleet.activeVehicles ?? 0,
                      analytics?.fleet.totalVehicles ?? 0,
                    )}% ready`}
                    tone="success"
                  />
                }
              />
              <SurfacePanel variant="muted" padding={1.35}>
                <Stack spacing={1}>
                  <BarRow
                    label="Active vehicles"
                    value={analytics?.fleet.activeVehicles ?? 0}
                    max={Math.max(analytics?.fleet.totalVehicles ?? 0, 1)}
                    meta={`${analytics?.fleet.activeVehicles ?? 0} of ${analytics?.fleet.totalVehicles ?? 0}`}
                    tone={trovanColors.semantic.success}
                  />
                  <BarRow
                    label="Active drivers"
                    value={analytics?.fleet.activeDrivers ?? 0}
                    max={Math.max(analytics?.fleet.totalDrivers ?? 0, 1)}
                    meta={`${analytics?.fleet.activeDrivers ?? 0} of ${analytics?.fleet.totalDrivers ?? 0}`}
                    tone={trovanColors.semantic.info}
                  />
                  <BarRow
                    label="Vehicles reporting"
                    value={analytics?.fleet.vehiclesReportingRecently ?? 0}
                    max={Math.max(analytics?.fleet.totalVehicles ?? 0, 1)}
                    meta={`${analytics?.fleet.vehiclesReportingRecently ?? 0} recently online`}
                  />
                </Stack>
              </SurfacePanel>
              <Grid container spacing={1.2}>
                <Grid item xs={12} sm={6}>
                  <SurfacePanel variant="subtle" padding={1.35}>
                    <Typography variant="subtitle2">Dispatch posture</Typography>
                    <Typography variant="h4" component="p" sx={{ mt: 0.55 }}>
                      {analytics?.operations.activeRouteRuns ?? 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      Live routes currently driving or assigned.
                    </Typography>
                  </SurfacePanel>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <SurfacePanel variant="subtle" padding={1.35}>
                    <Typography variant="subtitle2">Planning backlog</Typography>
                    <Typography variant="h4" component="p" sx={{ mt: 0.55 }}>
                      {analytics?.operations.plannedRouteRuns ?? 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      Runs still waiting for publish or dispatch.
                    </Typography>
                  </SurfacePanel>
                </Grid>
              </Grid>
            </Stack>
          </SurfacePanel>
        </Grid>

        <Grid item xs={12} md={6}>
          <SurfacePanel variant="panel" padding={1.65}>
            <Stack spacing={1.35}>
              <ModuleHeader
                title="Route status mix"
                subtitle="Where route volume currently sits across planning and execution."
              />
              <Stack spacing={1}>
                {routeBreakdown.map((item) => (
                  <BarRow
                    key={item.status}
                    label={item.status.replace(/_/g, ' ')}
                    value={item.count}
                    max={maxRouteCount}
                    meta={`${item.count} route runs`}
                    tone={
                      item.status === 'in_progress'
                        ? trovanColors.semantic.info
                        : trovanColors.copper[500]
                    }
                  />
                ))}
              </Stack>
            </Stack>
          </SurfacePanel>
        </Grid>

        <Grid item xs={12} md={6}>
          <SurfacePanel variant="panel" padding={1.65}>
            <Stack spacing={1.35}>
              <ModuleHeader
                title="Exception pressure"
                subtitle="Operational disruption level and queue pressure from the current run set."
                badge={
                  <StatusPill
                    label={`${analytics?.workload.openExceptions ?? 0} open`}
                    tone={(analytics?.workload.openExceptions ?? 0) > 0 ? 'warning' : 'default'}
                  />
                }
              />
              <Grid container spacing={1.2}>
                <Grid item xs={12} sm={6}>
                  <SurfacePanel variant="muted" padding={1.35}>
                    <Typography variant="subtitle2">Workload</Typography>
                    <Typography variant="h4" component="p" sx={{ mt: 0.55 }}>
                      {analytics?.workload.totalStops ?? 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      Total routed stops under management.
                    </Typography>
                  </SurfacePanel>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <SurfacePanel variant="muted" padding={1.35}>
                    <Typography variant="subtitle2">Serviced</Typography>
                    <Typography variant="h4" component="p" sx={{ mt: 0.55 }}>
                      {analytics?.workload.servicedStops ?? 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      Stops completed with state updates recorded.
                    </Typography>
                  </SurfacePanel>
                </Grid>
              </Grid>
              <Stack spacing={1}>
                {exceptionBreakdown.map((item) => (
                  <BarRow
                    key={item.status}
                    label={item.status.replace(/_/g, ' ')}
                    value={item.count}
                    max={maxExceptionCount}
                    meta={`${item.count} records`}
                    tone={
                      item.status === 'OPEN'
                        ? trovanColors.semantic.warning
                        : trovanColors.semantic.success
                    }
                  />
                ))}
              </Stack>
            </Stack>
          </SurfacePanel>
        </Grid>
      </Grid>
    </Stack>
  );
}
