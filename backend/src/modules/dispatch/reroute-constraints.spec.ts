import { BillingStatus, JobPriority, JobStatus } from '../jobs/entities/job.entity';
import { RouteStatus } from './entities/route.entity';
import {
  buildRerouteAlternatives,
  evaluateRerouteConstraints,
} from './reroute-constraints';

describe('reroute constraints', () => {
  const baseRoute = {
    id: 'route-1',
    status: RouteStatus.ASSIGNED,
    routeData: {},
  };

  const mkJob = (id: string, overrides: Record<string, any> = {}) => ({
    id,
    customerName: `Customer ${id}`,
    customerPhone: '+1-555-0100',
    customerEmail: `customer-${id}@example.com`,
    pickupAddress: '100 Pickup St, Denver, CO',
    deliveryAddress: '200 Delivery Ave, Denver, CO',
    pickupAddressStructured: null,
    deliveryAddressStructured: null,
    pickupLocation: null,
    deliveryLocation: null,
    timeWindow: { start: '2026-01-01T08:00:00.000Z', end: '2026-01-01T12:00:00.000Z' },
    timeWindowStart: new Date('2026-01-01T08:00:00.000Z'),
    timeWindowEnd: new Date('2026-01-01T12:00:00.000Z'),
    priority: JobPriority.NORMAL,
    status: JobStatus.SCHEDULED,
    billingStatus: BillingStatus.UNPAID,
    assignedRouteId: null,
    assignedVehicleId: null,
    stopSequence: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  it('detects capacity violations with reason codes', () => {
    const result = evaluateRerouteConstraints({
      route: baseRoute as any,
      action: 'reorder_stops',
      payload: {},
      beforeSnapshot: { jobIds: ['j1', 'j2'] },
      afterSnapshot: { jobIds: ['j1', 'j2'], dataQuality: 'live' },
      jobs: [
        mkJob('j1', { weight: 10, volume: 2 }),
        mkJob('j2', { weight: 10, volume: 2 }),
      ],
      vehicle: { capacityWeightKg: 15, capacityVolumeM3: 3 } as any,
      driver: null,
    });

    expect(result.feasible).toBe(false);
    expect(result.reasonCodes).toContain('CAPACITY_WEIGHT_EXCEEDED');
    expect(result.reasonCodes).toContain('CAPACITY_VOLUME_EXCEEDED');
    expect(result.capacityConflicts.length).toBeGreaterThan(0);
    expect(result.feasibilityScore).toBeLessThan(100);
  });

  it('detects time-window violations', () => {
    const result = evaluateRerouteConstraints({
      route: baseRoute as any,
      action: 'reorder_stops',
      payload: { plannedStart: '2026-01-01T13:00:00.000Z', travelBufferMinutes: 20 },
      beforeSnapshot: { jobIds: ['j1'] },
      afterSnapshot: { jobIds: ['j1'], dataQuality: 'degraded' },
      jobs: [mkJob('j1')],
      vehicle: { capacityWeightKg: 1000, capacityVolumeM3: 100 } as any,
      driver: null,
    });

    expect(result.feasible).toBe(false);
    expect(result.reasonCodes).toContain('TIME_WINDOW_VIOLATION');
    expect(result.timeWindowViolations.length).toBe(1);
  });

  it('detects skill mismatch', () => {
    const result = evaluateRerouteConstraints({
      route: baseRoute as any,
      action: 'reorder_stops',
      payload: { requiredSkillsByJob: { j1: ['hazmat'] } },
      beforeSnapshot: { jobIds: ['j1'] },
      afterSnapshot: { jobIds: ['j1'], dataQuality: 'live' },
      jobs: [mkJob('j1')],
      vehicle: { capacityWeightKg: 1000, capacityVolumeM3: 100 } as any,
      driver: { certifications: ['forklift'] } as any,
    });

    expect(result.feasible).toBe(false);
    expect(result.reasonCodes).toContain('SKILL_MISMATCH');
    expect(result.skillMismatches.length).toBe(1);
  });

  it('builds deterministic alternatives', () => {
    const diagnostics = evaluateRerouteConstraints({
      route: baseRoute as any,
      action: 'split_route',
      payload: {},
      beforeSnapshot: { jobIds: ['j1', 'j2'] },
      afterSnapshot: { jobIds: ['j1', 'j2'], dataQuality: 'live' },
      jobs: [mkJob('j1'), mkJob('j2')],
      vehicle: { capacityWeightKg: 15, capacityVolumeM3: 100 } as any,
      driver: null,
    });
    const alternatives = buildRerouteAlternatives('split_route', diagnostics, {
      distanceDeltaKm: 3,
      durationDeltaMinutes: 9,
      droppedJobs: [],
    });

    expect(alternatives.length).toBeGreaterThanOrEqual(3);
    expect(alternatives.some((alt) => alt.label === 'keep_current_route')).toBe(true);
    expect(alternatives.some((alt) => alt.label === 'split_route')).toBe(true);
    expect(alternatives[0].rank).toBe(1);
    expect(alternatives[0].score).toBeGreaterThanOrEqual(alternatives[1].score);
  });

  it('preserves degraded/simulated signal in diagnostics output', () => {
    const diagnostics = evaluateRerouteConstraints({
      route: baseRoute as any,
      action: 'reorder_stops',
      payload: {},
      beforeSnapshot: { jobIds: ['j1'] },
      afterSnapshot: { jobIds: ['j1'], dataQuality: 'simulated' },
      jobs: [mkJob('j1')],
      vehicle: { capacityWeightKg: 1000, capacityVolumeM3: 100 } as any,
      driver: null,
    });
    expect(diagnostics.warnings.some((w) => w.includes('simulated'))).toBe(true);
    expect(typeof diagnostics.feasibilityScore).toBe('number');
  });
});
