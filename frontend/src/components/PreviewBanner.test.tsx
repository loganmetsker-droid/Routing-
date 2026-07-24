import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewBanner } from './PreviewBanner';
import { getTrovanDataModeCopy } from '../services/dataMode';

describe('PreviewBanner', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('clearly labels preview data as non-persistent', () => {
    vi.stubEnv('VITE_MOCK_PREVIEW', 'true');

    const markup = renderToStaticMarkup(<PreviewBanner />);

    expect(markup).toContain('Preview data mode');
    expect(markup).toContain('Local preview state');
  });

  it('has unambiguous copy for live backend mode', () => {
    expect(getTrovanDataModeCopy('live')).toEqual({
      label: 'Live backend',
      detail: 'Using persisted API data.',
    });
  });
});
