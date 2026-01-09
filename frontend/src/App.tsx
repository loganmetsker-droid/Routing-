import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DriversPage from './pages/DriversPage';
import VehiclesPage from './pages/VehiclesPage';
import CustomersPage from './pages/CustomersPage';
import RoutingPage from './pages/RoutingPage';
import DispatchesPage from './pages/DispatchesPage';

// Improved dispatch workflow pages
import JobsPageImproved from './pages/JobsPageImproved';
import JobsPageEnhanced from './pages/JobsPageEnhanced';
import DispatchWorkflowPage from './pages/DispatchWorkflowPage';

import LoginPage from './pages/LoginPage';

// Legacy route pages (kept for backwards compatibility)
import RoutesPage from './pages/RoutesPage';
import RoutePlanningPage from './pages/RoutePlanningPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        {/* LATEST: Enhanced Jobs page with reassignment, batch actions, and filtering */}
        <Route path="jobs" element={<JobsPageEnhanced />} />
        {/* ALT: Basic improved version */}
        <Route path="jobs-basic" element={<JobsPageImproved />} />
        {/* NEW: Streamlined dispatch workflow */}
        <Route path="dispatch-workflow" element={<DispatchWorkflowPage />} />
        {/* Existing pages - keep for alternative workflows */}
        <Route path="routing" element={<RoutingPage />} />
        <Route path="dispatches" element={<DispatchesPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        {/* Legacy routes - redirect or keep for backwards compatibility */}
        <Route path="routes" element={<RoutesPage />} />
        <Route path="route-planning" element={<RoutePlanningPage />} />
      </Route>
    </Routes>
  );
}

export default App;
