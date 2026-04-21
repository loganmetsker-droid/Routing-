import { Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { DispatchRoute } from '../../../types/dispatch';

type RouteCardProps = {
  route: DispatchRoute;
  selected: boolean;
  onSelect: (route: DispatchRoute) => void;
};

export default function RouteCard({ route, selected, onSelect }: RouteCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper',
      }}
    >
      <CardActionArea onClick={() => onSelect(route)}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="subtitle2" fontWeight={700}>
              Route {route.id.slice(0, 8)}
            </Typography>
            <Chip size="small" label={route.status || 'planned'} />
          </Stack>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Vehicle: {route.vehicleId ? route.vehicleId.slice(0, 8) : 'Unassigned'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Driver: {route.driverId ? route.driverId.slice(0, 8) : 'Unassigned'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Stops: {route.jobIds?.length ?? route.optimizedStops?.length ?? 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Distance: {route.totalDistanceKm ?? route.totalDistance ?? 0} km
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
