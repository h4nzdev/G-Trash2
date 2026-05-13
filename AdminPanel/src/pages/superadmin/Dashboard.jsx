import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Truck, Users, ShieldAlert, Award, 
  TrendingUp, Activity, BarChart3, 
  Clock, MapPin, CheckCircle2, AlertCircle,
  PieChart as PieIcon, LineChart as LineIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, PieChart, Pie
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
    { title: 'Registered Citizens', value: stats?.summary?.residents || 0, icon: Users, color: 'blue' },
    { title: 'Officials', value: stats?.summary?.officials || 0, icon: Award, color: 'purple' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">City Intelligence</h2>
          <p className="text-sm text-slate-500 font-medium">Monitoring Cebu City waste operations and community engagement</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">System Online</span>
          </div>
          <div className="px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-900/10">
            <span className="text-[10px] font-black uppercase tracking-widest">Resolution: {stats?.summary?.resolutionRate || 0}%</span>
          </div>
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
            <div key={i} className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-sm hover:shadow-xl transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3.5 rounded-2xl ${colors[card.color]} border group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-emerald-50 transition-colors">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{card.title}</p>
                <h3 className="text-3xl font-black text-slate-900 mt-1 tracking-tight">{card.value.toLocaleString()}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Trend Analytics */}
          <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Reporting Trends</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Daily community submissions (Last 7 Days)</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <LineIcon className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.trends || []}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F8FAFC" />
                  <XAxis 
                    dataKey="_id" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 700}} 
                    dy={10} 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { weekday: 'short' })}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 700}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 800, fontSize: 12}}
                    itemStyle={{color: '#10B981'}}
                  />
                  <Area type="monotone" dataKey="count" stroke="#10B981" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Barangay Performance */}
            <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Top Performers</h3>
                <BarChart3 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="space-y-4">
                {(stats?.leaderboard || []).map((b, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-300 w-4">#{i+1}</span>
                      <span className="text-sm font-bold text-slate-700">{b._id}</span>
                    </div>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{b.count} Resolved</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Waste Composition */}
            <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Composition</h3>
                <PieIcon className="w-4 h-4 text-slate-400" />
              </div>
              <div className="h-40 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.composition || []}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {(stats?.composition || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#10B981', '#3B82F6', '#F59E0B', '#EF4444'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-900 leading-none">
                    {stats?.composition?.[0]?.count || 0}
                  </span>
                  <span className="text-[8px] font-black text-slate-400 uppercase">Top Cat</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {(stats?.composition?.slice(0,3) || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: ['#10B981', '#3B82F6', '#F59E0B'][i % 3]}} />
                    <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]">{c._id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Analytics */}
        <div className="space-y-8">
          {/* Winner Card */}
          <div className="bg-slate-900 rounded-[48px] p-8 text-white relative overflow-hidden shadow-2xl">
            <Activity className="absolute top-[-20px] right-[-20px] w-64 h-64 text-white/5 rotate-12" />
            
            <div className="relative z-10">
              <div className="bg-emerald-500 w-fit p-4 rounded-2xl shadow-xl shadow-emerald-500/30 mb-8">
                <Award className="w-8 h-8 text-white" />
              </div>
              
              <p className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-2">City Champion</p>
              <h3 className="text-4xl font-black mb-4 tracking-tighter leading-tight">
                {stats?.leaderboard?.[0]?._id || 'Fetching...'}
              </h3>
              
              <div className="space-y-6 mt-10">
                <div className="p-5 bg-white/5 border border-white/10 rounded-[32px] backdrop-blur-md">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolution Efficiency</p>
                    <span className="text-xs font-black text-emerald-400">{stats?.summary?.resolutionRate || 0}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{width: `${stats?.summary?.resolutionRate || 0}%`}} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Feed */}
          <div className="bg-white border border-slate-100 p-8 rounded-[48px] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Activity</h3>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-6">
              {recentReports.length > 0 ? recentReports.map((report) => (
                <div key={report._id} className="flex gap-4 group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                    report.status === 'resolved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {report.status === 'resolved' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-slate-900 truncate leading-tight group-hover:text-emerald-700 transition-colors">{report.title}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Brgy. {report.barangay}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-6">
                  <p className="text-xs text-slate-400 font-bold uppercase">Waiting for data...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
