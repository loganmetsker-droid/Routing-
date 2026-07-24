import { describe, expect, it } from 'vitest';
import { sanitizeJob } from './jobsApi';

describe('sanitizeJob', () => {
  it('preserves routing constraints and computes readiness when backend omits it', () => {
    const job = sanitizeJob({
      id: 'job-1',
      customerName: 'Jane & Sons Bakery',
      deliveryAddress: '1425 Market Ave, Denver, CO 80202',
      timeWindowStart: '2026-06-08T14:00:00.000Z',
      timeWindowEnd: '2026-06-08T16:00:00.000Z',
      estimatedDuration: 45,
      routingRequirements: {
        load: {
          palletCount: 4,
          palletLengthIn: 48,
          palletWidthIn: 40,
          palletHeightIn: 54,
          palletWeightLb: 900,
          stackable: false,
        },
        requiredEquipment: ['liftgate'],
      },
      priority: 'high',
      status: 'pending',
    });

    expect(job.routingRequirements?.load?.palletCount).toBe(4);
    expect(job.routingReadiness?.status).toBe('access_risk');
    expect(job.routingReadiness?.routable).toBe(true);
    expect(job.routingReadiness?.reasonCodes).toContain('ROUTING_CONSTRAINTS_PRESENT');
  });

  it('keeps backend readiness as source of truth when supplied', () => {
    const job = sanitizeJob({
      id: 'job-2',
      customerName: 'Omega Medical',
      deliveryAddress: '2100 Santa Fe Dr, Denver, CO 80204',
      routingReadiness: {
        status: 'missing_data',
        severity: 'blocked',
        routable: false,
        reasonCodes: ['MISSING_PALLET_DIMENSIONS'],
        summary: 'Missing routing-critical job data',
      },
      priority: 'urgent',
      status: 'pending',
    });

    expect(job.routingReadiness?.status).toBe('missing_data');
    expect(job.routingReadiness?.reasonCodes).toEqual(['MISSING_PALLET_DIMENSIONS']);
  });
});
