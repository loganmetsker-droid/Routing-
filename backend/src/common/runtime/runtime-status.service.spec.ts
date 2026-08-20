import { RuntimeStatusService } from './runtime-status.service';

describe('RuntimeStatusService', () => {
  const originalRenderSha = process.env.RENDER_GIT_COMMIT;
  const originalGitSha = process.env.GIT_SHA;

  afterEach(() => {
    if (originalRenderSha === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = originalRenderSha;
    if (originalGitSha === undefined) delete process.env.GIT_SHA;
    else process.env.GIT_SHA = originalGitSha;
  });

  it('exposes the immutable hosting release SHA without exposing secrets', () => {
    process.env.RENDER_GIT_COMMIT = 'a'.repeat(40);
    process.env.GIT_SHA = 'b'.repeat(40);

    expect(new RuntimeStatusService().getSummary().release).toEqual({
      sha: 'a'.repeat(40),
    });
  });

  it('falls back to the build SHA when Render metadata is unavailable', () => {
    delete process.env.RENDER_GIT_COMMIT;
    process.env.GIT_SHA = 'c'.repeat(40);

    expect(new RuntimeStatusService().getSummary().release).toEqual({
      sha: 'c'.repeat(40),
    });
  });
});
