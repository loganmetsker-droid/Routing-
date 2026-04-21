import { Alert, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import PageSection from '../../../components/ui/PageSection';
import EmptyState from '../../../components/ui/EmptyState';
import type { DispatchRoute } from '../../../types/dispatch';

type ExceptionsPanelProps = {
  routes: DispatchRoute[];
  onSelectRoute: (route: DispatchRoute) => void;
};

export default function ExceptionsPanel({
  routes,
  onSelectRoute,
}: ExceptionsPanelProps) {
  return (
    <PageSection
      title="Exceptions"
      subtitle="Routes needing operator review before execution"
    >
      {routes.length === 0 ? (
        <EmptyState
          title="No route exceptions"
          message="Active route warnings, dropped stops, and reroute flags will surface here."
          icon={<WarningAmberRoundedIcon color="disabled" />}
        />
      ) : (
        <List disablePadding>
          {routes.map((route) => (
            <ListItem
              key={route.id}
              disableGutters
              sx={{ alignItems: 'flex-start', cursor: 'pointer' }}
              onClick={() => onSelectRoute(route)}
            >
              <ListItemText
                primary={`Route ${route.id.slice(0, 8)}`}
                secondary={
                  <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {route.exceptionCategory ? (
                      <Alert severity="warning" sx={{ py: 0 }}>
                        {route.exceptionCategory}
                      </Alert>
                    ) : null}
                    {Array.isArray(route.planningWarnings) && route.planningWarnings.length > 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {route.planningWarnings[0]}
                      </Typography>
                    ) : null}
                    {Array.isArray(route.droppedJobIds) && route.droppedJobIds.length > 0 ? (
                      <Typography variant="body2" color="error.main">
                        {route.droppedJobIds.length} dropped stop
                        {route.droppedJobIds.length === 1 ? '' : 's'}
                      </Typography>
                    ) : null}
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </PageSection>
  );
}
