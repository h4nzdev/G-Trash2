import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import OfficialSidebar from '../components/official/OfficialSidebar';
import OfficialTopBar from '../components/official/OfficialTopBar';

export default function OfficialLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <OfficialSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <OfficialTopBar onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
