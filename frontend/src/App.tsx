import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';
import Layout from './components/Layout';
import { Navigate, RouteParamsProvider, matchPath, useLocation } from './router';
import {
  clearAuthSession,
  getSession,
  isDriverOnlyAuthUser,
  isAuthBypassed,
  isAuthenticated,
  validateSessionState,
} from './services/api';
import ErrorBoundary from './components/ui/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const DriversPage = lazy(() => import('./pages/DriversPage'));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const JobsPageEnhancedV2 = lazy(() => import('./pages/JobsPageEnhancedV2'));
const TrackingEnhanced = lazy(() => import('./pages/TrackingEnhanced'));
const DispatchBoardOpsPage = lazy(() => import('./pages/DispatchBoardOpsPage'));
const RoutingWorkspacePage = lazy(() => import('./pages/RoutingWorkspacePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ProofOfDeliveryPage = lazy(() => import('./pages/ProofOfDeliveryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const RouteRunDetailPage = lazy(() => import('./pages/RouteRunDetailPage'));
const ExceptionsQueuePage = lazy(() => import('./pages/ExceptionsQueuePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const DriverWorkspacePage = lazy(() => import('./pages/DriverWorkspacePage'));
const DriverRouteRunPage = lazy(() => import('./pages/DriverRouteRunPage'));
const PublicTrackingPage = lazy(() => import('./pages/PublicTrackingPage'));
const PublicLaunchPage = lazy(() => import('./pages/PublicLaunchPage'));
const AcademyPage = lazy(() => import('./pages/AcademyPage'));
const DriverHelpPage = lazy(() => import('./pages/DriverHelpPage'));

function AuthGate({
  children,
  redirectDriverOnly = false,
}: {
  children: React.ReactNode;
  redirectDriverOnly?: boolean;
}) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setRedirectTo(null);
      if (!isAuthenticated()) {
        if (!cancelled) {
          setValid(false);
          setChecking(false);
        }
        return;
      }

      const sessionState = await validateSessionState();
      if (sessionState.status === 'valid' && redirectDriverOnly) {
        const session = await getSession().catch(() => null);
        if (!cancelled && isDriverOnlyAuthUser(session?.user)) {
          setRedirectTo('/driver');
          setValid(true);
          setChecking(false);
          return;
        }
      }
      if (!cancelled) {
        setValid(sessionState.status !== 'invalid');
        setChecking(false);
      }
    };
    setChecking(true);
    void check();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (checking) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!valid) {
    clearAuthSession();
    return <Navigate to="/login" replace />;
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate redirectDriverOnly>
      <ErrorBoundary
        title="Workspace Failed To Render"
        message="The operator shell hit a rendering problem. Reload to recover and check the desktop or browser logs if this repeats."
      >
        <Layout>{children}</Layout>
      </ErrorBoundary>
    </AuthGate>
  );
}

function LoginRoute() {
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [checking, setChecking] = useState(() => !isAuthBypassed() && isAuthenticated());

  useEffect(() => {
    let cancelled = false;
    const resolveRedirect = async () => {
      if (isAuthBypassed() || !isAuthenticated()) {
        if (!cancelled) {
          setChecking(false);
          setRedirectTo(null);
        }
        return;
      }
      const session = await getSession().catch(() => null);
      if (!cancelled) {
        setRedirectTo(isDriverOnlyAuthUser(session?.user) ? '/driver' : '/dashboard');
        setChecking(false);
      }
    };
    void resolveRedirect();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthBypassed()) {
    return <LoginPage />;
  }
  if (checking) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }
  return <LoginPage />;
}

function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <ErrorBoundary
        title="Driver Workspace Failed To Render"
        message="The driver workspace hit a rendering problem. Reload to recover and inspect the current runtime if it repeats."
      >
        {children}
      </ErrorBoundary>
    </AuthGate>
  );
}

const publicSitePaths = new Set([
  '/',
  '/platform',
  '/demo',
  '/pricing',
  '/testimonials',
  '/security',
  '/resources',
  '/resources/downloads',
  '/support',
  '/company',
  '/mission',
  '/careers',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
  '/legal/exercise-rights',
]);

function withParams(element: ReactNode, params: Record<string, string> = {}) {
  return <RouteParamsProvider params={params}>{element}</RouteParamsProvider>;
}

function AppRoute() {
  const location = useLocation();
  const pathname = location.pathname === '/' ? '/' : location.pathname.replace(/\/+$/, '');

  if (pathname === '/login') return <LoginRoute />;
  if (pathname === '/auth/callback') return <AuthCallbackPage />;

  const trackingParams = matchPath('/track/:token', pathname);
  if (trackingParams) return withParams(<PublicTrackingPage />, trackingParams);

  if (publicSitePaths.has(pathname) || matchPath('/platform/:workflow', pathname)) {
    return <PublicLaunchPage />;
  }

  if (pathname === '/driver') {
    return <DriverLayout>{withParams(<DriverWorkspacePage />)}</DriverLayout>;
  }
  if (pathname === '/driver/help') {
    return <DriverLayout>{withParams(<DriverHelpPage />)}</DriverLayout>;
  }
  const driverRouteParams = matchPath('/driver/route-runs/:id', pathname);
  if (driverRouteParams) {
    return <DriverLayout>{withParams(<DriverRouteRunPage />, driverRouteParams)}</DriverLayout>;
  }

  let protectedPage: ReactNode = null;
  let params: Record<string, string> = {};
  if (pathname === '/dashboard') protectedPage = <Dashboard />;
  else if (pathname === '/loads' || pathname === '/jobs') protectedPage = <JobsPageEnhancedV2 />;
  else if (pathname === '/routing' || pathname === '/routes' || pathname === '/planning') protectedPage = <RoutingWorkspacePage />;
  else if (pathname === '/dispatch' || pathname === '/messages') protectedPage = <DispatchBoardOpsPage />;
  else if (matchPath('/route-runs/:id', pathname)) {
    params = matchPath('/route-runs/:id', pathname) ?? {};
    protectedPage = <RouteRunDetailPage />;
  } else if (pathname === '/exceptions') protectedPage = <ExceptionsQueuePage />;
  else if (pathname === '/tracking' || pathname === '/depots') protectedPage = <TrackingEnhanced />;
  else if (pathname === '/drivers') protectedPage = <DriversPage />;
  else if (pathname === '/vehicles' || pathname === '/assets') protectedPage = <VehiclesPage />;
  else if (pathname === '/customers') protectedPage = <CustomersPage />;
  else if (matchPath('/pod/*', pathname)) protectedPage = <ProofOfDeliveryPage />;
  else if (pathname === '/analytics') protectedPage = <AnalyticsPage />;
  else if (pathname === '/billing' || pathname === '/settings' || pathname === '/integrations') protectedPage = <SettingsPage />;
  else if (pathname === '/academy') protectedPage = <AcademyPage />;
  else if (matchPath('/academy/:moduleKey', pathname)) {
    params = matchPath('/academy/:moduleKey', pathname) ?? {};
    protectedPage = <AcademyPage />;
  }

  if (!protectedPage) return <Navigate to="/dashboard" replace />;
  return <ProtectedLayout>{withParams(protectedPage, params)}</ProtectedLayout>;
}

function App() {
  const routeFallback = (
    <Box sx={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={26} />
    </Box>
  );

  return (
    <Suspense fallback={routeFallback}>
      <AppRoute />
    </Suspense>
  );
}

export default App;
