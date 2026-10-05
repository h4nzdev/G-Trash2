import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ClipboardList,
  RefreshCw,
  Bell,
  MapPin,
  Target,
  CheckCircle,
  Smartphone,
  Users,
  Home,
  Megaphone,
  Trophy,
  Building2,
  Calendar,
} from 'lucide-react';
import API from '../../config';

const PURPOSE_META = {
  household: {
    label: 'Household Waste Tracking',
    icon: Home,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    barColor: 'bg-emerald-600',
  },
  reporting: {
    label: 'Community Issue Reporting',
    icon: Megaphone,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    barColor: 'bg-blue-600',
  },
  rewards: {
    label: 'Eco Rewards & Segregation',
    icon: Trophy,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    barColor: 'bg-amber-600',
  },
  commercial: {
    label: 'Commercial & Property',
    icon: Building2,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    barColor: 'bg-purple-600',
  },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function QuickSetupSurveyCard({ defaultBarangay = '' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [barangay, setBarangay] = useState(defaultBarangay);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period && period !== 'all') params.set('period', period);
      if (barangay && barangay !== 'All') params.set('barangay', barangay);
      const res = await axios.get(`${API}/api/survey/quick-setup/results?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.warn('Failed to load quick setup survey results:', err);
    } finally {
      setLoading(false);
    }
  }, [period, barangay]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const total = data?.total ?? 0;
  const notifications = data?.notifications ?? { enabled: 0, skipped: 0, optInRate: 0 };
  const byPurpose = data?.byPurpose ?? [];
  const byBarangay = data?.byBarangay ?? [];
  const recent = data?.recent ?? [];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Developer & Admin Survey
              </span>
              <span className="text-xs text-slate-400 font-medium">New User Quick Setup</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              G-Trash Onboarding & Area Purpose Results
            </h2>
          </div>
        </div>

        {/* Filter & Refresh Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            {[
              { key: 'all', label: 'All Time' },
              { key: 'month', label: 'This Month' },
              { key: 'week', label: 'This Week' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
                  period === p.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchResults}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Refresh survey results"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Completed Setups</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{total.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">Total residents onboarded</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Notif Opt-in</span>
            <Bell className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">{notifications.optInRate}%</p>
          <span className="text-[11px] text-slate-400">
            {notifications.enabled} granted / {notifications.skipped} skipped
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Top Barangay</span>
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg font-extrabold text-slate-900 truncate">
            {byBarangay[0]?.barangay || '—'}
          </p>
          <span className="text-[11px] text-slate-400">
            {byBarangay[0] ? `${byBarangay[0].count} users (${byBarangay[0].percentage}%)` : 'No data yet'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Top Purpose</span>
            <Target className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-sm font-extrabold text-slate-900 truncate">
            {PURPOSE_META[byPurpose[0]?.purpose]?.label || byPurpose[0]?.purpose || '—'}
          </p>
          <span className="text-[11px] text-slate-400">
            {byPurpose[0] ? `${byPurpose[0].count} selections (${byPurpose[0].percentage}%)` : 'No data yet'}
          </span>
        </div>
      </div>

      {total === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">No quick setup survey responses recorded yet</p>
          <p className="text-xs mt-1">Data will populate automatically as new residents complete the welcome tour.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purpose Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-600" /> App Usage Purpose Distribution
              </h3>
              <span className="text-xs text-slate-400 font-medium">Multi-selection allowed</span>
            </div>

            <div className="space-y-3">
              {['household', 'reporting', 'rewards', 'commercial'].map((pId) => {
                const meta = PURPOSE_META[pId];
                const found = byPurpose.find((p) => p.purpose === pId);
                const count = found?.count ?? 0;
                const pct = found?.percentage ?? 0;
                const Icon = meta.icon;

                return (
                  <div key={pId} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg border ${meta.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-slate-800">{meta.label}</span>
                      </div>
                      <span className="font-extrabold text-slate-900">
                        {count} <span className="text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${meta.barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Barangays List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" /> Top Registered Areas / Barangays
              </h3>
              <span className="text-xs text-slate-400 font-medium">Top zones onboarding</span>
            </div>

            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {byBarangay.map((b, idx) => (
                <div
                  key={b.barangay}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800">Barangay {b.barangay}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-medium">{b.count} users</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                      {b.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Onboarding Submissions Table */}
      {recent.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-500" /> Recent Setup Submissions (Latest 10)
            </h3>
            <span className="text-[11px] text-slate-400">Real-time sync from resident mobile app</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Barangay</th>
                  <th className="pb-2">Purposes Selected</th>
                  <th className="pb-2">Notifications</th>
                  <th className="pb-2">Platform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recent.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 text-slate-500">{timeAgo(item.submittedAt)}</td>
                    <td className="py-2.5 font-bold text-slate-800">Barangay {item.barangay}</td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {item.purposes?.map((p) => (
                          <span
                            key={p}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 capitalize"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5">
                      {item.notificationsEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3 h-3" /> Enabled
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Skipped</span>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-400 capitalize">{item.platform || 'mobile'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
