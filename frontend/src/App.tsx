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
import JobsPageEnhancedV2 from './pages/JobsPageEnhancedV2';
import DispatchWorkflowPage from './pages/DispatchWorkflowPage';
import DispatchWorkflowCorrected from './pages/DispatchWorkflowCorrected';
import DispatchWorkflowEnhanced from './pages/DispatchWorkflowEnhanced';
import RouteOptimizationPage from './pages/RouteOptimizationPage';

// Phase 3: Consolidated Routes and Enhanced Tracking
import RoutesConsolidated from './pages/RoutesConsolidated';
import TrackingEnhanced from './pages/TrackingEnhanced';

// Phase 4: Unified Dispatch
import DispatchUnified from './pages/DispatchUnified';

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
        {/* LATEST V2: Enhanced Jobs page with batch actions, filters, and completed summary */}
        <Route path="jobs" element={<JobsPageEnhancedV2 />} />
        {/* ALT: Enhanced V1 */}
        <Route path="jobs-v1" element={<JobsPageEnhanced />} />
        {/* ALT: Basic improved version */}
        <Route path="jobs-basic" element={<JobsPageImproved />} />
        {/* LATEST: Enhanced dispatch workflow with session storage & preview metrics */}
        <Route path="dispatch-workflow" element={<DispatchWorkflowEnhanced />} />
        {/* ALT: Corrected workflow (kept for reference) */}
        <Route path="dispatch-workflow-v1" element={<DispatchWorkflowCorrected />} />
        {/* ALT: Original workflow (kept for reference) */}
        <Route path="dispatch-workflow-old" element={<DispatchWorkflowPage />} />
        {/* NEW: Enhanced Route Optimization with drag-and-drop */}
        <Route path="route-optimization" element={<RouteOptimizationPage />} />
        {/* PHASE 3: Consolidated Routes (replaces route-optimization + routing) */}
        <Route path="routes-consolidated" element={<RoutesConsolidated />} />
        {/* PHASE 3: Enhanced Tracking with real-time updates and alerts */}
        <Route path="tracking-enhanced" element={<TrackingEnhanced />} />
        {/* Active Tracking page */}
        <Route path="tracking" element={<TrackingEnhanced />} />
        {/* PHASE 4: Unified Dispatch (single page for assign → optimize → dispatch) */}
        <Route path="dispatch" element={<DispatchUnified />} />
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
