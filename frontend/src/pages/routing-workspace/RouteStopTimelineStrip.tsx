import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { StatusPill } from '../../components/StatusPill';
import { SurfacePanel } from '../../components/SurfacePanel';
import type { PlannerRouteGroupWithStops } from './RoutingWorkspaceComponents';
import {
  buildRouteTimelineStops,
  formatTimelineDistance,
  formatTimelineDuration,
  formatTimelineMoney,
  formatTimelineTime,
  summarizeRouteTimeline,
  summarizeRouteTimelines,
} from './routeTimeline';

type RouteStopTimelineStripProps = {
  selectedGroup: PlannerRouteGroupWithStops | null;
  timelineGroups?: PlannerRouteGroupWithStops[];
  selectedStopId: string | null;
  onStopSelect: (groupId: string, stopId: string) => void;
  driverName: string;
  routeColor?: string;
  routeColorsById?: Record<string, string>;
  onReoptimize: () => void;
  isBusy?: boolean;
};

function truncateJobId(jobId: string) {
  if (!jobId) return 'JOB';
  const normalized = jobId.replace(/^job-/i, '').toUpperCase();
  return normalized.length > 8 ? normalized.slice(0, 8) : normalized;
}

export function RouteStopTimelineStrip({
  selectedGroup,
  timelineGroups,
  selectedStopId,
  onStopSelect,
  driverName,
  routeColor,
  routeColorsById = {},
  onReoptimize,
  isBusy = false,
}: RouteStopTimelineStripProps) {
  const theme = useTheme();
  const accent = routeColor || theme.palette.primary.main;
  const displayGroups = timelineGroups?.length
    ? timelineGroups
    : selectedGroup
      ? [selectedGroup]
      : [];
  const isAllRoutesView = displayGroups.length > 1;
  const selectedStops = buildRouteTimelineStops(selectedGroup?.stops || []);
  const summary = isAllRoutesView
    ? summarizeRouteTimelines(displayGroups)
    : summarizeRouteTimeline(selectedGroup, selectedStops);
  const headerLabel = isAllRoutesView ? 'All routes' : selectedGroup?.label || 'Select a route';

  const renderTimelineGroup = (group: PlannerRouteGroupWithStops, showGroupHeader: boolean) => {
    const stops = buildRouteTimelineStops(group.stops);
    const groupAccent = routeColorsById[group.id] || (group.id === selectedGroup?.id ? accent : theme.palette.primary.main);
    const groupSummary = summarizeRouteTimeline(group, stops);

    return (
      <Box
        key={group.id}
        data-testid={`routing-route-timeline-group-${group.id}`}
        sx={{
          borderTop: showGroupHeader ? '1px solid' : 0,
          borderColor: 'divider',
          pt: showGroupHeader ? 0.65 : 0,
          mt: showGroupHeader ? 0.6 : 0,
        }}
      >
        {showGroupHeader ? (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.45, minWidth: 0 }}>
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                bgcolor: groupAccent,
                boxShadow: `0 0 0 3px ${alpha(groupAccent, 0.14)}`,
                flex: '0 0 auto',
              }}
            />
            <Typography variant="caption" noWrap sx={{ fontWeight: 950, color: 'text.primary' }}>
              {group.label}
            </Typography>
            <StatusPill label={`${groupSummary.totalStops} stops`} tone="info" />
            <Typography variant="caption" noWrap color="text.secondary" sx={{ fontWeight: 800 }}>
              {formatTimelineDistance(groupSummary.totalDistanceMiles)}
            </Typography>
            <Typography variant="caption" noWrap color="text.secondary" sx={{ fontWeight: 800 }}>
              {formatTimelineDuration(groupSummary.totalDurationMinutes)}
            </Typography>
          </Stack>
        ) : null}

        <Box
          sx={{
            minWidth: Math.max(540, stops.length * 104),
            overflow: 'visible',
          }}
        >
          <Stack direction="row" alignItems="center" sx={{ mb: 0.4 }}>
            <Box
              aria-hidden
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: theme.palette.common.white,
                bgcolor: groupAccent,
                fontSize: 13,
                fontWeight: 900,
                flex: '0 0 auto',
              }}
            >
              H
            </Box>
            {stops.map((stop, index) => {
              const isSelected = group.id === selectedGroup?.id && (stop.id === selectedStopId || (!selectedStopId && index === 0));
              return (
                <Stack key={stop.id} direction="row" alignItems="center" sx={{ flex: '1 1 0', minWidth: 96 }}>
                  <Box sx={{ height: 2, bgcolor: alpha(groupAccent, 0.55), flex: 1 }} />
                  <Button
                    type="button"
                    onClick={() => onStopSelect(group.id, stop.id)}
                    aria-label={`Select ${group.label} stop ${stop.sequence}`}
                    aria-pressed={isSelected}
                    sx={{
                      minWidth: 26,
                      width: 26,
                      height: 26,
                      p: 0,
                      borderRadius: '50%',
                      bgcolor: isSelected ? groupAccent : alpha(groupAccent, 0.12),
                      color: isSelected ? theme.palette.common.white : groupAccent,
                      border: '2px solid',
                      borderColor: isSelected ? alpha(groupAccent, 0.2) : alpha(groupAccent, 0.55),
                      fontWeight: 950,
                      '&:hover': {
                        bgcolor: isSelected ? groupAccent : alpha(groupAccent, 0.2),
                      },
                    }}
                  >
                    {stop.sequence}
                  </Button>
                  {index === stops.length - 1 ? <Box sx={{ height: 2, bgcolor: alpha(groupAccent, 0.55), flex: 1 }} /> : null}
                </Stack>
              );
            })}
          </Stack>

          <Stack direction="row" spacing={0.7}>
            {stops.map((stop) => {
              const isSelected = group.id === selectedGroup?.id && stop.id === selectedStopId;
              return (
                <Box
                  key={stop.id}
                  component="button"
                  type="button"
                  onClick={() => onStopSelect(group.id, stop.id)}
                  aria-pressed={isSelected}
                  sx={{
                    width: 98,
                    minHeight: 58,
                    textAlign: 'left',
                    border: '1px solid',
                    borderColor: isSelected ? groupAccent : 'divider',
                    borderRadius: 1,
                    bgcolor: isSelected ? alpha(groupAccent, 0.08) : 'background.paper',
                    color: 'text.primary',
                    cursor: 'pointer',
                    p: 0.6,
                    flex: '0 0 auto',
                    '&:hover': { borderColor: groupAccent, bgcolor: alpha(groupAccent, 0.08) },
                  }}
                >
                  <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 950 }}>
                    {truncateJobId(stop.jobId)}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
                    {formatTimelineTime(stop.plannedArrival)}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
                    {stop.address}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', mt: 0.2 }}>
                    {formatTimelineDistance(stop.distanceMiles)}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Box>
    );
  };

  return (
    <SurfacePanel
      variant="panel"
      padding={0}
      data-testid="routing-route-timeline-strip"
      sx={{ overflow: 'hidden', minWidth: 0 }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{
          px: 1.2,
          py: 0.6,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: accent,
              boxShadow: `0 0 0 4px ${alpha(accent, 0.14)}`,
              flex: '0 0 auto',
            }}
          />
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 900, color: 'text.primary' }}>
            {headerLabel}
          </Typography>
          <StatusPill label={`${summary.totalStops} stops`} tone={summary.totalStops ? 'info' : 'default'} />
          <Typography variant="caption" noWrap color="text.secondary" sx={{ fontWeight: 800 }}>
            {formatTimelineDistance(summary.totalDistanceMiles)}
          </Typography>
          <Typography variant="caption" noWrap color="text.secondary" sx={{ fontWeight: 800 }}>
            {formatTimelineDuration(summary.totalDurationMinutes)}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: '0 0 auto' }}>
          <Typography variant="caption" noWrap color="text.secondary" sx={{ display: { xs: 'none', xl: 'block' } }}>
            Driver: {driverName}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={onReoptimize}
            disabled={isBusy || !selectedGroup}
            sx={{ minWidth: 96, fontWeight: 900 }}
          >
            Reoptimize
          </Button>
        </Stack>
      </Stack>

      {displayGroups.length ? (
        <Box
          sx={{
            px: 1.2,
            py: 0.65,
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          {displayGroups.map((group) => renderTimelineGroup(group, isAllRoutesView))}
        </Box>
      ) : (
        <Box sx={{ px: 1.2, py: 1.25 }}>
          <Typography variant="body2" color="text.secondary">
            Select a planned route to review sequenced stops, timing, and route totals.
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(92px, 1fr))',
          gap: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          overflowX: 'auto',
        }}
      >
        {[
          ['Total distance', formatTimelineDistance(summary.totalDistanceMiles)],
          ['Drive time', formatTimelineDuration(summary.driveMinutes)],
          ['Service time', formatTimelineDuration(summary.serviceMinutes)],
          ['Stops', String(summary.totalStops)],
          ['Total time', formatTimelineDuration(summary.totalDurationMinutes)],
          ['Est. fuel', formatTimelineMoney(summary.fuelCost)],
          ['Est. labor', formatTimelineMoney(summary.laborCost)],
        ].map(([label, value]) => (
          <Box
            key={label}
            sx={{
              minWidth: 96,
              px: 1,
              py: 0.5,
              borderRight: '1px solid',
              borderColor: 'divider',
              '&:last-of-type': { borderRight: 0 },
            }}
          >
            <Typography variant="caption" noWrap color="text.secondary" sx={{ display: 'block', fontWeight: 800 }}>
              {label}
            </Typography>
            <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 950, color: 'text.primary' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </SurfacePanel>
  );
}
