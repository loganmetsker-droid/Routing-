import { describe, expect, it } from 'vitest';
import { shouldShowShellOperatingDate } from './AppShell';

describe('AppShell operating date ownership', () => {
  it('leaves the date to dispatch routes that already render a workflow date', () => {
    expect(shouldShowShellOperatingDate('/dispatch')).toBe(false);
    expect(shouldShowShellOperatingDate('/dispatch/route-alpha')).toBe(false);
    expect(shouldShowShellOperatingDate('/messages')).toBe(false);
  });

  it('keeps the shell date on routes without a page-owned operating date', () => {
    expect(shouldShowShellOperatingDate('/dashboard')).toBe(true);
    expect(shouldShowShellOperatingDate('/routing')).toBe(true);
    expect(shouldShowShellOperatingDate('/settings')).toBe(true);
  });
});
