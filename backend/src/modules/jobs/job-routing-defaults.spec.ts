import { evaluateJobRoutingReadiness } from '@shared/contracts';
import { buildDefaultJobRoutingRequirements } from './job-routing-defaults';
import { JobPriority } from './entities/job.entity';

describe('buildDefaultJobRoutingRequirements', () => {
  it('fills missing routing-critical load fields without replacing existing values', () => {
    const routingRequirements = buildDefaultJobRoutingRequirements({
      customerName: 'Boulder Cold Chain',
      priority: JobPriority.URGENT,
      weight: 500,
      routingRequirements: {
        load: {
          palletCount: 2,
          palletLengthIn: 42,
        },
      },
    });

    expect(routingRequirements.load).toMatchObject({
      palletCount: 2,
      palletLengthIn: 42,
      palletWidthIn: 40,
      palletHeightIn: expect.any(Number),
      palletWeightLb: expect.any(Number),
      totalWeightKg: 500,
    });

    const readiness = evaluateJobRoutingReadiness({
      deliveryAddress: '1685 29th St, Boulder, CO',
      timeWindowStart: '2026-06-13T14:00:00.000Z',
      timeWindowEnd: '2026-06-13T16:00:00.000Z',
      estimatedDuration: 30,
      routingRequirements,
    });

    expect(readiness.reasonCodes).not.toContain('MISSING_PALLET_COUNT');
    expect(readiness.reasonCodes).not.toContain('MISSING_PALLET_DIMENSIONS');
    expect(readiness.reasonCodes).not.toContain('MISSING_LOAD_WEIGHT');
  });
});
