import type { SvgIconComponent } from '@mui/icons-material';
import {
  DashboardOutlined,
  Inventory2Outlined,
  AltRouteOutlined,
  LocalShippingOutlined,
  WarningAmberOutlined,
  MapOutlined,
  BadgeOutlined,
  AirportShuttleOutlined,
  BusinessOutlined,
  InsightsOutlined,
  SettingsOutlined,
} from '@mui/icons-material';

export type NavItem = {
  label: string;
  to: string;
  icon: SvgIconComponent;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: DashboardOutlined },
    ],
  },
  {
    label: 'Planning',
    items: [
      { label: 'Jobs', to: '/jobs', icon: Inventory2Outlined },
      { label: 'Routing', to: '/routing', icon: AltRouteOutlined },
    ],
  },
  {
    label: 'Live Dispatch',
    items: [
      { label: 'Dispatch', to: '/dispatch', icon: LocalShippingOutlined },
      { label: 'Exceptions', to: '/exceptions', icon: WarningAmberOutlined },
      { label: 'Tracking', to: '/tracking', icon: MapOutlined },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { label: 'Drivers', to: '/drivers', icon: BadgeOutlined },
      { label: 'Vehicles', to: '/vehicles', icon: AirportShuttleOutlined },
    ],
  },
  {
    label: 'Customers',
    items: [
      { label: 'Customers', to: '/customers', icon: BusinessOutlined },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Analytics', to: '/analytics', icon: InsightsOutlined },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Settings', to: '/settings', icon: SettingsOutlined },
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
