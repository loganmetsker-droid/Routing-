import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DriversPage from './pages/DriversPage';
import VehiclesPage from './pages/VehiclesPage';
import CustomersPage from './pages/CustomersPage';
import JobsPageEnhancedV2 from './pages/JobsPageEnhancedV2';
import TrackingEnhanced from './pages/TrackingEnhanced';

import DispatchUnifiedV2 from './pages/DispatchUnifiedV2';

import LoginPage from './pages/LoginPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="jobs" element={<JobsPageEnhancedV2 />} />
        <Route path="dispatch" element={<DispatchUnifiedV2 />} />
        <Route path="tracking" element={<TrackingEnhanced />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="customers" element={<CustomersPage />} />

        {/* Backward-compatible redirects from legacy pages */}
        <Route path="jobs-v1" element={<Navigate to="/jobs" replace />} />
        <Route path="jobs-basic" element={<Navigate to="/jobs" replace />} />
        <Route path="dispatch-workflow" element={<Navigate to="/dispatch" replace />} />
        <Route path="dispatch-workflow-v1" element={<Navigate to="/dispatch" replace />} />
        <Route path="dispatch-workflow-old" element={<Navigate to="/dispatch" replace />} />
        <Route path="dispatch-v1" element={<Navigate to="/dispatch" replace />} />
        <Route path="dispatches" element={<Navigate to="/dispatch" replace />} />
        <Route path="routing" element={<Navigate to="/dispatch" replace />} />
        <Route path="routing-global" element={<Navigate to="/dispatch" replace />} />
        <Route path="route-optimization" element={<Navigate to="/dispatch" replace />} />
        <Route path="routes-consolidated" element={<Navigate to="/dispatch" replace />} />
        <Route path="routes" element={<Navigate to="/dispatch" replace />} />
        <Route path="route-planning" element={<Navigate to="/dispatch" replace />} />
        <Route path="tracking-enhanced" element={<Navigate to="/tracking" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
