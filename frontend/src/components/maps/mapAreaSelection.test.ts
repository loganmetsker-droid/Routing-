import { describe, expect, it } from 'vitest';
import { isPointInsidePolygon } from './mapAreaSelection';

const serviceArea = [
  { lat: 41, lng: -88 },
  { lat: 41, lng: -87 },
  { lat: 42, lng: -87 },
  { lat: 42, lng: -88 },
];

describe('isPointInsidePolygon', () => {
  it('selects points inside a drawn service area', () => {
    expect(isPointInsidePolygon({ lat: 41.5, lng: -87.5 }, serviceArea)).toBe(true);
  });

  it('excludes points outside a drawn service area', () => {
    expect(isPointInsidePolygon({ lat: 42.5, lng: -87.5 }, serviceArea)).toBe(false);
  });

  it('does not select from an unfinished area', () => {
    expect(isPointInsidePolygon({ lat: 41.5, lng: -87.5 }, serviceArea.slice(0, 2))).toBe(false);
  });
});
