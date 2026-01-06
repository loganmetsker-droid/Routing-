import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DriversPage from './pages/DriversPage';
import VehiclesPage from './pages/VehiclesPage';
import CustomersPage from './pages/CustomersPage';
import RoutesPage from './pages/RoutesPage';
import DispatchesPage from './pages/DispatchesPage';
import JobsPage from './pages/JobsPage';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="dispatches" element={<DispatchesPage />} />
        <Route path="jobs" element={<JobsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
