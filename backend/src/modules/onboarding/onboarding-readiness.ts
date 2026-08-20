import type { OnboardingStep, TrainingModule } from '@shared/contracts';

export type OperationalCounts = {
  depotCount: number;
  activeDriverCount: number;
  readyVehicleCount: number;
  jobCount: number;
  locatedJobCount: number;
  providerBackedRouteCount: number;
  dispatchedRouteCount: number;
  proofCount: number;
};
export const buildOperationalOnboardingSteps = (counts: OperationalCounts): OnboardingStep[] => {
  const hasJobs = counts.jobCount > 0;
  return [
    {
      id: 'depot', label: 'Confirm primary depot', owner: 'Champion', complete: counts.depotCount > 0,
      blocked: false, action: 'Configure depot', href: '/settings', detail: 'Save the pilot team\'s primary operating depot.',
    },
    {
      id: 'drivers', label: 'Add an active driver', owner: 'Champion', complete: counts.activeDriverCount > 0,
      blocked: false, action: 'Add driver', href: '/drivers', detail: 'At least one active pilot driver is required.',
    },
    {
      id: 'vehicles', label: 'Add a ready vehicle', owner: 'Fleet owner', complete: counts.readyVehicleCount > 0,
      blocked: false, action: 'Add vehicle', href: '/vehicles', detail: 'Use an available vehicle with realistic capacity.',
    },
    {
      id: 'jobs', label: 'Import the first route day', owner: 'Dispatcher', complete: hasJobs,
      blocked: false, action: 'Import jobs', href: '/jobs', detail: 'Import one representative pilot route day.',
    },
    {
      id: 'locations', label: 'Validate every job location', owner: 'Dispatcher', complete: hasJobs && counts.locatedJobCount === counts.jobCount,
      blocked: !hasJobs, action: 'Review jobs', href: '/jobs', detail: 'Every imported job needs a routable pickup or delivery location.',
    },
    {
      id: 'optimize', label: 'Create a provider-backed route', owner: 'Dispatcher', complete: counts.providerBackedRouteCount > 0,
      blocked: !hasJobs || counts.readyVehicleCount === 0, action: 'Open planning', href: '/routing', detail: 'Use road-network inputs and resolve publish blockers.',
    },
    {
      id: 'dispatch', label: 'Dispatch the practice route', owner: 'Dispatcher', complete: counts.dispatchedRouteCount > 0,
      blocked: counts.providerBackedRouteCount === 0, action: 'Open dispatch', href: '/dispatch', detail: 'Assign the trained pilot driver and dispatch the route.',
    },
    {
      id: 'proof', label: 'Capture first delivery proof', owner: 'Pilot driver', complete: counts.proofCount > 0,
      blocked: counts.dispatchedRouteCount === 0, action: 'Review proof', href: '/pod', detail: 'Confirm a persisted proof artifact from the practice route.',
    },
  ];
};

export const buildTrainingOnboardingSteps = (
  modules: readonly TrainingModule[],
  completedModuleKeys: ReadonlySet<string>,
  driverTrainingComplete: boolean,
  championSelected: boolean,
): OnboardingStep[] => {
  const required = modules.filter((module) => module.required && module.key !== 'driver-quick-start');
  const steps: OnboardingStep[] = [
    {
      id: 'champion', label: 'Assign the customer Champion', owner: 'Owner or Admin', complete: championSelected,
      blocked: false, action: 'Choose Champion', href: '/academy', detail: 'The Champion owns the self-guided implementation.',
    },
    ...required.map((module, index) => ({
      id: `training-${module.key}`,
      label: module.title,
      owner: 'Champion',
      complete: completedModuleKeys.has(module.key),
      blocked: !championSelected || required.slice(0, index).some((item) => !completedModuleKeys.has(item.key)),
      action: 'Open lesson',
      href: `/academy/${module.key}`,
      detail: `${module.estimatedMinutes} minutes - score ${module.knowledgeCheck.passingScore}% or better.`,
    })),
    {
      id: 'training-driver-quick-start', label: 'Pilot driver completes Driver Quick Start', owner: 'Pilot driver',
      complete: driverTrainingComplete, blocked: !championSelected, action: 'Open driver lesson', href: '/academy/driver-quick-start',
      detail: 'At least one Driver-role team member must complete the driver track.',
    },
  ];
  return steps;
};
