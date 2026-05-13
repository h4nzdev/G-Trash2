import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import CollectionHistory from './pages/CollectionHistory';
import Settings from './pages/Settings';
import ScheduleRoute from './pages/ScheduleRoute';
import RouteManager from './pages/RouteManager';

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<OfficialsDashboard />} />
            <Route path="routes" element={<RouteMonitoring />} />
            <Route path="fleet" element={<FleetManagement />} />
            <Route path="route-builder" element={<RouteBuilder />} />
            <Route path="barangays" element={<BarangayPerformance />} />
            <Route path="reports" element={<ReportsManagement />} />
            <Route path="heatmap" element={<HeatmapAnalytics />} />
            <Route path="history" element={<CollectionHistory />} />
            <Route path="settings" element={<Settings />} />
            <Route path="schedule" element={<ScheduleRoute />} />
            <Route path="route-manager" element={<RouteManager />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
