import { RuntimeStatusService } from './runtime-status.service';

describe('RuntimeStatusService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports the immutable Render commit in the public runtime summary', () => {
    const releaseSha = 'b'.repeat(40);
    vi.stubEnv('RENDER_GIT_COMMIT', releaseSha);

    const summary = new RuntimeStatusService().getSummary();

    expect(summary.releaseSha).toBe(releaseSha);
  });
});
