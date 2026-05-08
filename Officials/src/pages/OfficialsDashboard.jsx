import { Scale, Truck, AlertTriangle, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import StatCard from '../components/dashboard/StatCard';
import PollutionChart from '../components/dashboard/PollutionChart';
import RecentAlerts from '../components/dashboard/RecentAlerts';
import BarangayRanking from '../components/dashboard/BarangayRanking';
import { stats, pollutionTrends, alerts, wasteByBarangay, barangays } from '../data/mockData';

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-xs font-bold text-slate-700">{label}</p>
      <p className="text-xs text-emerald-600 font-semibold">{payload[0].value.toLocaleString()} kg</p>
    </div>
  );
};

export default function OfficialsDashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Date Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Monday, May 5, 2025 · Week 19
          </p>
        </div>
        <button className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200">
          Generate Report <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Scale}
          title="Total Waste Collected"
          value={stats.totalCollected.value}
          trend={stats.totalCollected.change}
          trendDirection="up"
          subtitle="This month across all barangays"
          color="green"
        />
        <StatCard
          icon={Truck}
          title="Active Trucks"
          value={stats.activeTrucks.value}
          subtitle={stats.activeTrucks.label}
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          title="Critical Alerts"
          value={stats.criticalAlerts.value}
          subtitle={stats.criticalAlerts.label}
          color="red"
        />
        <StatCard
          icon={TrendingUp}
          title="Avg Collection Rate"
          value={stats.avgCollectionRate.value}
          trend={stats.avgCollectionRate.change}
          trendDirection="up"
          subtitle="vs. last month"
          color="green"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pollution Trends */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pollution Trends</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ammonia & methane levels — last 7 days</p>
            </div>
            <select className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>This Month</option>
            </select>
          </div>
          <PollutionChart data={pollutionTrends} />
        </div>

        {/* Waste by Barangay */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Waste by Barangay</h2>
              <p className="text-xs text-slate-500 mt-0.5">Top 5 barangays by collection weight</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={wasteByBarangay}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} width={65} />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {wasteByBarangay.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={index === 0 ? '#065f46' : index === 1 ? '#047857' : index === 2 ? '#059669' : index === 3 ? '#10b981' : '#34d399'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Alerts</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest pollution and collection events</p>
            </div>
            <button className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <RecentAlerts alerts={alerts} />
        </div>

        {/* Top Barangays */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Top Performing Barangays</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ranked by collection rate and efficiency</p>
            </div>
            <button className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
              Full rankings <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <BarangayRanking data={barangays} />
        </div>
      </div>
    </div>
  );
}
