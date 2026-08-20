import { describe, expect, it } from 'vitest';
import {
  buildDashboardEfficiencyMetrics,
  buildDashboardJobStatusMetrics,
  isDashboardStopComplete,
} from './dashboardMetrics';

describe('dashboard efficiency metrics', () => {
  it('derives savings from route miles and duration instead of returning placeholder copy', () => {
    const metrics = buildDashboardEfficiencyMetrics([
      { id: 'route-1', totalDistanceKm: 16.0934, totalDurationMinutes: 60 },
      { id: 'route-2', totalDistanceKm: 8.0467, totalDurationMinutes: 30 },
    ]);

    expect(metrics.cards).toEqual([
      expect.objectContaining({ label: 'Miles Saved', value: '3.8 mi' }),
      expect.objectContaining({ label: 'Fuel Savings', value: '$2.57' }),
      expect.objectContaining({ label: 'Labor Savings', value: '$10.80' }),
    ]);
    expect(metrics.roiLabel).toMatch(/%/);
    expect(metrics.cards.map((card) => card.value)).not.toContain('Not tracked');
    expect(metrics.cards.map((card) => card.note)).not.toContain('Backend metric pending');
  });

  it('returns an honest empty state when no route mileage exists', () => {
    const metrics = buildDashboardEfficiencyMetrics([]);

    expect(metrics.cards).toEqual([
      expect.objectContaining({ label: 'Miles Saved', value: '0.0 mi', note: 'No route miles yet' }),
      expect.objectContaining({ label: 'Fuel Savings', value: '$0.00', note: 'No route miles yet' }),
      expect.objectContaining({ label: 'Labor Savings', value: '$0.00', note: 'No route hours yet' }),
    ]);
    expect(metrics.roiLabel).toBe('0%');
  });
});

describe('dashboard operational status metrics', () => {
  it('keeps job-status segments mutually exclusive and equal to the job total', () => {
    const metrics = buildDashboardJobStatusMetrics([
      { status: 'pending' },
      { status: 'assigned' },
      { status: 'IN_PROGRESS' },
      { status: 'delivered' },
      { status: 'cancelled' },
    ]);

    expect(metrics).toEqual(
      expect.objectContaining({
        total: 5,
        completed: 1,
        inProgress: 1,
        pending: 2,
        failed: 1,
      }),
    );
    expect(metrics.completed + metrics.inProgress + metrics.pending + metrics.failed).toBe(metrics.total);
    expect(metrics.pendingEnd).toBe(80);
  });

  it('does not count a pending stop as complete merely because no proof is required', () => {
    expect(
      isDashboardStopComplete({
        status: 'PENDING',
        proofRequired: false,
        proofStatus: { proofRequired: false, requiredProofComplete: true },
      }),
    ).toBe(false);
    expect(isDashboardStopComplete({ status: 'SERVICED' })).toBe(true);
    expect(
      isDashboardStopComplete({
        status: 'PENDING',
        proofRequired: true,
        proofStatus: { proofRequired: true, requiredProofComplete: true },
      }),
    ).toBe(true);
  });
});
