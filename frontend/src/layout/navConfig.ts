export type NavItem = {
  label: string;
  to: string;
  monogram: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard', to: '/', monogram: 'DB' },
      { label: 'Jobs', to: '/jobs', monogram: 'JB' },
      { label: 'Routing', to: '/routing', monogram: 'RT' },
      { label: 'Dispatch', to: '/dispatch', monogram: 'DP' },
      { label: 'Exceptions', to: '/exceptions', monogram: 'EX' },
      { label: 'Tracking', to: '/tracking', monogram: 'TR' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Drivers', to: '/drivers', monogram: 'DR' },
      { label: 'Vehicles', to: '/vehicles', monogram: 'VH' },
      { label: 'Customers', to: '/customers', monogram: 'CU' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Analytics', to: '/analytics', monogram: 'AN' },
      { label: 'Settings', to: '/settings', monogram: 'ST' },
    ],
  },
];

export function getActiveNavItem(pathname: string) {
  for (const section of navSections) {
    for (const item of section.items) {
      if (item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/')) {
        return item;
      }
    }
  }
  return navSections[0].items[0];
}
