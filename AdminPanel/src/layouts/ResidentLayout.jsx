import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import ResidentSidebar from '../components/resident/ResidentSidebar';

export default function ResidentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <ResidentSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Minimal topbar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center px-5 shrink-0 z-10">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="mr-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Barangay Collection Route Tracker</h2>
            <p className="text-xs text-slate-400">Real-time truck tracking for Cebu City</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-500 font-medium">Live</span>
          </div>
        </header>

        {/* No padding — map fills the full remaining height */}
        <main className="flex-1 overflow-hidden min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
