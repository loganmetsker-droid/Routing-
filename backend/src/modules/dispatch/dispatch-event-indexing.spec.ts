import { deriveDispatchEventIndexFields } from './dispatch-event-indexing';

describe('dispatch event indexing', () => {
  it('prefers explicit index fields', () => {
    const fields = deriveDispatchEventIndexFields({
      reasonCode: 'TIME_WINDOW_VIOLATION',
      action: 'split_route',
      actor: 'dispatcher-ui',
      packId: 'construction_concrete',
      payload: {
        reasonCodes: ['CAPACITY_WEIGHT_EXCEEDED'],
        action: 'reorder_stops',
      },
    });
    expect(fields.reasonCode).toBe('TIME_WINDOW_VIOLATION');
    expect(fields.action).toBe('split_route');
    expect(fields.actor).toBe('dispatcher-ui');
    expect(fields.packId).toBe('construction_concrete');
  });

  it('falls back to payload-derived fields', () => {
    const fields = deriveDispatchEventIndexFields({
      payload: {
        reasonCodes: ['CONCRETE_SITE_NOT_READY'],
        action: 'reassign_stop_to_route',
        overrideActor: 'admin-1',
        selectedPackId: 'construction_concrete',
      },
    });
    expect(fields.reasonCode).toBe('CONCRETE_SITE_NOT_READY');
    expect(fields.action).toBe('reassign_stop_to_route');
    expect(fields.actor).toBe('admin-1');
    expect(fields.packId).toBe('construction_concrete');
  });
});

