import { describe, expect, it } from 'vitest';
import { workspaceRuntimeStatus } from './runtimeReadiness';

describe('workspace runtime status', () => {
  it('never presents preview data as a live workspace', () => {
    expect(workspaceRuntimeStatus('preview')).toEqual({
      state: 'preview',
      label: 'Preview workspace',
      detail: 'Local synthetic data',
    });
  });

  it('surfaces failed critical dependencies', () => {
    expect(workspaceRuntimeStatus('live', {
      status: 'error',
      missingCritical: ['database', 'routingService'],
      launchWarnings: [],
      checkedAt: '2026-08-06T00:00:00.000Z',
    })).toMatchObject({
      state: 'degraded',
      label: 'Service degraded',
      detail: '2 critical dependencies unavailable',
    });
  });
});
