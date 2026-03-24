import { normalizeTimelineFilters } from './timeline-query';

describe('timeline query normalization', () => {
  it('normalizes and trims structured filters', () => {
    const normalized = normalizeTimelineFilters({
      reasonCode: ' TIME_WINDOW_VIOLATION ',
      action: ' split_route ',
      actor: ' dispatcher-ui ',
      source: 'reroute',
      before: ' 2026-03-20T10:00:00.000Z ',
      packId: ' construction_concrete ',
    });
    expect(normalized.reasonCode).toBe('TIME_WINDOW_VIOLATION');
    expect(normalized.action).toBe('split_route');
    expect(normalized.actor).toBe('dispatcher-ui');
    expect(normalized.source).toBe('reroute');
    expect(normalized.before).toBe('2026-03-20T10:00:00.000Z');
    expect(normalized.packId).toBe('construction_concrete');
  });
});

