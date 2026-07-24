import { describe, expect, it } from 'vitest';
import { estimateTrailerLoadFit } from './routingConstraints';

describe('estimateTrailerLoadFit', () => {
  it('treats non-stackable pallets as one trailer floor position each', () => {
    const estimate = estimateTrailerLoadFit({
      quantity: 26,
      palletLengthIn: 48,
      palletWidthIn: 40,
      palletHeightIn: 54,
      palletWeightLb: 1200,
      stackable: false,
      maxStackLevels: 1,
      trailerLengthFt: 53,
      trailerWidthIn: 102,
      trailerHeightIn: 110,
      trailerWeightCapacityLb: 45000,
    });

    expect(estimate.stackLevelsUsed).toBe(1);
    expect(estimate.floorPositionsRequired).toBe(26);
    expect(estimate.floorSpacePercent).toBeGreaterThan(80);
    expect(estimate.weightPercent).toBeLessThan(75);
    expect(estimate.fits).toBe(true);
  });

  it('uses safe vertical stack levels when freight is stackable', () => {
    const estimate = estimateTrailerLoadFit({
      quantity: 40,
      palletLengthIn: 48,
      palletWidthIn: 40,
      palletHeightIn: 42,
      palletWeightLb: 600,
      stackable: true,
      maxStackLevels: 2,
      trailerLengthFt: 26,
      trailerWidthIn: 96,
      trailerHeightIn: 96,
      trailerWeightCapacityLb: 10000,
    });

    expect(estimate.stackLevelsUsed).toBe(2);
    expect(estimate.floorPositionsRequired).toBe(20);
    expect(estimate.fits).toBe(false);
    expect(estimate.limitReasons).toContain('weight');
    expect(estimate.limitReasons).toContain('floor');
  });
});
