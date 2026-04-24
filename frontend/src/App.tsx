import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Layout from './components/Layout';
import { clearAuthSession, isAuthenticated, validateSession } from './services/api';
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
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const RouteRunDetailPage = lazy(() => import('./pages/RouteRunDetailPage'));
const ExceptionsQueuePage = lazy(() => import('./pages/ExceptionsQueuePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const DriverWorkspacePage = lazy(() => import('./pages/DriverWorkspacePage'));
const DriverRouteRunPage = lazy(() => import('./pages/DriverRouteRunPage'));
const PublicTrackingPage = lazy(() => import('./pages/PublicTrackingPage'));

function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!isAuthenticated()) {
        if (!cancelled) {
          setValid(false);
          setChecking(false);
        }
        return;
      }

      const ok = await validateSession();
      if (!cancelled) {
        setValid(ok);
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

  return <>{children}</>;
}

function ProtectedLayout() {
  return (
    <AuthGate>
      <ErrorBoundary
        title="Workspace Failed To Render"
        message="The operator shell hit a rendering problem. Reload to recover and check the desktop or browser logs if this repeats."
      >
        <Layout />
      </ErrorBoundary>
    </AuthGate>
  );
}

function LoginRoute() {
  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return <LoginPage />;
}

function DriverLayout() {
  return (
    <AuthGate>
      <ErrorBoundary
        title="Driver Workspace Failed To Render"
        message="The driver workspace hit a rendering problem. Reload to recover and inspect the current runtime if it repeats."
      >
        <Outlet />
      </ErrorBoundary>
    </AuthGate>
  );
}

function App() {
  const routeFallback = (
    <Box sx={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={26} />
    </Box>
  );

  return (
    <Suspense fallback={routeFallback}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/track/:token" element={<PublicTrackingPage />} />
        <Route path="/driver" element={<DriverLayout />}>
          <Route index element={<DriverWorkspacePage />} />
          <Route path="route-runs/:id" element={<DriverRouteRunPage />} />
        </Route>
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="jobs" element={<JobsPageEnhancedV2 />} />
          <Route path="routing" element={<RoutingWorkspacePage />} />
          <Route path="dispatch" element={<DispatchBoardOpsPage />} />
          <Route path="route-runs/:id" element={<RouteRunDetailPage />} />
          <Route path="exceptions" element={<ExceptionsQueuePage />} />
          <Route path="tracking" element={<TrackingEnhanced />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
