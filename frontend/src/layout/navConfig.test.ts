import { describe, expect, it } from 'vitest';
import { getActiveNavItem, navSections, normalizeAppNavigationPath } from './navConfig';

describe('Trovan prototype navigation contract', () => {
  it('uses the prototype operator module order', () => {
    const labels = navSections.flatMap((section) => section.items.map((item) => item.label));

    expect(labels).toEqual([
      'Dashboard',
      'Dispatch',
      'Routing',
      'Jobs',
      'Customers',
      'Drivers',
      'Vehicles',
      'Tracking',
      'Proof of Delivery',
      'Exceptions',
      'Reports',
      'Settings',
    ]);
  });

  it('keeps routing, reports, fleet, POD, and exceptions addressable from the shell', () => {
    expect(getActiveNavItem('/routing').label).toBe('Routing');
    expect(getActiveNavItem('/analytics').label).toBe('Reports');
    expect(getActiveNavItem('/vehicles').label).toBe('Vehicles');
    expect(getActiveNavItem('/pod').label).toBe('Proof of Delivery');
    expect(getActiveNavItem('/exceptions').label).toBe('Exceptions');
  });

  it('keeps legacy aliases and route-run details anchored to their canonical modules', () => {
    expect(normalizeAppNavigationPath('/messages')).toBe('/dispatch');
    expect(normalizeAppNavigationPath('/routes')).toBe('/routing');
    expect(normalizeAppNavigationPath('/planning')).toBe('/routing');
    expect(normalizeAppNavigationPath('/loads')).toBe('/jobs');
    expect(normalizeAppNavigationPath('/assets')).toBe('/vehicles');
    expect(normalizeAppNavigationPath('/depots')).toBe('/tracking');
    expect(normalizeAppNavigationPath('/billing')).toBe('/settings');
    expect(normalizeAppNavigationPath('/integrations')).toBe('/settings');
    expect(normalizeAppNavigationPath('/route-runs/route-alpha-001')).toBe('/dispatch');

    expect(getActiveNavItem('/messages').label).toBe('Dispatch');
    expect(getActiveNavItem('/routes').label).toBe('Routing');
    expect(getActiveNavItem('/route-runs/route-alpha-001').label).toBe('Dispatch');
  });
});
