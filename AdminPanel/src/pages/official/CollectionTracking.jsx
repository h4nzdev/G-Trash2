import { useState } from 'react';
import { Truck, CheckCircle2, Clock, AlertTriangle, Fuel, MapPin, User } from 'lucide-react';
import StatusBadge from '../../components/shared/StatusBadge';
import ProgressBar from '../../components/shared/ProgressBar';
import { collectionSchedule, collectionHistory } from '../../data/mockData';

const tabs = ['Today', 'This Week', 'This Month'];

const statusColor = {
  'in-progress': { bar: 'border-l-blue-500',   bg: 'bg-blue-50' },
  'completed':   { bar: 'border-l-emerald-500', bg: 'bg-emerald-50' },
  'pending':     { bar: 'border-l-slate-300',   bg: 'bg-slate-50' },
  'delayed':     { bar: 'border-l-amber-500',   bg: 'bg-amber-50' },
};

const summary = [
  { label: 'Total Routes', value: 4, icon: Truck, color: 'text-slate-600', bg: 'bg-slate-100' },
  { label: 'Completed',    value: collectionSchedule.filter(r => r.status === 'completed').length,   icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'In Progress',  value: collectionSchedule.filter(r => r.status === 'in-progress').length, icon: Clock,        color: 'text-blue-600',    bg: 'bg-blue-50' },
  { label: 'Delayed',      value: collectionSchedule.filter(r => r.status === 'delayed').length,     icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50' },
];

export default function CollectionTracking() {
  const [activeTab, setActiveTab] = useState('Today');

  const totalKg = collectionSchedule.reduce((s, r) => s + r.wasteKg, 0);
  const totalStops = collectionSchedule.reduce((s, r) => s + r.stopsDone, 0);
  const totalStopsMax = collectionSchedule.reduce((s, r) => s + r.totalStops, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Collection Tracking</h1>
          <p className="text-slate-500 text-sm mt-1">Monitor all garbage routes and collector status for Barangay Lahug</p>
        </div>
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === tab ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summary.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Today's progress banner */}
      <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-40">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Daily Progress</span>
            <span className="text-sm font-semibold text-emerald-600">{totalStops}/{totalStopsMax} stops</span>
          </div>
          <ProgressBar value={totalStops} max={totalStopsMax} color="emerald" size="lg" />
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-xl font-bold text-slate-900">{totalKg} kg</p>
            <p className="text-xs text-slate-400">Collected today</p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{Math.round((totalStops / totalStopsMax) * 100)}%</p>
            <p className="text-xs text-slate-400">Completion rate</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-600">4</p>
            <p className="text-xs text-slate-400">Active routes</p>
          </div>
        </div>
      </div>

      {/* Collector Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Collector Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collectionSchedule.map(route => {
            const pct = route.totalStops > 0 ? Math.round((route.stopsDone / route.totalStops) * 100) : 0;
            const colors = statusColor[route.status] ?? statusColor['pending'];
            return (
              <div
                key={route.id}
                className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${colors.bar}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{route.collector}</p>
                      <p className="text-xs text-slate-400">{route.truck} · {route.route}</p>
                    </div>
                  </div>
                  <StatusBadge status={route.status} showDot />
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="bg-slate-50 rounded-xl py-2">
                    <p className="font-bold text-slate-900 text-sm">{route.wasteKg} kg</p>
                    <p className="text-xs text-slate-400">Collected</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl py-2">
                    <p className="font-bold text-slate-900 text-sm">{route.stopsDone}/{route.totalStops}</p>
                    <p className="text-xs text-slate-400">Stops</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl py-2">
                    <p className="font-bold text-slate-900 text-sm">{route.estEnd}</p>
                    <p className="text-xs text-slate-400">Est. End</p>
                  </div>
                </div>

                <ProgressBar value={route.stopsDone} max={route.totalStops} color="emerald" showLabel label="Route progress" />

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5" />
                    {route.currentLocation}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Fuel className="w-3.5 h-3.5" />
                    Fuel OK
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    Started {route.startTime}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collection History Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Collection History</h2>
          <button className="text-xs text-emerald-600 font-medium hover:underline">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Date', 'Routes', 'Waste Collected', 'Stops', 'Status'].map(col => (
                  <th key={col} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {collectionHistory.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3.5 text-sm font-medium text-slate-700">{row.date}</td>
                  <td className="px-6 py-3.5 text-sm text-slate-500">{row.routes} routes</td>
                  <td className="px-6 py-3.5 text-sm font-semibold text-emerald-600">{row.collected}</td>
                  <td className="px-6 py-3.5 text-sm text-slate-500">{row.stops}</td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={row.status} showDot />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
