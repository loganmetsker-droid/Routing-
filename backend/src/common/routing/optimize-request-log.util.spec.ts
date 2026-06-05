import { describe, expect, it } from 'vitest';
import { summarizeOptimizeRequestForLog } from './optimize-request-log.util';

describe('summarizeOptimizeRequestForLog', () => {
  it('does not include lat/lng fields from the optimizer payload', () => {
    const summary = summarizeOptimizeRequestForLog({
      plan_date: '2026-05-13T00:00:00.000Z',
      objective: 'balanced',
      vehicles: [{ id: 'vehicle-a' }],
      stops: [{ id: 'stop-a' }, { id: 'stop-b' }],
      // Intentionally include location-like fields to ensure they are ignored.
      // @ts-expect-error - extra fields for test coverage
      lat: 39.1,
      // @ts-expect-error - extra fields for test coverage
      lng: -94.5,
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).toContain('vehicle-a');
    expect(serialized).toContain('stop-a');
    expect(serialized).not.toContain('"lat"');
    expect(serialized).not.toContain('"lng"');
  });

  it('truncates overly long string fields to prevent log amplification', () => {
    const longId = 'x'.repeat(500);
    const summary = summarizeOptimizeRequestForLog({
      plan_date: '2026-05-13T00:00:00.000Z',
      objective: 'balanced',
      vehicles: [{ id: longId }],
      stops: [{ id: longId }],
    });

    expect(summary.vehicle_ids_sample[0]?.length).toBeLessThanOrEqual(128);
    expect(summary.stop_ids_sample[0]?.length).toBeLessThanOrEqual(128);
    expect(summary.truncated).toBe(true);
  });

  it('omits non-primitive objective values from the summary', () => {
    const summary = summarizeOptimizeRequestForLog({
      plan_date: '2026-05-13T00:00:00.000Z',
      // @ts-expect-error - objective should be a string; objects should not be logged
      objective: { kind: 'balanced', debug: 'do-not-log' },
      vehicles: [{ id: 'vehicle-a' }],
      stops: [{ id: 'stop-a' }],
    });

    expect(summary.objective).toBe(null);
  });

  it('marks truncated when id lists exceed the sample cap', () => {
    const stops = Array.from({ length: 30 }, (_, idx) => ({ id: `stop-${idx}` }));
    const summary = summarizeOptimizeRequestForLog({
      plan_date: '2026-05-13T00:00:00.000Z',
      objective: 'balanced',
      vehicles: [{ id: 'vehicle-a' }],
      stops,
    });

    expect(summary.stop_count).toBe(30);
    expect(summary.stop_ids_sample.length).toBe(25);
    expect(summary.truncated).toBe(true);
  });
});
