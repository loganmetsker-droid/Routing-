import type { ReactNode } from 'react';
import { useNavigate } from '../router';
import AppShell from '../layout/AppShell';
import { clearAuthSession, logout } from '../services/api';
import ErrorBoundary from './ui/ErrorBoundary';

export function Layout({ children }: { children: ReactNode }) {
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
          {children}
        </ErrorBoundary>
      </AppShell>
    </ErrorBoundary>
  );
}

export default Layout;
