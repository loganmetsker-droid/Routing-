import { describe, expect, it } from 'vitest';
import { trovanTrainingCatalog } from '@shared/contracts';
import {
  buildOperationalOnboardingSteps,
  buildTrainingOnboardingSteps,
} from './onboarding-readiness';

describe('onboarding readiness', () => {
  it('blocks dependent operating steps until persisted prerequisites exist', () => {
    const steps = buildOperationalOnboardingSteps({
      depotCount: 1,
      activeDriverCount: 1,
      readyVehicleCount: 1,
      jobCount: 2,
      locatedJobCount: 1,
      providerBackedRouteCount: 0,
      dispatchedRouteCount: 0,
      proofCount: 0,
    });

    expect(steps.find((step) => step.id === 'depot')?.complete).toBe(true);
    expect(steps.find((step) => step.id === 'locations')?.complete).toBe(false);
    expect(steps.find((step) => step.id === 'dispatch')?.blocked).toBe(true);
    expect(steps.find((step) => step.id === 'proof')?.blocked).toBe(true);
  });

  it('requires a Champion, Champion track completion, and pilot Driver completion', () => {
    const championModules = trovanTrainingCatalog.filter((module) => module.audiences.includes('CHAMPION'));
    const completed = new Set(['start-here', 'workspace-setup']);
    const steps = buildTrainingOnboardingSteps(championModules, completed, false, true);

    expect(steps.find((step) => step.id === 'champion')?.complete).toBe(true);
    expect(steps.find((step) => step.id === 'training-start-here')?.complete).toBe(true);
    expect(steps.find((step) => step.id === 'training-route-operations')?.complete).toBe(false);
    expect(steps.find((step) => step.id === 'training-go-live')?.blocked).toBe(true);
    expect(steps.find((step) => step.id === 'training-driver-quick-start')?.complete).toBe(false);
  });
});
