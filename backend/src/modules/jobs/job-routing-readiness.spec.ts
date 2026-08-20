import { evaluateJobRoutingReadiness } from '@shared/contracts';

describe('evaluateJobRoutingReadiness', () => {
  it('marks a fully constrained load as routable', () => {
    const readiness = evaluateJobRoutingReadiness({
      deliveryAddress: '1425 Market Ave, Denver, CO',
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
      },
    });

    expect(readiness).toMatchObject({
      status: 'routable',
      severity: 'ok',
      routable: true,
      reasonCodes: [],
    });
    expect(readiness.loadSummary?.palletCount).toBe(4);
    expect(readiness.loadSummary?.totalWeightKg).toBeCloseTo(1632.93, 1);
  });

  it('blocks routing when pallet dimensions are missing', () => {
    const readiness = evaluateJobRoutingReadiness({
      deliveryAddress: '2100 Santa Fe Dr, Denver, CO',
      timeWindowStart: '2026-06-08T14:00:00.000Z',
      timeWindowEnd: '2026-06-08T16:00:00.000Z',
      estimatedDuration: 30,
      routingRequirements: {
        load: {
          palletCount: 2,
          palletWeightLb: 500,
        },
      },
    });

    expect(readiness.status).toBe('missing_data');
    expect(readiness.routable).toBe(false);
    expect(readiness.reasonCodes).toContain('MISSING_PALLET_DIMENSIONS');
  });

  it('blocks oversized non-stackable loads for capacity review', () => {
    const readiness = evaluateJobRoutingReadiness({
      deliveryAddress: '3300 Pena Blvd, Denver, CO',
      timeWindowStart: '2026-06-08T14:00:00.000Z',
      timeWindowEnd: '2026-06-08T16:00:00.000Z',
      estimatedDuration: 60,
      routingRequirements: {
        load: {
          palletCount: 32,
          palletLengthIn: 48,
          palletWidthIn: 40,
          palletHeightIn: 60,
          palletWeightLb: 500,
          stackable: false,
        },
      },
    });

    expect(readiness.status).toBe('capacity_risk');
    expect(readiness.routable).toBe(false);
    expect(readiness.reasonCodes).toContain('LOAD_EXCEEDS_DEFAULT_TRAILER');
  });

  it('keeps access and sequence requirements routable with a review warning', () => {
    const readiness = evaluateJobRoutingReadiness({
      deliveryAddress: '1425 Market Ave, Denver, CO',
      timeWindowStart: '2026-06-08T14:00:00.000Z',
      timeWindowEnd: '2026-06-08T16:00:00.000Z',
      estimatedDuration: 30,
      routingRequirements: {
        load: {
          palletCount: 1,
          palletLengthIn: 48,
          palletWidthIn: 40,
          palletHeightIn: 48,
          palletWeightLb: 600,
          stackable: false,
        },
        sequence: { position: 'first', strict: true },
        site: {
          accessCode: '4827',
          accessCodeRequired: true,
          gateInstructions: 'Use the service-lane keypad.',
        },
      },
    });

    expect(readiness).toMatchObject({
      status: 'access_risk',
      severity: 'warning',
      routable: true,
    });
    expect(readiness.reasonCodes).toContain('ROUTING_CONSTRAINTS_PRESENT');
  });
});
