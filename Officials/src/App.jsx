import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import OfficialsDashboard from './pages/OfficialsDashboard';
import RouteMonitoring from './pages/RouteMonitoring';
import FleetManagement from './pages/FleetManagement';
import RouteBuilder from './pages/RouteBuilder';
import BarangayPerformance from './pages/BarangayPerformance';
import ReportsManagement from './pages/ReportsManagement';
import HeatmapAnalytics from './pages/HeatmapAnalytics';
import WasteAnalytics from './pages/WasteAnalytics';
import CollectionHistory from './pages/CollectionHistory';
import Settings from './pages/Settings';
import ScheduleRoute from './pages/ScheduleRoute';
import RouteManager from './pages/RouteManager';
import DriverAnalytics from './pages/DriverAnalytics';
import RewardsManagement from './pages/RewardsManagement';
import DriverView from './pages/DriverView';

function ProtectedLayout() {
  const { official, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!official) return <Navigate to="/login" replace />;
  return <DashboardLayout />;
}

function ChdGuard({ children }) {
  const { official } = useAuth();
  const location = useLocation();
  if (official?.role === 'chd') {
    return <Navigate to="/dashboard" state={{ chdAccessDenied: true, from: location.pathname }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/driver" element={<DriverView />} />
          <Route path="/" element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<OfficialsDashboard />} />
            <Route path="routes" element={<ChdGuard><RouteMonitoring /></ChdGuard>} />
            <Route path="fleet" element={<ChdGuard><FleetManagement /></ChdGuard>} />
            <Route path="route-builder" element={<ChdGuard><RouteBuilder /></ChdGuard>} />
            <Route path="barangays" element={<ChdGuard><BarangayPerformance /></ChdGuard>} />
            <Route path="reports" element={<ReportsManagement />} />
            <Route path="heatmap" element={<HeatmapAnalytics />} />
            <Route path="waste-analytics" element={<WasteAnalytics />} />
            <Route path="history" element={<CollectionHistory />} />
            <Route path="settings" element={<ChdGuard><Settings /></ChdGuard>} />
            <Route path="schedule" element={<ChdGuard><ScheduleRoute /></ChdGuard>} />
            <Route path="route-manager" element={<ChdGuard><RouteManager /></ChdGuard>} />
            <Route path="fleet/:truckId" element={<ChdGuard><DriverAnalytics /></ChdGuard>} />
            <Route path="rewards" element={<ChdGuard><RewardsManagement /></ChdGuard>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
