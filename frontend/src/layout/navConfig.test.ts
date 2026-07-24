import { describe, expect, it } from 'vitest';
import { getActiveNavItem, navSections } from './navConfig';

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
});
