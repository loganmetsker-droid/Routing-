import {
  getConstraintPack,
  getRegisteredConstraintPacks,
} from './constraint-packs';
import { evaluateRerouteConstraints } from './reroute-constraints';
import { RouteStatus } from './entities/route.entity';

describe('constraint pack registry', () => {
  it('registers construction/concrete pack', () => {
    const pack = getConstraintPack('construction_concrete');
    expect(pack).toBeTruthy();
    expect(getRegisteredConstraintPacks().some((p) => p.id === 'construction_concrete')).toBe(true);
  });

  it('executes concrete pack reason codes through core evaluator', () => {
    const diagnostics = evaluateRerouteConstraints({
      route: {
        id: 'r1',
        status: RouteStatus.ASSIGNED,
        routeData: {},
      } as any,
      action: 'reorder_stops',
      payload: {
        constraintPackId: 'construction_concrete',
        siteReadinessByJob: { j1: false },
      },
      beforeSnapshot: { jobIds: ['j1'] },
      afterSnapshot: { jobIds: ['j1'], dataQuality: 'live' },
      jobs: [
        {
          id: 'j1',
          notes: 'Concrete pour - slab',
          specialInstructions: '',
          estimatedDuration: 20,
          timeWindowStart: new Date('2026-01-01T08:00:00.000Z'),
          timeWindowEnd: new Date('2026-01-01T14:00:00.000Z'),
          weight: 5,
          volume: 1,
        } as any,
      ],
      vehicle: null,
      driver: null,
    });

    expect(diagnostics.selectedPackId).toBe('construction_concrete');
    expect(diagnostics.reasonCodes).toContain('CONCRETE_SITE_NOT_READY');
    expect(diagnostics.packDiagnostics.some((d) => d.packId === 'construction_concrete')).toBe(true);
  });

  it('keeps generic flow clean when no pack applies', () => {
    const diagnostics = evaluateRerouteConstraints({
      route: {
        id: 'r2',
        status: RouteStatus.ASSIGNED,
        routeData: {},
      } as any,
      action: 'reorder_stops',
      payload: {},
      beforeSnapshot: { jobIds: ['j2'] },
      afterSnapshot: { jobIds: ['j2'], dataQuality: 'live' },
      jobs: [
        {
          id: 'j2',
          notes: 'Standard delivery',
          specialInstructions: '',
          estimatedDuration: 15,
          timeWindowStart: new Date('2026-01-01T08:00:00.000Z'),
          timeWindowEnd: new Date('2026-01-01T16:00:00.000Z'),
          weight: 2,
          volume: 1,
        } as any,
      ],
      vehicle: { capacityWeightKg: 500, capacityVolumeM3: 100 } as any,
      driver: { certifications: ['forklift'] } as any,
    });

    expect(diagnostics.reasonCodes.some((code) => code.startsWith('CONCRETE_'))).toBe(false);
  });
});
