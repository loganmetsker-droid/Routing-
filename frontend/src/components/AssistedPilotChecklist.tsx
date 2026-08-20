import { CheckCircleOutlined, RadioButtonUncheckedOutlined } from '@mui/icons-material';
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link } from '../router';
import { useOnboardingReadinessQuery } from '../services/onboardingApi';
import { trovanColors } from '../theme/designTokens';
import { SurfacePanel } from './SurfacePanel';

type SetupStep = {
  id: string;
  label: string;
  owner: string;
  complete: boolean;
  blocked: boolean;
  action: string;
  to: string;
};

export function buildAssistedPilotSteps(input: {
  depotCount: number;
  driverCount: number;
  vehicleCount: number;
  jobCount: number;
  locatedJobCount: number;
  optimizedRouteCount: number;
  dispatchedRouteCount: number;
  completedProofCount: number;
}): SetupStep[] {
  const hasJobs = input.jobCount > 0;
  return [
    { id: 'depot', label: 'Confirm primary depot', owner: 'Launch owner', complete: input.depotCount > 0, blocked: false, action: 'Configure', to: '/settings' },
    { id: 'drivers', label: 'Add an active driver', owner: 'Dispatcher', complete: input.driverCount > 0, blocked: false, action: 'Add driver', to: '/drivers' },
    { id: 'vehicles', label: 'Add a ready vehicle', owner: 'Fleet owner', complete: input.vehicleCount > 0, blocked: false, action: 'Add vehicle', to: '/vehicles' },
    { id: 'jobs', label: 'Import the first route day', owner: 'Dispatcher', complete: hasJobs, blocked: false, action: 'Import jobs', to: '/jobs' },
    { id: 'locations', label: 'Validate every job location', owner: 'Dispatcher', complete: hasJobs && input.locatedJobCount === input.jobCount, blocked: !hasJobs, action: 'Review jobs', to: '/jobs' },
    { id: 'optimize', label: 'Create a provider-backed draft', owner: 'Dispatcher', complete: input.optimizedRouteCount > 0, blocked: !hasJobs || input.vehicleCount === 0, action: 'Open planning', to: '/routing' },
    { id: 'dispatch', label: 'Publish and dispatch a route', owner: 'Dispatcher', complete: input.dispatchedRouteCount > 0, blocked: input.optimizedRouteCount === 0, action: 'Open dispatch', to: '/dispatch' },
    { id: 'proof', label: 'Capture first delivery proof', owner: 'Pilot driver', complete: input.completedProofCount > 0, blocked: input.dispatchedRouteCount === 0, action: 'Review proof', to: '/pod' },
  ];
}

export function AssistedPilotChecklist({ compact = false }: { compact?: boolean }) {
  const readinessQuery = useOnboardingReadinessQuery();
  const readiness = readinessQuery.data;
  const steps = readiness ? [...readiness.trainingSteps, ...readiness.operationalSteps] : [];
  const completeCount = readiness?.completedSteps ?? 0;
  const firstAction = readiness?.nextAction ?? null;
  const loading = readinessQuery.isLoading;
  const totalSteps = readiness?.totalSteps || 1;

  return (
    <SurfacePanel variant="panel" padding={compact ? 1.2 : 1.5} data-testid="assisted-pilot-checklist">
      <Stack spacing={1.15}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.8}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
              Assisted-pilot setup
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Training and workspace progress are calculated from persisted organization data.
            </Typography>
          </Box>
          {firstAction ? (
            <Button component={Link} to={firstAction.href} size="small" variant="contained">
              {firstAction.action}
            </Button>
          ) : (
            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 850 }}>
              Ready for launch review
            </Typography>
          )}
        </Stack>
        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.45 }}>
            <Typography variant="caption" sx={{ fontWeight: 800 }}>
              {loading ? 'Checking setup…' : `${completeCount} of ${readiness?.totalSteps || 0} complete`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {Math.round((completeCount / totalSteps) * 100)}%
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={(completeCount / totalSteps) * 100} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : { xs: '1fr', lg: '1fr 1fr' }, gap: 0.65 }}>
          {steps.slice(0, compact ? 6 : 16).map((step) => (
            <Stack
              key={step.id}
              direction="row"
              spacing={0.8}
              alignItems="center"
              sx={{
                px: 0.9,
                py: 0.7,
                borderRadius: 1,
                bgcolor: step.complete
                  ? alpha(trovanColors.semantic.success, 0.07)
                  : step.blocked
                    ? alpha(trovanColors.semantic.warning, 0.07)
                    : 'transparent',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {step.complete
                ? <CheckCircleOutlined color="success" sx={{ fontSize: 19 }} />
                : <RadioButtonUncheckedOutlined color={step.blocked ? 'warning' : 'disabled'} sx={{ fontSize: 19 }} />}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                  {step.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {step.blocked && !step.complete ? 'Blocked · ' : ''}{step.owner}
                </Typography>
              </Box>
              {!step.complete && !step.blocked ? (
                <Button component={Link} to={step.href} size="small" variant="text">
                  Open
                </Button>
              ) : null}
            </Stack>
          ))}
        </Box>
        {!loading && steps.length === 0 ? (
          <Typography variant="body2" color={readinessQuery.isError ? 'error.main' : 'text.secondary'}>
            {readinessQuery.isError ? 'Readiness is temporarily unavailable. Open Academy to continue training.' : 'No readiness steps are available.'}
          </Typography>
        ) : null}
      </Stack>
    </SurfacePanel>
  );
}
