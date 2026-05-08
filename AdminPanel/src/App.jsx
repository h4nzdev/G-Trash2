import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OfficialLayout from './layouts/OfficialLayout';
import OfficialDashboard from './pages/official/OfficialDashboard';
import CollectionTracking from './pages/official/CollectionTracking';
import BarangayReports from './pages/official/BarangayReports';
import LocalHeatmap from './pages/official/LocalHeatmap';
import NotificationsPage from './pages/official/NotificationsPage';
import OfficialSettings from './pages/official/OfficialSettings';
import ResidentLayout from './layouts/ResidentLayout';
import ResidentMap from './pages/resident/ResidentMap';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/official/dashboard" replace />} />

        {/* Official routes */}
        <Route path="/official" element={<OfficialLayout />}>
          <Route index element={<Navigate to="/official/dashboard" replace />} />
          <Route path="dashboard" element={<OfficialDashboard />} />
          <Route path="collection" element={<CollectionTracking />} />
          <Route path="reports" element={<BarangayReports />} />
          <Route path="heatmap" element={<LocalHeatmap />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<OfficialSettings />} />
        </Route>

        {/* Resident routes */}
        <Route path="/resident" element={<ResidentLayout />}>
          <Route index element={<Navigate to="/resident/map" replace />} />
          <Route path="map" element={<ResidentMap />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
