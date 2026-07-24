import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AccountCircleOutlined,
  AccessTimeOutlined,
  AssignmentTurnedInOutlined,
  CheckCircleOutlined,
  ErrorOutlineOutlined,
  FullscreenOutlined,
  GrassOutlined,
  LayersOutlined,
  LocalGasStationOutlined,
  LocalShippingOutlined,
  MapOutlined,
  PaidOutlined,
  ReportProblemOutlined,
  RouteOutlined,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LiveRouteMapPanel from '../components/maps/LiveRouteMapPanel';
import type { MapDisplayMode } from '../components/maps/MultiRouteMap';
import LoadingState from '../components/ui/LoadingState';
import { useDispatchBoardQuery } from '../features/dispatch/api/routeRunsApi';
import { useRoutesQuery } from '../services/dispatchApi';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import { useJobsQuery } from '../services/jobsApi';
import { trovanColors, trovanShadows } from '../theme/designTokens';
import {
  buildDashboardEfficiencyMetrics,
  buildDashboardJobStatusMetrics,
  isDashboardStopComplete,
} from './dashboardMetrics';

type MetricCard = {
  label: string;
  value: string | number;
  note: string;
  trend?: string;
  tone?: 'default' | 'danger';
  icon: SvgIconComponent;
};

function DashboardPanel({
  title,
  action,
  actionTo,
  children,
  sx,
}: {
  title: string;
  action?: string;
  actionTo?: string;
  children: React.ReactNode;
  sx?: object;
}) {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: trovanShadows.soft,
        backgroundClip: 'padding-box',
        ...sx,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ minHeight: 46, px: 1.4, py: 0.9, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: 15 }}>
          {title}
        </Typography>
        {action ? (
          <Button
            variant="text"
            size="small"
            onClick={actionTo ? () => navigate(actionTo) : undefined}
            sx={{ color: trovanColors.copper[500], fontWeight: 850 }}
          >
            {action}
          </Button>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

function MetricTile({ card }: { card: MetricCard }) {
  const Icon = card.icon;
  const danger = card.tone === 'danger';
  return (
    <Box
      sx={{
        minHeight: 96,
        p: 1.35,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '12px',
        boxShadow: trovanShadows.soft,
        backgroundClip: 'padding-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.15}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: danger ? alpha(trovanColors.semantic.danger, 0.13) : alpha(trovanColors.semantic.blue, 0.12),
            color: danger ? trovanColors.semantic.danger : trovanColors.semantic.blue,
          }}
        >
          <Icon sx={{ fontSize: 21 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 750, fontSize: 11.5 }}>
            {card.label}
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.15, fontSize: 25, lineHeight: 1.05, color: danger ? trovanColors.semantic.danger : 'text.primary' }}>
            {card.value}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.15, fontSize: 11.5 }}>{card.note}</Typography>
        </Box>
      </Stack>
      {card.trend ? (
        <Typography variant="caption" sx={{ color: trovanColors.semantic.success, fontWeight: 850 }}>
          ↑ {card.trend} vs yesterday
        </Typography>
      ) : null}
    </Box>
  );
}

function LiveOperationsMap({
  routes,
  routeRuns,
  routeRunStops,
  vehicles,
  drivers,
}: {
  routes: ReturnType<typeof useRoutesQuery>['data'];
  routeRuns: NonNullable<ReturnType<typeof useDispatchBoardQuery>['data']>['routeRuns'];
  routeRunStops: NonNullable<ReturnType<typeof useDispatchBoardQuery>['data']>['routeRunStops'];
  vehicles: ReturnType<typeof useVehiclesQuery>['data'];
  drivers: ReturnType<typeof useDriversQuery>['data'];
}) {
  const navigate = useNavigate();
  const [displayMode, setDisplayMode] = useState<MapDisplayMode>('all');
  const [showRouteLayers, setShowRouteLayers] = useState(false);
  const cycleDisplayMode = () => {
    setDisplayMode((current) => {
      if (current === 'all') return 'exceptions';
      if (current === 'exceptions') return 'density';
      return 'all';
    });
  };
  const displayModeLabel =
    displayMode === 'exceptions'
      ? 'Exceptions only'
      : displayMode === 'density'
        ? 'Route density'
        : 'All Routes';

  return (
    <DashboardPanel
      title="Live Operations Map"
      action="View full screen"
      actionTo="/tracking"
      sx={{ position: 'relative' }}
    >
      <Box sx={{ position: 'relative' }}>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1001,
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={cycleDisplayMode}
            sx={{ bgcolor: 'background.paper', fontWeight: 850 }}
          >
            {displayModeLabel}
          </Button>
          <Button
            variant={showRouteLayers ? 'contained' : 'outlined'}
            size="small"
            startIcon={<LayersOutlined />}
            onClick={() => setShowRouteLayers((current) => !current)}
            sx={{ bgcolor: showRouteLayers ? undefined : 'background.paper', fontWeight: 850 }}
          >
            {showRouteLayers ? 'Hide layers' : 'Layers'}
          </Button>
          <Button
            aria-label="Open full-screen map"
            variant="outlined"
            size="small"
            onClick={() => navigate('/tracking')}
            sx={{ minWidth: 38, bgcolor: 'background.paper' }}
          >
            <FullscreenOutlined fontSize="small" />
          </Button>
        </Stack>
        <Box
          sx={{
            position: 'absolute',
            top: 54,
            left: 14,
            zIndex: 1001,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.2,
            boxShadow: '0 12px 28px rgba(16,24,40,.14)',
            p: 1.1,
            minWidth: 132,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary' }}>
            LEGEND
          </Typography>
          {[
            ['In Progress', trovanColors.semantic.success],
            ['En Route', trovanColors.semantic.blue],
            ['On Break', trovanColors.semantic.purple],
            ['Idle', trovanColors.stone[400]],
            ['Delayed', trovanColors.semantic.warning],
          ].map(([label, color]) => (
            <Stack key={label} direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.8 }}>
              <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: String(color) }} />
              <Typography variant="caption">{label}</Typography>
            </Stack>
          ))}
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1, pt: 0.9 }}>
            {[
              ['Customer', MapOutlined],
              ['Depot', LocalShippingOutlined],
              ['Route', RouteOutlined],
            ].map(([label, Icon]) => {
              const LegendIcon = Icon as SvgIconComponent;
              return (
                <Stack key={String(label)} direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.65 }}>
                  <LegendIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                  <Typography variant="caption">{String(label)}</Typography>
                </Stack>
              );
            })}
          </Box>
        </Box>
        <LiveRouteMapPanel
          routes={routes ?? []}
          routeRuns={routeRuns}
          routeRunStops={routeRunStops}
          vehicles={vehicles ?? []}
          drivers={drivers ?? []}
          height={340}
          showLegend={showRouteLayers}
          displayMode={displayMode}
        />
      </Box>
    </DashboardPanel>
  );
}

const formatRouteLabel = (id: string, index: number) =>
  id ? id.replace(/^route-/, 'Route ').replace(/^run-/, 'Route ') : `Route ${index + 1}`;

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export default function Dashboard() {
  const navigate = useNavigate();
  const jobsQuery = useJobsQuery();
  const routesQuery = useRoutesQuery();
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const boardQuery = useDispatchBoardQuery();

  const jobs = jobsQuery.data ?? [];
  const routes = routesQuery.data ?? [];
  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const routeRuns = boardQuery.data?.routeRuns ?? [];
  const routeRunStops = boardQuery.data?.routeRunStops ?? [];
  const exceptions = boardQuery.data?.exceptions ?? [];

  const loading =
    jobsQuery.isLoading ||
    routesQuery.isLoading ||
    driversQuery.isLoading ||
    vehiclesQuery.isLoading ||
    boardQuery.isLoading;

  const state = useMemo(() => {
    const stopsWithTiming = routeRunStops.filter((stop) => stop.actualArrival && stop.plannedArrival);
    const onTimeStops = stopsWithTiming.filter((stop) => {
      const actual = new Date(String(stop.actualArrival)).getTime();
      const planned = new Date(String(stop.plannedArrival)).getTime();
      return Number.isFinite(actual) && Number.isFinite(planned) && actual <= planned;
    }).length;
    const onTimeRate = stopsWithTiming.length
      ? `${Math.round((onTimeStops / stopsWithTiming.length) * 100)}%`
      : 'Not tracked';
    const activeRouteRecords = routeRuns.length ? routeRuns : routes;
    const activeRoutes = activeRouteRecords.filter((route) =>
      ['assigned', 'ready_for_dispatch', 'in_progress'].includes(String(route.workflowStatus || route.status || '').toLowerCase()),
    );
    const readyVehicles = vehicles.filter((vehicle) =>
      ['available', 'active', 'ready'].includes(String(vehicle.status || '').toLowerCase()),
    );
    const readyDrivers = drivers.filter((driver) =>
      ['active', 'on_duty', 'on_route'].includes(String(driver.status || '').toLowerCase()),
    );
    const openExceptions = exceptions.filter((exception) => exception.status === 'OPEN');

    const metricCards: MetricCard[] = [
      { label: 'Jobs Today', value: jobs.length || 0, note: 'Total Jobs', icon: AssignmentTurnedInOutlined },
      { label: 'On-Time Rate', value: onTimeRate, note: stopsWithTiming.length ? `${onTimeStops}/${stopsWithTiming.length} timed stops` : 'No timed stop telemetry', icon: AccessTimeOutlined },
      { label: 'Active Routes', value: activeRoutes.length || activeRouteRecords.length || 0, note: `${routeRuns.length || routes.length || 0} planned/live routes`, icon: RouteOutlined },
      { label: 'Vehicles in Service', value: `${readyVehicles.length} / ${vehicles.length || 0}`, note: 'Ready vehicles', icon: LocalShippingOutlined },
      { label: 'Driver Utilization', value: `${drivers.length ? Math.round((readyDrivers.length / drivers.length) * 100) : 0}%`, note: `${readyDrivers.length}/${drivers.length || 0} active drivers`, icon: AccountCircleOutlined },
      { label: 'Exceptions', value: openExceptions.length, note: 'Require Attention', tone: 'danger', icon: ReportProblemOutlined },
    ];
    const efficiencyMetrics = buildDashboardEfficiencyMetrics(activeRouteRecords);
    const jobStatusMetrics = buildDashboardJobStatusMetrics(jobs);

    const routePerformance = activeRouteRecords.slice(0, 5).map((route, index) => {
      const routeStops = routeRunStops.filter((stop) => stop.routeId === route.id);
      const totalStops = routeStops.length || ('jobIds' in route ? route.jobIds?.length : undefined) || route.jobCount || 0;
      const finishedStops = routeStops.filter(isDashboardStopComplete).length;
      const progress = totalStops ? Math.round((finishedStops / totalStops) * 100) : 0;
      return ({
      id: route.id,
      label: formatRouteLabel(route.id, index),
      driver: route.driverId || 'Driver pending',
      stops: `${finishedStops} / ${totalStops}`,
      onTime: totalStops ? `${progress}%` : 'No stops',
      progress,
      color: [trovanColors.copper[400], trovanColors.semantic.blue, trovanColors.semantic.purple, trovanColors.semantic.teal][index],
    });
    });

    const exceptionCards = Object.values(
      openExceptions.reduce<Record<string, { label: string; count: number; color: string }>>((acc, exception) => {
        const label = exception.code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
        acc[exception.code] = acc[exception.code] || {
          label,
          count: 0,
          color: exception.status === 'OPEN' ? trovanColors.semantic.danger : trovanColors.semantic.warning,
        };
        acc[exception.code].count += 1;
        return acc;
      }, {}),
    ).map((item) => [item.label, `${item.count} open`, item.color]);

    const activity = [
      ...routeRunStops
        .filter((stop) => stop.actualArrival || stop.actualDeparture || stop.proofStatus?.proofCaptured)
        .map((stop) => [
          stop.proofStatus?.proofCaptured ? 'Proof captured' : stop.actualDeparture ? 'Stop departed' : 'Stop arrived',
          `${stop.jobId} • ${stop.routeId}`,
          formatTimestamp(stop.actualDeparture || stop.actualArrival || stop.plannedArrival),
          stop.proofStatus?.proofCaptured ? trovanColors.semantic.success : trovanColors.semantic.blue,
        ]),
      ...openExceptions.map((exception) => [
        exception.message || exception.code,
        exception.routeId || 'Unassigned route',
        formatTimestamp(exception.createdAt),
        trovanColors.semantic.danger,
      ]),
    ].slice(0, 5);

    return {
      metricCards,
      routePerformance,
      exceptionCards,
      activity,
      efficiencyMetrics,
      jobStatusMetrics,
      openExceptions,
    };
  }, [drivers, exceptions, jobs, routeRunStops, routeRuns, routes, vehicles]);

  if (loading) {
    return <LoadingState label="Loading dashboard..." minHeight="50vh" />;
  }

  return (
    <Box data-testid="operations-dashboard-page">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' },
          gap: 1.1,
          mb: 1.35,
        }}
      >
        {state.metricCards.map((card) => (
          <MetricTile key={card.label} card={card} />
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(0, 1fr) minmax(300px, 360px)',
            xl: 'minmax(0, 1fr) 520px',
          },
          gap: 1.25,
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.35} sx={{ minWidth: 0 }}>
          <LiveOperationsMap
            routes={routes}
            routeRuns={routeRuns}
            routeRunStops={routeRunStops}
            vehicles={vehicles}
            drivers={drivers}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.92fr 1.08fr' }, gap: 1.35 }}>
            <DashboardPanel title="Jobs by Status">
              <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2 }}>
                <Box
                  sx={{
                    width: 154,
                    height: 154,
                    borderRadius: '50%',
                    background: `conic-gradient(${trovanColors.semantic.success} 0 ${state.jobStatusMetrics.completedEnd}%, ${trovanColors.semantic.blue} ${state.jobStatusMetrics.completedEnd}% ${state.jobStatusMetrics.inProgressEnd}%, ${trovanColors.semantic.warning} ${state.jobStatusMetrics.inProgressEnd}% ${state.jobStatusMetrics.pendingEnd}%, ${trovanColors.semantic.danger} ${state.jobStatusMetrics.pendingEnd}% 100%)`,
                    display: 'grid',
                    placeItems: 'center',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      width: 86,
                      height: 86,
                      borderRadius: '50%',
                      bgcolor: 'background.paper',
                    },
                  }}
                >
                  <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                    <Typography variant="h4">{jobs.length || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                  </Box>
                </Box>
                <Stack spacing={1}>
                  {[
                    ['Completed', state.jobStatusMetrics.completed, trovanColors.semantic.success],
                    ['In Progress', state.jobStatusMetrics.inProgress, trovanColors.semantic.blue],
                    ['Pending', state.jobStatusMetrics.pending, trovanColors.semantic.warning],
                    ['Failed / Cancelled', state.jobStatusMetrics.failed, trovanColors.semantic.danger],
                  ].map(([label, value, color]) => (
                    <Stack key={String(label)} direction="row" spacing={0.8} alignItems="center">
                      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: String(color) }} />
                      <Typography variant="caption">{String(label)} {String(value)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </DashboardPanel>

            <DashboardPanel title="Recent Activity" action="View all" actionTo="/dispatch">
              {state.activity.length ? state.activity.slice(0, 4).map(([title, detail, when, color]) => (
                <Stack key={String(title)} direction="row" alignItems="center" spacing={1.2} sx={{ px: 1.6, py: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: String(color), color: '#fff', display: 'grid', placeItems: 'center' }}>
                    {String(title).includes('Failed') ? <ReportProblemOutlined fontSize="small" /> : <CheckCircleOutlined fontSize="small" />}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={800}>{String(title)}</Typography>
                    <Typography variant="caption" color="text.secondary">{String(detail)}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">{String(when)}</Typography>
                </Stack>
              )) : (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No live route activity has been recorded yet.
                  </Typography>
                </Box>
              )}
            </DashboardPanel>
          </Box>
        </Stack>

        <Stack spacing={1.25} sx={{ minWidth: 0 }}>
          <DashboardPanel title="Route Performance" action="View all routes" actionTo="/routing">
            <Box sx={{ px: 1.4, pb: 1.3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 0.7fr 0.75fr', gap: 1, py: 1.2, color: 'text.secondary' }}>
                {['Route', 'Progress', '', 'Avg ETA Variance'].map((label) => (
                  <Typography key={label} variant="caption">{label}</Typography>
                ))}
              </Box>
              {state.routePerformance.map((route, index) => (
                <Box key={route.id} sx={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 0.7fr 0.75fr', gap: 1, alignItems: 'center', py: 1.08, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" fontWeight={850}>{route.label}</Typography>
                  <Box sx={{ height: 6, borderRadius: 999, bgcolor: 'divider', overflow: 'hidden' }}>
                    <Box sx={{ width: `${route.progress}%`, height: '100%', bgcolor: trovanColors.copper[700], borderRadius: 999 }} />
                  </Box>
                  <Typography variant="body2" fontWeight={800}>{route.onTime}</Typography>
                  <Typography variant="body2" sx={{ color: index === 2 ? trovanColors.semantic.danger : trovanColors.semantic.success, fontWeight: 800 }}>
                    {route.stops}
                  </Typography>
                </Box>
              ))}
            </Box>
          </DashboardPanel>

          <DashboardPanel title="Exceptions" action="View all" actionTo="/exceptions">
            {state.exceptionCards.length ? state.exceptionCards.map(([label, count, color]) => (
              <Stack
                key={String(label)}
                component="button"
                type="button"
                direction="row"
                alignItems="center"
                spacing={1.2}
                sx={{
                  width: '100%',
                  px: 1.6,
                  py: 1.25,
                  border: 0,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background-color 140ms ease',
                  '&:hover': { bgcolor: alpha(trovanColors.copper[500], 0.045) },
                  '&:focus-visible': {
                    outline: `2px solid ${alpha(trovanColors.copper[500], 0.55)}`,
                    outlineOffset: -2,
                  },
                }}
                onClick={() => navigate('/exceptions')}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: alpha(String(color), 0.14), color: String(color), display: 'grid', placeItems: 'center' }}>
                  <ErrorOutlineOutlined />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={800}>{String(label)}</Typography>
                  <Typography variant="caption" color="text.secondary">{String(count)}</Typography>
                </Box>
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: trovanColors.semantic.danger, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>
                  {String(count).split(' ')[0]}
                </Box>
                <Typography color="text.secondary">›</Typography>
              </Stack>
            )) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No open dispatch exceptions in the current board.
                </Typography>
              </Box>
            )}
          </DashboardPanel>

          <DashboardPanel title="Efficiency & Savings (MTD)" action="View details" actionTo="/analytics">
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 116px', gap: 1.1, p: 1.4, alignItems: 'center' }}>
              {state.efficiencyMetrics.cards.map((card, index) => {
                const Icon = [LocalGasStationOutlined, GrassOutlined, PaidOutlined][index];
                const SavingsIcon = Icon as SvgIconComponent;
                return (
                  <Stack key={card.label} spacing={0.45}>
                    <SavingsIcon sx={{ color: trovanColors.copper[500], fontSize: 20 }} />
                    <Typography variant="body2" fontWeight={900}>{card.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{card.note}</Typography>
                  </Stack>
                );
              })}
              <Box sx={{ width: 92, height: 92, borderRadius: '50%', border: `8px solid ${trovanColors.copper[700]}`, display: 'grid', placeItems: 'center', textAlign: 'center', justifySelf: 'end' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">ROI</Typography>
                  <Typography variant="h5">{state.efficiencyMetrics.roiLabel}</Typography>
                </Box>
              </Box>
            </Box>
          </DashboardPanel>
        </Stack>
      </Box>
    </Box>
  );
}
