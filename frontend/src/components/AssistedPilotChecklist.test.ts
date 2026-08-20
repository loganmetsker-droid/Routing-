import { describe, expect, it } from 'vitest';
import { buildAssistedPilotSteps } from './AssistedPilotChecklist';

describe('assisted pilot setup checklist', () => {
  it('derives completion and blocking from persisted record counts', () => {
    const steps = buildAssistedPilotSteps({
      depotCount: 1,
      driverCount: 1,
      vehicleCount: 1,
      jobCount: 3,
      locatedJobCount: 2,
      optimizedRouteCount: 0,
      dispatchedRouteCount: 0,
      completedProofCount: 0,
    });

    expect(steps.find((step) => step.id === 'depot')?.complete).toBe(true);
    expect(steps.find((step) => step.id === 'locations')?.complete).toBe(false);
    expect(steps.find((step) => step.id === 'dispatch')?.blocked).toBe(true);
  });
});
