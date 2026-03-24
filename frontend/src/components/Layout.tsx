import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Dashboard as DashboardIcon,
  DriveEta as VehiclesIcon,
  Person as DriversIcon,
  People as CustomersIcon,
  LocalShipping as DispatchIcon,
  Work as JobsIcon,
  GpsFixed as TrackingIcon,
} from '@mui/icons-material';
import AppShell, { type ShellNavItem } from './shell/AppShell';
import { useThemeMode } from '../contexts/ThemeContext';
import { clearAuthSession } from '../services/api';

const menuItems: ShellNavItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Jobs', icon: <JobsIcon />, path: '/jobs' },
  { text: 'Dispatch', icon: <DispatchIcon />, path: '/dispatch' },
  { text: 'Tracking', icon: <TrackingIcon />, path: '/tracking' },
  { text: 'Drivers', icon: <DriversIcon />, path: '/drivers' },
  { text: 'Vehicles', icon: <VehiclesIcon />, path: '/vehicles' },
  { text: 'Customers', icon: <CustomersIcon />, path: '/customers' },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme } = useThemeMode();

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  return (
    <AppShell
      items={menuItems}
      currentPath={location.pathname}
      mode={mode}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
    >
      <Outlet />
    </AppShell>
  );
}

export default Layout;
