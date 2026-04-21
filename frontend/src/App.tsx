import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DriversPage from './pages/DriversPage';
import VehiclesPage from './pages/VehiclesPage';
import CustomersPage from './pages/CustomersPage';
import JobsPageEnhancedV2 from './pages/JobsPageEnhancedV2';
import TrackingEnhanced from './pages/TrackingEnhanced';
import DispatchBoardOpsPage from './pages/DispatchBoardOpsPage';
import RoutingWorkspacePage from './pages/RoutingWorkspacePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import RouteRunDetailPage from './pages/RouteRunDetailPage';
import ExceptionsQueuePage from './pages/ExceptionsQueuePage';
import LoginPage from './pages/LoginPage';
import { clearAuthSession, isAuthenticated, validateSession } from './services/api';
import ErrorBoundary from './components/ui/ErrorBoundary';

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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
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
        <Route path="jobs-v1" element={<Navigate to="/jobs" replace />} />
        <Route path="jobs-basic" element={<Navigate to="/jobs" replace />} />
        <Route path="dispatch-workflow" element={<Navigate to="/dispatch" replace />} />
        <Route path="dispatch-workflow-v1" element={<Navigate to="/dispatch" replace />} />
        <Route path="dispatch-workflow-old" element={<Navigate to="/dispatch" replace />} />
        <Route path="dispatch-v1" element={<Navigate to="/dispatch" replace />} />
        <Route path="dispatches" element={<Navigate to="/dispatch" replace />} />
        <Route path="routing-global" element={<Navigate to="/routing" replace />} />
        <Route path="route-optimization" element={<Navigate to="/routing" replace />} />
        <Route path="routes-consolidated" element={<Navigate to="/routing" replace />} />
        <Route path="routes" element={<Navigate to="/routing" replace />} />
        <Route path="route-planning" element={<Navigate to="/routing" replace />} />
        <Route path="tracking-enhanced" element={<Navigate to="/tracking" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
