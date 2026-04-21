import { Grid, Stack, Typography } from '@mui/material';
import PageSection from '../../../components/ui/PageSection';
import type { DispatchRoute } from '../../../types/dispatch';
import { groupRoutesByStatus } from '../utils/dispatchSelectors';
import RouteCard from './RouteCard';

type RoutesBoardProps = {
  routes: DispatchRoute[];
  selectedRouteId: string | null;
  onSelectRoute: (route: DispatchRoute) => void;
};

const COLUMN_ORDER = ['planned', 'assigned', 'in_progress', 'completed', 'cancelled'];

export default function RoutesBoard({
  routes,
  selectedRouteId,
  onSelectRoute,
}: RoutesBoardProps) {
  const grouped = groupRoutesByStatus(routes);

  return (
    <PageSection
      title="Routes Board"
      subtitle="Board-first dispatch workflow grouped by live execution state"
    >
      <Grid container spacing={2}>
        {COLUMN_ORDER.map((status) => (
          <Grid item xs={12} md={6} xl={2.4 as any} key={status}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                {status.replace('_', ' ')} ({grouped[status]?.length ?? 0})
              </Typography>
              {grouped[status]?.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  selected={route.id === selectedRouteId}
                  onSelect={onSelectRoute}
                />
              ))}
            </Stack>
          </Grid>
        ))}
      </Grid>
    </PageSection>
  );
}
