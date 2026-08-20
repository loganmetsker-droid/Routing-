import { describe, expect, it } from 'vitest';
import { estimateJobLoad, evaluateVehicleLoadFit } from '@shared/contracts';

const vehicle = {
  id: 'vehicle-1',
  capacityWeightKg: 5_000,
  capacityVolumeM3: 30,
  routingProfile: {
    cargo: {
      interiorLengthIn: 240,
      interiorWidthIn: 96,
      interiorHeightIn: 96,
      doorHeightIn: 90,
      maxPalletPositions: 10,
      maxStackLevels: 2,
    },
    features: ['liftgate', 'pallet jack'],
    blockedDriverIds: ['driver-blocked'],
  },
};

describe('fleet constraint load-fit evaluation', () => {
  it('estimates stacked pallet floor positions and capacity utilization', () => {
    const result = evaluateVehicleLoadFit({
      vehicle,
      driver: { id: 'driver-1', certifications: ['food-safe'] },
      jobs: [
        {
          id: 'job-1',
          routingRequirements: {
            load: {
              palletGroups: [
                {
                  label: 'Cases',
                  quantity: 8,
                  lengthIn: 48,
                  widthIn: 40,
                  heightIn: 40,
                  weightLb: 500,
                  stackable: true,
                  maxStackLevels: 2,
                },
              ],
            },
            requiredEquipment: ['liftgate'],
            driver: { requiredCertifications: ['food-safe'] },
          },
        },
      ],
    });

    expect(result.fits).toBe(true);
    expect(result.totals).toMatchObject({ palletCount: 8, floorPositionsNeeded: 4 });
    expect(result.utilization.palletPositionPercent).toBe(40);
  });

  it('blocks overweight, fragile floor-space, missing equipment, and driver exclusions', () => {
    const result = evaluateVehicleLoadFit({
      vehicle,
      driver: { id: 'driver-blocked', certifications: [] },
      jobs: [
        {
          id: 'job-glass',
          routingRequirements: {
            load: {
              palletGroups: [
                {
                  label: 'Glass',
                  quantity: 12,
                  lengthIn: 48,
                  widthIn: 40,
                  heightIn: 84,
                  weightLb: 1_100,
                  stackable: true,
                  fragile: true,
                },
              ],
            },
            requiredEquipment: ['refrigerated'],
            driver: { requiredCertifications: ['glass-handling'] },
          },
        },
      ],
    });

    expect(result.fits).toBe(false);
    expect(result.blockers.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'DRIVER_BLOCKED_FROM_VEHICLE',
        'DRIVER_CERTIFICATION_MISSING',
        'VEHICLE_FEATURE_MISSING',
        'CAPACITY_WEIGHT_EXCEEDED',
        'PALLET_POSITIONS_EXCEEDED',
      ]),
    );
    expect(
      result.blockers.find((issue) => issue.code === 'CAPACITY_WEIGHT_EXCEEDED')?.message,
    ).toMatch(/lb.*vehicle limit.*lb/i);
  });

  it('honors explicit vehicle and driver deny lists', () => {
    const result = evaluateVehicleLoadFit({
      vehicle,
      driver: { id: 'driver-1', certifications: [] },
      jobs: [
        {
          id: 'job-restricted',
          routingRequirements: {
            requiredDriverId: 'driver-required',
            vehicle: { prohibitedVehicleIds: ['vehicle-1'] },
            driver: { prohibitedDriverIds: ['driver-1'] },
          },
        },
      ],
    });

    expect(result.blockers.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['VEHICLE_PROHIBITED', 'DRIVER_PROHIBITED', 'DRIVER_REQUIRED']),
    );
  });

  it('derives one authoritative load demand from multiple pallet groups', () => {
    const estimate = estimateJobLoad({
      routingRequirements: {
        load: {
          palletGroups: [
            {
              quantity: 2,
              lengthIn: 48,
              widthIn: 40,
              heightIn: 48,
              weightLb: 500,
            },
            {
              quantity: 3,
              lengthIn: 36,
              widthIn: 36,
              heightIn: 30,
              weightLb: 200,
              fragile: true,
            },
          ],
        },
      },
    });

    expect(estimate.palletCount).toBe(5);
    expect(estimate.totalWeightKg).toBeCloseTo(725.75, 1);
    expect(estimate.totalVolumeM3).toBeCloseTo(4.93, 1);
    expect(estimate.stackable).toBe(false);
  });

  it('blocks a pallet footprint that cannot enter the configured cargo floor', () => {
    const result = evaluateVehicleLoadFit({
      vehicle,
      driver: { id: 'driver-1' },
      jobs: [{
        id: 'oversize-job',
        routingRequirements: {
          load: {
            palletGroups: [{
              quantity: 1,
              lengthIn: 250,
              widthIn: 100,
              heightIn: 40,
              weightLb: 500,
              rotationAllowed: false,
            }],
          },
        },
      }],
    });

    expect(result.fits).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PALLET_FOOTPRINT_TOO_LARGE' }),
      ]),
    );
  });
});
