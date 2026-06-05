import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material';
import {
  TrovanAnalyticsIcon,
  TrovanCustomersIcon,
  TrovanDashboardIcon,
  TrovanDispatchIcon,
  TrovanDriversIcon,
  TrovanExceptionsIcon,
  TrovanJobsIcon,
  TrovanRoutingIcon,
  TrovanSettingsIcon,
  TrovanTrackingIcon,
  TrovanVehiclesIcon,
} from '../components/nav/TrovanNavIcons';

export type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<SvgIconProps>;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: TrovanDashboardIcon },
    ],
  },
  {
    label: 'Planning',
    items: [
      { label: 'Jobs', to: '/jobs', icon: TrovanJobsIcon },
      { label: 'Routing', to: '/routing', icon: TrovanRoutingIcon },
    ],
  },
  {
    label: 'Live Dispatch',
    items: [
      { label: 'Dispatch', to: '/dispatch', icon: TrovanDispatchIcon },
      { label: 'Exceptions', to: '/exceptions', icon: TrovanExceptionsIcon },
      { label: 'Tracking', to: '/tracking', icon: TrovanTrackingIcon },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { label: 'Drivers', to: '/drivers', icon: TrovanDriversIcon },
      { label: 'Vehicles', to: '/vehicles', icon: TrovanVehiclesIcon },
    ],
  },
  {
    label: 'Customers',
    items: [
      { label: 'Customers', to: '/customers', icon: TrovanCustomersIcon },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Analytics', to: '/analytics', icon: TrovanAnalyticsIcon },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Settings', to: '/settings', icon: TrovanSettingsIcon },
    ],
  },
];

export function getActiveNavItem(pathname: string) {
  for (const section of navSections) {
    for (const item of section.items) {
      if (pathname === item.to || pathname.startsWith(item.to + '/')) {
        return item;
      }
    }
  }
  return navSections[0].items[0];
}
