import { Outlet, useNavigate } from 'react-router-dom';
import AppShell from '../layout/AppShell';
import { clearAuthSession, logout } from '../services/api';
import ErrorBoundary from './ui/ErrorBoundary';

export function Layout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      clearAuthSession();
      navigate('/login');
      return;
    }
    navigate('/login');
  };

  return (
    <ErrorBoundary
      title="Shell Render Error"
      message="The Trovan shell failed to render one of its regions. Reload the interface and inspect the current build if the problem persists."
    >
      <AppShell onLogout={handleLogout}>
        <ErrorBoundary
          title="Page Render Error"
          message="This page failed to render. Reload to retry after the shell recovers."
        >
          <Outlet />
        </ErrorBoundary>
      </AppShell>
    </ErrorBoundary>
  );
}

export default Layout;
