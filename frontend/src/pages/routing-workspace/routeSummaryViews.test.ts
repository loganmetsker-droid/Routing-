import { describe, expect, it } from 'vitest';
import {
  builtInRouteSummaryViews,
  defaultRouteSummaryColumns,
  deleteRouteSummaryView,
  normalizeRouteSummaryColumns,
  normalizeRouteSummaryViewSnapshot,
  normalizeSavedRouteSummaryViews,
  routeSummarySnapshotsEqual,
  saveRouteSummaryView,
  type RouteSummaryViewSnapshot,
} from './routeSummaryViews';

const snapshot: RouteSummaryViewSnapshot = {
  columns: ['driver', 'stops', 'workload'],
  summaryFilter: 'attention',
  routeSearch: 'north',
  routeQuickFilter: 'needs-driver',
  driverFilterId: 'driver-1',
  vehicleFilterId: 'all',
  mapDisplayMode: 'exceptions',
};

describe('route summary views', () => {
  it('normalizes corrupt columns and snapshots to safe defaults', () => {
    expect(normalizeRouteSummaryColumns(['stops', 'stops', 'bogus'])).toEqual(['stops']);
    expect(normalizeRouteSummaryColumns([])).toEqual(defaultRouteSummaryColumns);
    expect(normalizeRouteSummaryViewSnapshot({
      columns: ['weight', 'bogus'],
      summaryFilter: 'invalid',
      routeQuickFilter: 'invalid',
      mapDisplayMode: 'invalid',
    })).toMatchObject({
      columns: ['weight'],
      summaryFilter: 'all',
      routeQuickFilter: 'all',
      mapDisplayMode: 'selected',
    });
  });

  it('creates, updates, renames, and deletes a named view', () => {
    const created = saveRouteSummaryView([], 'Morning desk', snapshot, {
      now: new Date('2026-08-04T12:00:00.000Z'),
    });
    expect(created.error).toBeNull();
    expect(created.saved?.name).toBe('Morning desk');
    expect(created.saved?.snapshot).toEqual(snapshot);

    const updated = saveRouteSummaryView(created.views, 'AM attention', {
      ...snapshot,
      columns: ['vehicle', 'volume'],
    }, {
      id: created.saved?.id,
      now: new Date('2026-08-04T12:05:00.000Z'),
    });
    expect(updated.views).toHaveLength(1);
    expect(updated.saved?.name).toBe('AM attention');
    expect(updated.saved?.createdAt).toBe('2026-08-04T12:00:00.000Z');
    expect(updated.saved?.updatedAt).toBe('2026-08-04T12:05:00.000Z');
    expect(deleteRouteSummaryView(updated.views, updated.saved?.id || '')).toEqual([]);
  });

  it('rejects duplicate names and caps valid saved views at twelve', () => {
    const created = saveRouteSummaryView([], 'Morning desk', snapshot);
    expect(saveRouteSummaryView(created.views, ' morning DESK ', snapshot).error)
      .toBe('A saved view already uses that name.');

    const candidates = Array.from({ length: 15 }, (_, index) => ({
      id: `view-${index}`,
      name: `View ${index}`,
      snapshot,
      createdAt: '2026-08-04T12:00:00.000Z',
      updatedAt: '2026-08-04T12:00:00.000Z',
    }));
    expect(normalizeSavedRouteSummaryViews(candidates)).toHaveLength(12);
  });

  it('drops malformed, duplicate, and unsafe stored entries', () => {
    const restored = normalizeSavedRouteSummaryViews([
      'not-a-view',
      {
        id: 'view-1',
        name: 'Dispatch desk',
        snapshot,
        createdAt: '2026-08-04T12:00:00.000Z',
        updatedAt: '2026-08-04T12:00:00.000Z',
      },
      {
        id: 'view-2',
        name: 'dispatch DESK',
        snapshot,
      },
      { id: '', name: 'Missing ID', snapshot },
    ]);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.name).toBe('Dispatch desk');
  });

  it('compares normalized snapshots and exposes truthful built-in views', () => {
    expect(routeSummarySnapshotsEqual(snapshot, { ...snapshot, columns: [...snapshot.columns] }))
      .toBe(true);
    expect(routeSummarySnapshotsEqual(snapshot, { ...snapshot, summaryFilter: 'ready' }))
      .toBe(false);
    expect(builtInRouteSummaryViews.map((view) => view.name)).toEqual([
      'Operations default',
      'Attention review',
      'Capacity watch',
    ]);
  });
});
