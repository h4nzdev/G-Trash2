import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/superadmin/Dashboard';
import Officials from './pages/superadmin/Officials';
import OfficialDetail from './pages/superadmin/OfficialDetail';
import MasterMap from './pages/superadmin/MasterMap';
import IoTSimulator from './pages/superadmin/IoTSimulator';
import BugReports from './pages/superadmin/BugReports';
import JurisdictionManager from './pages/superadmin/JurisdictionManager';
import Reports from './pages/superadmin/Reports';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Superadmin routes */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="officials" element={<Officials />} />
            <Route path="officials/:id" element={<OfficialDetail />} />
            <Route path="map" element={<MasterMap />} />
            <Route path="iot-simulator" element={<IoTSimulator />} />
            <Route path="reports" element={<Reports />} />
            <Route path="jurisdiction" element={<JurisdictionManager />} />
            <Route path="bugs" element={<BugReports />} />
            <Route path="settings" element={<div className="p-8 bg-white rounded-3xl border border-slate-200">Settings coming soon...</div>} />
          </Route>

          {/* Legacy routes - hidden for now */}
          <Route path="/official" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
