import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Truck, Users, ShieldAlert, Award, 
  TrendingUp, Activity, BarChart3, 
  Clock, MapPin, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import API from '../../config';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, reportsRes] = await Promise.all([
          axios.get(`${API}/api/admin/stats`),
          axios.get(`${API}/api/reports?limit=5`)
        ]);
        setStats(statsRes.data);
        setRecentReports(reportsRes.data.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const cards = [
    { title: 'Fleet Size', value: stats?.summary?.trucks || 0, icon: Truck, color: 'emerald' },
    { title: 'Active Reports', value: stats?.summary?.reports || 0, icon: ShieldAlert, color: 'amber' },
    { title: 'Officials', value: stats?.summary?.officials || 0, icon: Award, color: 'purple' },
    { title: 'System Health', value: '100%', icon: Activity, color: 'blue' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">City Overview</h2>
          <p className="text-sm text-slate-500 font-medium">Real-time waste management monitoring</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">Live System Monitoring</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          const colors = {
            emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            blue: 'bg-blue-50 text-blue-600 border-blue-100',
            purple: 'bg-purple-50 text-purple-600 border-purple-100',
            amber: 'bg-amber-50 text-amber-600 border-amber-100',
          };
          return (
            <div key={i} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${colors[card.color]} border group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <TrendingUp className="w-4 h-4 text-slate-300" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{card.title}</p>
                <h3 className="text-3xl font-black text-slate-900 mt-1">{card.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leaderboard Chart */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Barangay Performance</h3>
                <p className="text-xs text-slate-500 font-medium">Reports resolved per jurisdiction</p>
              </div>
              <BarChart3 className="w-5 h-5 text-slate-400" />
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.leaderboard || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#F8FAFC'}} 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                    {(stats?.leaderboard || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Incoming Reports</h3>
                <p className="text-xs text-slate-500 font-medium">Latest community submissions</p>
              </div>
              <Clock className="w-5 h-5 text-slate-400" />
            </div>

            <div className="space-y-4">
              {recentReports.length > 0 ? recentReports.map((report) => (
                <div key={report._id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors group">
                  <div className={`p-2.5 rounded-xl ${
                    report.status === 'resolved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {report.status === 'resolved' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{report.title}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{report.category}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full" />
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                        <MapPin className="w-3 h-3" />
                        {report.barangay || 'City-wide'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400 font-medium">No recent reports found.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Current #1 Ranking & Status */}
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl">
            <Activity className="absolute top-[-20px] right-[-20px] w-64 h-64 text-white/5 rotate-12" />
            
            <div className="relative z-10">
              <div className="bg-emerald-500 w-fit p-3 rounded-2xl shadow-lg shadow-emerald-500/20 mb-6">
                <Award className="w-8 h-8 text-white" />
              </div>
              
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Top Performing</p>
              <h3 className="text-4xl font-black mb-4">
                {stats?.leaderboard?.[0]?._id || 'Pending Data'}
              </h3>
              
              <div className="space-y-4 mt-8">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Resolution Rate</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[94%]" />
                    </div>
                    <span className="text-xs font-bold">94%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              Quick Actions
            </h4>
            <div className="grid grid-cols-1 gap-3">
              <button className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group">
                <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Broadcast Alert</p>
                <p className="text-[10px] text-slate-500 font-medium">Notify all barangay officials</p>
              </button>
              <button className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group">
                <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">Generate Report</p>
                <p className="text-[10px] text-slate-500 font-medium">Download city-wide weekly PDF</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
