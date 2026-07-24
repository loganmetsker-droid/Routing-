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
  TrovanPodIcon,
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
    label: 'Operations',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: TrovanDashboardIcon },
      { label: 'Dispatch', to: '/dispatch', icon: TrovanDispatchIcon },
      { label: 'Routing', to: '/routing', icon: TrovanRoutingIcon },
      { label: 'Jobs', to: '/jobs', icon: TrovanJobsIcon },
      { label: 'Customers', to: '/customers', icon: TrovanCustomersIcon },
      { label: 'Drivers', to: '/drivers', icon: TrovanDriversIcon },
      { label: 'Vehicles', to: '/vehicles', icon: TrovanVehiclesIcon },
      { label: 'Tracking', to: '/tracking', icon: TrovanTrackingIcon },
      { label: 'Proof of Delivery', to: '/pod', icon: TrovanPodIcon },
      { label: 'Exceptions', to: '/exceptions', icon: TrovanExceptionsIcon },
      { label: 'Reports', to: '/analytics', icon: TrovanAnalyticsIcon },
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
