export type TimelineFiltersInput = {
  reasonCode?: string;
  action?: string;
  actor?: string;
  source?: 'optimizer' | 'reroute' | 'workflow' | 'system';
  before?: string;
  packId?: string;
};

export const normalizeTimelineFilters = (filters: TimelineFiltersInput) => {
  const trim = (value?: string) => (typeof value === 'string' ? value.trim() : undefined);
  return {
    reasonCode: trim(filters.reasonCode),
    action: trim(filters.action),
    actor: trim(filters.actor),
    source: filters.source,
    before: trim(filters.before),
    packId: trim(filters.packId),
  };
};

